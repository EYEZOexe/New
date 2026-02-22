import { describe, expect, it } from "bun:test";

import { evaluateSeatGate } from "../../convex/seatEnforcement";

describe("seat enforcement gate", () => {
  it("allows claims when enforcement is disabled", () => {
    const result = evaluateSeatGate({
      now: 1000,
      config: {
        seatEnforcementEnabled: false,
        seatLimit: 10,
      },
      snapshot: null,
    });

    expect(result).toEqual({
      action: "allow",
      reason: "enforcement_disabled",
    });
  });

  it("blocks claims when snapshot is over limit", () => {
    const result = evaluateSeatGate({
      now: 1000,
      config: {
        seatEnforcementEnabled: true,
        seatLimit: 10,
      },
      snapshot: {
        seatsUsed: 11,
        seatLimit: 10,
        isOverLimit: true,
        checkedAt: 950,
      },
    });

    expect(result).toEqual({
      action: "block",
      reason: "seat_limit_exceeded",
    });
  });

  it("marks stale snapshots as pending checks", () => {
    const result = evaluateSeatGate({
      now: 300_000,
      config: {
        seatEnforcementEnabled: true,
        seatLimit: 10,
      },
      snapshot: {
        seatsUsed: 3,
        seatLimit: 10,
        isOverLimit: false,
        checkedAt: 1000,
      },
      freshnessMs: 60_000,
    });

    expect(result).toEqual({
      action: "block",
      reason: "seat_check_pending",
    });
  });
});
