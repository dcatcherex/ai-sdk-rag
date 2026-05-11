import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type {
  RichMessageCategory,
  RichMessageChannel,
  RichMessageFallbackConfig,
  RichMessageLayout,
  RichMessageSchemaDefinition,
} from '@/features/rich-messages/types';
import type { ResponseIntent } from '@/features/response-format/types';

export type RichMessageTemplateCatalogStatus =
  | 'draft'
  | 'published'
  | 'archived';

export const richMessageTemplate = pgTable('rich_message_template', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull().$type<RichMessageCategory>(),
  intent: text('intent').notNull().$type<ResponseIntent>(),
  schemaJson: jsonb('schema_json').notNull().$type<RichMessageSchemaDefinition>(),
  layoutJson: jsonb('layout_json').notNull().$type<RichMessageLayout>(),
  fallbackJson: jsonb('fallback_json').$type<RichMessageFallbackConfig>(),
  sampleDataJson: jsonb('sample_data_json').notNull().$type<Record<string, unknown>>(),
  supportedChannels: text('supported_channels').array().notNull().$type<RichMessageChannel[]>(),
  catalogStatus: text('catalog_status').notNull().default('draft').$type<RichMessageTemplateCatalogStatus>(),
  createdBy: text('created_by'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('rich_message_template_key_idx').on(table.key),
  index('rich_message_template_status_idx').on(table.catalogStatus),
  index('rich_message_template_category_idx').on(table.category),
]);
