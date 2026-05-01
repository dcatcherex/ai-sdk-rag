import { relations, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { agent } from "./agents";
import { user } from "./auth";
import { brand } from "./brands";
import { connectedAccount } from "./integrations";

export const userTool = pgTable("user_tool", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  icon: text("icon").notNull().default("Wrench"),
  category: text("category").notNull().default("utilities"),
  executionType: text("execution_type").notNull(),
  visibility: text("visibility").notNull().default("private"),
  status: text("status").notNull().default("draft"),
  readOnly: boolean("read_only").notNull().default(true),
  requiresConfirmation: boolean("requires_confirmation").notNull().default(false),
  supportsAgent: boolean("supports_agent").notNull().default(true),
  supportsManualRun: boolean("supports_manual_run").notNull().default(true),
  latestVersion: integer("latest_version").notNull().default(0),
  activeVersion: integer("active_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("user_tool_userId_idx").on(table.userId),
  uniqueIndex("user_tool_owner_slug_idx").on(table.userId, table.slug),
  index("user_tool_status_idx").on(table.status),
]);

export const userToolVersion = pgTable("user_tool_version", {
  id: text("id").primaryKey(),
  toolId: text("tool_id").notNull().references(() => userTool.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  inputSchemaJson: jsonb("input_schema_json").notNull().default(sql`'[]'::jsonb`),
  outputSchemaJson: jsonb("output_schema_json").notNull().default(sql`'[]'::jsonb`),
  configJson: jsonb("config_json").notNull().default(sql`'{}'::jsonb`),
  changeSummary: text("change_summary"),
  isDraft: boolean("is_draft").notNull().default(true),
  createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_tool_version_unique_idx").on(table.toolId, table.version),
  index("user_tool_version_toolId_idx").on(table.toolId),
]);

export const userToolShare = pgTable("user_tool_share", {
  id: text("id").primaryKey(),
  toolId: text("tool_id").notNull().references(() => userTool.id, { onDelete: "cascade" }),
  sharedWithUserId: text("shared_with_user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("runner"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_tool_share_unique_idx").on(table.toolId, table.sharedWithUserId),
  index("user_tool_share_toolId_idx").on(table.toolId),
  index("user_tool_share_userId_idx").on(table.sharedWithUserId),
]);

export const userToolWorkspaceShare = pgTable("user_tool_workspace_share", {
  id: text("id").primaryKey(),
  toolId: text("tool_id").notNull().references(() => userTool.id, { onDelete: "cascade" }),
  brandId: text("brand_id").notNull().references(() => brand.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("runner"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("user_tool_workspace_share_unique_idx").on(table.toolId, table.brandId),
  index("user_tool_workspace_share_toolId_idx").on(table.toolId),
  index("user_tool_workspace_share_brandId_idx").on(table.brandId),
]);

export const agentUserToolAttachment = pgTable("agent_user_tool_attachment", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agent.id, { onDelete: "cascade" }),
  userToolId: text("user_tool_id").notNull().references(() => userTool.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("agent_user_tool_attachment_unique_idx").on(table.agentId, table.userToolId),
  index("agent_user_tool_attachment_agentId_idx").on(table.agentId),
  index("agent_user_tool_attachment_userToolId_idx").on(table.userToolId),
]);

export const userToolConnection = pgTable("user_tool_connection", {
  id: text("id").primaryKey(),
  toolId: text("tool_id").notNull().references(() => userTool.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  connectionType: text("connection_type").notNull(),
  connectedAccountId: text("connected_account_id"),
  secretRef: text("secret_ref"),
  configJson: jsonb("config_json").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  foreignKey({
    name: "user_tool_conn_account_fk",
    columns: [table.connectedAccountId],
    foreignColumns: [connectedAccount.id],
  }).onDelete("set null"),
  uniqueIndex("user_tool_connection_tool_key_idx").on(table.toolId, table.key),
  index("user_tool_connection_toolId_idx").on(table.toolId),
]);

export const userToolRelations = relations(userTool, ({ one, many }) => ({
  owner: one(user, { fields: [userTool.userId], references: [user.id] }),
  versions: many(userToolVersion),
  shares: many(userToolShare),
  workspaceShares: many(userToolWorkspaceShare),
  attachments: many(agentUserToolAttachment),
  connections: many(userToolConnection),
}));

export const userToolVersionRelations = relations(userToolVersion, ({ one }) => ({
  tool: one(userTool, { fields: [userToolVersion.toolId], references: [userTool.id] }),
  createdBy: one(user, { fields: [userToolVersion.createdByUserId], references: [user.id] }),
}));

export const userToolShareRelations = relations(userToolShare, ({ one }) => ({
  tool: one(userTool, { fields: [userToolShare.toolId], references: [userTool.id] }),
  sharedWithUser: one(user, { fields: [userToolShare.sharedWithUserId], references: [user.id] }),
}));

export const userToolWorkspaceShareRelations = relations(userToolWorkspaceShare, ({ one }) => ({
  tool: one(userTool, { fields: [userToolWorkspaceShare.toolId], references: [userTool.id] }),
  brand: one(brand, { fields: [userToolWorkspaceShare.brandId], references: [brand.id] }),
}));

export const agentUserToolAttachmentRelations = relations(agentUserToolAttachment, ({ one }) => ({
  agent: one(agent, { fields: [agentUserToolAttachment.agentId], references: [agent.id] }),
  tool: one(userTool, { fields: [agentUserToolAttachment.userToolId], references: [userTool.id] }),
}));

export const userToolConnectionRelations = relations(userToolConnection, ({ one }) => ({
  tool: one(userTool, { fields: [userToolConnection.toolId], references: [userTool.id] }),
  connectedAccount: one(connectedAccount, {
    fields: [userToolConnection.connectedAccountId],
    references: [connectedAccount.id],
  }),
}));
