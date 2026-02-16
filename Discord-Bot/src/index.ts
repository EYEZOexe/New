import { ConvexRoleSyncClient } from "./convexRoleSyncClient";
import { loadBotConfig } from "./config";
import { DiscordRoleManager } from "./discordRoleManager";
import { logError, logInfo, logWarn } from "./logger";

async function main() {
  const config = loadBotConfig();
  const roleManager = new DiscordRoleManager();
  const queueClient = new ConvexRoleSyncClient({
    convexUrl: config.convexUrl,
    botToken: config.roleSyncBotToken,
    workerId: config.workerId,
    claimLimit: config.claimLimit,
  });

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
    `worker started poll_interval_ms=${config.pollIntervalMs} claim_limit=${config.claimLimit}`,
  );

  const tick = async () => {
    if (shuttingDown || tickInProgress) return;
    tickInProgress = true;

    try {
      const jobs = await queueClient.claimJobs();
      if (jobs.length === 0) return;

      logInfo(`claimed ${jobs.length} role sync job(s)`);
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

