import { ConvexRoleSyncClient } from "./convexRoleSyncClient";
import { ConvexSignalMirrorClient } from "./convexSignalMirrorClient";
import { loadBotConfig } from "./config";
import { DiscordRoleManager } from "./discordRoleManager";
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
  const mirrorManager = new DiscordSignalMirrorManager(roleManager.discordClient);

  let shuttingDown = false;
  let drainInFlight = false;
  let scheduledDrain: ReturnType<typeof setTimeout> | null = null;

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

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearScheduledDrain();
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
  });

  await roleManager.login(config.discordBotToken);
  logInfo(
    `worker started wake_fallback_min_ms=${config.queueWakeFallbackMinMs} wake_fallback_max_ms=${config.queueWakeFallbackMaxMs} role_claim_limit=${config.roleSyncClaimLimit} mirror_claim_limit=${config.mirrorClaimLimit}`,
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

  await runDrainLoop("startup");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logError(`fatal startup error: ${message}`);
  process.exit(1);
});
