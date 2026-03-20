export interface AudioTrack {
  id: string;
  audioUrl: string;
  imageUrl?: string;
  title: string;
  tags: string;
  duration: number;
  prompt: string;
}

export interface AudioMeta {
  audioUrl: string;
  imageUrl?: string;
  title: string;
  tags: string;
  duration: number;
  tracks: AudioTrack[];
}

export interface AudioGenerationState {
  status: 'idle' | 'polling' | 'success' | 'failed' | 'timeout';
  generationId?: string;
  taskId?: string;
  output?: string;
  audioMeta?: AudioMeta;
  error?: string;
}
