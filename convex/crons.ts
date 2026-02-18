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

export default crons;
