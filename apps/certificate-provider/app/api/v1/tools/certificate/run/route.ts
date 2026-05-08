import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { providerRequestSchema } from '@/lib/provider-contract';
import { renderCertificate } from '@/lib/render-certificate';
import { findByIdempotencyKey, setJob } from '@/lib/job-store';
import type { ProviderResponse } from '@/lib/provider-contract';

function verifyAuth(req: NextRequest): boolean {
  const secret = process.env.PROVIDER_SECRET;
  if (!secret) return true; // No secret configured — allow in dev
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = providerRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad request', detail: parsed.error.message }, { status: 400 });
  }

  const { requestId, idempotencyKey, vajaRunId, userRef, input } = parsed.data;

  // Idempotency: return the existing result if the key was already processed
  const existing = findByIdempotencyKey(idempotencyKey);
  if (existing && existing.status !== 'pending') {
    return NextResponse.json(existing.result as ProviderResponse);
  }

  const providerRunId = nanoid();
  const createdAt = new Date().toISOString();

  try {
    const rendered = await renderCertificate(userRef, input, idempotencyKey);
    const completedAt = new Date().toISOString();

    const response: ProviderResponse = {
      providerRunId,
      status: 'success',
      title: rendered.downloadLabel,
      summary: `${rendered.count} certificate${rendered.count !== 1 ? 's' : ''} generated`,
      data: {
        jobId: rendered.jobId,
        count: rendered.count,
        downloadLabel: rendered.downloadLabel,
        fileKey: rendered.fileKey,
        fileName: rendered.fileName,
        fileUrl: rendered.fileUrl,
        format: rendered.format,
        outputMode: rendered.outputMode,
      },
      artifacts: [
        {
          kind: 'file',
          format: rendered.format,
          url: rendered.fileUrl,
          label: rendered.downloadLabel,
        },
      ],
      usage: { durationMs: Date.now() - new Date(createdAt).getTime() },
      createdAt,
      completedAt,
    };

    setJob(providerRunId, {
      providerRunId,
      idempotencyKey,
      status: 'success',
      result: response,
      createdAt,
      completedAt,
    });

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Certificate generation failed';
    const completedAt = new Date().toISOString();

    const response: ProviderResponse = {
      providerRunId,
      status: 'failed',
      error: {
        code: 'RENDER_ERROR',
        message: message.slice(0, 512),
        retryable: false,
      },
      createdAt,
      completedAt,
    };

    setJob(providerRunId, {
      providerRunId,
      idempotencyKey,
      status: 'failed',
      result: response,
      error: message,
      createdAt,
      completedAt,
    });

    console.error('[certificate-provider] render error', { requestId, vajaRunId, err });
    return NextResponse.json(response, { status: 500 });
  }
}
