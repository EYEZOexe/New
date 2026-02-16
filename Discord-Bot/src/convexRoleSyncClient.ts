import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type ClaimedRoleSyncJob = {
  jobId: string;
  claimToken: string;
  userId: string;
  discordUserId: string;
  guildId: string;
  roleId: string;
  action: "grant" | "revoke";
  attemptCount: number;
  maxAttempts: number;
  source: string | null;
  runAfter: number;
  createdAt: number;
};

const claimRoleSyncJobsRef = makeFunctionReference<
  "mutation",
  { botToken: string; limit?: number; workerId?: string },
  ClaimedRoleSyncJob[]
>("roleSync:claimPendingRoleSyncJobs");

const completeRoleSyncJobRef = makeFunctionReference<
  "mutation",
  {
    botToken: string;
    jobId: string;
    claimToken: string;
    success: boolean;
    error?: string;
  },
  {
    ok: boolean;
    ignored: boolean;
    reason?: "job_not_found" | "job_not_processing" | "claim_token_mismatch";
    status?: "completed" | "pending" | "failed";
  }
>("roleSync:completeRoleSyncJob");

export class ConvexRoleSyncClient {
  private readonly client: ConvexHttpClient;
  private readonly botToken: string;
  private readonly workerId: string;
  private readonly claimLimit: number;

  constructor(args: {
    convexUrl: string;
    botToken: string;
    workerId: string;
    claimLimit: number;
  }) {
    this.client = new ConvexHttpClient(args.convexUrl);
    this.botToken = args.botToken;
    this.workerId = args.workerId;
    this.claimLimit = args.claimLimit;
  }

  async claimJobs(): Promise<ClaimedRoleSyncJob[]> {
    return await this.client.mutation(claimRoleSyncJobsRef, {
      botToken: this.botToken,
      workerId: this.workerId,
      limit: this.claimLimit,
    });
  }

  async completeJob(args: {
    jobId: string;
    claimToken: string;
    success: boolean;
    error?: string;
  }): Promise<{
    ok: boolean;
    ignored: boolean;
    reason?: "job_not_found" | "job_not_processing" | "claim_token_mismatch";
    status?: "completed" | "pending" | "failed";
  }> {
    return await this.client.mutation(completeRoleSyncJobRef, {
      botToken: this.botToken,
      jobId: args.jobId,
      claimToken: args.claimToken,
      success: args.success,
      error: args.error,
    });
  }
}
