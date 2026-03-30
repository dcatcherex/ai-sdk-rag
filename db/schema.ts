import { relations, sql } from "drizzle-orm";
import { boolean, foreignKey, index, integer, jsonb, pgTable, text, timestamp, customType, uniqueIndex } from "drizzle-orm/pg-core";
import type { AgentStructuredBehavior } from "@/lib/agent-structured-behavior";
import type { CertificateTemplateType, PrintSheetSettings } from "@/lib/certificate-print";

type CertificateJobExportMode = 'single_file' | 'zip' | 'single_pdf' | 'sheet_pdf';
type CertificateJobSource = 'manual' | 'agent';
type CertificateJobRequestPayload = {
  fieldIds: string[];
  hasBackSide: boolean;
  recipientCount: number;
  recipientPreview: string[];
  requiredFieldIds: string[];
  templateName: string;
};
type CertificateJobResultPayload = {
  downloadLabel: string;
  fileKey: string;
  fileName: string;
  fileUrl: string;
  isDuplexSheet: boolean;
};

// Custom vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    const typed = config as { dimensions?: number } | undefined;
    return `vector(${typed?.dimensions ?? 1024})`;
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  approved: boolean("approved").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const chatThread = pgTable(
  "chat_thread",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    preview: text("preview").notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    brandId: text("brand_id").references(() => brand.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("chat_thread_userId_idx").on(table.userId)],
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    parts: jsonb("parts").notNull(),
    metadata: jsonb("metadata"),
    position: integer("position").notNull(),
    reaction: text("reaction"), // 'thumbs_up', 'thumbs_down', or null
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("chat_message_thread_idx").on(table.threadId)],
);

export const tokenUsage = pgTable(
  "token_usage",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("token_usage_thread_idx").on(table.threadId)],
);

export const mediaAsset = pgTable(
  "media_asset",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    threadId: text("thread_id")
      .references(() => chatThread.id, { onDelete: "set null" }),
    messageId: text("message_id")
      .references(() => chatMessage.id, { onDelete: "set null" }),
    parentAssetId: text("parent_asset_id"),
    rootAssetId: text("root_asset_id"),
    version: integer("version").default(1).notNull(),
    editPrompt: text("edit_prompt"),
    type: text("type").notNull(),
    r2Key: text("r2_key").notNull(),
    url: text("url").notNull(),
    thumbnailKey: text("thumbnail_key"),
    thumbnailUrl: text("thumbnail_url"),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "media_asset_parent_fk",
      columns: [table.parentAssetId],
      foreignColumns: [table.id],
    }).onDelete("set null"),
    index("media_asset_thread_idx").on(table.threadId),
    index("media_asset_message_idx").on(table.messageId),
    index("media_asset_user_idx").on(table.userId),
    index("media_asset_type_idx").on(table.type),
    index("media_asset_parent_idx").on(table.parentAssetId),
    index("media_asset_root_idx").on(table.rootAssetId),
  ]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const chatThreadRelations = relations(chatThread, ({ many, one }) => ({
  messages: many(chatMessage),
  user: one(user, {
    fields: [chatThread.userId],
    references: [user.id],
  }),
}));

export const chatMessageRelations = relations(chatMessage, ({ one, many }) => ({
  thread: one(chatThread, {
    fields: [chatMessage.threadId],
    references: [chatThread.id],
  }),
  assets: many(mediaAsset),
}));

export const mediaAssetRelations = relations(mediaAsset, ({ one }) => ({
  user: one(user, {
    fields: [mediaAsset.userId],
    references: [user.id],
  }),
  thread: one(chatThread, {
    fields: [mediaAsset.threadId],
    references: [chatThread.id],
  }),
  message: one(chatMessage, {
    fields: [mediaAsset.messageId],
    references: [chatMessage.id],
  }),
}));

export const tokenUsageRelations = relations(tokenUsage, ({ one }) => ({
  thread: one(chatThread, {
    fields: [tokenUsage.threadId],
    references: [chatThread.id],
  }),
}));

// Credits system
export const userCredit = pgTable("user_credit", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  balance: integer("balance").default(0).notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const creditTransaction = pgTable(
  "credit_transaction",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // positive = grant, negative = usage
    balance: integer("balance").notNull(), // balance after transaction
    type: text("type").notNull(), // 'grant' | 'usage' | 'refund' | 'signup_bonus'
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("credit_transaction_userId_idx").on(table.userId),
    index("credit_transaction_type_idx").on(table.type),
  ],
);

export const userCreditRelations = relations(userCredit, ({ one }) => ({
  user: one(user, {
    fields: [userCredit.userId],
    references: [user.id],
  }),
}));

