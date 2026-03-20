export interface ElevenLabsVoice {
  id: string;
  name: string;
  gender: 'm' | 'f';
}

export const ELEVENLABS_VOICES: ElevenLabsVoice[] = [
  { id: 'BIvP0GN1cAtSRTxNHnWS', name: 'Ellen', gender: 'f' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', gender: 'f' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', gender: 'f' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', gender: 'f' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', gender: 'f' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', gender: 'm' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', gender: 'm' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', gender: 'm' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', gender: 'm' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', gender: 'm' },
];

export interface SpeechGenerationState {
  status: 'idle' | 'polling' | 'success' | 'failed' | 'timeout';
  generationId?: string;
  taskId?: string;
  output?: string;
  error?: string;
}
