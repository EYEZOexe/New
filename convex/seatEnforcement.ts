export type SeatEnforcementConfig = {
  seatEnforcementEnabled: boolean;
  seatLimit: number;
};

export type SeatSnapshotState = {
  seatsUsed: number;
  seatLimit: number;
  isOverLimit: boolean;
  checkedAt: number;
};

export type SeatGateDecision =
  | { action: "allow"; reason: "enforcement_disabled" | "under_limit" }
  | { action: "block"; reason: "seat_check_pending" | "seat_limit_exceeded" };

const DEFAULT_FRESHNESS_MS = 90_000;

function isFiniteNonNegativeInt(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && Number.isInteger(value);
}

export function evaluateSeatGate(args: {
  now: number;
  config: SeatEnforcementConfig | null;
  snapshot: SeatSnapshotState | null;
  freshnessMs?: number;
}): SeatGateDecision {
  const config = args.config;
  if (!config || config.seatEnforcementEnabled !== true) {
    return {
      action: "allow",
      reason: "enforcement_disabled",
    };
  }

  if (!isFiniteNonNegativeInt(config.seatLimit)) {
    return {
      action: "block",
      reason: "seat_check_pending",
    };
  }

  const snapshot = args.snapshot;
  if (!snapshot) {
    return {
      action: "block",
      reason: "seat_check_pending",
    };
  }

  const freshnessMs =
    typeof args.freshnessMs === "number" && Number.isFinite(args.freshnessMs)
      ? Math.max(5_000, Math.min(15 * 60_000, args.freshnessMs))
      : DEFAULT_FRESHNESS_MS;

  const isFresh = args.now - snapshot.checkedAt <= freshnessMs;
  if (!isFresh) {
    return {
      action: "block",
      reason: "seat_check_pending",
    };
  }

  if (snapshot.isOverLimit || snapshot.seatsUsed > config.seatLimit) {
    return {
      action: "block",
      reason: "seat_limit_exceeded",
    };
  }

  return {
    action: "allow",
    reason: "under_limit",
  };
}
