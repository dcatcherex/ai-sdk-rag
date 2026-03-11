import type { UIDataTypes, UIMessage, UIMessagePart } from 'ai';
import type { ChatTools } from '@/lib/tools';

export type ThreadItem = {
  id: string;
  title: string;
  preview: string;
  pinned: boolean;
  hasGeneratedImage: boolean;
  imageThumbnailUrl: string | null;
  updatedAtMs: number;
};

export type RoutingMetadata = {
  mode: 'auto' | 'manual';
  modelId: string;
  reason: string;
};

export type ChatMessageMetadata = {
  routing?: RoutingMetadata;
  persona?: import('@/lib/prompt').SystemPromptKey | string;
  enhancedPrompt?: string;
  followUpSuggestions?: string[];
  // Compare mode
  compareGroupId?: string;
  compareModelId?: string;
  compareModelName?: string;
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

export type MessageReaction = 'thumbs_up' | 'thumbs_down';

export type StepControlPart = {
  type: 'step-start' | 'step-finish' | 'step-result';
};

export type ChatMessagePart =
  | UIMessagePart<UIDataTypes, ChatTools>
  | StepControlPart;

export type ChatMessage = UIMessage<ChatMessageMetadata, UIDataTypes, ChatTools> & {
  reaction?: MessageReaction | null;
};
