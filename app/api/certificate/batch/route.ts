import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { certificateTemplate, certificateJob } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { generateCertificate, mergePdfBuffers } from '@/lib/certificate-generator';
import { uploadPublicObject } from '@/lib/r2';
import { nanoid } from 'nanoid';
import JSZip from 'jszip';
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
 * POST /api/certificate/batch
 * Body: {
 *   templateId: string,
 *   format: 'png'|'jpg'|'pdf',
 *   recipients: Array<{ values: { fieldId, value }[] }>
 * }
 * Returns: { jobId, zipKey, count }
 */
export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    templateId: string;
    format?: 'png' | 'jpg' | 'pdf';
    exportMode?: 'zip' | 'single_pdf';
    recipients: Array<{ values: CertificateField[] }>;
  };

  const { templateId, recipients, format = 'png', exportMode = 'zip' } = body;

  if (!templateId || !recipients?.length) {
    return NextResponse.json({ error: 'Missing templateId or recipients' }, { status: 400 });
  }

  if (recipients.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 recipients per batch' }, { status: 400 });
  }

  // Load template
  const [template] = await db
    .select()
    .from(certificateTemplate)
    .where(and(eq(certificateTemplate.id, templateId), eq(certificateTemplate.userId, userId)));

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  // Create job record
  const jobId = nanoid();
  await db.insert(certificateJob).values({
    id: jobId,
    userId,
    templateId,
    status: 'processing',
    format,
    totalCount: recipients.length,
    processedCount: 0,
  });

  try {
    const imageRes = await fetch(template.url);
    if (!imageRes.ok) throw new Error('Failed to fetch template image');
    const templateBuffer = Buffer.from(await imageRes.arrayBuffer());
    const fields = template.fields as TextFieldConfig[];

    const zip = new JSZip();
    const usedNames = new Map<string, number>();
    const pdfBuffers: Buffer[] = [];
    const mergedPdfRequested = format === 'pdf' && exportMode === 'single_pdf';

    for (let i = 0; i < recipients.length; i++) {
      const { values } = recipients[i];

      const certBuffer = await generateCertificate({
        templateBuffer,
        templateWidth: template.width,
        templateHeight: template.height,
        fields,
        values,
        format,
      });

      // Build unique filename
      const nameValue = values.find((v) => v.fieldId === 'name')?.value ?? `certificate_${i + 1}`;
      const safeName = nameValue.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 50);
      const count = usedNames.get(safeName) ?? 0;
      usedNames.set(safeName, count + 1);
      const filename = count === 0 ? `${safeName}.${format}` : `${safeName}_${count}.${format}`;

      if (mergedPdfRequested) {
        pdfBuffers.push(certBuffer);
      } else {
        zip.file(filename, certBuffer);
      }
    }

    if (mergedPdfRequested) {
      const mergedPdfBuffer = await mergePdfBuffers(pdfBuffers);
      const safeTemplateName = template.name.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 50) || 'certificates';
      const fileName = `${safeTemplateName}_batch.pdf`;
      const fileKey = `certificates/output/${userId}/${jobId}/${fileName}`;
      const { url: fileUrl } = await uploadPublicObject({
        key: fileKey,
        body: mergedPdfBuffer,
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=86400',
      });

      await db
        .update(certificateJob)
        .set({ status: 'completed', processedCount: recipients.length, zipKey: fileKey, zipUrl: fileUrl, completedAt: new Date() })
        .where(eq(certificateJob.id, jobId));

      return NextResponse.json({
        jobId,
        fileKey,
        fileName,
        count: recipients.length,
        downloadLabel: 'Download PDF',
      });
    }

    const zipBuffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    const fileName = `${template.name.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 50) || 'certificates'}.zip`;
    const fileKey = `certificates/zips/${userId}/${jobId}.zip`;
    const { url: fileUrl } = await uploadPublicObject({
      key: fileKey,
      body: zipBuffer,
      contentType: 'application/zip',
      cacheControl: 'public, max-age=86400',
    });

    await db
      .update(certificateJob)
      .set({ status: 'completed', processedCount: recipients.length, zipKey: fileKey, zipUrl: fileUrl, completedAt: new Date() })
      .where(eq(certificateJob.id, jobId));

    return NextResponse.json({
      jobId,
      fileKey,
      fileName,
      count: recipients.length,
      downloadLabel: 'Download ZIP',
    });
  } catch (error) {
    await db
      .update(certificateJob)
      .set({ status: 'failed', error: String(error) })
      .where(eq(certificateJob.id, jobId));

    console.error('[batch certificate]', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
