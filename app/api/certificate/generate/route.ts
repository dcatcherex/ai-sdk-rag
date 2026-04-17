import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { generateCertificateOutput } from '@/lib/certificate-service';
import type { CertificateField } from '@/lib/certificate-generator';
import type { PdfQuality } from '@/features/certificate/types';

async function getSessionUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    templateId: string;
    values: CertificateField[];
    format?: 'png' | 'jpg' | 'pdf';
    pdfQuality?: PdfQuality;
  };

  const { templateId, values, format = 'png', pdfQuality = 'standard' } = body;
  if (!templateId || !values?.length) {
    return NextResponse.json({ error: 'Missing templateId or values' }, { status: 400 });
  }

  try {
    const result = await generateCertificateOutput({
      userId,
      templateId,
      recipients: [{ values }],
      format,
      pdfQuality,
      source: 'manual',
    });

    return NextResponse.json({
      jobId: result.jobId,
      url: result.fileUrl,
      filename: result.fileName,
      r2Key: result.fileKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
