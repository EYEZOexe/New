import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type ClaimedSeatAuditJob = {
  jobId: string;
  claimToken: string;
  tenantKey: string;
  connectorId: string;
  guildId: string;
  attemptCount: number;
  maxAttempts: number;
  source: string | null;
  runAfter: number;
  createdAt: number;
  seatLimit: number | null;
  seatEnforcementEnabled: boolean;
  targetChannelIds: string[];
};

const claimSeatAuditJobsRef = makeFunctionReference<
  "mutation",
  { botToken: string; limit?: number; workerId?: string },
  ClaimedSeatAuditJob[]
>("discordSeatAudit:claimPendingSeatAuditJobs");

const completeSeatAuditJobRef = makeFunctionReference<
  "mutation",
  {
    botToken: string;
    jobId: string;
    claimToken: string;
    success: boolean;
    seatsUsed?: number;
    seatLimit?: number;
    checkedAt?: number;
    error?: string;
  },
  {
    ok: boolean;
    ignored: boolean;
    reason?: "job_not_found" | "job_not_processing" | "claim_token_mismatch";
    status?: "completed" | "pending" | "failed";
  }
>("discordSeatAudit:completeSeatAuditJob");

export class ConvexSeatAuditClient {
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

  async claimJobs(): Promise<ClaimedSeatAuditJob[]> {
    return await this.client.mutation(claimSeatAuditJobsRef, {
      botToken: this.botToken,
      workerId: this.workerId,
      limit: this.claimLimit,
    });
  }

  async completeJob(args: {
    jobId: string;
    claimToken: string;
    success: boolean;
    seatsUsed?: number;
    seatLimit?: number;
    checkedAt?: number;
    error?: string;
  }): Promise<{
    ok: boolean;
    ignored: boolean;
    reason?: "job_not_found" | "job_not_processing" | "claim_token_mismatch";
    status?: "completed" | "pending" | "failed";
  }> {
    return await this.client.mutation(completeSeatAuditJobRef, {
      botToken: this.botToken,
      jobId: args.jobId,
      claimToken: args.claimToken,
      success: args.success,
      seatsUsed: args.seatsUsed,
      seatLimit: args.seatLimit,
      checkedAt: args.checkedAt,
      error: args.error,
    });
  }
}
