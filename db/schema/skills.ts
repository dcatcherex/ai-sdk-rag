import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { agent } from "./agents";

export const skillSource = pgTable("skill_source", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  repoOwner: text("repo_owner"),
  repoName: text("repo_name"),
  repoRef: text("repo_ref"),
  subdirPath: text("subdir_path"),
  defaultEntryPath: text("default_entry_path").notNull().default("SKILL.md"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("skill_source_canonicalUrl_idx").on(table.canonicalUrl),
  index("skill_source_sourceType_idx").on(table.sourceType),
]);

export const agentSkill = pgTable("agent_skill", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull().default("keyword"),
  trigger: text("trigger"),
  promptFragment: text("prompt_fragment").notNull(),
  enabledTools: text("enabled_tools").array().notNull().default(sql`'{}'::text[]`),
  sourceUrl: text("source_url"),
  sourceId: text("source_id").references(() => skillSource.id, { onDelete: "set null" }),
  skillKind: text("skill_kind").notNull().default("inline"),
  activationMode: text("activation_mode").notNull().default("rule"),
  entryFilePath: text("entry_file_path").notNull().default("SKILL.md"),
  installedRef: text("installed_ref"),
  installedCommitSha: text("installed_commit_sha"),
  upstreamCommitSha: text("upstream_commit_sha"),
  syncStatus: text("sync_status").notNull().default("local"),
  pinnedToInstalledVersion: boolean("pinned_to_installed_version").notNull().default(false),
  hasBundledFiles: boolean("has_bundled_files").notNull().default(false),
  packageManifest: jsonb("package_manifest").$type<Record<string, unknown>>(),
  lastSyncCheckedAt: timestamp("last_sync_checked_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("agent_skill_userId_idx").on(table.userId),
  index("agent_skill_sourceId_idx").on(table.sourceId),
  index("agent_skill_skillKind_idx").on(table.skillKind),
  index("agent_skill_syncStatus_idx").on(table.syncStatus),
]);

export const agentSkillFile = pgTable("agent_skill_file", {
  id: text("id").primaryKey(),
  skillId: text("skill_id").notNull().references(() => agentSkill.id, { onDelete: "cascade" }),
  relativePath: text("relative_path").notNull(),
  fileKind: text("file_kind").notNull(),
  mediaType: text("media_type"),
  textContent: text("text_content"),
  sizeBytes: integer("size_bytes"),
  checksum: text("checksum"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("agent_skill_file_skillId_relativePath_idx").on(table.skillId, table.relativePath),
  index("agent_skill_file_skillId_idx").on(table.skillId),
  index("agent_skill_file_kind_idx").on(table.fileKind),
]);

export const agentSkillAttachment = pgTable("agent_skill_attachment", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => agent.id, { onDelete: "cascade" }),
  skillId: text("skill_id").notNull().references(() => agentSkill.id, { onDelete: "cascade" }),
  isEnabled: boolean("is_enabled").notNull().default(true),
  activationModeOverride: text("activation_mode_override"),
  triggerTypeOverride: text("trigger_type_override"),
  triggerOverride: text("trigger_override"),
  priority: integer("priority").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex("agent_skill_attachment_agentId_skillId_idx").on(table.agentId, table.skillId),
  index("agent_skill_attachment_agentId_idx").on(table.agentId),
  index("agent_skill_attachment_skillId_idx").on(table.skillId),
]);

export const agentSkillRelations = relations(agentSkill, ({ one, many }) => ({
  user: one(user, { fields: [agentSkill.userId], references: [user.id] }),
  source: one(skillSource, { fields: [agentSkill.sourceId], references: [skillSource.id] }),
  files: many(agentSkillFile),
  attachments: many(agentSkillAttachment),
}));

export const agentSkillFileRelations = relations(agentSkillFile, ({ one }) => ({
  skill: one(agentSkill, { fields: [agentSkillFile.skillId], references: [agentSkill.id] }),
}));

export const agentSkillAttachmentRelations = relations(agentSkillAttachment, ({ one }) => ({
  agent: one(agent, { fields: [agentSkillAttachment.agentId], references: [agent.id] }),
  skill: one(agentSkill, { fields: [agentSkillAttachment.skillId], references: [agentSkill.id] }),
}));

export const skillSourceRelations = relations(skillSource, ({ many }) => ({
  skills: many(agentSkill),
}));
