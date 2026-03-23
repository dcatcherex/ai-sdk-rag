import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { generateCertificateOutput } from '@/lib/certificate-service';
import type { CertificateField } from '@/lib/certificate-generator';
import type { PdfQuality } from '@/features/certificate/types';

async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    templateId: string;
    format?: 'png' | 'jpg' | 'pdf';
    exportMode?: 'zip' | 'single_pdf' | 'sheet_pdf';
    pdfQuality?: PdfQuality;
    padToGrid?: boolean;
    fillerTemplateId?: string;
    recipients: Array<{ values: CertificateField[] }>;
  };

  const { templateId, recipients, format = 'png', exportMode = 'zip', pdfQuality = 'standard', padToGrid, fillerTemplateId } = body;

  if (!templateId || !recipients?.length) {
    return NextResponse.json({ error: 'Missing templateId or recipients' }, { status: 400 });
  }

  try {
    const result = await generateCertificateOutput({
      userId,
      templateId,
      recipients,
      format,
      outputMode: exportMode,
      pdfQuality,
      padToGrid,
      fillerTemplateId,
      source: 'manual',
    });

    return NextResponse.json({
      jobId: result.jobId,
      fileKey: result.fileKey,
      fileName: result.fileName,
      fileUrl: result.fileUrl,
      count: result.count,
      downloadLabel: result.downloadLabel,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed';

    console.error('[batch certificate]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
