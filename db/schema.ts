import { relations, sql } from "drizzle-orm";
import { boolean, foreignKey, index, integer, jsonb, pgTable, text, timestamp, customType, uniqueIndex } from "drizzle-orm/pg-core";

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
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessage.id, { onDelete: "cascade" }),
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
  r2Key: text('r2_key').notNull(),
  url: text('url').notNull(),
  thumbnailKey: text('thumbnail_key'),
  thumbnailUrl: text('thumbnail_url'),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  // Array of TextFieldConfig stored as JSONB
  fields: jsonb('fields').notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [index('certificate_template_userId_idx').on(table.userId)]);

export const certificateJob = pgTable('certificate_job', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  templateId: text('template_id').notNull().references(() => certificateTemplate.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // pending | processing | completed | failed
  format: text('format').notNull().default('png'),     // png | jpg | pdf
  totalCount: integer('total_count').notNull().default(0),
  processedCount: integer('processed_count').notNull().default(0),
  zipKey: text('zip_key'),
  zipUrl: text('zip_url'),
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

export const agent = pgTable('agent', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  modelId: text('model_id'),
  enabledTools: text('enabled_tools').array().notNull().default(sql`'{}'::text[]`),
  documentIds: text('document_ids').array().notNull().default(sql`'{}'::text[]`),
  isPublic: boolean('is_public').notNull().default(false),
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
