import { relations, sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { brand } from "./brands";

// ── Content Marketing ─────────────────────────────────────────────────────────

export const socialPost = pgTable("social_post", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  caption: text("caption").notNull(),
  platforms: text("platforms").array().notNull(),
  platformOverrides: jsonb("platform_overrides").notNull().default(sql`'{}'::jsonb`),
  media: jsonb("media").notNull().default(sql`'[]'::jsonb`),
  status: text("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),
  brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("social_post_userId_idx").on(table.userId),
  index("social_post_status_idx").on(table.status),
  index("social_post_scheduledAt_idx").on(table.scheduledAt),
]);

/** Connected social accounts (Phase 2 — OAuth tokens) */
export const socialAccount = pgTable("social_account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(),
  platformAccountId: text("platform_account_id").notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("social_account_userId_idx").on(table.userId),
  index("social_account_platform_idx").on(table.platform),
]);

/** Cached trend data fetched from Apify — shared across all users */
export const trendCache = pgTable("trend_cache", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  industry: text("industry").notNull().default("all"),
  items: jsonb("items").notNull().default(sql`'[]'::jsonb`),
  weekKey: text("week_key").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
}, (table) => [
  index("trend_cache_platform_industry_idx").on(table.platform, table.industry),
  uniqueIndex("trend_cache_week_platform_industry_idx").on(table.weekKey, table.platform, table.industry),
]);

export const socialPostRelations = relations(socialPost, ({ one }) => ({
  user: one(user, { fields: [socialPost.userId], references: [user.id] }),
  brand: one(brand, { fields: [socialPost.brandId], references: [brand.id] }),
}));

export const socialAccountRelations = relations(socialAccount, ({ one }) => ({
  user: one(user, { fields: [socialAccount.userId], references: [user.id] }),
}));
