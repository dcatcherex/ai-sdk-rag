import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { brand } from "./brands";
import { contentPiece } from "./content";

// ── Content Piece Metrics ─────────────────────────────────────────────────────

export const contentPieceMetric = pgTable("content_piece_metric", {
  id: text("id").primaryKey(),
  contentPieceId: text("content_piece_id").notNull().references(() => contentPiece.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),        // "linkedin" | "twitter" | "email" | "blog" | "other"
  views: integer("views").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  engagement: integer("engagement").notNull().default(0),   // likes + shares + comments
  conversions: integer("conversions").notNull().default(0),
  ctr: real("ctr"),                            // click-through rate 0..1
  notes: text("notes"),
  measuredAt: timestamp("measured_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("metric_contentPieceId_idx").on(table.contentPieceId),
  index("metric_userId_idx").on(table.userId),
  index("metric_platform_idx").on(table.platform),
  index("metric_measuredAt_idx").on(table.measuredAt),
]);

// ── A/B Variants ──────────────────────────────────────────────────────────────

export const abVariant = pgTable("ab_variant", {
  id: text("id").primaryKey(),
  contentPieceId: text("content_piece_id").notNull().references(() => contentPiece.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  variantLabel: text("variant_label").notNull(),   // "A", "B", "C" …
  body: text("body").notNull(),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  isWinner: boolean("is_winner").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("ab_variant_contentPieceId_idx").on(table.contentPieceId),
  index("ab_variant_userId_idx").on(table.userId),
]);

// ── Distribution Records ───────────────────────────────────────────────────────

export const distributionRecord = pgTable("distribution_record", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  contentPieceId: text("content_piece_id").references(() => contentPiece.id, { onDelete: "set null" }),
  brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
  channel: text("channel").notNull(),          // "email" | "webhook" | "export" | "linkedin" | "twitter"
  status: text("status").notNull().default("pending"),  // "pending" | "sent" | "failed" | "cancelled"
  recipientCount: integer("recipient_count"),
  externalRef: text("external_ref"),           // message ID from Resend or external system
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("distribution_userId_idx").on(table.userId),
  index("distribution_contentPieceId_idx").on(table.contentPieceId),
  index("distribution_channel_idx").on(table.channel),
  index("distribution_status_idx").on(table.status),
]);

// ── Relations ─────────────────────────────────────────────────────────────────

export const contentPieceMetricRelations = relations(contentPieceMetric, ({ one }) => ({
  contentPiece: one(contentPiece, { fields: [contentPieceMetric.contentPieceId], references: [contentPiece.id] }),
  user: one(user, { fields: [contentPieceMetric.userId], references: [user.id] }),
}));

export const abVariantRelations = relations(abVariant, ({ one }) => ({
  contentPiece: one(contentPiece, { fields: [abVariant.contentPieceId], references: [contentPiece.id] }),
  user: one(user, { fields: [abVariant.userId], references: [user.id] }),
}));

export const distributionRecordRelations = relations(distributionRecord, ({ one }) => ({
  user: one(user, { fields: [distributionRecord.userId], references: [user.id] }),
  contentPiece: one(contentPiece, { fields: [distributionRecord.contentPieceId], references: [contentPiece.id] }),
  brand: one(brand, { fields: [distributionRecord.brandId], references: [brand.id] }),
}));
