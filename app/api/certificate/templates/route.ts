import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { certificateTemplate } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { uploadPublicObject } from '@/lib/r2';
import { generateThumbnail, getImageDimensions } from '@/lib/certificate-generator';
import {
  getDefaultPrintSheetSettingsForTemplateType,
  getEstimatedTemplateItemSizeMm,
  normalizePrintSheetSettings,
  normalizeTemplateType,
} from '@/lib/certificate-print';
import { nanoid } from 'nanoid';
import type { TextFieldConfig } from '@/lib/certificate-generator';

async function getSessionUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/** GET /api/certificate/templates — list all templates for the user */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const templates = await db
    .select()
    .from(certificateTemplate)
    .where(eq(certificateTemplate.userId, userId))
    .orderBy(certificateTemplate.createdAt);

  return NextResponse.json({ templates });
}

/**
 * POST /api/certificate/templates
 * multipart/form-data: file (image), name, description?, fields (JSON string)
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const name = formData.get('name') as string | null;
  const description = formData.get('description') as string | null;
  const fieldsRaw = formData.get('fields') as string | null;
  const templateTypeRaw = formData.get('templateType') as string | null;
  const printSettingsRaw = formData.get('printSettings') as string | null;

  if (!file || !name) {
    return NextResponse.json({ error: 'Missing file or name' }, { status: 400 });
  }

  let fields: TextFieldConfig[] = [];
  if (fieldsRaw) {
    try {
      fields = JSON.parse(fieldsRaw);
    } catch {
      return NextResponse.json({ error: 'Invalid fields JSON' }, { status: 400 });
    }
  }

  const templateType = normalizeTemplateType(templateTypeRaw);
  const id = nanoid();
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Get dimensions
  const { width, height } = await getImageDimensions(buffer);
  const estimatedItemSize = getEstimatedTemplateItemSizeMm(width, height);
  const defaultPrintSettings = getDefaultPrintSheetSettingsForTemplateType(templateType, estimatedItemSize);
  let printSettings = defaultPrintSettings;

  if (printSettingsRaw) {
    try {
      printSettings = normalizePrintSheetSettings(JSON.parse(printSettingsRaw) as Record<string, unknown>, {
        fallbackItemWidthMm: estimatedItemSize.itemWidthMm,
        fallbackItemHeightMm: estimatedItemSize.itemHeightMm,
      });
    } catch {
      return NextResponse.json({ error: 'Invalid print settings JSON' }, { status: 400 });
    }
  }

  // Upload original
  const r2Key = `certificates/templates/${id}/original.${ext}`;
  const { url } = await uploadPublicObject({
    key: r2Key,
    body: buffer,
    contentType: file.type || 'image/png',
    cacheControl: 'public, max-age=31536000, immutable',
  });

  // Upload thumbnail
  const thumbBuffer = await generateThumbnail(buffer);
  const thumbKey = `certificates/templates/${id}/thumbnail.jpg`;
  const { url: thumbnailUrl } = await uploadPublicObject({
    key: thumbKey,
    body: thumbBuffer,
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000, immutable',
  });

  const [created] = await db
    .insert(certificateTemplate)
    .values({
      id,
      userId,
      name,
      description,
      templateType,
      r2Key,
      url,
      thumbnailKey: thumbKey,
      thumbnailUrl,
      width,
      height,
      fields,
      backFields: [],
      printSettings,
    })
    .returning();

  return NextResponse.json({ template: created }, { status: 201 });
}
