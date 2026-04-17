import { GoogleGenAI, Modality } from '@google/genai';
import { requireUser } from "@/lib/auth-server";

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  // authTokens.create is only available in the v1alpha API
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { apiVersion: 'v1alpha' } });

  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: {
            automaticActivityDetection: {
              disabled: true,
            },
          },
          sessionResumption: {},
        },
      },
    },
  });

  return Response.json({ token: token.name });
}
