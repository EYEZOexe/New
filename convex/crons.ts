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

crons.interval(
  "purge non-critical data (14d retention)",
  { hours: 24 * 14 },
  internal.retention.runFourteenDayRetention,
  {},
);

export default crons;
