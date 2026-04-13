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
  pinnedWorkspaceItemIds: string[] | null; // null = defaults
  hiddenWorkspaceItemIds: string[] | null; // null = show all
  rerankEnabled: boolean;
  selectedVoice: string | null; // null = use default (Aoede)
  mcpCredentials: Record<string, string>; // key = credential key name, value = secret
};
