import { relations, sql } from "drizzle-orm";
import { customType, index, jsonb, pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

import { user } from "./auth";

type VectorConfig = { dimensions?: number };

const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    const typed = config as VectorConfig | undefined;
    return `vector(${typed?.dimensions ?? 1024})`;
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

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
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("document_metadata_idx").using("gin", table.metadata),
    index("document_user_id_idx").on(table.userId),
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
    embedding: vector("embedding", { dimensions: 1024 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("document_chunk_document_id_idx").on(table.documentId),
    index("document_chunk_fts_idx").using("gin", sql`to_tsvector('english', ${table.content})`),
  ],
);

export const documentChunkRelations = relations(documentChunk, ({ one }) => ({
  document: one(document, {
    fields: [documentChunk.documentId],
    references: [document.id],
  }),
}));
