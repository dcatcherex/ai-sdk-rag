import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, customType } from "drizzle-orm/pg-core";

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
    index("media_asset_thread_idx").on(table.threadId),
    index("media_asset_message_idx").on(table.messageId),
    index("media_asset_user_idx").on(table.userId),
    index("media_asset_type_idx").on(table.type),
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

// RAG: Document storage with vector embeddings
export const document = pgTable(
  "document",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
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
  ],
);

export const documentChunkRelations = relations(documentChunk, ({ one }) => ({
  document: one(document, {
    fields: [documentChunk.documentId],
    references: [document.id],
  }),
}));
