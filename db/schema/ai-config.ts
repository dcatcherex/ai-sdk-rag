import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// ── AI Model Slots (singleton, id = 1) ───────────────────────────────────────
//
// One column per named slot. NULL means "use the hardcoded fallback in lib/ai-config.ts".
// To add a new slot: add a column here, a fallback in SLOT_DEFAULTS, run drizzle-kit generate.
//
export const aiModelSlots = pgTable("ai_model_slots", {
  id: integer("id").primaryKey().default(1),

  // User-facing chat
  chatModel: text("chat_model"),

  // All background/utility LLM calls: conversation summary, memory extraction,
  // prompt enhancement, quiz gen, brand guardrails, document cleaning,
  // content generation, skill discovery, workspace AI, etc.
  backgroundModel: text("background_model"),

  // Dedicated slot for the agent optimizer. Defaults can be stronger than
  // generic background jobs without raising cost across the whole platform.
  optimizerModel: text("optimizer_model"),

  // Embedding generation (changing this requires re-indexing all documents)
  embeddingModel: text("embedding_model"),

  // Media generation slots
  imageModel: text("image_model"),
  videoModel: text("video_model"),
  audioModel: text("audio_model"),
  ttsModel: text("tts_model"),
  transcriptionModel: text("transcription_model"),
  liveModel: text("live_model"),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  updatedBy: text("updated_by"),
});

// ── Prompt Templates ──────────────────────────────────────────────────────────

export const promptTemplate = pgTable("ai_prompt_template", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  // Soft FK to promptTemplateVersion.id — set after first version insert
  activeVersionId: text("active_version_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// ── Prompt Template Versions ──────────────────────────────────────────────────

export const promptTemplateVersion = pgTable(
  "ai_prompt_template_version",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => promptTemplate.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: text("content").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    createdBy: text("created_by"),
  },
  (table) => [
    uniqueIndex("ai_prompt_template_version_unique_idx").on(
      table.templateId,
      table.version,
    ),
  ],
);

// ── Relations ─────────────────────────────────────────────────────────────────

export const promptTemplateRelations = relations(promptTemplate, ({ many }) => ({
  versions: many(promptTemplateVersion),
}));

export const promptTemplateVersionRelations = relations(
  promptTemplateVersion,
  ({ one }) => ({
    template: one(promptTemplate, {
      fields: [promptTemplateVersion.templateId],
      references: [promptTemplate.id],
    }),
  }),
);

// ── TypeScript types ──────────────────────────────────────────────────────────

export type AiModelSlotsRow = typeof aiModelSlots.$inferSelect;
export type PromptTemplateRow = typeof promptTemplate.$inferSelect;
export type PromptTemplateVersionRow = typeof promptTemplateVersion.$inferSelect;
