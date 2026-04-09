import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "expire fixed-term subscriptions",
  { minutes: 5 },
  internal.payments.expireFixedTermSubscriptions,
  {},
);

crons.interval(
  "refresh workspace live feeds",
  { minutes: 2 },
  internal.workspace.refreshExternalWorkspaceFeeds,
  {},
);

// Temporarily disabled while self-hosted backend memory/query pressure is being
// stabilized. Retention cleanup can be re-enabled once operator paths and claim
// mutations are consistently staying under the isolate timeout budget.

export default crons;
