import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

// ── Prompt Library ────────────────────────────────────────────────────────────

export const promptLibrary = pgTable("prompt_library", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  isPublic: boolean("is_public").notNull().default(false),
  isBuiltIn: boolean("is_built_in").notNull().default(false),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("prompt_library_userId_idx").on(table.userId)]);

export const promptLibraryRelations = relations(promptLibrary, ({ one }) => ({
  user: one(user, { fields: [promptLibrary.userId], references: [user.id] }),
}));