export const creditTransactionRelations = relations(creditTransaction, ({ one }) => ({
  user: one(user, {
    fields: [creditTransaction.userId],
    references: [user.id],
  }),
}));

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  memoryEnabled: boolean("memory_enabled").default(true).notNull(),
  memoryInjectEnabled: boolean("memory_inject_enabled").default(true).notNull(),
  memoryExtractEnabled: boolean("memory_extract_enabled").default(true).notNull(),
  personaDetectionEnabled: boolean("persona_detection_enabled").default(true).notNull(),
  promptEnhancementEnabled: boolean("prompt_enhancement_enabled").default(true).notNull(),
  followUpSuggestionsEnabled: boolean("follow_up_suggestions_enabled").default(true).notNull(),
  /** null = all tools enabled (default for new users). Set to array to restrict. */
  enabledToolIds: text("enabled_tool_ids").array(),
  /** Cohere cross-encoder reranking after hybrid retrieval. Recommended for large KBs (100+ docs). */
  rerankEnabled: boolean("rerank_enabled").default(false).notNull(),
  /** Voice name for real-time voice chat. null = use default (Aoede). */
  selectedVoice: text("selected_voice"),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const customPersona = pgTable("custom_persona", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index("custom_persona_userId_idx").on(table.userId)]);

export const personaCustomization = pgTable("persona_customization", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  personaKey: text("persona_key").notNull(),
  extraInstructions: text("extra_instructions").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  { name: "persona_customization_pkey", columns: [table.userId, table.personaKey] },
  index("persona_customization_userId_idx").on(table.userId),
]);

