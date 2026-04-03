import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { brand } from "./brands";
import { contentPiece } from "./content";

// ── Workspace Members ─────────────────────────────────────────────────────────

export const workspaceMember = pgTable("workspace_member", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull().references(() => brand.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("writer"),
  invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
  joinedAt: timestamp("joined_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("workspace_member_brandId_userId_idx").on(table.brandId, table.userId),
  index("workspace_member_brandId_idx").on(table.brandId),
  index("workspace_member_userId_idx").on(table.userId),
]);

// ── Approval Requests ─────────────────────────────────────────────────────────

export const approvalRequest = pgTable("approval_request", {
  id: text("id").primaryKey(),
  contentPieceId: text("content_piece_id").notNull().references(() => contentPiece.id, { onDelete: "cascade" }),
  brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
  requesterId: text("requester_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"),
  dueAt: timestamp("due_at"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("approval_brandId_idx").on(table.brandId),
  index("approval_assigneeId_idx").on(table.assigneeId),
  index("approval_status_idx").on(table.status),
  index("approval_contentPieceId_idx").on(table.contentPieceId),
]);

// ── Content Comments ──────────────────────────────────────────────────────────

export const contentComment = pgTable("content_comment", {
  id: text("id").primaryKey(),
  contentPieceId: text("content_piece_id").notNull().references(() => contentPiece.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  parentId: text("parent_id").references((): AnyPgColumn => contentComment.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("comment_contentPieceId_idx").on(table.contentPieceId),
  index("comment_userId_idx").on(table.userId),
  index("comment_parentId_idx").on(table.parentId),
]);

// ── Brand Guardrails ──────────────────────────────────────────────────────────

export const brandGuardrail = pgTable("brand_guardrail", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull().references(() => brand.id, { onDelete: "cascade" }),
  ruleType: text("rule_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  pattern: text("pattern"),
  severity: text("severity").notNull().default("warning"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("guardrail_brandId_idx").on(table.brandId),
  index("guardrail_ruleType_idx").on(table.ruleType),
]);

// ── Relations ─────────────────────────────────────────────────────────────────

export const workspaceMemberRelations = relations(workspaceMember, ({ one }) => ({
  brand: one(brand, { fields: [workspaceMember.brandId], references: [brand.id] }),
  user: one(user, { fields: [workspaceMember.userId], references: [user.id] }),
  inviter: one(user, { fields: [workspaceMember.invitedBy], references: [user.id], relationName: "invited_by_user" }),
}));

export const approvalRequestRelations = relations(approvalRequest, ({ one }) => ({
  contentPiece: one(contentPiece, { fields: [approvalRequest.contentPieceId], references: [contentPiece.id] }),
  brand: one(brand, { fields: [approvalRequest.brandId], references: [brand.id] }),
  requester: one(user, { fields: [approvalRequest.requesterId], references: [user.id], relationName: "approval_requester" }),
  assignee: one(user, { fields: [approvalRequest.assigneeId], references: [user.id], relationName: "approval_assignee" }),
}));

export const contentCommentRelations = relations(contentComment, ({ one, many }) => ({
  contentPiece: one(contentPiece, { fields: [contentComment.contentPieceId], references: [contentPiece.id] }),
  user: one(user, { fields: [contentComment.userId], references: [user.id] }),
  parent: one(contentComment, {
    fields: [contentComment.parentId],
    references: [contentComment.id],
    relationName: "comment_replies",
  }),
  replies: many(contentComment, { relationName: "comment_replies" }),
  resolver: one(user, { fields: [contentComment.resolvedBy], references: [user.id], relationName: "comment_resolver" }),
}));

export const brandGuardrailRelations = relations(brandGuardrail, ({ one }) => ({
  brand: one(brand, { fields: [brandGuardrail.brandId], references: [brand.id] }),
}));
