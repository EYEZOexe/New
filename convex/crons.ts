import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "expire fixed-term subscriptions",
  { minutes: 5 },
  internal.payments.expireFixedTermSubscriptions,
  {},
);

export default crons;
