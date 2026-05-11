import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { requireUser } from '@/lib/auth-server';
import {
  buildRealtimeFunctionTools,
  prepareRealtimeVoiceRun,
  realtimeVoiceContextSchema,
  resolveOpenAIRealtimeModel,
  resolveOpenAIRealtimeVoice,
} from '@/features/chat/server/realtime-voice';

const realtimeSessionRequestSchema = realtimeVoiceContextSchema.extend({
  sdp: z.string().min(1),
});

export const maxDuration = 30;

function hashSafetyIdentifier(userId: string) {
  return createHash('sha256').update(userId).digest('hex');
}

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  try {
    const parsed = realtimeSessionRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid realtime session request' }, { status: 400 });
    }

    const { sdp, ...context } = parsed.data;
    const preparedRun = await prepareRealtimeVoiceRun({
      userId: authResult.user.id,
      context,
    });
    const tools = await buildRealtimeFunctionTools(preparedRun.tools);
    const realtimeModel = resolveOpenAIRealtimeModel();

    const sessionConfig = {
      type: 'realtime',
      model: realtimeModel,
      instructions: [
        preparedRun.systemPrompt,
        'Realtime voice behavior: speak naturally, stay concise, and respond in the same language as the user. If a tool is useful, call it before answering.',
      ].filter(Boolean).join('\n\n'),
      audio: {
        input: {
          transcription: {
            model: process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe',
          },
          turn_detection: {
            type: 'server_vad',
            idle_timeout_ms: 6000,
          },
        },
        output: {
          voice: resolveOpenAIRealtimeVoice(context.voiceName),
        },
      },
      output_modalities: ['audio'],
      tools,
      tool_choice: tools.length > 0 ? 'auto' : 'none',
    };

    const formData = new FormData();
    formData.set('sdp', sdp);
    formData.set('session', JSON.stringify(sessionConfig));

    const response = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'OpenAI-Safety-Identifier': hashSafetyIdentifier(authResult.user.id),
      },
      body: formData,
    });

    const answerSdp = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: answerSdp || 'Failed to create realtime session' },
        { status: response.status },
      );
    }

    return new Response(answerSdp, {
      headers: {
        'Content-Type': 'application/sdp',
        'X-Vaja-Realtime-Model': realtimeModel,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
