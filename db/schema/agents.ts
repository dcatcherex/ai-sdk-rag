import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import type { AgentStructuredBehavior } from "@/lib/agent-structured-behavior";
import type { McpServerConfig } from "@/features/agents/types";

import { user } from "./auth";
import { brand } from "./brands";

export const agent = pgTable("agent", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  structuredBehavior: jsonb("structured_behavior").$type<AgentStructuredBehavior>(),
  modelId: text("model_id"),
  enabledTools: text("enabled_tools").array().notNull().default(sql`'{}'::text[]`),
  documentIds: text("document_ids").array().notNull().default(sql`'{}'::text[]`),
  skillIds: text("skill_ids").array().notNull().default(sql`'{}'::text[]`),
  brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
  imageUrl: text("image_url"),
  isPublic: boolean("is_public").notNull().default(false),
  starterPrompts: text("starter_prompts").array().notNull().default(sql`'{}'::text[]`),
  isTemplate: boolean("is_template").notNull().default(false),
  templateId: text("template_id"),
  isDefault: boolean("is_default").notNull().default(false),
  catalogScope: text("catalog_scope").notNull().default("personal"),
  catalogStatus: text("catalog_status").notNull().default("draft"),
  managedByAdmin: boolean("managed_by_admin").notNull().default(false),
  cloneBehavior: text("clone_behavior").notNull().default("editable_copy"),
  updatePolicy: text("update_policy").notNull().default("notify"),
  lockedFields: text("locked_fields").array().notNull().default(sql`'{}'::text[]`),
  version: integer("version").notNull().default(1),
  sourceTemplateVersion: integer("source_template_version"),
  publishedAt: timestamp("published_at"),
  archivedAt: timestamp("archived_at"),
  changelog: text("changelog"),
  mcpServers: jsonb("mcp_servers").$type<McpServerConfig[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
}, (table) => [index("agent_userId_idx").on(table.userId)]);

export const agentRelations = relations(agent, ({ one, many }) => ({
  user: one(user, { fields: [agent.userId], references: [user.id] }),
  shares: many(agentShare),
}));

export const agentShare = pgTable("agent_share", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agent.id, { onDelete: "cascade" }),
  sharedWithUserId: text("shared_with_user_id").notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("agent_share_unique_idx").on(table.agentId, table.sharedWithUserId),
  index("agent_share_agentId_idx").on(table.agentId),
  index("agent_share_sharedWithUserId_idx").on(table.sharedWithUserId),
]);

export const agentShareRelations = relations(agentShare, ({ one }) => ({
  agent: one(agent, { fields: [agentShare.agentId], references: [agent.id] }),
  sharedWithUser: one(user, { fields: [agentShare.sharedWithUserId], references: [user.id] }),
}));

// ── Public Agent Share (shareable link for anonymous users) ───────────────────

export const publicAgentShare = pgTable("public_agent_share", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agent.id, { onDelete: "cascade" }),
  shareToken: text("share_token").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  guestMessageLimit: integer("guest_message_limit"),
  passwordHash: text("password_hash"),
  expiresAt: timestamp("expires_at"),
  maxUses: integer("max_uses"),
  creditLimit: integer("credit_limit"),
  creditsUsed: integer("credits_used").notNull().default(0),
  conversationCount: integer("conversation_count").notNull().default(0),
  shareCount: integer("share_count").notNull().default(0),
  welcomeMessage: text("welcome_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("public_agent_share_token_idx").on(table.shareToken),
  index("public_agent_share_agentId_idx").on(table.agentId),
]);

export const publicAgentShareRelations = relations(publicAgentShare, ({ one }) => ({
  agent: one(agent, { fields: [publicAgentShare.agentId], references: [agent.id] }),
}));

// ── Public Agent Share Events (analytics) ─────────────────────────────────────

export const publicAgentShareEvent = pgTable("public_agent_share_event", {
  id: text("id").primaryKey(),
  shareToken: text("share_token").notNull(),
  eventType: text("event_type").notNull(),
  sessionId: text("session_id"),
  firstMessage: text("first_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("pas_event_token_idx").on(table.shareToken),
  index("pas_event_created_idx").on(table.createdAt),
]);
