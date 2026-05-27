import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { getUserBalance } from '@/lib/credits';
import {
  buildRealtimeFunctionTools,
  buildRealtimeVoiceInstructions,
  resolveOpenAIRealtimeModel,
  resolveOpenAIRealtimeReasoningEffort,
  resolveOpenAIRealtimeVoice,
} from '@/features/chat/server/realtime-voice';
import {
  preparePublicRealtimeVoiceRun,
  publicRealtimeSessionRequestSchema,
} from '@/features/agents/server/public-realtime-voice';

type Params = { params: Promise<{ token: string }> };

export const maxDuration = 30;

function hashSafetyIdentifier(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function encodeHeaderJson(value: unknown) {
  return encodeURIComponent(JSON.stringify(value));
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const parsed = publicRealtimeSessionRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid realtime session request' }, { status: 400 });
    }

    const { sdp, ...context } = parsed.data;
    const runContext = await preparePublicRealtimeVoiceRun({ req, token, context });
    const { turn, share, ownerId, guestId } = runContext;
    const creditCost = turn.creditCost;

    if (share.creditLimit !== null && share.creditsUsed + creditCost > share.creditLimit) {
      return NextResponse.json({ error: 'This link has reached its credit budget.' }, { status: 402 });
    }

    const ownerBalance = await getUserBalance(ownerId);
    if (ownerBalance < creditCost) {
      return NextResponse.json(
        { error: 'This agent is temporarily unavailable (owner has insufficient credits).' },
        { status: 402 },
      );
    }

    const tools = await buildRealtimeFunctionTools(turn.preparedRun.tools);
    const realtimeModel = resolveOpenAIRealtimeModel();
    const reasoningEffort = resolveOpenAIRealtimeReasoningEffort();
    const activatedSkills = turn.preparedRun.skillRuntime.activatedSkills.slice(0, 20).map((entry) => ({
      id: entry.skill.id,
      name: entry.skill.name,
      source: entry.activationSource,
    }));

    const sessionConfig = {
      type: 'realtime',
      model: realtimeModel,
      instructions: [
        turn.systemPrompt,
        buildRealtimeVoiceInstructions(),
      ].filter(Boolean).join('\n\n'),
      reasoning: {
        effort: reasoningEffort,
      },
      audio: {
        input: {
          transcription: {
            model: process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL?.trim() || 'gpt-realtime-whisper',
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
        'OpenAI-Safety-Identifier': hashSafetyIdentifier(`${ownerId}:${guestId}`),
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
        'X-Vaja-Realtime-Provider': 'openai',
        'X-Vaja-Realtime-Model': realtimeModel,
        'X-Vaja-Realtime-Activated-Skills': encodeHeaderJson(activatedSkills),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Password required.' ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
