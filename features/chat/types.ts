import type { UIDataTypes, UIMessage, UIMessagePart } from 'ai';
import type { ChatTools } from '@/lib/tools';
import type { ResponseAuditSummary } from '@/features/response-format/server/audit';
import type { RichMessageInstance } from '@/features/rich-messages/types';
import type { TaskFlowMessageState } from '@/features/task-flows/types';

export type ThreadItem = {
  id: string;
  title: string;
  preview: string;
  pinned: boolean;
  hasGeneratedImage: boolean;
  imageThumbnailUrl: string | null;
  updatedAtMs: number;
  agentId: string | null;
};

export type RoutingMetadata = {
  mode: 'auto' | 'manual';
  modelId: string;
  reason: string;
};

export type ActivatedSkillBadge = {
  id: string;
  name: string;
  source: 'rule' | 'model';
};

export type ChatMessageMetadata = {
  routing?: RoutingMetadata;
  enhancedPrompt?: string;
  followUpSuggestions?: string[];
  responseFormat?: ResponseAuditSummary;
  activatedSkills?: ActivatedSkillBadge[];
  taskFlow?: TaskFlowMessageState;
  // Compare mode
  compareGroupId?: string;
  compareModelId?: string;
  compareModelName?: string;
  // Agent team run
  teamRun?: {
    runId: string;
    teamId: string;
    teamName: string;
    stepCount: number;
  };
};

export type QuizAttemptSummary = {
  questionId: string;
  question: string;
  topic: string;
  type: 'mcq' | 'short_answer' | 'true_false';
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean | null;
  wasRevealed: boolean;
};

export type QuizFollowUpContext = {
  messageId: string;
  questionCount: number;
  answeredCount: number;
  objectiveAnsweredCount: number;
  correctCount: number;
  completed: boolean;
  attempts: QuizAttemptSummary[];
};

export type ChatReferenceImage = {
  id: string;
  url: string;
  mediaType: string;
  filename?: string;
  thumbnailUrl?: string;
  assetId?: string;
  rootAssetId?: string;
  version?: number;
  editPrompt?: string;
};

export type MessageReaction = 'thumbs_up' | 'thumbs_down';

export type ChatDataTypes = UIDataTypes & {
  'rich-message': RichMessageInstance;
};

export type StepControlPart = {
  type: 'step-start' | 'step-finish' | 'step-result';
};

export type ChatMessagePart =
  | UIMessagePart<ChatDataTypes, ChatTools>
  | StepControlPart;

export type ChatMessage = UIMessage<ChatMessageMetadata, ChatDataTypes, ChatTools> & {
  reaction?: MessageReaction | null;
};
