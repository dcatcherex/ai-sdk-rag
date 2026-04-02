import { relations } from "drizzle-orm";
import { boolean, foreignKey, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { brand } from "./brands";

export const chatThread = pgTable(
  "chat_thread",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    preview: text("preview").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("chat_thread_userId_idx").on(table.userId)],
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    parts: jsonb("parts").notNull(),
    metadata: jsonb("metadata"),
    position: integer("position").notNull(),
    reaction: text("reaction"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("chat_message_thread_idx").on(table.threadId)],
);

export const tokenUsage = pgTable(
  "token_usage",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("token_usage_thread_idx").on(table.threadId)],
);

export const mediaAsset = pgTable(
  "media_asset",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    threadId: text("thread_id")
      .references(() => chatThread.id, { onDelete: "set null" }),
    messageId: text("message_id")
      .references(() => chatMessage.id, { onDelete: "set null" }),
    parentAssetId: text("parent_asset_id"),
    rootAssetId: text("root_asset_id"),
    version: integer("version").default(1).notNull(),
    editPrompt: text("edit_prompt"),
    type: text("type").notNull(),
    r2Key: text("r2_key").notNull(),
    url: text("url").notNull(),
    thumbnailKey: text("thumbnail_key"),
    thumbnailUrl: text("thumbnail_url"),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "media_asset_parent_fk",
      columns: [table.parentAssetId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
    index("media_asset_thread_idx").on(table.threadId),
    index("media_asset_message_idx").on(table.messageId),
    index("media_asset_user_idx").on(table.userId),
    index("media_asset_type_idx").on(table.type),
    index("media_asset_parent_idx").on(table.parentAssetId),
    index("media_asset_root_idx").on(table.rootAssetId),
  ]
);

export const chatThreadRelations = relations(chatThread, ({ many, one }) => ({
  messages: many(chatMessage),
  user: one(user, {
    fields: [chatThread.userId],
    references: [user.id],
  }),
}));

export const chatMessageRelations = relations(chatMessage, ({ one, many }) => ({
  thread: one(chatThread, {
    fields: [chatMessage.threadId],
    references: [chatThread.id],
  }),
  assets: many(mediaAsset),
}));

export const mediaAssetRelations = relations(mediaAsset, ({ one }) => ({
  user: one(user, {
    fields: [mediaAsset.userId],
    references: [user.id],
  }),
  thread: one(chatThread, {
    fields: [mediaAsset.threadId],
    references: [chatThread.id],
  }),
  message: one(chatMessage, {
    fields: [mediaAsset.messageId],
    references: [chatMessage.id],
  }),
}));

export const tokenUsageRelations = relations(tokenUsage, ({ one }) => ({
  thread: one(chatThread, {
    fields: [tokenUsage.threadId],
    references: [chatThread.id],
  }),
}));
