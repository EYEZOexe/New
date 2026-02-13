import { z } from "zod";

/**
 * Shared domain types.
 * Keep this package framework-agnostic.
 */

export const signalSchema = z.object({
  sourceMessageId: z.string().min(1),
  sourceChannelId: z.string().min(1),
  sourceThreadId: z.string().nullable().optional(),
  authorId: z.string().optional(),
  authorName: z.string().optional(),
  content: z.string().default(""),
  createdAt: z.string().datetime().optional(),
  editedAt: z.string().datetime().nullable().optional(),
  deletedAt: z.string().datetime().nullable().optional()
});

export type Signal = z.infer<typeof signalSchema>;
