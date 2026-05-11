import { requireAdmin } from '@/lib/admin';
import { db } from '@/lib/db';
import { lineFlexTemplate } from '@/db/schema';
import { listRichMessageTemplateCatalogEntries } from '@/features/rich-messages/catalog';
import { hasRichMessageTemplate } from '@/features/rich-messages/registry';
import {
  createDbRichMessageTemplateSchema,
  toDbRichMessageTemplateCatalogEntry,
} from '@/features/rich-messages/server/service';
import {
  createDbRichMessageTemplate,
  getDbRichMessageTemplateByKey,
  listDbRichMessageTemplates,
} from '@/features/rich-messages/server/repository';

export async function GET() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const codeTemplates = listRichMessageTemplateCatalogEntries();

  try {
    const flexOverrides = await db
      .select({
        id: lineFlexTemplate.id,
        name: lineFlexTemplate.name,
        richTemplateKey: lineFlexTemplate.richTemplateKey,
        templateType: lineFlexTemplate.templateType,
        catalogStatus: lineFlexTemplate.catalogStatus,
      })
      .from(lineFlexTemplate);
    const dbTemplates = await listDbRichMessageTemplates();
    const overrideMap = new Map<string, Array<{
      id: string;
      name: string;
      status: string;
      templateType: string;
    }>>();

    for (const override of flexOverrides) {
      if (!override.richTemplateKey || override.templateType !== 'line_override') {
        continue;
      }

      const overrides = overrideMap.get(override.richTemplateKey) ?? [];
      overrides.push({
        id: override.id,
        name: override.name,
        status: override.catalogStatus,
        templateType: override.templateType,
      });
      overrideMap.set(override.richTemplateKey, overrides);
    }

    const attachOverrideSummary = <T extends { key: string }>(template: T) => {
      const overrides = overrideMap.get(template.key) ?? [];
      const publishedOverride = overrides.find((override) => override.status === 'published') ?? null;

      return {
        ...template,
        lineOverrideCount: overrides.length,
        publishedLineOverride: publishedOverride
          ? {
              id: publishedOverride.id,
              name: publishedOverride.name,
              status: publishedOverride.status,
            }
          : null,
      };
    };

    return Response.json({
      databaseAvailable: true,
      templates: [
        ...codeTemplates.map(attachOverrideSummary),
        ...dbTemplates.map(toDbRichMessageTemplateCatalogEntry).map(attachOverrideSummary),
      ],
    });
  } catch {
    return Response.json({
      databaseAvailable: false,
      templates: codeTemplates,
    });
  }
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  const body = await req.json();
  const result = createDbRichMessageTemplateSchema.safeParse(body);
  if (!result.success) {
    return new Response('Bad Request', { status: 400 });
  }

  if (hasRichMessageTemplate(result.data.key)) {
    return new Response('Template key already exists', { status: 409 });
  }

  const existing = await getDbRichMessageTemplateByKey(result.data.key);
  if (existing) {
    return new Response('Template key already exists', { status: 409 });
  }

  const template = await createDbRichMessageTemplate({
    ...result.data,
    createdBy: adminCheck.session.user.id,
  });

  if (!template) {
    return new Response('Failed to create template', { status: 500 });
  }

  return Response.json(
    { template: toDbRichMessageTemplateCatalogEntry(template) },
    { status: 201 },
  );
}