export const userMemory = pgTable("user_memory", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  fact: text("fact").notNull(),
  sourceThreadId: text("source_thread_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("user_memory_userId_idx").on(table.userId)]);

export const userModelPreference = pgTable("user_model_preference", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  enabledModelIds: text("enabled_model_ids").array().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const userModelPreferenceRelations = relations(userModelPreference, ({ one }) => ({
  user: one(user, {
    fields: [userModelPreference.userId],
    references: [user.id],
  }),
}));

export const userModelScore = pgTable(
  'user_model_score',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    modelId: text('model_id').notNull(),
    persona: text('persona').notNull(),
    thumbsUp: integer('thumbs_up').default(0).notNull(),
    thumbsDown: integer('thumbs_down').default(0).notNull(),
    score: integer('score').default(0).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (table) => [
    index('user_model_score_userId_idx').on(table.userId),
    index('user_model_score_combo_idx').on(table.userId, table.modelId, table.persona),
  ]
);

export const userModelScoreRelations = relations(userModelScore, ({ one }) => ({
  user: one(user, { fields: [userModelScore.userId], references: [user.id] }),
}));

// RAG: Document storage with vector embeddings
export const document = pgTable(
  "document",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    originalContent: text("original_content"),
    processingStatus: text("processing_status").notNull().default("ready"),
    analysisResult: jsonb("analysis_result"),
    storageMode: text("storage_mode"),
    processingMode: text("processing_mode"),
    r2Key: text("r2_key"),
    metadata: jsonb("metadata").default({}).notNull(),
    embedding: vector("embedding", { dimensions: 1024 }), // mistral/mistral-embed
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("document_metadata_idx").using("gin", table.metadata),
    index("document_user_id_idx").on(table.userId),
    // GIN index on tsvector expression for fast BM25 full-text search
    index("document_fts_idx").using("gin", sql`to_tsvector('english', ${table.content})`),
  ],
);

// RAG: Document chunks for large documents
export const documentChunk = pgTable(
  "document_chunk",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull(),
    content: text("content").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    embedding: vector("embedding", { dimensions: 1024 }), // mistral/mistral-embed
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_chunk_document_id_idx").on(table.documentId),
    // GIN index on tsvector expression for fast BM25 full-text search
    index("document_chunk_fts_idx").using("gin", sql`to_tsvector('english', ${table.content})`),
  ],
);

export const documentChunkRelations = relations(documentChunk, ({ one }) => ({
  document: one(document, {
    fields: [documentChunk.documentId],
    references: [document.id],
  }),
}));

// Certificate templates and batch jobs
export const certificateTemplate = pgTable('certificate_template', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  templateType: text('template_type').$type<CertificateTemplateType>().notNull().default('certificate'),
  r2Key: text('r2_key').notNull(),
  url: text('url').notNull(),
  thumbnailKey: text('thumbnail_key'),
  thumbnailUrl: text('thumbnail_url'),
  backR2Key: text('back_r2_key'),
  backUrl: text('back_url'),
  backThumbnailKey: text('back_thumbnail_key'),
  backThumbnailUrl: text('back_thumbnail_url'),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  backWidth: integer('back_width'),
  backHeight: integer('back_height'),
  // Array of TextFieldConfig stored as JSONB
  fields: jsonb('fields').notNull().default(sql`'[]'::jsonb`),
  backFields: jsonb('back_fields').notNull().default(sql`'[]'::jsonb`),
  printSettings: jsonb('print_settings').$type<PrintSheetSettings>().notNull().default(sql`'{"preset":"a4_3x3","pageSize":"A4","columns":3,"rows":3,"marginTopMm":12,"marginRightMm":12,"marginBottomMm":12,"marginLeftMm":12,"gapXMm":4,"gapYMm":4,"cropMarks":false,"cropMarkLengthMm":4,"cropMarkOffsetMm":2,"duplexMode":"single_sided","backPageOrder":"same","backOffsetXMm":0,"backOffsetYMm":0,"backFlipX":false,"backFlipY":false}'::jsonb`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index('certificate_template_userId_idx').on(table.userId)]);

export const certificateJob = pgTable('certificate_job', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  templateId: text('template_id').notNull().references(() => certificateTemplate.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending | processing | completed | failed
  format: text('format').notNull().default('png'),     // png | jpg | pdf
  exportMode: text('export_mode').$type<CertificateJobExportMode>().notNull().default('zip'),
  source: text('source').$type<CertificateJobSource>().notNull().default('manual'),
  totalCount: integer('total_count').notNull().default(0),
  processedCount: integer('processed_count').notNull().default(0),
  fileName: text('file_name'),
  downloadLabel: text('download_label'),
  resultKey: text('result_key'),
  resultUrl: text('result_url'),
  zipKey: text('zip_key'),
  zipUrl: text('zip_url'),
  requestPayload: jsonb('request_payload').$type<CertificateJobRequestPayload>(),
  resultPayload: jsonb('result_payload').$type<CertificateJobResultPayload>(),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => [index('certificate_job_userId_idx').on(table.userId)]);

export const certificateTemplateRelations = relations(certificateTemplate, ({ one, many }) => ({
  user: one(user, { fields: [certificateTemplate.userId], references: [user.id] }),
  jobs: many(certificateJob),
}));

export const certificateJobRelations = relations(certificateJob, ({ one }) => ({
  user: one(user, { fields: [certificateJob.userId], references: [user.id] }),
  template: one(certificateTemplate, { fields: [certificateJob.templateId], references: [certificateTemplate.id] }),
}));

// Recipient groups for certificate batch generation
export const recipientGroup = pgTable('recipient_group', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  // Array of { id: string, values: Record<string, string> }
  recipients: jsonb('recipients')
    .$type<Array<{ id: string; values: Record<string, string> }>>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index('recipient_group_userId_idx').on(table.userId)]);

export const agent = pgTable('agent', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  structuredBehavior: jsonb('structured_behavior').$type<AgentStructuredBehavior>(),
  modelId: text('model_id'),
  enabledTools: text('enabled_tools').array().notNull().default(sql`'{}'::text[]`),
  documentIds: text('document_ids').array().notNull().default(sql`'{}'::text[]`),
  skillIds: text('skill_ids').array().notNull().default(sql`'{}'::text[]`),
  brandId: text('brand_id').references(() => brand.id, { onDelete: 'set null' }),
  isPublic: boolean('is_public').notNull().default(false),
  starterPrompts: text('starter_prompts').array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [index('agent_userId_idx').on(table.userId)]);

export const agentRelations = relations(agent, ({ one, many }) => ({
  user: one(user, { fields: [agent.userId], references: [user.id] }),
  shares: many(agentShare),
}));

export const agentShare = pgTable('agent_share', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agent.id, { onDelete: 'cascade' }),
  sharedWithUserId: text('shared_with_user_id').notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('agent_share_unique_idx').on(table.agentId, table.sharedWithUserId),
  index('agent_share_agentId_idx').on(table.agentId),
  index('agent_share_sharedWithUserId_idx').on(table.sharedWithUserId),
]);

export const agentShareRelations = relations(agentShare, ({ one }) => ({
  agent: one(agent, { fields: [agentShare.agentId], references: [agent.id] }),
  sharedWithUser: one(user, { fields: [agentShare.sharedWithUserId], references: [user.id] }),
}));

// ── Public Agent Share (shareable link for anonymous users) ───────────────────

