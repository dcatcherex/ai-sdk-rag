import { z } from 'zod';

import { buildRichMessageDataSchema } from '@/features/rich-messages/dynamic';
import type { RichMessageTemplateCatalogEntry } from '@/features/rich-messages/catalog';
import type {
  RichMessageCategory,
  RichMessageChannel,
  RichMessageFallbackConfig,
  RichMessageLayout,
  RichMessageSchemaDefinition,
  RichMessageTemplate,
} from '@/features/rich-messages/types';
import type { ResponseIntent } from '@/features/response-format/types';
import type { DbRichMessageTemplateRecord } from '@/features/rich-messages/server/repository';

export const richMessageChannelSchema = z.enum(['line', 'web', 'email', 'plain_text']);
export const richMessageCategorySchema = z.enum([
  'common',
  'agriculture',
  'education',
  'clinic',
  'sales',
  'creator',
  'other',
]);
export const responseIntentSchema = z.enum([
  'answer',
  'advisory',
  'diagnosis',
  'risk_summary',
  'record_confirmation',
  'record_saved',
  'market_guidance',
  'lesson_plan',
  'student_support',
  'patient_follow_up',
  'client_follow_up',
  'content_plan',
  'approval_request',
  'escalation',
  'broadcast',
  'unknown',
]);

const richMessageToneSchema = z.enum(['neutral', 'success', 'warning', 'danger', 'info']);

const richMessageActionSchema = z.object({
  label: z.string().min(1),
  kind: z.enum(['message', 'postback', 'uri', 'copy', 'tool']),
  value: z.string().min(1),
  style: z.enum(['primary', 'secondary', 'danger']).optional(),
});

const richMessageMediaSchema = z.object({
  kind: z.literal('image'),
  url: z.string().url(),
  alt: z.string().min(1).optional(),
  aspectRatio: z.enum(['1:1', '4:3', '16:9', '20:13']).optional(),
});

const richMessageSectionSchema = z.object({
  key: z.string().min(1).optional(),
  label: z.string().min(1),
  value: z.string().min(1),
  tone: richMessageToneSchema.optional(),
  toneFrom: z.string().min(1).optional(),
  maxLines: z.number().int().positive().optional(),
});

const richMessageMetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  unit: z.string().min(1).optional(),
  tone: richMessageToneSchema.optional(),
});

export const richMessageLayoutSchema: z.ZodType<RichMessageLayout> = z.lazy(() => z.object({
  type: z.enum(['card', 'summary', 'alert', 'receipt', 'carousel']),
  tone: richMessageToneSchema.optional(),
  eyebrow: z.string().min(1).optional(),
  title: z.string().min(1),
  subtitle: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
  media: richMessageMediaSchema.optional(),
  sections: z.array(richMessageSectionSchema).optional(),
  metrics: z.array(richMessageMetricSchema).optional(),
  actions: z.array(richMessageActionSchema).optional(),
  items: z.array(richMessageLayoutSchema).optional(),
}));

export const richMessageFallbackSchema: z.ZodType<RichMessageFallbackConfig> = z.object({
  altText: z.string().min(1).optional(),
});

const richMessageSchemaFieldDefinitionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1).optional(),
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean().optional(),
  description: z.string().min(1).optional(),
});

export const richMessageSchemaDefinitionSchema: z.ZodType<RichMessageSchemaDefinition> = z.object({
  fields: z.array(richMessageSchemaFieldDefinitionSchema).min(1),
});

export const createDbRichMessageTemplateSchema = z.object({
  key: z.string().min(1).max(120),
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  category: richMessageCategorySchema,
  intent: responseIntentSchema,
  schemaJson: richMessageSchemaDefinitionSchema,
  layoutJson: richMessageLayoutSchema,
  fallbackJson: richMessageFallbackSchema.nullable().optional(),
  sampleDataJson: z.record(z.string(), z.unknown()),
  supportedChannels: z.array(richMessageChannelSchema).min(1),
});

export const updateDbRichMessageTemplateSchema = createDbRichMessageTemplateSchema.partial();

export function buildRuntimeTemplateFromStoredRecord(
  record: Pick<
    DbRichMessageTemplateRecord,
    | 'key'
    | 'title'
    | 'description'
    | 'category'
    | 'intent'
    | 'schemaJson'
    | 'layoutJson'
    | 'fallbackJson'
    | 'supportedChannels'
  >,
): RichMessageTemplate {
  return {
    key: record.key,
    title: record.title,
    description: record.description ?? undefined,
    category: record.category as RichMessageCategory,
    intent: record.intent as ResponseIntent,
    schema: buildRichMessageDataSchema(record.schemaJson),
    supportedChannels: [...record.supportedChannels] as RichMessageChannel[],
    layout: record.layoutJson,
    fallback: record.fallbackJson ?? undefined,
  };
}

export function toDbRichMessageTemplateCatalogEntry(
  record: DbRichMessageTemplateRecord,
): RichMessageTemplateCatalogEntry {
  return {
    id: record.id,
    source: 'database',
    status: record.catalogStatus,
    key: record.key,
    title: record.title,
    description: record.description ?? null,
    category: record.category,
    intent: record.intent,
    supportedChannels: [...record.supportedChannels],
    layoutType: record.layoutJson.type,
    layout: record.layoutJson as Record<string, unknown>,
    sampleData: record.sampleDataJson,
    schemaDefinition: record.schemaJson,
    fallback: record.fallbackJson ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    publishedAt: record.publishedAt?.toISOString() ?? null,
  };
}
