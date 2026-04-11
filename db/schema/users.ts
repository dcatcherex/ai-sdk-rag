import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  memoryEnabled: boolean("memory_enabled").default(true).notNull(),
  memoryInjectEnabled: boolean("memory_inject_enabled").default(true).notNull(),
  memoryExtractEnabled: boolean("memory_extract_enabled").default(true).notNull(),
  promptEnhancementEnabled: boolean("prompt_enhancement_enabled").default(true).notNull(),
  followUpSuggestionsEnabled: boolean("follow_up_suggestions_enabled").default(true).notNull(),
  enabledToolIds: text("enabled_tool_ids").array(),
  pinnedWorkspaceItemIds: text("pinned_workspace_item_ids").array(),
  hiddenWorkspaceItemIds: text("hidden_workspace_item_ids").array(),
  rerankEnabled: boolean("rerank_enabled").default(false).notNull(),
  selectedVoice: text("selected_voice"),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const userMemory = pgTable("user_memory", {
  id: text("id").primaryKey(),
  /** Vaja account owner — null for unlinked LINE users (lineUserId will be set instead). */
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  /** LINE user ID owner — set for unlinked LINE users; cleared after account linking. */
  lineUserId: text("line_user_id"),
  category: text("category").notNull(),
  fact: text("fact").notNull(),
  sourceThreadId: text("source_thread_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("user_memory_userId_idx").on(table.userId),
  index("user_memory_lineUserId_idx").on(table.lineUserId),
]);

export const userModelPreference = pgTable("user_model_preference", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  enabledModelIds: text("enabled_model_ids").array().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const userModelPreferenceRelations = relations(userModelPreference, ({ one }) => ({
  user: one(user, {
    fields: [userModelPreference.userId],
    references: [user.id],
  }),
}));

export const userModelScore = pgTable(
  "user_model_score",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(),
    persona: text("persona").notNull(),
    thumbsUp: integer("thumbs_up").default(0).notNull(),
    thumbsDown: integer("thumbs_down").default(0).notNull(),
    score: integer("score").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index("user_model_score_userId_idx").on(table.userId),
    index("user_model_score_combo_idx").on(table.userId, table.modelId, table.persona),
  ]
);

export const userModelScoreRelations = relations(userModelScore, ({ one }) => ({
  user: one(user, { fields: [userModelScore.userId], references: [user.id] }),
}));
