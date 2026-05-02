import { GoogleGenAI, Modality } from '@google/genai';
import { requireUser } from "@/lib/auth-server";

const DEFAULT_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

function isSupportedLiveModel(model: string) {
  return model.startsWith('gemini-live-') || model.endsWith('-flash-live-preview');
}

function resolveLiveModel() {
  const configuredModel = process.env.GEMINI_LIVE_MODEL?.trim();
  if (!configuredModel || configuredModel.length === 0) {
    return DEFAULT_LIVE_MODEL;
  }

  return isSupportedLiveModel(configuredModel) ? configuredModel : DEFAULT_LIVE_MODEL;
}

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const liveModel = resolveLiveModel();
  // authTokens.create is only available in the v1alpha API
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, apiVersion: 'v1alpha' });

  const token = await ai.authTokens.create({
    config: {
      uses: 1,
      expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: liveModel,
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

  return Response.json({ token: token.name, model: liveModel });
}