export const publicAgentShare = pgTable('public_agent_share', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agent.id, { onDelete: 'cascade' }),
  shareToken: text('share_token').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  /** Max messages a guest session may send (null = unlimited) */
  guestMessageLimit: integer('guest_message_limit'),
  /** HMAC-SHA256 hash of the access password (null = no password) */
  passwordHash: text('password_hash'),
  /** Link expires at this timestamp (null = never) */
  expiresAt: timestamp('expires_at'),
  /** Max total AI responses across all guests (null = unlimited) */
  maxUses: integer('max_uses'),
  /** Max credits the owner is willing to spend on this link (null = unlimited) */
  creditLimit: integer('credit_limit'),
  /** Running total of credits spent via this link */
  creditsUsed: integer('credits_used').notNull().default(0),
  conversationCount: integer('conversation_count').notNull().default(0),
  shareCount: integer('share_count').notNull().default(0),
  /** Optional greeting shown as the first message in the chat UI */
  welcomeMessage: text('welcome_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex('public_agent_share_token_idx').on(table.shareToken),
  index('public_agent_share_agentId_idx').on(table.agentId),
]);

export const publicAgentShareRelations = relations(publicAgentShare, ({ one }) => ({
  agent: one(agent, { fields: [publicAgentShare.agentId], references: [agent.id] }),
}));

// ── Public Agent Share Events (analytics) ─────────────────────────────────────

export const publicAgentShareEvent = pgTable('public_agent_share_event', {
  id: text('id').primaryKey(),
  shareToken: text('share_token').notNull(),
  /** 'view' = landing page visit, 'chat' = AI response completed */
  eventType: text('event_type').notNull(),
  /** Client-generated UUID per browser session (for unique-session counting) */
  sessionId: text('session_id'),
  /** First user message of the session — only populated on 'chat' events */
  firstMessage: text('first_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('pas_event_token_idx').on(table.shareToken),
  index('pas_event_created_idx').on(table.createdAt),
]);

// ── Agent Skills ──────────────────────────────────────────────────────────────

export const agentSkill = pgTable('agent_skill', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  /** 'slash' | 'keyword' | 'always' */
  triggerType: text('trigger_type').notNull().default('keyword'),
  /** The slash command (e.g. '/email') or keyword to match. Null for 'always'. */
  trigger: text('trigger'),
  /** Injected into the agent's system prompt when this skill is triggered */
  promptFragment: text('prompt_fragment').notNull(),
  /** Additional tool IDs unlocked when this skill is active */
  enabledTools: text('enabled_tools').array().notNull().default(sql`'{}'::text[]`),
  /** Source URL (GitHub raw URL) if imported from the internet */
  sourceUrl: text('source_url'),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index('agent_skill_userId_idx').on(table.userId)]);

export const agentSkillRelations = relations(agentSkill, ({ one }) => ({
  user: one(user, { fields: [agentSkill.userId], references: [user.id] }),
}));

// ── Tool Run / Artifact (unified tool execution persistence) ──────────────────

export const toolRun = pgTable('tool_run', {
  id: text('id').primaryKey(),
  toolSlug: text('tool_slug').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  threadId: text('thread_id').references(() => chatThread.id, { onDelete: 'set null' }),
  /** Execution source: 'sidebar' | 'agent' | 'api' */
  source: text('source').notNull(),
  inputJson: jsonb('input_json').notNull(),
  outputJson: jsonb('output_json'),
  /** 'pending' | 'success' | 'error' */
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('tool_run_userId_idx').on(table.userId),
  index('tool_run_toolSlug_idx').on(table.toolSlug),
  index('tool_run_threadId_idx').on(table.threadId),
]);

export const toolArtifact = pgTable('tool_artifact', {
  id: text('id').primaryKey(),
  toolRunId: text('tool_run_id').notNull().references(() => toolRun.id, { onDelete: 'cascade' }),
  /** Semantic kind: 'quiz' | 'certificate' | 'flashcards' | 'study_plan' | ... */
  kind: text('kind').notNull(),
  /** Storage format: 'json' | 'html' | 'pdf' | 'csv' */
  format: text('format').notNull(),
  storageUrl: text('storage_url'),
  payloadJson: jsonb('payload_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('tool_artifact_runId_idx').on(table.toolRunId),
]);

export const toolRunRelations = relations(toolRun, ({ one, many }) => ({
  user: one(user, { fields: [toolRun.userId], references: [user.id] }),
  thread: one(chatThread, { fields: [toolRun.threadId], references: [chatThread.id] }),
  artifacts: many(toolArtifact),
}));

export const toolArtifactRelations = relations(toolArtifact, ({ one }) => ({
  toolRun: one(toolRun, { fields: [toolArtifact.toolRunId], references: [toolRun.id] }),
}));

// ── Brands ───────────────────────────────────────────────────────────────────

export const brand = pgTable('brand', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  overview: text('overview'),
  websiteUrl: text('website_url'),
  industry: text('industry'),
  targetAudience: text('target_audience'),
  toneOfVoice: text('tone_of_voice').array().notNull().default(sql`'{}'::text[]`),
  brandValues: text('brand_values').array().notNull().default(sql`'{}'::text[]`),
  visualAesthetics: text('visual_aesthetics').array().notNull().default(sql`'{}'::text[]`),
  fonts: text('fonts').array().notNull().default(sql`'{}'::text[]`),
  /** [{ hex: string, label: string }] — flexible palette, typically 3–5 colors */
  colors: jsonb('colors').notNull().default(sql`'[]'::jsonb`),
  writingDos: text('writing_dos'),
  writingDonts: text('writing_donts'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index('brand_userId_idx').on(table.userId)]);

export const brandAsset = pgTable('brand_asset', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brand.id, { onDelete: 'cascade' }),
  /** 'logo' | 'product' | 'creative' | 'document' | 'font' | 'other' */
  kind: text('kind').notNull(),
  /** Groups assets, e.g. campaign name */
  collection: text('collection'),
  title: text('title').notNull(),
  r2Key: text('r2_key').notNull(),
  url: text('url').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes'),
  metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('brand_asset_brandId_idx').on(table.brandId),
  index('brand_asset_kind_idx').on(table.kind),
]);

