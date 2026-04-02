import { relations, sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { agent } from "./agents";
import { brand } from "./brands";
import { chatThread } from "./chat";

// ── Agent Teams (multi-agent orchestration) ───────────────────────────────────

export type AgentTeamConfig = {
  maxSteps?: number;
  budgetCredits?: number;
  outputFormat?: "markdown" | "json";
  outputContract?: "markdown" | "json" | "sections";
  contractSections?: string[];
};

export const agentTeam = pgTable("agent_team", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  routingStrategy: text("routing_strategy")
    .$type<"sequential" | "planner_generated">()
    .notNull()
    .default("sequential"),
  config: jsonb("config").$type<AgentTeamConfig>().notNull().default(sql`'{}'::jsonb`),
  brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("agent_team_userId_idx").on(table.userId),
]);

export const agentTeamMember = pgTable("agent_team_member", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => agentTeam.id, { onDelete: "cascade" }),
  agentId: text("agent_id").notNull().references(() => agent.id, { onDelete: "cascade" }),
  role: text("role").$type<"orchestrator" | "specialist">().notNull().default("specialist"),
  displayRole: text("display_role"),
  position: integer("position").notNull().default(0),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  handoffInstructions: text("handoff_instructions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("agent_team_member_teamId_idx").on(table.teamId),
  uniqueIndex("agent_team_member_unique_idx").on(table.teamId, table.agentId),
]);

export const teamRun = pgTable("team_run", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => agentTeam.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  threadId: text("thread_id").references(() => chatThread.id, { onDelete: "set null" }),
  status: text("status").notNull().default("running"),
  inputPrompt: text("input_prompt").notNull(),
  finalOutput: text("final_output"),
  budgetCredits: integer("budget_credits"),
  spentCredits: integer("spent_credits").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("team_run_teamId_idx").on(table.teamId),
  index("team_run_userId_idx").on(table.userId),
  index("team_run_threadId_idx").on(table.threadId),
  index("team_run_status_idx").on(table.status),
]);

export const teamRunStep = pgTable("team_run_step", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull().references(() => teamRun.id, { onDelete: "cascade" }),
  memberId: text("member_id").references(() => agentTeamMember.id, { onDelete: "set null" }),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  role: text("role").$type<"orchestrator" | "specialist">().notNull(),
  stepIndex: integer("step_index").notNull(),
  inputPrompt: text("input_prompt").notNull(),
  output: text("output"),
  summary: text("summary"),
  artifactType: text("artifact_type")
    .$type<"research_brief" | "ad_copy" | "analysis" | "creative_direction" | "strategy" | "content" | "other">()
    .notNull()
    .default("other"),
  modelId: text("model_id"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  creditCost: integer("credit_cost").notNull().default(0),
  status: text("status").notNull().default("running"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("team_run_step_runId_idx").on(table.runId),
  index("team_run_step_memberId_idx").on(table.memberId),
]);

// ── Agent Team Relations ───────────────────────────────────────────────────────

export const agentTeamRelations = relations(agentTeam, ({ one, many }) => ({
  user: one(user, { fields: [agentTeam.userId], references: [user.id] }),
  brand: one(brand, { fields: [agentTeam.brandId], references: [brand.id] }),
  members: many(agentTeamMember),
  runs: many(teamRun),
}));

export const agentTeamMemberRelations = relations(agentTeamMember, ({ one }) => ({
  team: one(agentTeam, { fields: [agentTeamMember.teamId], references: [agentTeam.id] }),
  agent: one(agent, { fields: [agentTeamMember.agentId], references: [agent.id] }),
}));

export const teamRunRelations = relations(teamRun, ({ one, many }) => ({
  team: one(agentTeam, { fields: [teamRun.teamId], references: [agentTeam.id] }),
  user: one(user, { fields: [teamRun.userId], references: [user.id] }),
  thread: one(chatThread, { fields: [teamRun.threadId], references: [chatThread.id] }),
  steps: many(teamRunStep),
}));

export const teamRunStepRelations = relations(teamRunStep, ({ one }) => ({
  run: one(teamRun, { fields: [teamRunStep.runId], references: [teamRun.id] }),
  member: one(agentTeamMember, { fields: [teamRunStep.memberId], references: [agentTeamMember.id] }),
}));
