import { ConvexBotPresenceClient } from "./convexBotPresenceClient";
import { ConvexRoleSyncClient } from "./convexRoleSyncClient";
import { ConvexSeatAuditClient } from "./convexSeatAuditClient";
import { ConvexSignalMirrorClient } from "./convexSignalMirrorClient";
import { loadBotConfig } from "./config";
import { DiscordMirrorOwnershipCache } from "./discordMirrorOwnershipCache";
import { DiscordRoleManager } from "./discordRoleManager";
import { DiscordSeatAuditManager } from "./discordSeatAuditManager";
import { DiscordSignalMirrorManager } from "./discordSignalMirrorManager";
import { logError, logInfo, logWarn } from "./logger";
import { QueueWakeClient } from "./queueWakeClient";

type WakeSource = "startup" | "realtime_update" | "fallback_tick";

async function main() {
  const config = loadBotConfig();
  const roleManager = new DiscordRoleManager();
  const queueClient = new ConvexRoleSyncClient({
    convexUrl: config.convexUrl,
    botToken: config.roleSyncBotToken,
    workerId: config.workerId,
    claimLimit: config.roleSyncClaimLimit,
  });
  const mirrorQueueClient = new ConvexSignalMirrorClient({
    convexUrl: config.convexUrl,
    botToken: config.mirrorBotToken,
    workerId: config.workerId,
    claimLimit: config.mirrorClaimLimit,
  });
  const wakeClient = new QueueWakeClient({
    convexUrl: config.convexUrl,
    botToken: config.queueWakeBotToken,
    fallbackMinMs: config.queueWakeFallbackMinMs,
    fallbackMaxMs: config.queueWakeFallbackMaxMs,
  });
  const seatAuditClient = new ConvexSeatAuditClient({
    convexUrl: config.convexUrl,
    botToken: config.queueWakeBotToken,
    workerId: config.workerId,
    claimLimit: config.seatAuditClaimLimit,
  });
  const botPresenceClient = new ConvexBotPresenceClient({
    convexUrl: config.convexUrl,
    botToken: config.queueWakeBotToken,
  });
  const mirrorOwnershipCache = new DiscordMirrorOwnershipCache();
  const mirrorManager = new DiscordSignalMirrorManager(roleManager.discordClient, {
    ownershipLookup: mirrorOwnershipCache,
  });
  const seatAuditManager = new DiscordSeatAuditManager(roleManager.discordClient);

  let shuttingDown = false;
  let drainInFlight = false;
  let scheduledDrain: ReturnType<typeof setTimeout> | null = null;
  let seatAuditTimer: ReturnType<typeof setInterval> | null = null;
  let guildSyncTimer: ReturnType<typeof setInterval> | null = null;
  let seatAuditInFlight = false;
  let guildSyncInFlight = false;

  const clearScheduledDrain = () => {
    if (scheduledDrain) {
      clearTimeout(scheduledDrain);
      scheduledDrain = null;
    }
  };

  const processRoleTick = async (wakeSource: WakeSource) => {
    if (shuttingDown) return 0;

    let processed = 0;
    try {
      const jobs = await queueClient.claimJobs();
      processed = jobs.length;
      logInfo(`wake=${wakeSource} queue=role claim_count=${jobs.length}`);
      for (const job of jobs) {
        if (shuttingDown) break;
        try {
          const result = await roleManager.executeJob(job);
          if (!result.ok) {
            logWarn(
              `role_job=${job.jobId} action=${job.action} discord_user=${job.discordUserId} failed=${result.message}`,
            );
            await queueClient.completeJob({
              jobId: job.jobId,
              claimToken: job.claimToken,
              success: false,
              error: result.message,
            });
            continue;
          }

          logInfo(
            `role_job=${job.jobId} action=${job.action} discord_user=${job.discordUserId} status=completed`,
          );
          await queueClient.completeJob({
            jobId: job.jobId,
            claimToken: job.claimToken,
            success: true,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(
            `role_job=${job.jobId} action=${job.action} discord_user=${job.discordUserId} exception=${message}`,
          );
          await queueClient.completeJob({
            jobId: job.jobId,
            claimToken: job.claimToken,
            success: false,
            error: message,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`role tick failed: ${message}`);
    }
    return processed;
  };

  const processMirrorTick = async (wakeSource: WakeSource) => {
    if (shuttingDown) return 0;

    let processed = 0;
    try {
      const mirrorJobs = await mirrorQueueClient.claimJobs();
      processed = mirrorJobs.length;
      logInfo(`wake=${wakeSource} queue=mirror claim_count=${mirrorJobs.length}`);
      for (const job of mirrorJobs) {
        if (shuttingDown) break;
        try {
          const result = await mirrorManager.executeJob(job);
          const baseEventAt =
            job.eventType === "update" && typeof job.sourceEditedAt === "number"
              ? job.sourceEditedAt
              : job.sourceCreatedAt;
          const latencyMs = Math.max(0, Date.now() - baseEventAt);
          if (!result.ok) {
            logWarn(
              `mirror_job=${job.jobId} event=${job.eventType} source_message=${job.sourceMessageId} failed=${result.message} latency_ms=${latencyMs}`,
            );
            await mirrorQueueClient.completeJob({
              jobId: job.jobId,
              claimToken: job.claimToken,
              success: false,
              error: result.message,
            });
            continue;
          }

          logInfo(
            `mirror_job=${job.jobId} event=${job.eventType} source_message=${job.sourceMessageId} status=completed latency_ms=${latencyMs}`,
          );
          await mirrorQueueClient.completeJob({
            jobId: job.jobId,
            claimToken: job.claimToken,
            success: true,
            mirroredMessageId: result.mirroredMessageId,
            mirroredExtraMessageIds: result.mirroredExtraMessageIds,
            mirroredGuildId: result.mirroredGuildId,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(
            `mirror_job=${job.jobId} event=${job.eventType} source_message=${job.sourceMessageId} exception=${message}`,
          );
          await mirrorQueueClient.completeJob({
            jobId: job.jobId,
            claimToken: job.claimToken,
            success: false,
            error: message,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`mirror tick failed: ${message}`);
    }
    return processed;
  };

  const scheduleNextWake = () => {
    if (shuttingDown) return;
    const next = wakeClient.getNextWakeDelay();
    const source: WakeSource = next.reason === "fallback" ? "fallback_tick" : "realtime_update";
    clearScheduledDrain();
    scheduledDrain = setTimeout(() => {
      scheduledDrain = null;
      void runDrainLoop(source);
    }, next.delayMs);
    logInfo(
      `wake schedule source=${source} delay_ms=${next.delayMs} reason=${next.reason}`,
    );
  };

  const runDrainLoop = async (wakeSource: WakeSource) => {
    if (shuttingDown || drainInFlight) return;
    drainInFlight = true;
    clearScheduledDrain();

    try {
      logInfo(`wake triggered source=${wakeSource}`);
      for (;;) {
        if (shuttingDown) break;
        const [mirrorProcessed, roleProcessed] = await Promise.all([
          processMirrorTick(wakeSource),
          processRoleTick(wakeSource),
        ]);
        const totalProcessed = mirrorProcessed + roleProcessed;
        if (totalProcessed === 0) break;
        if (shuttingDown) break;
      }
    } finally {
      drainInFlight = false;
      scheduleNextWake();
    }
  };

  const completeSeatAuditJobSafely = async (args: {
    jobId: string;
    claimToken: string;
    success: boolean;
    seatsUsed?: number;
    seatLimit?: number;
    checkedAt?: number;
    error?: string;
  }) => {
    try {
      const completion = await seatAuditClient.completeJob(args);
      logInfo(
        `seat_audit_job=${args.jobId} completion_status=${completion.status ?? "none"} ignored=${completion.ignored} reason=${completion.reason ?? "none"}`,
      );
      return completion;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`seat_audit_job=${args.jobId} complete_exception=${message}`);
      return null;
    }
  };

  const runSeatAuditTick = async () => {
    if (shuttingDown || seatAuditInFlight) return;
    seatAuditInFlight = true;
    try {
      const jobs = await seatAuditClient.claimJobs();
      if (jobs.length > 0) {
        logInfo(`queue=seat-audit claim_count=${jobs.length}`);
      }
      for (const job of jobs) {
        if (shuttingDown) break;
        try {
          const result = await seatAuditManager.executeJob(job);
          if (!result.ok) {
            logWarn(
              `seat_audit_job=${job.jobId} guild=${job.guildId} failed=${result.message}`,
            );
            await completeSeatAuditJobSafely({
              jobId: job.jobId,
              claimToken: job.claimToken,
              success: false,
              error: result.message,
            });
            continue;
          }

          logInfo(
            `seat_audit_job=${job.jobId} guild=${job.guildId} status=completed seats_used=${result.seatsUsed ?? -1} seat_limit=${result.seatLimit ?? -1}`,
          );
          await completeSeatAuditJobSafely({
            jobId: job.jobId,
            claimToken: job.claimToken,
            success: true,
            seatsUsed: result.seatsUsed,
            seatLimit: result.seatLimit,
            checkedAt: result.checkedAt,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logError(`seat_audit_job=${job.jobId} guild=${job.guildId} exception=${message}`);
          await completeSeatAuditJobSafely({
            jobId: job.jobId,
            claimToken: job.claimToken,
            success: false,
            error: message,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`seat audit tick failed: ${message}`);
    } finally {
      seatAuditInFlight = false;
    }
  };

  const runGuildSyncTick = async () => {
    if (shuttingDown || guildSyncInFlight) return;
    guildSyncInFlight = true;
    try {
      const guildList = roleManager.discordClient.guilds.cache.map((guild) => guild);
      const guilds = guildList.map((guild) => ({
        guildId: guild.id,
        name: guild.name,
        icon: guild.icon ?? undefined,
      }));
      const guildSyncResult = await botPresenceClient.syncGuilds(guilds);
      let channelUpserted = 0;
      let channelDeactivated = 0;
      let channelFailures = 0;
      let roleUpserted = 0;
      let roleDeactivated = 0;
      let roleFailures = 0;
      const roleSnapshots: Array<{ guildId: string; roleIds: string[] }> = [];

      for (const guild of guildList) {
        try {
          const fetchedChannels = await guild.channels.fetch();
          const syncableChannels: Array<{
            channelId: string;
            name: string;
            type?: number;
            parentId?: string;
            position?: number;
          }> = [];
          for (const maybeChannel of fetchedChannels.values()) {
            if (!maybeChannel) continue;
            if (!maybeChannel.isTextBased()) continue;
            const channelId = maybeChannel.id?.trim();
            if (!channelId) continue;
            const maybePosition = (maybeChannel as { position?: unknown }).position;
            const name =
              typeof maybeChannel.name === "string" && maybeChannel.name.trim()
                ? maybeChannel.name.trim()
                : channelId;
            syncableChannels.push({
              channelId,
              name,
              type:
                typeof maybeChannel.type === "number" ? maybeChannel.type : undefined,
              parentId:
                typeof maybeChannel.parentId === "string"
                  ? maybeChannel.parentId
                  : undefined,
              position: typeof maybePosition === "number" ? maybePosition : undefined,
            });
          }

          const channelSyncResult = await botPresenceClient.syncGuildChannels({
            guildId: guild.id,
            channels: syncableChannels,
          });
          channelUpserted += channelSyncResult.upserted;
          channelDeactivated += channelSyncResult.deactivated;
        } catch (error) {
          channelFailures += 1;
          const message = error instanceof Error ? error.message : String(error);
          logWarn(`guild channel sync failed guild=${guild.id} error=${message}`);
        }

        try {
          const fetchedRoles = await guild.roles.fetch();
          const syncableRoles: Array<{
            roleId: string;
            name: string;
            position?: number;
            managed?: boolean;
            mentionable?: boolean;
            hoist?: boolean;
          }> = [];
          const roleIds: string[] = [];
          for (const maybeRole of fetchedRoles.values()) {
            if (!maybeRole) continue;
            const roleId = maybeRole.id?.trim();
            if (!roleId) continue;
            roleIds.push(roleId);
            const roleName =
              typeof maybeRole.name === "string" && maybeRole.name.trim()
                ? maybeRole.name.trim()
                : roleId;
            syncableRoles.push({
              roleId,
              name: roleName,
              position:
                typeof maybeRole.position === "number" ? maybeRole.position : undefined,
              managed:
                typeof maybeRole.managed === "boolean" ? maybeRole.managed : undefined,
              mentionable:
                typeof maybeRole.mentionable === "boolean"
                  ? maybeRole.mentionable
                  : undefined,
              hoist: typeof maybeRole.hoist === "boolean" ? maybeRole.hoist : undefined,
            });
          }

          const roleSyncResult = await botPresenceClient.syncGuildRoles({
            guildId: guild.id,
            roles: syncableRoles,
          });
          roleUpserted += roleSyncResult.upserted;
          roleDeactivated += roleSyncResult.deactivated;
          roleSnapshots.push({
            guildId: guild.id,
            roleIds,
          });
        } catch (error) {
          roleFailures += 1;
          const message = error instanceof Error ? error.message : String(error);
          logWarn(`guild role sync failed guild=${guild.id} error=${message}`);
        }
      }

      mirrorOwnershipCache.applySnapshots({
        allGuildIds: guildList.map((guild) => guild.id),
        roleSnapshots,
      });
      const ownershipStats = mirrorOwnershipCache.getStats();

      logInfo(
        `guild_sync total=${guildSyncResult.total} upserted=${guildSyncResult.upserted} deactivated=${guildSyncResult.deactivated} channels_upserted=${channelUpserted} channels_deactivated=${channelDeactivated} channel_failures=${channelFailures} roles_upserted=${roleUpserted} roles_deactivated=${roleDeactivated} role_failures=${roleFailures} known_guilds=${ownershipStats.knownGuildCount} known_roles=${ownershipStats.knownRoleCount}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`guild sync tick failed: ${message}`);
    } finally {
      guildSyncInFlight = false;
    }
  };

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearScheduledDrain();
    if (seatAuditTimer) {
      clearInterval(seatAuditTimer);
      seatAuditTimer = null;
    }
    if (guildSyncTimer) {
      clearInterval(guildSyncTimer);
      guildSyncTimer = null;
    }
    logInfo(`received ${signal}; shutting down`);
    await wakeClient.stop();
    await roleManager.destroy();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  roleManager.discordClient.once("ready", () => {
    logInfo(
      `discord ready user=${roleManager.discordClient.user?.tag ?? "unknown"} worker=${config.workerId}`,
    );
    void runGuildSyncTick();
  });
  roleManager.discordClient.on("guildCreate", (guild) => {
    logInfo(`guild join detected guild=${guild.id} name=${guild.name}`);
    void runGuildSyncTick();
  });
  roleManager.discordClient.on("guildDelete", (guild) => {
    logInfo(`guild leave detected guild=${guild.id} name=${guild.name}`);
    void runGuildSyncTick();
  });
  roleManager.discordClient.on("roleCreate", (role) => {
    logInfo(`role create detected guild=${role.guild.id} role=${role.id}`);
    void runGuildSyncTick();
  });
  roleManager.discordClient.on("roleDelete", (role) => {
    logInfo(`role delete detected guild=${role.guild.id} role=${role.id}`);
    void runGuildSyncTick();
  });
  roleManager.discordClient.on("roleUpdate", (_oldRole, newRole) => {
    logInfo(`role update detected guild=${newRole.guild.id} role=${newRole.id}`);
    void runGuildSyncTick();
  });

  await roleManager.login(config.discordBotToken);
  logInfo(
    `worker started wake_fallback_min_ms=${config.queueWakeFallbackMinMs} wake_fallback_max_ms=${config.queueWakeFallbackMaxMs} role_claim_limit=${config.roleSyncClaimLimit} mirror_claim_limit=${config.mirrorClaimLimit} seat_audit_claim_limit=${config.seatAuditClaimLimit} seat_audit_poll_ms=${config.seatAuditPollIntervalMs} guild_sync_poll_ms=${config.botGuildSyncIntervalMs}`,
  );

  wakeClient.start({
    onWakeState: (state, source) => {
      logInfo(
        `wake update source=${source} mirror_ready=${state.mirror.pendingReady} mirror_next=${state.mirror.nextRunAfter ?? -1} role_ready=${state.role.pendingReady} role_next=${state.role.nextRunAfter ?? -1}`,
      );
      scheduleNextWake();
    },
    onConnectionHealthyChange: (healthy) => {
      logInfo(`wake connection healthy=${healthy}`);
      scheduleNextWake();
    },
    onError: (error) => {
      logWarn(`wake subscription error=${error.message}`);
      scheduleNextWake();
    },
  });

  seatAuditTimer = setInterval(() => {
    void runSeatAuditTick();
  }, config.seatAuditPollIntervalMs);
  void runSeatAuditTick();
  guildSyncTimer = setInterval(() => {
    void runGuildSyncTick();
  }, config.botGuildSyncIntervalMs);

  await runDrainLoop("startup");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logError(`fatal startup error: ${message}`);
  process.exit(1);
});
