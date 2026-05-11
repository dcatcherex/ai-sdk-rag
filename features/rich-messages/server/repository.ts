import { and, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import {
  richMessageTemplate,
  type RichMessageTemplateCatalogStatus,
} from '@/db/schema';
import type {
  RichMessageCategory,
  RichMessageChannel,
  RichMessageFallbackConfig,
  RichMessageLayout,
  RichMessageSchemaDefinition,
} from '@/features/rich-messages/types';
import type { ResponseIntent } from '@/features/response-format/types';

export type DbRichMessageTemplateRecord = typeof richMessageTemplate.$inferSelect;

export type CreateDbRichMessageTemplateInput = {
  key: string;
  title: string;
  description?: string | null;
  category: RichMessageCategory;
  intent: ResponseIntent;
  schemaJson: RichMessageSchemaDefinition;
  layoutJson: RichMessageLayout;
  fallbackJson?: RichMessageFallbackConfig | null;
  sampleDataJson: Record<string, unknown>;
  supportedChannels: RichMessageChannel[];
  createdBy: string | null;
};

export type UpdateDbRichMessageTemplateInput = Partial<Omit<CreateDbRichMessageTemplateInput, 'createdBy'>>;

export async function listDbRichMessageTemplates() {
  return db
    .select()
    .from(richMessageTemplate)
    .orderBy(desc(richMessageTemplate.updatedAt));
}

export async function getDbRichMessageTemplateById(id: string) {
  const rows = await db
    .select()
    .from(richMessageTemplate)
    .where(eq(richMessageTemplate.id, id))
    .limit(1);

  return rows[0] ?? null;
}

export async function getDbRichMessageTemplateByKey(key: string) {
  const rows = await db
    .select()
    .from(richMessageTemplate)
    .where(eq(richMessageTemplate.key, key))
    .limit(1);

  return rows[0] ?? null;
}

export async function getPublishedDbRichMessageTemplateByKey(key: string) {
  const rows = await db
    .select()
    .from(richMessageTemplate)
    .where(
      and(
        eq(richMessageTemplate.key, key),
        eq(richMessageTemplate.catalogStatus, 'published'),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function listPublishedDbRichMessageTemplatesByKeys(keys: string[]) {
  if (keys.length === 0) {
    return [];
  }

  return db
    .select()
    .from(richMessageTemplate)
    .where(
      and(
        inArray(richMessageTemplate.key, keys),
        eq(richMessageTemplate.catalogStatus, 'published'),
      ),
    );
}

export async function createDbRichMessageTemplate(input: CreateDbRichMessageTemplateInput) {
  const now = new Date();
  const id = nanoid();

  await db.insert(richMessageTemplate).values({
    id,
    key: input.key,
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    intent: input.intent,
    schemaJson: input.schemaJson,
    layoutJson: input.layoutJson,
    fallbackJson: input.fallbackJson ?? null,
    sampleDataJson: input.sampleDataJson,
    supportedChannels: input.supportedChannels,
    catalogStatus: 'draft',
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  });

  return getDbRichMessageTemplateById(id);
}

export async function updateDbRichMessageTemplate(
  id: string,
  input: UpdateDbRichMessageTemplateInput,
) {
  await db
    .update(richMessageTemplate)
    .set({
      ...(input.key ? { key: input.key } : {}),
      ...(input.title ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description ?? null } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.intent ? { intent: input.intent } : {}),
      ...(input.schemaJson ? { schemaJson: input.schemaJson } : {}),
      ...(input.layoutJson ? { layoutJson: input.layoutJson } : {}),
      ...(input.fallbackJson !== undefined ? { fallbackJson: input.fallbackJson ?? null } : {}),
      ...(input.sampleDataJson ? { sampleDataJson: input.sampleDataJson } : {}),
      ...(input.supportedChannels ? { supportedChannels: input.supportedChannels } : {}),
      updatedAt: new Date(),
    })
    .where(eq(richMessageTemplate.id, id));

  return getDbRichMessageTemplateById(id);
}

export async function deleteDbRichMessageTemplate(id: string) {
  await db.delete(richMessageTemplate).where(eq(richMessageTemplate.id, id));
}

export async function setDbRichMessageTemplateStatus(
  id: string,
  status: RichMessageTemplateCatalogStatus,
) {
  await db
    .update(richMessageTemplate)
    .set({
      catalogStatus: status,
      publishedAt: status === 'published' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(richMessageTemplate.id, id));

  return getDbRichMessageTemplateById(id);
}

export async function findDbRichMessageTemplateKeyConflict(id: string, key: string) {
  const rows = await db
    .select({ id: richMessageTemplate.id })
    .from(richMessageTemplate)
    .where(eq(richMessageTemplate.key, key))
    .limit(1);

  return rows[0]?.id && rows[0].id !== id ? rows[0].id : null;
}
