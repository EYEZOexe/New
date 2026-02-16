import { ConvexRoleSyncClient } from "./convexRoleSyncClient";
import { ConvexSignalMirrorClient } from "./convexSignalMirrorClient";
import { loadBotConfig } from "./config";
import { DiscordRoleManager } from "./discordRoleManager";
import { DiscordSignalMirrorManager } from "./discordSignalMirrorManager";
import { logError, logInfo, logWarn } from "./logger";

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
  const mirrorManager = new DiscordSignalMirrorManager(roleManager.discordClient);

  let shuttingDown = false;
  let roleTickInProgress = false;
  let mirrorTickInProgress = false;
  let roleTimer: ReturnType<typeof setInterval> | null = null;
  let mirrorTimer: ReturnType<typeof setInterval> | null = null;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (roleTimer) clearInterval(roleTimer);
    if (mirrorTimer) clearInterval(mirrorTimer);
    logInfo(`received ${signal}; shutting down`);
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
    `worker started role_poll_ms=${config.roleSyncPollIntervalMs} mirror_poll_ms=${config.mirrorPollIntervalMs} role_claim_limit=${config.roleSyncClaimLimit} mirror_claim_limit=${config.mirrorClaimLimit}`,
  );

  const processRoleTick = async () => {
    if (shuttingDown || roleTickInProgress) return 0;
    roleTickInProgress = true;
    let processed = 0;

    try {
      const jobs = await queueClient.claimJobs();
      processed = jobs.length;
      if (jobs.length > 0) {
        logInfo(`claimed ${jobs.length} role sync job(s)`);
      }
      for (const job of jobs) {
        if (shuttingDown) break;
        try {
          const result = await roleManager.executeJob(job);
          if (!result.ok) {
            logWarn(
              `job=${job.jobId} action=${job.action} discord_user=${job.discordUserId} failed: ${result.message}`,
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
            `job=${job.jobId} action=${job.action} discord_user=${job.discordUserId} success=${result.message}`,
          );
          await queueClient.completeJob({
            jobId: job.jobId,
            claimToken: job.claimToken,
            success: true,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logError(
            `job=${job.jobId} action=${job.action} discord_user=${job.discordUserId} exception=${message}`,
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
    } finally {
      roleTickInProgress = false;
      if (processed > 0 && !shuttingDown) {
        queueMicrotask(() => {
          void processRoleTick();
        });
      }
    }

    return processed;
  };

  const processMirrorTick = async () => {
    if (shuttingDown || mirrorTickInProgress) return 0;
    mirrorTickInProgress = true;
    let processed = 0;

    try {
      const mirrorJobs = await mirrorQueueClient.claimJobs();
      processed = mirrorJobs.length;
      if (mirrorJobs.length > 0) {
        logInfo(`claimed ${mirrorJobs.length} mirror job(s)`);
      }
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
            `mirror_job=${job.jobId} event=${job.eventType} source_message=${job.sourceMessageId} success=${result.message} latency_ms=${latencyMs}`,
          );
          await mirrorQueueClient.completeJob({
            jobId: job.jobId,
            claimToken: job.claimToken,
            success: true,
            mirroredMessageId: result.mirroredMessageId,
            mirroredGuildId: result.mirroredGuildId,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
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
    } finally {
      mirrorTickInProgress = false;
      if (processed > 0 && !shuttingDown) {
        queueMicrotask(() => {
          void processMirrorTick();
        });
      }
    }

    return processed;
  };

  roleTimer = setInterval(() => {
    void processRoleTick();
  }, config.roleSyncPollIntervalMs);
  mirrorTimer = setInterval(() => {
    void processMirrorTick();
  }, config.mirrorPollIntervalMs);

  await Promise.all([processMirrorTick(), processRoleTick()]);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logError(`fatal startup error: ${message}`);
  process.exit(1);
});
