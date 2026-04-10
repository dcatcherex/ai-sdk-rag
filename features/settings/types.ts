export type MemoryFact = {
  id: string;
  category: string;
  fact: string;
  createdAt: string;
};

export type Preferences = {
  memoryEnabled: boolean;
  memoryInjectEnabled: boolean;
  memoryExtractEnabled: boolean;
  promptEnhancementEnabled: boolean;
  followUpSuggestionsEnabled: boolean;
  enabledToolIds: string[] | null; // null = all tools enabled
  rerankEnabled: boolean;
  selectedVoice: string | null; // null = use default (Aoede)
};
