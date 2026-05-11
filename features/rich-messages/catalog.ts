import type {
  RichMessageFallbackConfig,
  RichMessageSchemaDefinition,
} from '@/features/rich-messages/types';
import { getSampleRichMessageData } from '@/features/rich-messages/sample-data';
import { getRichMessageTemplate, listRichMessageTemplates } from '@/features/rich-messages/registry';

export type RichMessageTemplateCatalogEntry = {
  id?: string;
  source: 'code' | 'database';
  status: 'built_in' | 'draft' | 'published' | 'archived';
  key: string;
  title: string;
  description: string | null;
  category: string;
  intent: string;
  supportedChannels: string[];
  layoutType: string;
  layout: Record<string, unknown>;
  sampleData: Record<string, unknown>;
  schemaDefinition?: RichMessageSchemaDefinition;
  fallback?: RichMessageFallbackConfig | null;
  lineOverrideCount?: number;
  publishedLineOverride?: {
    id: string;
    name: string;
    status: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
};

function toCatalogEntry(key: string): RichMessageTemplateCatalogEntry | null {
  const template = getRichMessageTemplate(key);
  if (!template) {
    return null;
  }

  return {
    source: 'code',
    status: 'built_in',
    key: template.key,
    title: template.title,
    description: template.description ?? null,
    category: template.category,
    intent: template.intent,
    supportedChannels: [...template.supportedChannels],
    layoutType: template.layout.type,
    layout: template.layout as Record<string, unknown>,
    sampleData: getSampleRichMessageData(template),
  };
}

export function listRichMessageTemplateCatalogEntries(): RichMessageTemplateCatalogEntry[] {
  return listRichMessageTemplates()
    .map((template) => toCatalogEntry(template.key))
    .filter((entry): entry is RichMessageTemplateCatalogEntry => entry !== null);
}

export function getRichMessageTemplateCatalogEntry(
  key: string,
): RichMessageTemplateCatalogEntry | null {
  return toCatalogEntry(key);
}
