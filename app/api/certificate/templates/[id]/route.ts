import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { certificateTemplate } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { uploadPublicObject } from '@/lib/r2';
import { generateThumbnail, getImageDimensions } from '@/lib/certificate-generator';
import {
  getDefaultPrintSheetSettingsForTemplateType,
  getEstimatedTemplateItemSizeMm,
  normalizePrintSheetSettings,
  normalizeTemplateType,
} from '@/lib/certificate-print';
import type { TextFieldConfig } from '@/lib/certificate-generator';

async function getSessionUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/** GET /api/certificate/templates/[id] */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [template] = await db
    .select()
    .from(certificateTemplate)
    .where(and(eq(certificateTemplate.id, id), eq(certificateTemplate.userId, userId)));

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ template });
}

/**
 * PUT /api/certificate/templates/[id]
 * JSON body: { name?, description?, fields? }
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    name?: string;
    description?: string;
    fields?: TextFieldConfig[];
    backFields?: TextFieldConfig[];
    templateType?: string;
    printSettings?: Record<string, unknown>;
  };

  const normalizedTemplateType = body.templateType !== undefined
    ? normalizeTemplateType(body.templateType)
    : undefined;
  const [existing] = await db
    .select()
    .from(certificateTemplate)
    .where(and(eq(certificateTemplate.id, id), eq(certificateTemplate.userId, userId)));

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const estimatedItemSize = getEstimatedTemplateItemSizeMm(existing.width, existing.height);
  const normalizedPrintSettings = body.printSettings !== undefined
    ? normalizePrintSheetSettings(body.printSettings, {
        fallbackItemWidthMm: estimatedItemSize.itemWidthMm,
        fallbackItemHeightMm: estimatedItemSize.itemHeightMm,
      })
    : undefined;

  const [updated] = await db
    .update(certificateTemplate)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.fields !== undefined && { fields: body.fields }),
      ...(body.backFields !== undefined && { backFields: body.backFields }),
      ...(normalizedTemplateType !== undefined && { templateType: normalizedTemplateType }),
      ...(normalizedPrintSettings !== undefined && { printSettings: normalizedPrintSettings }),
    })
    .where(and(eq(certificateTemplate.id, id), eq(certificateTemplate.userId, userId)))
    .returning();

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ template: updated });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get('file');
  const side = formData.get('side') === 'back' ? 'back' : 'front';

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(certificateTemplate)
    .where(and(eq(certificateTemplate.id, id), eq(certificateTemplate.userId, userId)));

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const buffer = Buffer.from(await file.arrayBuffer());
  const { width, height } = await getImageDimensions(buffer);

  const r2Key = side === 'back'
    ? `certificates/templates/${id}/back.${ext}`
    : `certificates/templates/${id}/original.${ext}`;
  const { url } = await uploadPublicObject({
    key: r2Key,
    body: buffer,
    contentType: file.type || 'image/png',
    cacheControl: 'public, max-age=31536000, immutable',
  });

  const thumbBuffer = await generateThumbnail(buffer);
  const thumbnailKey = side === 'back'
    ? `certificates/templates/${id}/back-thumbnail.jpg`
    : `certificates/templates/${id}/thumbnail.jpg`;
  const { url: thumbnailUrl } = await uploadPublicObject({
    key: thumbnailKey,
    body: thumbBuffer,
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000, immutable',
  });

  const nextPrintSettings = side === 'front'
    ? normalizePrintSheetSettings(existing.printSettings as Record<string, unknown>, {
        fallbackItemWidthMm: getEstimatedTemplateItemSizeMm(width, height).itemWidthMm,
        fallbackItemHeightMm: getEstimatedTemplateItemSizeMm(width, height).itemHeightMm,
      })
    : normalizePrintSheetSettings(existing.printSettings as Record<string, unknown>, {
        fallbackItemWidthMm: getEstimatedTemplateItemSizeMm(existing.width, existing.height).itemWidthMm,
        fallbackItemHeightMm: getEstimatedTemplateItemSizeMm(existing.width, existing.height).itemHeightMm,
      });
  const [updated] = await db
    .update(certificateTemplate)
    .set({
      ...(side === 'back'
        ? {
            backR2Key: r2Key,
            backUrl: url,
            backThumbnailKey: thumbnailKey,
            backThumbnailUrl: thumbnailUrl,
            backWidth: width,
            backHeight: height,
          }
        : {
            r2Key,
            url,
            thumbnailKey,
            thumbnailUrl,
            width,
            height,
            printSettings: nextPrintSettings,
          }),
    })
    .where(and(eq(certificateTemplate.id, id), eq(certificateTemplate.userId, userId)))
    .returning();

  return NextResponse.json({ template: updated ?? existing });
}

/** DELETE /api/certificate/templates/[id] */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const [deleted] = await db
    .delete(certificateTemplate)
    .where(and(eq(certificateTemplate.id, id), eq(certificateTemplate.userId, userId)))
    .returning();

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
