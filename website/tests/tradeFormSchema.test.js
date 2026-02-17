import { describe, expect, it } from "bun:test";

import { tradeFormSchema } from "../app/workspace/journal/lib/tradeFormSchema";

function buildBaseInput() {
  return {
    coin: "BTCUSDT",
    direction: "long",
    entryPrice: 67000,
    exitPrice: null,
    stopLoss: 66000,
    riskUsd: 250,
    takeProfits: [68000, 69000],
    pnlUsd: 0,
    leverage: "5x",
    setup: "Breakout",
    executionGrade: "A",
    status: "open",
    entryDate: "2026-02-17",
    exitDate: null,
    notes: "Test trade",
    tags: ["breakout"],
  };
}

describe("tradeFormSchema", () => {
  it("accepts a valid open trade payload", () => {
    const parsed = tradeFormSchema.safeParse(buildBaseInput());
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid direction and status values", () => {
    const parsed = tradeFormSchema.safeParse({
      ...buildBaseInput(),
      direction: "buy",
      status: "pending",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("direction");
      expect(paths).toContain("status");
    }
  });

  it("rejects negative numeric values", () => {
    const parsed = tradeFormSchema.safeParse({
      ...buildBaseInput(),
      entryPrice: -1,
      riskUsd: -10,
    });

    expect(parsed.success).toBe(false);
  });

  it("requires exit date for closed trades", () => {
    const parsed = tradeFormSchema.safeParse({
      ...buildBaseInput(),
      status: "closed",
      exitDate: "",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const hasExitDateIssue = parsed.error.issues.some((issue) => issue.path.join(".") === "exitDate");
      expect(hasExitDateIssue).toBe(true);
    }
  });
});

