import { NextResponse } from 'next/server';
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

    const { sdp, language, latencyMode } = parsed.data;
    const formData = new FormData();
    formData.set('sdp', sdp);
    formData.set(
      'session',
      JSON.stringify(buildRealtimeTranscriptionSessionConfig({ language, latencyMode })),
    );

    const response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Safety-Identifier': hashRealtimeSafetyIdentifier(authResult.user.id),
      },
      body: formData,
    });

    const answerSdp = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: answerSdp || 'Failed to create realtime transcription session' },
        { status: response.status },
      );
    }

    return new Response(answerSdp, {
      headers: {
        'Content-Type': 'application/sdp',
        'X-Vaja-Realtime-Provider': 'openai',
        'X-Vaja-Realtime-Model': resolveOpenAIRealtimeTranscriptionModel(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
