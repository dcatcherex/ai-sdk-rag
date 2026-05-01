import { z } from "zod";

export const chatRunStatusSchema = z.enum(["pending", "success", "error"]);
export const chatRunRouteKindSchema = z.enum(["text", "image"]);
export const chatRunRoutingModeSchema = z.enum(["manual", "auto"]);

export const chatRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const chatRunsSummaryItemSchema = z.object({
  key: z.string().min(1),
  count: z.number().int().nonnegative(),
});

export const chatRunListItemSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  agentId: z.string().nullable(),
  brandId: z.string().nullable(),
  status: chatRunStatusSchema,
  routeKind: chatRunRouteKindSchema,
  requestedModelId: z.string().nullable(),
  resolvedModelId: z.string().nullable(),
  routingMode: chatRunRoutingModeSchema.nullable(),
  routingReason: z.string().nullable(),
  useWebSearch: z.boolean(),
  usedTools: z.boolean(),
  toolCallCount: z.number().int().nonnegative(),
  creditCost: z.number().int().nullable(),
  totalTokens: z.number().int().nullable(),
  responseIntent: z.string().nullable(),
  responseFormats: z.array(z.string()),
  templateKey: z.string().nullable(),
  quickReplyCount: z.number().int().nonnegative(),
  escalationCreated: z.boolean(),
  renderFallbackUsed: z.boolean(),
  errorMessage: z.string().nullable(),
  createdAt: z.string().min(1),
  completedAt: z.string().nullable(),
});

export const chatRunsOverviewSchema = z.object({
  summary: z.object({
    totalRuns: z.number().int().nonnegative(),
    successCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    pendingCount: z.number().int().nonnegative(),
    byRouteKind: z.array(chatRunsSummaryItemSchema),
    byResolvedModel: z.array(chatRunsSummaryItemSchema),
    byRoutingMode: z.array(chatRunsSummaryItemSchema),
    byResponseIntent: z.array(chatRunsSummaryItemSchema),
  }),
  runs: z.array(chatRunListItemSchema),
});

export const chatRunDetailSchema = chatRunListItemSchema.extend({
  promptTokens: z.number().int().nullable(),
  completionTokens: z.number().int().nullable(),
  inputJson: z.record(z.string(), z.unknown()),
  outputJson: z.record(z.string(), z.unknown()).nullable(),
  startedAt: z.string().min(1),
});

export type ChatRunsQueryInput = z.infer<typeof chatRunsQuerySchema>;
