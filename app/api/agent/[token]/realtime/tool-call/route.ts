import { NextResponse } from 'next/server';
import {
  executePublicRealtimeToolCall,
  preparePublicRealtimeVoiceRun,
  publicRealtimeToolCallSchema,
} from '@/features/agents/server/public-realtime-voice';

type Params = { params: Promise<{ token: string }> };

export const maxDuration = 30;

export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;
    const body = publicRealtimeToolCallSchema.parse(await req.json());
    const runContext = await preparePublicRealtimeVoiceRun({
      req,
      token,
      context: body.context,
    });
    const output = await executePublicRealtimeToolCall({
      runContext,
      context: body.context,
      callId: body.callId,
      toolName: body.toolName,
      argumentsJson: body.argumentsJson,
      signal: req.signal,
    });

    return NextResponse.json({ output });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool call failed';
    const status = message === 'Password required.' ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
