import { z } from "zod";

export const tradeDirectionSchema = z.enum(["long", "short"]);
export const tradeStatusSchema = z.enum(["open", "closed"]);
export const tradeExecutionGradeSchema = z.enum(["A", "B", "C", "D"]);

const positiveNumber = z
  .number({ error: "Must be a number" })
  .finite()
  .positive("Must be greater than 0");

const nonNegativeNumber = z
  .number({ error: "Must be a number" })
  .finite()
  .nonnegative("Must be greater than or equal to 0");

export const tradeFormSchema = z
  .object({
    coin: z.string().trim().min(1, "Coin is required"),
    direction: tradeDirectionSchema,
    entryPrice: positiveNumber,
    exitPrice: positiveNumber.nullable().optional(),
    stopLoss: nonNegativeNumber,
    riskUsd: nonNegativeNumber,
    takeProfits: z.array(nonNegativeNumber).default([]),
    pnlUsd: z.number().finite().optional().default(0),
    leverage: z.string().trim().min(1, "Leverage is required"),
    setup: z.string().trim().min(1, "Setup is required"),
    executionGrade: tradeExecutionGradeSchema,
    status: tradeStatusSchema,
    entryDate: z.string().trim().min(1, "Entry date is required"),
    exitDate: z.string().trim().optional().nullable(),
    notes: z.string().trim().optional().default(""),
    tags: z.array(z.string().trim().min(1)).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.status === "closed" && !value.exitDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exitDate"],
        message: "Exit date is required for closed trades",
      });
    }

    if (value.status === "closed" && typeof value.exitPrice !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exitPrice"],
        message: "Exit price is required for closed trades",
      });
    }

    if (value.direction === "long" && value.stopLoss >= value.entryPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stopLoss"],
        message: "Long trades require stop loss below entry",
      });
    }

    if (value.direction === "short" && value.stopLoss <= value.entryPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stopLoss"],
        message: "Short trades require stop loss above entry",
      });
    }
  });

export type TradeFormInput = z.input<typeof tradeFormSchema>;
export type TradeFormValues = z.output<typeof tradeFormSchema>;
