import { GoogleGenAI } from '@google/genai';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const TRANSCRIPTION_MODEL = 'gemini-2.5-flash-lite';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const audioBlob = formData.get('audio') as Blob | null;

    if (!audioBlob || audioBlob.size === 0) {
      return Response.json({ error: 'No audio provided' }, { status: 400 });
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const mimeType = audioBlob.type || 'audio/webm';
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const response = await ai.models.generateContent({
      model: TRANSCRIPTION_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: 'Transcribe this audio accurately, preserving the original language (including Thai). Return only the spoken words.',
            },
          ],
        },
      ],
    });

    const transcript = response.text?.trim() ?? '';
    return Response.json({ transcript, model: 'Gemini 2.5 Flash Lite' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/transcribe]', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