export const brandShare = pgTable('brand_share', {
  id: text('id').primaryKey(),
  brandId: text('brand_id').notNull().references(() => brand.id, { onDelete: 'cascade' }),
  sharedWithUserId: text('shared_with_user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('brand_share_unique_idx').on(table.brandId, table.sharedWithUserId),
  index('brand_share_brandId_idx').on(table.brandId),
  index('brand_share_userId_idx').on(table.sharedWithUserId),
]);

// ── Content Marketing ─────────────────────────────────────────────────────────

export const socialPost = pgTable('social_post', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  /** Base caption used when no platform override exists */
  caption: text('caption').notNull(),
  /** ['instagram', 'facebook', 'tiktok'] */
  platforms: text('platforms').array().notNull(),
  /** Per-platform caption overrides: { instagram: { caption: '...' }, ... } */
  platformOverrides: jsonb('platform_overrides').notNull().default(sql`'{}'::jsonb`),
  /** Attached media: [{ r2Key, url, mimeType, width, height, sizeBytes }] */
  media: jsonb('media').notNull().default(sql`'[]'::jsonb`),
  /** 'draft' | 'scheduled' | 'published' | 'failed' */
  status: text('status').notNull().default('draft'),
  scheduledAt: timestamp('scheduled_at'),
  publishedAt: timestamp('published_at'),
  brandId: text('brand_id').references(() => brand.id, { onDelete: 'set null' }),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('social_post_userId_idx').on(table.userId),
  index('social_post_status_idx').on(table.status),
  index('social_post_scheduledAt_idx').on(table.scheduledAt),
]);

/** Connected social accounts (Phase 2 — OAuth tokens) */
export const socialAccount = pgTable('social_account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  /** 'instagram' | 'facebook' | 'tiktok' */
  platform: text('platform').notNull(),
  platformAccountId: text('platform_account_id').notNull(),
  accountName: text('account_name').notNull(),
  /** 'personal' | 'business' | 'creator' */
  accountType: text('account_type'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('social_account_userId_idx').on(table.userId),
  index('social_account_platform_idx').on(table.platform),
]);

/** Cached trend data fetched from Apify — shared across all users */
export const trendCache = pgTable('trend_cache', {
  id: text('id').primaryKey(),
  /** 'tiktok' | 'instagram' */
  platform: text('platform').notNull(),
  /** Industry/niche, e.g. 'fitness', 'food', 'fashion', 'all' */
  industry: text('industry').notNull().default('all'),
  /** Full trend items array as JSON */
  items: jsonb('items').notNull().default(sql`'[]'::jsonb`),
  /** ISO week string for deduplication, e.g. '2026-W11' */
  weekKey: text('week_key').notNull(),
  /** When Apify fetch completed */
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
}, (table) => [
  index('trend_cache_platform_industry_idx').on(table.platform, table.industry),
  uniqueIndex('trend_cache_week_platform_industry_idx').on(table.weekKey, table.platform, table.industry),
]);

// ── Website Builder ───────────────────────────────────────────────────────────

export const website = pgTable('website', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  templateSlug: text('template_slug').notNull(),
  status: text('status').notNull().default('draft'),
  siteDataJson: jsonb('site_data_json'),
  renderedHtmlKey: text('rendered_html_key'),
  renderedHtmlUrl: text('rendered_html_url'),
  pagesProjectName: text('pages_project_name'),
  pagesDeploymentId: text('pages_deployment_id'),
  liveUrl: text('live_url'),
  customDomain: text('custom_domain'),
  error: text('error'),
  generationCount: integer('generation_count').notNull().default(0),
  editCount: integer('edit_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (t) => [
  index('website_userId_idx').on(t.userId),
  uniqueIndex('website_userId_slug_idx').on(t.userId, t.slug),
]);

