import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";

// ── Brands ───────────────────────────────────────────────────────────────────

export const brand = pgTable("brand", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  overview: text("overview"),
  websiteUrl: text("website_url"),
  industry: text("industry"),
  targetAudience: text("target_audience"),
  toneOfVoice: text("tone_of_voice").array().notNull().default(sql`'{}'::text[]`),
  brandValues: text("brand_values").array().notNull().default(sql`'{}'::text[]`),
  visualAesthetics: text("visual_aesthetics").array().notNull().default(sql`'{}'::text[]`),
  fonts: text("fonts").array().notNull().default(sql`'{}'::text[]`),
  colors: jsonb("colors").notNull().default(sql`'[]'::jsonb`),
  writingDos: text("writing_dos"),
  writingDonts: text("writing_donts"),
  // ── Strategy layer ────────────────────────────────────────────────────────
  positioningStatement: text("positioning_statement"),
  messagingPillars: text("messaging_pillars").array().notNull().default(sql`'{}'::text[]`),
  proofPoints: text("proof_points").array().notNull().default(sql`'{}'::text[]`),
  exampleHeadlines: text("example_headlines").array().notNull().default(sql`'{}'::text[]`),
  exampleRejections: text("example_rejections").array().notNull().default(sql`'{}'::text[]`),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("brand_userId_idx").on(table.userId)]);

// ── Brand ICP (Ideal Customer Profiles / Audience Personas) ──────────────────

export const brandIcp = pgTable("brand_icp", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull().references(() => brand.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ageRange: text("age_range"),
  jobTitles: text("job_titles").array().notNull().default(sql`'{}'::text[]`),
  painPoints: text("pain_points").array().notNull().default(sql`'{}'::text[]`),
  buyingTriggers: text("buying_triggers").array().notNull().default(sql`'{}'::text[]`),
  objections: text("objections").array().notNull().default(sql`'{}'::text[]`),
  channels: text("channels").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("brand_icp_brandId_idx").on(table.brandId)]);

export const brandAsset = pgTable("brand_asset", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull().references(() => brand.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  collection: text("collection"),
  title: text("title").notNull(),
  r2Key: text("r2_key").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes"),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("brand_asset_brandId_idx").on(table.brandId),
  index("brand_asset_kind_idx").on(table.kind),
]);

export const brandShare = pgTable("brand_share", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull().references(() => brand.id, { onDelete: "cascade" }),
  sharedWithUserId: text("shared_with_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("brand_share_unique_idx").on(table.brandId, table.sharedWithUserId),
  index("brand_share_brandId_idx").on(table.brandId),
  index("brand_share_userId_idx").on(table.sharedWithUserId),
]);

export const brandRelations = relations(brand, ({ one, many }) => ({
  user: one(user, { fields: [brand.userId], references: [user.id] }),
  assets: many(brandAsset),
  shares: many(brandShare),
  icps: many(brandIcp),
}));

export const brandAssetRelations = relations(brandAsset, ({ one }) => ({
  brand: one(brand, { fields: [brandAsset.brandId], references: [brand.id] }),
}));

export const brandShareRelations = relations(brandShare, ({ one }) => ({
  brand: one(brand, { fields: [brandShare.brandId], references: [brand.id] }),
  sharedWithUser: one(user, { fields: [brandShare.sharedWithUserId], references: [user.id] }),
}));

export const brandIcpRelations = relations(brandIcp, ({ one }) => ({
  brand: one(brand, { fields: [brandIcp.brandId], references: [brand.id] }),
}));
