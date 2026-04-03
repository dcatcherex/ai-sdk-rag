import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { brand } from "./brands";
import { contentPiece } from "./content";

// ── Campaign Brief ─────────────────────────────────────────────────────────────

export const campaignBrief = pgTable("campaign_brief", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  goal: text("goal"),
  offer: text("offer"),
  keyMessage: text("key_message"),
  cta: text("cta"),
  channels: text("channels").array().notNull().default(sql`'{}'::text[]`),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("campaign_brief_userId_idx").on(table.userId),
  index("campaign_brief_brandId_idx").on(table.brandId),
  index("campaign_brief_status_idx").on(table.status),
]);

// ── Content Calendar Entry ─────────────────────────────────────────────────────

export const contentCalendarEntry = pgTable("content_calendar_entry", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
  campaignId: text("campaign_id").references(() => campaignBrief.id, { onDelete: "set null" }),
  contentPieceId: text("content_piece_id").references(() => contentPiece.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  contentType: text("content_type").notNull(),
  channel: text("channel"),
  status: text("status").notNull().default("idea"),
  plannedDate: text("planned_date").notNull(),
  notes: text("notes"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("calendar_entry_userId_idx").on(table.userId),
  index("calendar_entry_brandId_idx").on(table.brandId),
  index("calendar_entry_campaignId_idx").on(table.campaignId),
  index("calendar_entry_plannedDate_idx").on(table.plannedDate),
  index("calendar_entry_status_idx").on(table.status),
]);

// ── Relations ─────────────────────────────────────────────────────────────────

export const campaignBriefRelations = relations(campaignBrief, ({ one, many }) => ({
  user: one(user, { fields: [campaignBrief.userId], references: [user.id] }),
  brand: one(brand, { fields: [campaignBrief.brandId], references: [brand.id] }),
  calendarEntries: many(contentCalendarEntry),
}));

export const contentCalendarEntryRelations = relations(contentCalendarEntry, ({ one }) => ({
  user: one(user, { fields: [contentCalendarEntry.userId], references: [user.id] }),
  brand: one(brand, { fields: [contentCalendarEntry.brandId], references: [brand.id] }),
  campaign: one(campaignBrief, { fields: [contentCalendarEntry.campaignId], references: [campaignBrief.id] }),
  contentPiece: one(contentPiece, { fields: [contentCalendarEntry.contentPieceId], references: [contentPiece.id] }),
}));
