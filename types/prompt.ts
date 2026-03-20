
export type PromptCategory = 'Text Gen' | 'Image Gen' | 'Audio Gen' | 'Video Gen' | 'Speech Gen';

export type PromptDomain =
  | 'General'
  | 'Marketing'
  | 'Education'
  | 'Business'
  | 'Social Media'
  | 'E-commerce'
  | 'Creative'
  | 'Development'
  | 'Sales'
  | 'Support'
  | 'Personal';

export const PROMPT_DOMAINS: readonly PromptDomain[] = [
  'General',
  'Marketing',
  'Education',
  'Business',
  'Social Media',
  'E-commerce',
  'Creative',
  'Development',
  'Sales',
  'Support',
  'Personal',
] as const;

export interface PromptVariable {
  name: string;
  value: string;
}

export interface PromptVariableConfig {
  name: string;
  label?: string;
  type: 'text' | 'select';
  defaultValue?: string;
  options?: string[]; // For select type
}

export interface PromptVersion {
  id: string;
  content: string;
  timestamp: number;
  author: string;
}

export interface PromptAttachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // Base64 for images, text content for text files
}

export interface PromptImageSettings {
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '2:3' | '1:2' | '2:1' | '4:5' | '3:2';
  resolution: '1K' | '2K' | '4K';
  quality?: 'medium' | 'high';
  quantity?: number; // Number of images to generate
  negativePrompt?: string;
  referenceImages?: string[]; // Array of base64 strings (User uploads)
  styleReferenceImage?: string; // New: Specific image for style transfer

  // Structured References
  stylePreset?: string;      // e.g. "Cyberpunk", "Watercolor"
  characterPreset?: string;  // e.g. "Cyborg", "Wizard"
  colorPreset?: string;      // e.g. "Pastel", "Neon"
  cameraPreset?: string;     // e.g. "Wide Angle", "Macro"
  objectPreset?: string;     // e.g. "Minimalist", "Cluttered"
}

export interface PromptAudioSettings {
  instrumental: boolean;
  customMode: boolean;
  style?: string;
  title?: string;
  negativeTags?: string;
  vocalGender?: 'm' | 'f';
  styleWeight?: number;           // 0–1
  weirdnessConstraint?: number;   // 0–1
  audioWeight?: number;           // 0–1
}

export interface DialogueLine {
  text: string;
  voice: string;
}

export interface PromptTtsSettings {
  voice: string;                  // ElevenLabs voice ID (e.g. '21m00Tcm4TlvDq8ikWAM' for Rachel)
  stability?: number;             // 0–1, default 0.5
  similarityBoost?: number;       // 0–1, default 0.75
  style?: number;                 // 0–1, default 0
  speed?: number;                 // 0.7–1.2, default 1
  languageCode?: string;          // ISO 639-1, default 'auto'
  dialogueLines?: DialogueLine[]; // For dialogue-v3 model (multi-speaker)
}

export type VeoGenerationMode = 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO';

export interface PromptVideoSettings {
  generationMode: VeoGenerationMode;
  aspectRatio: '16:9' | '9:16' | 'Auto';
  imageUrls?: string[];       // Uploaded image URLs for frame/reference modes
  seeds?: number;             // 10000-99999 for reproducibility
}

export interface PromptData {
  id: string;
  title: string;
  description?: string;
  content: string;
  category: PromptCategory;
  domain?: PromptDomain;
  tags: string[];
  models: string[]; // Supported models e.g., 'gemini-2.5-flash', 'gpt-4o'
  variables: string[]; // Extracted variable names
  variableConfigs?: Record<string, PromptVariableConfig>; // Configuration for variables
  previewImage?: string; // URL for image generation previews
  imageSettings?: PromptImageSettings; // New field for advanced image options
  audioSettings?: PromptAudioSettings; // Audio generation options (Suno)
  ttsSettings?: PromptTtsSettings; // Text-to-speech options (ElevenLabs)
  videoSettings?: PromptVideoSettings; // Video generation options (Veo 3.1)
  attachments?: PromptAttachment[]; // Context documents for text prompts
  contextConfig?: {
    documentIds?: string[];
    memoryIds?: string[];
    exampleIds?: string[];
    historyStrategy?: string;
    maxHistoryTokens?: number;
  }; // Context engineering configuration
  sourcePromptId?: string | null;
  sourceUrl?: string | null;
  attributionText?: string | null;
  author: string;
  lastUsed: number; // Timestamp
  usageCount: number;
  isFavorite: boolean;
  isPublic?: boolean;
  versions: PromptVersion[];
}
