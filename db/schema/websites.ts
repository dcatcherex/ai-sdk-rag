import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";

// ── Website Builder ───────────────────────────────────────────────────────────

export const website = pgTable("website", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  templateSlug: text("template_slug").notNull(),
  status: text("status").notNull().default("draft"),
  siteDataJson: jsonb("site_data_json"),
  renderedHtmlKey: text("rendered_html_key"),
  renderedHtmlUrl: text("rendered_html_url"),
  pagesProjectName: text("pages_project_name"),
  pagesDeploymentId: text("pages_deployment_id"),
  liveUrl: text("live_url"),
  customDomain: text("custom_domain"),
  error: text("error"),
  generationCount: integer("generation_count").notNull().default(0),
  editCount: integer("edit_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index("website_userId_idx").on(t.userId),
  uniqueIndex("website_userId_slug_idx").on(t.userId, t.slug),
]);

export const websiteTemplate = pgTable("website_template", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  category: text("category").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  defaultSiteData: jsonb("default_site_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const websiteGenerationLog = pgTable("website_generation_log", {
  id: text("id").primaryKey(),
  websiteId: text("website_id").notNull().references(() => website.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  promptText: text("prompt_text").notNull(),
  modelId: text("model_id").notNull(),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  creditsDeducted: integer("credits_deducted").notNull().default(0),
  status: text("status").notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("website_gen_log_websiteId_idx").on(t.websiteId),
  index("website_gen_log_userId_idx").on(t.userId),
]);

export const websiteRelations = relations(website, ({ one, many }) => ({
  user: one(user, { fields: [website.userId], references: [user.id] }),
  generationLogs: many(websiteGenerationLog),
}));

export const websiteGenerationLogRelations = relations(websiteGenerationLog, ({ one }) => ({
  website: one(website, { fields: [websiteGenerationLog.websiteId], references: [website.id] }),
  user: one(user, { fields: [websiteGenerationLog.userId], references: [user.id] }),
}));