export const websiteTemplate = pgTable('website_template', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  category: text('category').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  defaultSiteData: jsonb('default_site_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const websiteGenerationLog = pgTable('website_generation_log', {
  id: text('id').primaryKey(),
  websiteId: text('website_id').notNull().references(() => website.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  promptText: text('prompt_text').notNull(),
  modelId: text('model_id').notNull(),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  creditsDeducted: integer('credits_deducted').notNull().default(0),
  status: text('status').notNull().default('success'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('website_gen_log_websiteId_idx').on(t.websiteId),
  index('website_gen_log_userId_idx').on(t.userId),
]);

export const websiteRelations = relations(website, ({ one, many }) => ({
  user: one(user, { fields: [website.userId], references: [user.id] }),
  generationLogs: many(websiteGenerationLog),
}));

export const websiteGenerationLogRelations = relations(websiteGenerationLog, ({ one }) => ({
  website: one(website, { fields: [websiteGenerationLog.websiteId], references: [website.id] }),
  user: one(user, { fields: [websiteGenerationLog.userId], references: [user.id] }),
}));

// ── Prompt Library ────────────────────────────────────────────────────────────

export const promptLibrary = pgTable('prompt_library', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  content: text('content').notNull(),
  category: text('category').notNull(),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  isPublic: boolean('is_public').notNull().default(false),
  isBuiltIn: boolean('is_built_in').notNull().default(false),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index('prompt_library_userId_idx').on(table.userId)]);

export const promptLibraryRelations = relations(promptLibrary, ({ one }) => ({
  user: one(user, { fields: [promptLibrary.userId], references: [user.id] }),
}));

export const socialPostRelations = relations(socialPost, ({ one }) => ({
  user: one(user, { fields: [socialPost.userId], references: [user.id] }),
  brand: one(brand, { fields: [socialPost.brandId], references: [brand.id] }),
}));

// ── Exam Builder ──────────────────────────────────────────────────────────────

export type ExamQuestionType = 'mcq' | 'true_false' | 'short_answer' | 'essay' | 'matching';
export type ExamBloomsLevel = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
export type ExamLanguage = 'th' | 'en';
export type ExamStatus = 'draft' | 'finalized';
export type ExamHeaderInfo = {
  schoolName?: string;
  teacherName?: string;
  className?: string;
  examDate?: string;
  timeLimit?: string;
};
// MCQ/T-F: string[], Matching: { left: string[]; right: string[] }, Short/Essay: null
export type ExamQuestionOptions = string[] | { left: string[]; right: string[] } | null;

export const examDraft = pgTable('exam_draft', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  gradeLevel: text('grade_level').notNull(),
  language: text('language').$type<ExamLanguage>().notNull().default('th'),
  instructions: text('instructions'),
  headerInfo: jsonb('header_info').$type<ExamHeaderInfo>().notNull().default(sql`'{}'::jsonb`),
  enabledTypes: text('enabled_types').array().notNull().default(sql`'{mcq}'::text[]`),
  enabledBloomsLevels: text('enabled_blooms_levels').array().notNull().default(sql`'{remember,understand,apply}'::text[]`),
  totalPoints: integer('total_points').notNull().default(0),
  status: text('status').$type<ExamStatus>().notNull().default('draft'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('exam_draft_userId_idx').on(table.userId),
]);

export const examQuestion = pgTable('exam_question', {
  id: text('id').primaryKey(),
  examId: text('exam_id').notNull().references(() => examDraft.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').$type<ExamQuestionType>().notNull(),
  text: text('text').notNull(),
  options: jsonb('options').$type<ExamQuestionOptions>(),
  answer: text('answer').notNull(),
  explanation: text('explanation').notNull().default(''),
  bloomsLevel: text('blooms_level').$type<ExamBloomsLevel>().notNull(),
  points: integer('points').notNull().default(1),
  orderIndex: integer('order_index').notNull().default(0),
  subject: text('subject').notNull().default(''),
  gradeLevel: text('grade_level').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('exam_question_examId_idx').on(table.examId),
  index('exam_question_userId_idx').on(table.userId),
]);

export const examQuestionBank = pgTable('exam_question_bank', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  sourceExamId: text('source_exam_id').references(() => examDraft.id, { onDelete: 'set null' }),
  type: text('type').$type<ExamQuestionType>().notNull(),
  text: text('text').notNull(),
  options: jsonb('options').$type<ExamQuestionOptions>(),
  answer: text('answer').notNull(),
  explanation: text('explanation').notNull().default(''),
  bloomsLevel: text('blooms_level').$type<ExamBloomsLevel>().notNull(),
  defaultPoints: integer('default_points').notNull().default(1),
  subject: text('subject').notNull(),
  gradeLevel: text('grade_level').notNull(),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  useCount: integer('use_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('exam_bank_userId_idx').on(table.userId),
  index('exam_bank_subject_idx').on(table.subject),
  index('exam_bank_type_idx').on(table.type),
]);

export const examDraftRelations = relations(examDraft, ({ one, many }) => ({
  user: one(user, { fields: [examDraft.userId], references: [user.id] }),
  questions: many(examQuestion),
  bankQuestions: many(examQuestionBank),
}));

export const examQuestionRelations = relations(examQuestion, ({ one }) => ({
  exam: one(examDraft, { fields: [examQuestion.examId], references: [examDraft.id] }),
  user: one(user, { fields: [examQuestion.userId], references: [user.id] }),
}));

export const examQuestionBankRelations = relations(examQuestionBank, ({ one }) => ({
  user: one(user, { fields: [examQuestionBank.userId], references: [user.id] }),
  sourceExam: one(examDraft, { fields: [examQuestionBank.sourceExamId], references: [examDraft.id] }),
}));

export const socialAccountRelations = relations(socialAccount, ({ one }) => ({
  user: one(user, { fields: [socialAccount.userId], references: [user.id] }),
}));

export const brandRelations = relations(brand, ({ one, many }) => ({
  user: one(user, { fields: [brand.userId], references: [user.id] }),
  assets: many(brandAsset),
  shares: many(brandShare),
}));

export const brandAssetRelations = relations(brandAsset, ({ one }) => ({
  brand: one(brand, { fields: [brandAsset.brandId], references: [brand.id] }),
}));

export const brandShareRelations = relations(brandShare, ({ one }) => ({
  brand: one(brand, { fields: [brandShare.brandId], references: [brand.id] }),
  sharedWithUser: one(user, { fields: [brandShare.sharedWithUserId], references: [user.id] }),
}));

// ── LINE OA Integration ───────────────────────────────────────────────────────

/**
 * One row per LINE Official Account connected by a user.
 * channelSecret is used for webhook signature verification.
 * channelAccessToken is used for sending messages via LINE API.
 */
export const lineOaChannel = pgTable('line_oa_channel', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  /** The linked agent that handles conversations from this OA */
  agentId: text('agent_id').references(() => agent.id, { onDelete: 'set null' }),
  /** Display name for this connection (user-defined) */
  name: text('name').notNull(),
  /** LINE Channel ID (from LINE Developers Console → Basic Settings) */
  lineChannelId: text('line_channel_id').notNull(),
  /** LINE Channel Secret — used for webhook signature verification (HMAC-SHA256) */
  channelSecret: text('channel_secret').notNull(),
  /** LINE Channel Access Token — used for sending reply/push messages */
  channelAccessToken: text('channel_access_token').notNull(),
  /** 'active' | 'inactive' */
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('line_oa_channel_userId_idx').on(table.userId),
  index('line_oa_channel_lineChannelId_idx').on(table.lineChannelId),
]);

/**
 * Maps a LINE user (lineUserId) within a channel to a chatThread.
 * This gives each LINE user persistent conversation context.
 */
export const lineConversation = pgTable('line_conversation', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull().references(() => lineOaChannel.id, { onDelete: 'cascade' }),
  /** LINE user ID (e.g. "Uxxxxxxxxxx") */
  lineUserId: text('line_user_id').notNull(),
  /** The chat thread used to persist messages for this LINE user */
  threadId: text('thread_id').notNull().references(() => chatThread.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex('line_conversation_channel_user_idx').on(table.channelId, table.lineUserId),
  index('line_conversation_channelId_idx').on(table.channelId),
  index('line_conversation_threadId_idx').on(table.threadId),
]);

export const lineOaChannelRelations = relations(lineOaChannel, ({ one, many }) => ({
  user: one(user, { fields: [lineOaChannel.userId], references: [user.id] }),
  agent: one(agent, { fields: [lineOaChannel.agentId], references: [agent.id] }),
  conversations: many(lineConversation),
  richMenus: many(lineRichMenu),
}));

export const lineConversationRelations = relations(lineConversation, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineConversation.channelId], references: [lineOaChannel.id] }),
  thread: one(chatThread, { fields: [lineConversation.threadId], references: [chatThread.id] }),
}));

