import type { z } from 'zod';
import type { ResponseIntent } from '@/features/response-format/types';

export type RichMessageChannel =
  | 'line'
  | 'web'
  | 'email'
  | 'plain_text';

export type RichMessageCategory =
  | 'common'
  | 'agriculture'
  | 'education'
  | 'clinic'
  | 'sales'
  | 'creator'
  | 'other';

export type RichMessageSchemaFieldType =
  | 'string'
  | 'number'
  | 'boolean';

export type RichMessageSchemaFieldDefinition = {
  key: string;
  label?: string;
  type: RichMessageSchemaFieldType;
  required?: boolean;
  description?: string;
};

export type RichMessageSchemaDefinition = {
  fields: RichMessageSchemaFieldDefinition[];
};

export type RichMessageTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type RichMessageAction = {
  label: string;
  kind: 'message' | 'postback' | 'uri' | 'copy' | 'tool';
  value: string;
  style?: 'primary' | 'secondary' | 'danger';
};

export type RichMessageMedia = {
  kind: 'image';
  url: string;
  alt?: string;
  aspectRatio?: '1:1' | '4:3' | '16:9' | '20:13';
};

export type RichMessageSection = {
  key?: string;
  label: string;
  value: string;
  tone?: RichMessageTone;
  toneFrom?: string;
  maxLines?: number;
};

export type RichMessageMetric = {
  label: string;
  value: string;
  unit?: string;
  tone?: RichMessageTone;
};

export type RichMessageLayout = {
  type: 'card' | 'summary' | 'alert' | 'receipt' | 'carousel';
  tone?: RichMessageTone;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  summary?: string;
  media?: RichMessageMedia;
  sections?: RichMessageSection[];
  metrics?: RichMessageMetric[];
  actions?: RichMessageAction[];
  items?: RichMessageLayout[];
};

export type RichMessageFallbackConfig = {
  altText?: string;
};

export type RichMessageTemplate<TData extends Record<string, unknown> = Record<string, unknown>> = {
  key: string;
  title: string;
  description?: string;
  category: RichMessageCategory;
  intent: ResponseIntent;
  schema: z.ZodType<TData>;
  supportedChannels: RichMessageChannel[];
  layout: RichMessageLayout;
  fallback?: RichMessageFallbackConfig;
};

export type RichMessageInstance = {
  kind: 'rich_message';
  templateKey: string;
  intent: ResponseIntent;
  altText: string;
  fallbackText: string;
  data: Record<string, unknown>;
  resolvedLayout: RichMessageLayout;
  metadata?: Record<string, unknown>;
};

export type WebRichMessageViewModel = {
  tone: RichMessageTone;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  summary?: string;
  sections: Array<{ label: string; value: string; tone?: RichMessageTone }>;
  metrics: Array<{ label: string; value: string; unit?: string; tone?: RichMessageTone }>;
  actions: RichMessageAction[];
  media?: RichMessageMedia;
};

export function isRichMessageInstance(value: unknown): value is RichMessageInstance {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.kind === 'rich_message'
    && typeof record.templateKey === 'string'
    && typeof record.altText === 'string'
    && typeof record.fallbackText === 'string'
    && !!record.resolvedLayout
    && typeof record.resolvedLayout === 'object'
  );
}
