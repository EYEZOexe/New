import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export type ClaimedSignalMirrorJob = {
  jobId: string;
  claimToken: string;
  tenantKey: string;
  connectorId: string;
  sourceMessageId: string;
  sourceChannelId: string;
  sourceGuildId: string;
  targetChannelId: string;
  eventType: "create" | "update" | "delete";
  content: string;
  attachments: Array<{
    url: string;
    name?: string;
    contentType?: string;
    size?: number;
  }>;
  sourceCreatedAt: number;
  sourceEditedAt: number | null;
  sourceDeletedAt: number | null;
  attemptCount: number;
  maxAttempts: number;
  runAfter: number;
  createdAt: number;
  existingMirroredMessageId: string | null;
  existingMirroredExtraMessageIds: string[];
  existingMirroredGuildId: string | null;
};

const claimSignalMirrorJobsRef = makeFunctionReference<
  "mutation",
  { botToken: string; limit?: number; workerId?: string },
  ClaimedSignalMirrorJob[]
>("mirror:claimPendingSignalMirrorJobs");

const completeSignalMirrorJobRef = makeFunctionReference<
  "mutation",
  {
    botToken: string;
    jobId: string;
    claimToken: string;
    success: boolean;
    error?: string;
    mirroredMessageId?: string;
    mirroredExtraMessageIds?: string[];
    mirroredGuildId?: string;
  },
  {
    ok: boolean;
    ignored: boolean;
    reason?: "job_not_found" | "job_not_processing" | "claim_token_mismatch";
    status?: "completed" | "pending" | "failed";
  }
>("mirror:completeSignalMirrorJob");

export class ConvexSignalMirrorClient {
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

  async claimJobs(): Promise<ClaimedSignalMirrorJob[]> {
    return await this.client.mutation(claimSignalMirrorJobsRef, {
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
    mirroredMessageId?: string;
    mirroredExtraMessageIds?: string[];
    mirroredGuildId?: string;
  }): Promise<{
    ok: boolean;
    ignored: boolean;
    reason?: "job_not_found" | "job_not_processing" | "claim_token_mismatch";
    status?: "completed" | "pending" | "failed";
  }> {
    return await this.client.mutation(completeSignalMirrorJobRef, {
      botToken: this.botToken,
      jobId: args.jobId,
      claimToken: args.claimToken,
      success: args.success,
      error: args.error,
      mirroredMessageId: args.mirroredMessageId,
      mirroredExtraMessageIds: args.mirroredExtraMessageIds,
      mirroredGuildId: args.mirroredGuildId,
    });
  }
}
