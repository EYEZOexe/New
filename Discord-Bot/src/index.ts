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
  let tickInProgress = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (timer) clearInterval(timer);
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
    `worker started poll_interval_ms=${config.pollIntervalMs} role_claim_limit=${config.roleSyncClaimLimit} mirror_claim_limit=${config.mirrorClaimLimit}`,
  );

  const tick = async () => {
    if (shuttingDown || tickInProgress) return;
    tickInProgress = true;

    try {
      const jobs = await queueClient.claimJobs();
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

      const mirrorJobs = await mirrorQueueClient.claimJobs();
      if (mirrorJobs.length > 0) {
        logInfo(`claimed ${mirrorJobs.length} mirror job(s)`);
      }
      for (const job of mirrorJobs) {
        if (shuttingDown) break;
        try {
          const result = await mirrorManager.executeJob(job);
          if (!result.ok) {
            logWarn(
              `mirror_job=${job.jobId} event=${job.eventType} source_message=${job.sourceMessageId} failed: ${result.message}`,
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
            `mirror_job=${job.jobId} event=${job.eventType} source_message=${job.sourceMessageId} success=${result.message}`,
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
      logError(`tick failed: ${message}`);
    } finally {
      tickInProgress = false;
    }
  };

  timer = setInterval(() => {
    void tick();
  }, config.pollIntervalMs);

  await tick();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  logError(`fatal startup error: ${message}`);
  process.exit(1);
});
