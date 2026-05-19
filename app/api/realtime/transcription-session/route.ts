import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireUser } from '@/lib/auth-server';
import {
  buildRealtimeTranscriptionSessionConfig,
  hashRealtimeSafetyIdentifier,
  realtimeTranscriptionSessionRequestSchema,
  resolveOpenAIRealtimeTranscriptionModel,
} from '@/features/chat/server/realtime-transcription';

export const maxDuration = 30;

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    const parsed = realtimeTranscriptionSessionRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid realtime transcription request' }, { status: 400 });
    }

    const { language, latencyMode } = parsed.data;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const clientRequestId = randomUUID();

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Safety-Identifier': hashRealtimeSafetyIdentifier(authResult.user.id),
          'X-Client-Request-Id': clientRequestId,
        },
        body: JSON.stringify({
          session: buildRealtimeTranscriptionSessionConfig({ language, latencyMode }),
        }),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json(
        {
          error: `Failed to mint realtime transcription client secret: ${message}`,
          clientRequestId,
        },
        { status: 504 },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const bodyText = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        {
          error: bodyText || 'Failed to create realtime transcription client secret',
          clientRequestId,
        },
        { status: response.status },
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return NextResponse.json(
        {
          error: 'OpenAI returned an invalid client secret payload',
          clientRequestId,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ...(payload as Record<string, unknown>),
      model: resolveOpenAIRealtimeTranscriptionModel(),
      provider: 'openai',
      clientRequestId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
