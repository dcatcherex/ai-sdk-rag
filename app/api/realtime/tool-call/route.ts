import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth-server';
import {
  executeRealtimeToolCall,
  realtimeVoiceContextSchema,
} from '@/features/chat/server/realtime-voice';

const realtimeToolCallSchema = z.object({
  context: realtimeVoiceContextSchema,
  toolName: z.string().min(1),
  callId: z.string().min(1),
  argumentsJson: z.string().default('{}'),
});

export const maxDuration = 30;

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  try {
    const body = realtimeToolCallSchema.parse(await req.json());
    const output = await executeRealtimeToolCall({
      userId: authResult.user.id,
      context: body.context,
      toolName: body.toolName,
      callId: body.callId,
      argumentsJson: body.argumentsJson,
      signal: req.signal,
    });

    return NextResponse.json({ output });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
