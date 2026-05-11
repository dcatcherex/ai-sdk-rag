export type TaskFlowChannel = 'web' | 'shared_link' | 'line';

export type TaskFlowIntentSource = 'rule' | 'model' | 'state' | 'fallback';

export type TaskFlowSlotType =
  | 'text'
  | 'number'
  | 'date'
  | 'location'
  | 'image'
  | 'enum'
  | 'boolean';

export type TaskFlowSlotDefinition = {
  key: string;
  label: string;
  type: TaskFlowSlotType;
  required: boolean;
  question: string;
  examples?: string[];
  extractionHints?: string[];
  enumValues?: string[];
};

export type TaskFlowDefinition = {
  key: string;
  skillKey?: string;
  profession: string;
  title: string;
  description: string;
  triggers: string[];
  negativeTriggers?: string[];
  requiredSlots: TaskFlowSlotDefinition[];
  optionalSlots?: TaskFlowSlotDefinition[];
  outputTemplateKey?: string;
  toolName?: string;
  safetyLevel?: 'normal' | 'caution' | 'high_stakes';
  channels?: TaskFlowChannel[];
};

export type TaskFlowSlotValue = {
  key: string;
  value: unknown;
  confidence: number;
  source: 'user_message' | 'conversation_state' | 'model' | 'tool';
};

export type TaskFlowMessageState = {
  flowKey: string;
  status: 'needs_more_info' | 'ready' | 'completed';
  slots: Record<string, unknown>;
  missingSlots: string[];
  updatedAt: string;
};

export type TaskFlowDecision =
  | {
      status: 'no_match';
      confidence: number;
      source: TaskFlowIntentSource;
    }
  | {
      status: 'needs_more_info';
      flowKey: string;
      confidence: number;
      source: TaskFlowIntentSource;
      slots: Record<string, unknown>;
      missingSlots: string[];
      followUpQuestion: string;
      outputTemplateKey?: string;
      toolName?: string;
    }
  | {
      status: 'ready';
      flowKey: string;
      confidence: number;
      source: TaskFlowIntentSource;
      slots: Record<string, unknown>;
      outputTemplateKey?: string;
      toolName?: string;
    };

export type TaskFlowIntentMatch = {
  flow: TaskFlowDefinition | null;
  confidence: number;
  source: TaskFlowIntentSource;
};

export type TaskFlowSlotExtractionResult = {
  slots: Record<string, unknown>;
  slotConfidence: Record<string, number>;
};
