import { relations } from "drizzle-orm";
import { date, index, integer, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { chatThread } from "./chat";

export const toolRun = pgTable("tool_run", {
  id: text("id").primaryKey(),
  toolSlug: text("tool_slug").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  threadId: text("thread_id").references(() => chatThread.id, { onDelete: "set null" }),
  source: text("source").notNull(),
  inputJson: jsonb("input_json").notNull(),
  outputJson: jsonb("output_json"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("tool_run_userId_idx").on(table.userId),
  index("tool_run_toolSlug_idx").on(table.toolSlug),
  index("tool_run_threadId_idx").on(table.threadId),
]);

export const toolArtifact = pgTable("tool_artifact", {
  id: text("id").primaryKey(),
  toolRunId: text("tool_run_id").notNull().references(() => toolRun.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  format: text("format").notNull(),
  storageUrl: text("storage_url"),
  payloadJson: jsonb("payload_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("tool_artifact_runId_idx").on(table.toolRunId),
]);

export const workspaceAiRun = pgTable("workspace_ai_run", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  route: text("route").notNull(),
  status: text("status").notNull().default("pending"),
  modelId: text("model_id"),
  inputJson: jsonb("input_json").notNull(),
  outputJson: jsonb("output_json"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("workspace_ai_run_userId_idx").on(table.userId),
  index("workspace_ai_run_kind_idx").on(table.kind),
  index("workspace_ai_run_entityType_idx").on(table.entityType),
  index("workspace_ai_run_entityId_idx").on(table.entityId),
]);

export const activityRecord = pgTable("activity_record", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  contextType: text("context_type").notNull(),
  category: text("category"),
  entity: text("entity"),
  date: date("date").notNull(),
  activity: text("activity").notNull(),
  quantity: text("quantity"),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  income: numeric("income", { precision: 10, scale: 2 }),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("activity_record_userId_contextType_idx").on(table.userId, table.contextType),
  index("activity_record_userId_date_idx").on(table.userId, table.date),
  index("activity_record_entity_idx").on(table.entity),
]);

export const activityRecordRelations = relations(activityRecord, ({ one }) => ({
  user: one(user, { fields: [activityRecord.userId], references: [user.id] }),
}));

export const toolRunRelations = relations(toolRun, ({ one, many }) => ({
  user: one(user, { fields: [toolRun.userId], references: [user.id] }),
  thread: one(chatThread, { fields: [toolRun.threadId], references: [chatThread.id] }),
  artifacts: many(toolArtifact),
}));

export const workspaceAiRunRelations = relations(workspaceAiRun, ({ one }) => ({
  user: one(user, { fields: [workspaceAiRun.userId], references: [user.id] }),
}));

export const toolArtifactRelations = relations(toolArtifact, ({ one }) => ({
  toolRun: one(toolRun, { fields: [toolArtifact.toolRunId], references: [toolRun.id] }),
}));

export const brandPhoto = pgTable("brand_photo", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  brandId: text("brand_id"),
  lineUserId: text("line_user_id"),
  channelId: text("channel_id"),
  url: text("url").notNull(),
  r2Key: text("r2_key").notNull(),
  filename: text("filename"),
  tags: text("tags").array().notNull().default([]),
  usageCount: integer("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("brand_photo_userId_idx").on(table.userId),
  index("brand_photo_brandId_idx").on(table.brandId),
  index("brand_photo_lineUserId_channelId_idx").on(table.lineUserId, table.channelId),
]);

export const lineBrandDraft = pgTable("line_brand_draft", {
  id: text("id").primaryKey(),
  lineUserId: text("line_user_id").notNull(),
  channelId: text("channel_id").notNull(),
  field: text("field").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("line_brand_draft_lineUserId_channelId_idx").on(table.lineUserId, table.channelId),
]);
