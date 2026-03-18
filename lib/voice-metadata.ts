/**
 * Voice metadata including characteristics for each available voice
 */

export interface VoiceMetadata {
  name: string;
  sex: 'male' | 'female';
  tone: string;
  pitch: 'higher' | 'middle' | 'lower' | 'lower middle';
  audioFile: string;
}

export const VOICE_METADATA: Record<string, VoiceMetadata> = {
  Zephyr: {
    name: 'Zephyr',
    sex: 'female',
    tone: 'bright',
    pitch: 'higher',
    audioFile: '/voices/zephyr.mp3',
  },
  Puck: {
    name: 'Puck',
    sex: 'male',
    tone: 'upbeat',
    pitch: 'middle',
    audioFile: '/voices/puck.mp3',
  },
  Charon: {
    name: 'Charon',
    sex: 'male',
    tone: 'informative',
    pitch: 'lower',
    audioFile: '/voices/charon.mp3',
  },
  Kore: {
    name: 'Kore',
    sex: 'female',
    tone: 'firm',
    pitch: 'middle',
    audioFile: '/voices/kore.mp3',
  },
  Fenrir: {
    name: 'Fenrir',
    sex: 'male',
    tone: 'excitable',
    pitch: 'lower middle',
    audioFile: '/voices/fenrir.mp3',
  },
  Leda: {
    name: 'Leda',
    sex: 'female',
    tone: 'youthful',
    pitch: 'higher',
    audioFile: '/voices/leda.mp3',
  },
  Orus: {
    name: 'Orus',
    sex: 'male',
    tone: 'firm',
    pitch: 'lower middle',
    audioFile: '/voices/orus.mp3',
  },
  Aoede: {
    name: 'Aoede',
    sex: 'female',
    tone: 'breezy',
    pitch: 'middle',
    audioFile: '/voices/aoede.mp3',
  },
  Callirrhoe: {
    name: 'Callirrhoe',
    sex: 'female',
    tone: 'easy-going',
    pitch: 'middle',
    audioFile: '/voices/callirrhoe.mp3',
  },
  Autonoe: {
    name: 'Autonoe',
    sex: 'female',
    tone: 'bright',
    pitch: 'middle',
    audioFile: '/voices/autonoe.mp3',
  },
  Enceladus: {
    name: 'Enceladus',
    sex: 'male',
    tone: 'breathy',
    pitch: 'middle',
    audioFile: '/voices/enceladus.mp3',
  },
  Iapetus: {
    name: 'Iapetus',
    sex: 'male',
    tone: 'clear',
    pitch: 'lower middle',
    audioFile: '/voices/lapetus.mp3',
  },
  Umbriel: {
    name: 'Umbriel',
    sex: 'male',
    tone: 'easy-going',
    pitch: 'lower middle',
    audioFile: '/voices/umbriel.mp3',
  },
  Algieba: {
    name: 'Algieba',
    sex: 'male',
    tone: 'smooth',
    pitch: 'lower',
    audioFile: '/voices/algieba.mp3',
  },
  Despina: {
    name: 'Despina',
    sex: 'female',
    tone: 'smooth',
    pitch: 'middle',
    audioFile: '/voices/despina.mp3',
  },
  Erinome: {
    name: 'Erinome',
    sex: 'female',
    tone: 'clear',
    pitch: 'middle',
    audioFile: '/voices/erinome.mp3',
  },
  Algenib: {
    name: 'Algenib',
    sex: 'male',
    tone: 'gravelly',
    pitch: 'lower',
    audioFile: '/voices/algenib.mp3',
  },
  Rasalgethi: {
    name: 'Rasalgethi',
    sex: 'male',
    tone: 'informative',
    pitch: 'middle',
    audioFile: '/voices/rasalgethi.mp3',
  },
  Laomedeia: {
    name: 'Laomedeia',
    sex: 'female',
    tone: 'upbeat',
    pitch: 'higher',
    audioFile: '/voices/laomedeia.mp3',
  },
  Achernar: {
    name: 'Achernar',
    sex: 'female',
    tone: 'soft',
    pitch: 'higher',
    audioFile: '/voices/achernar.mp3',
  },
  Alnilam: {
    name: 'Alnilam',
    sex: 'male',
    tone: 'firm',
    pitch: 'lower middle',
    audioFile: '/voices/alnilam.mp3',
  },
  Schedar: {
    name: 'Schedar',
    sex: 'male',
    tone: 'even',
    pitch: 'lower middle',
    audioFile: '/voices/schedar.mp3',
  },
  Gacrux: {
    name: 'Gacrux',
    sex: 'male',
    tone: 'mature',
    pitch: 'middle',
    audioFile: '/voices/gacrux.mp3',
  },
  Pulcherrima: {
    name: 'Pulcherrima',
    sex: 'male',
    tone: 'forward',
    pitch: 'middle',
    audioFile: '/voices/pulcherrima.mp3',
  },
  Achird: {
    name: 'Achird',
    sex: 'male',
    tone: 'friendly',
    pitch: 'lower middle',
    audioFile: '/voices/achird.mp3',
  },
  Zubenelgenubi: {
    name: 'Zubenelgenubi',
    sex: 'male',
    tone: 'casual',
    pitch: 'lower middle',
    audioFile: '/voices/zubenelgenubi.mp3',
  },
  Vindemiatrix: {
    name: 'Vindemiatrix',
    sex: 'male',
    tone: 'gentle',
    pitch: 'middle',
    audioFile: '/voices/vindemiatrix.mp3',
  },
  Sadachbia: {
    name: 'Sadachbia',
    sex: 'male',
    tone: 'lively',
    pitch: 'lower',
    audioFile: '/voices/sadachbia.mp3',
  },
  Sadaltager: {
    name: 'Sadaltager',
    sex: 'male',
    tone: 'knowledgeable',
    pitch: 'middle',
    audioFile: '/voices/sadaltager.mp3',
  },
  Sulafat: {
    name: 'Sulafat',
    sex: 'female',
    tone: 'warm',
    pitch: 'middle',
    audioFile: '/voices/sulafat.mp3',
  },
};

/**
 * Get voice metadata by name
 */
export function getVoiceMetadata(voiceName: string): VoiceMetadata | undefined {
  return VOICE_METADATA[voiceName];
}

/**
 * Get all available voice names
 */
export function getAllVoiceNames(): string[] {
  return Object.keys(VOICE_METADATA);
}

/**
 * Filter voices by characteristics
 */
export function filterVoices(filters: {
  sex?: 'male' | 'female';
  pitch?: string;
  tone?: string;
}): VoiceMetadata[] {
  return Object.values(VOICE_METADATA).filter(voice => {
    if (filters.sex && voice.sex !== filters.sex) return false;
    if (filters.pitch && voice.pitch !== filters.pitch) return false;
    if (filters.tone && voice.tone !== filters.tone) return false;
    return true;
  });
}
