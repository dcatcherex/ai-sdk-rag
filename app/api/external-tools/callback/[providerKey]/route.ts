import { NextRequest, NextResponse } from 'next/server';

import { processProviderCallback } from '@/features/external-tools/callbacks';
import { getProviderByKey } from '@/features/external-tools/registry';

/**
 * POST /api/external-tools/callback/[providerKey]
 *
 * Authenticated server-to-server endpoint that receives provider callbacks
 * for async tool runs. The provider signs the body with HMAC-SHA256 using
 * the shared PROVIDER_SECRET_<KEY> environment variable.
 *
 * Signature header: X-Signature-256: sha256=<hex>
 *
 * Returns 200 even for unknown runs so that the provider does not retry
 * valid-but-already-processed callbacks.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ providerKey: string }> },
) {
  const { providerKey } = await params;

  // Reject callbacks for unregistered providers immediately
  const provider = getProviderByKey(providerKey);
  if (!provider) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-signature-256');

  try {
    const result = await processProviderCallback(providerKey, rawBody, signature);

    return NextResponse.json({
      received: true,
      vajaRunId: result.vajaRunId || undefined,
      status: result.status,
      skipped: result.skipped,
    });
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'CALLBACK_ERROR';

    if (code === 'INVALID_SIGNATURE') {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    if (code === 'INVALID_JSON' || code === 'SCHEMA_ERROR') {
      return NextResponse.json({ error: 'Bad request', detail: (err as Error).message }, { status: 400 });
    }

    console.error('[external-tools callback]', { providerKey, err });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
