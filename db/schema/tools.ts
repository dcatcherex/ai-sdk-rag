import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { chatThread } from "./chat";

// ── Tool Run / Artifact (unified tool execution persistence) ──────────────────

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

export const toolRunRelations = relations(toolRun, ({ one, many }) => ({
  user: one(user, { fields: [toolRun.userId], references: [user.id] }),
  thread: one(chatThread, { fields: [toolRun.threadId], references: [chatThread.id] }),
  artifacts: many(toolArtifact),
}));

export const toolArtifactRelations = relations(toolArtifact, ({ one }) => ({
  toolRun: one(toolRun, { fields: [toolArtifact.toolRunId], references: [toolRun.id] }),
}));