// ── Rich Menu ─────────────────────────────────────────────────────────────────

export type RichMenuBounds = { x: number; y: number; width: number; height: number };

export type RichMenuAreaConfig = {
  label: string;     // display label (shown in menu image)
  emoji: string;     // emoji icon
  bgColor: string;   // hex background color e.g. '#06C755'
  bounds?: RichMenuBounds; // pixel bounds within the menu image; if absent, equal columns are used
  action: {
    type: 'message' | 'uri' | 'postback';
    text?: string;         // for type='message' — text sent as user message
    uri?: string;          // for type='uri' — URL to open
    data?: string;         // for type='postback'
    displayText?: string;  // display text for postback
  };
};

export const lineRichMenu = pgTable('line_rich_menu', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull().references(() => lineOaChannel.id, { onDelete: 'cascade' }),
  lineMenuId: text('line_menu_id'),  // assigned by LINE after deploy; null = draft
  name: text('name').notNull(),
  chatBarText: text('chat_bar_text').notNull().default('เมนู'),
  areas: jsonb('areas').notNull().$type<RichMenuAreaConfig[]>().default([]),
  isDefault: boolean('is_default').notNull().default(false),
  status: text('status').notNull().default('draft'),  // 'draft' | 'active'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('line_rich_menu_channelId_idx').on(table.channelId),
]);

