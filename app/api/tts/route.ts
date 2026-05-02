import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { getCurrentUser } from '@/lib/auth-server';

function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'TTS not configured' }, { status: 503 });
  }

  const { text } = await req.json() as { text?: string };
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const ttsText = text.slice(0, 1000);

  try {
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await genAI.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: ttsText }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } },
        },
      },
    });

    const pcmBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!pcmBase64) {
      const finishReason = response.candidates?.[0]?.finishReason;
      console.error('[TTS] No audio data returned. finishReason:', finishReason);
      return NextResponse.json({ error: 'TTS returned no audio', finishReason }, { status: 502 });
    }

    const pcmBuffer = Buffer.from(pcmBase64, 'base64');
    const wavBuffer = pcmToWav(pcmBuffer);

    return new NextResponse(new Uint8Array(wavBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': String(wavBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[TTS] Generation failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'TTS generation failed' },
      { status: 502 },
    );
  }
}
