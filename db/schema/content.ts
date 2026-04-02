import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { brand } from "./brands";

// ── Content Piece ─────────────────────────────────────────────────────────────

export const contentPiece = pgTable("content_piece", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
  contentType: text("content_type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  excerpt: text("excerpt"),
  status: text("status").notNull().default("draft"),
  channel: text("channel"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  parentId: text("parent_id").references((): AnyPgColumn => contentPiece.id, { onDelete: "set null" }),
  generatedByTeamRunId: text("generated_by_team_run_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("content_piece_userId_idx").on(table.userId),
  index("content_piece_brandId_idx").on(table.brandId),
  index("content_piece_status_idx").on(table.status),
  index("content_piece_parentId_idx").on(table.parentId),
]);

// ── Relations ─────────────────────────────────────────────────────────────────

export const contentPieceRelations = relations(contentPiece, ({ one, many }) => ({
  user: one(user, { fields: [contentPiece.userId], references: [user.id] }),
  brand: one(brand, { fields: [contentPiece.brandId], references: [brand.id] }),
  parent: one(contentPiece, {
    fields: [contentPiece.parentId],
    references: [contentPiece.id],
    relationName: "repurposed_from",
  }),
  repurposed: many(contentPiece, { relationName: "repurposed_from" }),
}));