// Tracks which rich menu is currently assigned to each LINE user
export const lineUserMenu = pgTable('line_user_menu', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull().references(() => lineOaChannel.id, { onDelete: 'cascade' }),
  lineUserId: text('line_user_id').notNull(),
  lineMenuId: text('line_menu_id').notNull(),  // LINE's menu ID (not our DB id)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  uniqueIndex('line_user_menu_channel_user_idx').on(table.channelId, table.lineUserId),
]);

// Reusable rich menu templates — user-scoped, apply to any channel
export const lineRichMenuTemplate = pgTable('line_rich_menu_template', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  chatBarText: text('chat_bar_text').notNull().default('เมนู'),
  areas: jsonb('areas').notNull().$type<RichMenuAreaConfig[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('line_rich_menu_template_userId_idx').on(table.userId),
]);

export const lineRichMenuRelations = relations(lineRichMenu, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineRichMenu.channelId], references: [lineOaChannel.id] }),
}));

export const lineUserMenuRelations = relations(lineUserMenu, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineUserMenu.channelId], references: [lineOaChannel.id] }),
}));

// ─── Broadcast / Narrowcast ────────────────────────────────────────────────

export type BroadcastMessageType = 'text' | 'flex';
export type BroadcastTargetType = 'all' | 'followers';
export type BroadcastStatus = 'draft' | 'sending' | 'sent' | 'failed';

export const lineBroadcast = pgTable('line_broadcast', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull().references(() => lineOaChannel.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  targetType: text('target_type').notNull().default('all').$type<BroadcastTargetType>(),
  messageType: text('message_type').notNull().default('text').$type<BroadcastMessageType>(),
  messageText: text('message_text'),
  messagePayload: jsonb('message_payload').$type<Record<string, unknown>>(),
  status: text('status').notNull().default('draft').$type<BroadcastStatus>(),
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  recipientCount: integer('recipient_count'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('line_broadcast_channelId_idx').on(table.channelId),
]);

export const lineBroadcastRelations = relations(lineBroadcast, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineBroadcast.channelId], references: [lineOaChannel.id] }),
}));

// ─── Account Linking ───────────────────────────────────────────────────────

/**
 * Short-lived token generated by the app user in the dashboard.
 * The LINE user sends this token in chat to claim ownership.
 */
export const lineAccountLinkToken = pgTable('line_account_link_token', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').notNull().references(() => lineOaChannel.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('line_account_link_token_userId_idx').on(table.userId),
  index('line_account_link_token_channelId_idx').on(table.channelId),
]);

/**
 * Permanent link between an app user account and a LINE user ID on a given channel.
 */
export const lineAccountLink = pgTable('line_account_link', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  channelId: text('channel_id').notNull().references(() => lineOaChannel.id, { onDelete: 'cascade' }),
  lineUserId: text('line_user_id').notNull(),
  displayName: text('display_name'),
  pictureUrl: text('picture_url'),
  linkedAt: timestamp('linked_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('line_account_link_channel_line_user_idx').on(table.channelId, table.lineUserId),
  index('line_account_link_userId_idx').on(table.userId),
  index('line_account_link_channelId_idx').on(table.channelId),
]);

export const lineAccountLinkRelations = relations(lineAccountLink, ({ one }) => ({
  channel: one(lineOaChannel, { fields: [lineAccountLink.channelId], references: [lineOaChannel.id] }),
  user: one(user, { fields: [lineAccountLink.userId], references: [user.id] }),
}));
