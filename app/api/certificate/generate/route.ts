import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { certificateTemplate } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { generateCertificate } from '@/lib/certificate-generator';
import { uploadPublicObject } from '@/lib/r2';
import { nanoid } from 'nanoid';
import type { CertificateField, TextFieldConfig } from '@/lib/certificate-generator';

async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  pdf: 'application/pdf',
};

/**
 * POST /api/certificate/generate
 * Body: { templateId, values: { fieldId, value }[], format: 'png'|'jpg'|'pdf' }
 * Returns: { url, filename }
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    templateId: string;
    values: CertificateField[];
    format?: 'png' | 'jpg' | 'pdf';
  };

  const { templateId, values, format = 'png' } = body;
  if (!templateId || !values?.length) {
    return NextResponse.json({ error: 'Missing templateId or values' }, { status: 400 });
  }

  // Load template record
  const [template] = await db
    .select()
    .from(certificateTemplate)
    .where(and(eq(certificateTemplate.id, templateId), eq(certificateTemplate.userId, userId)));

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  // Fetch the template image from R2
  const imageRes = await fetch(template.url);
  if (!imageRes.ok) return NextResponse.json({ error: 'Failed to fetch template image' }, { status: 500 });
  const templateBuffer = Buffer.from(await imageRes.arrayBuffer());

  // Generate certificate
  const certBuffer = await generateCertificate({
    templateBuffer,
    templateWidth: template.width,
    templateHeight: template.height,
    fields: template.fields as TextFieldConfig[],
    values,
    format,
  });

  // Build a filename from the "name" field value if present
  const nameValue = values.find((v) => v.fieldId === 'name')?.value ?? nanoid(8);
  const safeName = nameValue.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 50);
  const filename = `${safeName}.${format}`;
  const jobId = nanoid();
  const r2Key = `certificates/output/${userId}/${jobId}/${filename}`;

  const { url } = await uploadPublicObject({
    key: r2Key,
    body: certBuffer,
    contentType: MIME[format],
    cacheControl: 'public, max-age=86400',
  });

  return NextResponse.json({ url, filename, r2Key });
}
