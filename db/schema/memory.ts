import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { brand } from "./brands";
import { chatMessage, chatThread } from "./chat";

export const memoryRecord = pgTable(
  "memory_record",
  {
    id: text("id").primaryKey(),
    scopeType: text("scope_type").notNull(),
    scopeId: text("scope_id").notNull(),
    memoryType: text("memory_type").notNull().default("shared_fact"),
    status: text("status").notNull().default("pending_review"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    category: text("category"),
    sourceType: text("source_type").notNull().default("manual"),
    sourceThreadId: text("source_thread_id").references(() => chatThread.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    rejectedByUserId: text("rejected_by_user_id").references(() => user.id, { onDelete: "set null" }),
    confidence: integer("confidence").notNull().default(100),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    approvedAt: timestamp("approved_at"),
    rejectedAt: timestamp("rejected_at"),
    archivedAt: timestamp("archived_at"),
    lastReferencedAt: timestamp("last_referenced_at"),
  },
  (table) => [
    index("memory_record_scope_idx").on(table.scopeType, table.scopeId),
    index("memory_record_scope_status_idx").on(table.scopeType, table.scopeId, table.status),
    index("memory_record_type_idx").on(table.memoryType),
    index("memory_record_created_by_idx").on(table.createdByUserId),
    index("memory_record_source_thread_idx").on(table.sourceThreadId),
    index("memory_record_updated_at_idx").on(table.updatedAt),
  ],
);

export const threadWorkingMemory = pgTable(
  "thread_working_memory",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
    summary: text("summary").notNull().default(""),
    currentObjective: text("current_objective"),
    decisions: jsonb("decisions").default([]).notNull(),
    openQuestions: jsonb("open_questions").default([]).notNull(),
    importantContext: jsonb("important_context").default([]).notNull(),
    recentArtifacts: jsonb("recent_artifacts").default([]).notNull(),
    lastMessageId: text("last_message_id").references(() => chatMessage.id, { onDelete: "set null" }),
    refreshStatus: text("refresh_status").notNull().default("ready"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    refreshedAt: timestamp("refreshed_at"),
    clearedAt: timestamp("cleared_at"),
  },
  (table) => [
    uniqueIndex("thread_working_memory_thread_id_idx").on(table.threadId),
    index("thread_working_memory_brand_id_idx").on(table.brandId),
    index("thread_working_memory_refreshed_at_idx").on(table.refreshedAt),
  ],
);

export const memoryRecordRelations = relations(memoryRecord, ({ one }) => ({
  createdBy: one(user, {
    fields: [memoryRecord.createdByUserId],
    references: [user.id],
    relationName: "memory_record_created_by_user",
  }),
  approvedBy: one(user, {
    fields: [memoryRecord.approvedByUserId],
    references: [user.id],
    relationName: "memory_record_approved_by_user",
  }),
  rejectedBy: one(user, {
    fields: [memoryRecord.rejectedByUserId],
    references: [user.id],
    relationName: "memory_record_rejected_by_user",
  }),
  sourceThread: one(chatThread, {
    fields: [memoryRecord.sourceThreadId],
    references: [chatThread.id],
  }),
}));

export const threadWorkingMemoryRelations = relations(threadWorkingMemory, ({ one }) => ({
  thread: one(chatThread, {
    fields: [threadWorkingMemory.threadId],
    references: [chatThread.id],
  }),
  brand: one(brand, {
    fields: [threadWorkingMemory.brandId],
    references: [brand.id],
  }),
  lastMessage: one(chatMessage, {
    fields: [threadWorkingMemory.lastMessageId],
    references: [chatMessage.id],
  }),
}));
