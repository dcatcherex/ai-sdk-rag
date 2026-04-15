import type { UIMessagePart } from "ai";
import type { MediaAsset } from "@/features/gallery/types";
import type { ChatReferenceImage, QuizFollowUpContext } from "@/features/chat/types";

// ─── Public Props ────────────────────────────────────────────────────────────

export type MessagePartRendererProps = {
  part: UIMessagePart<any, any>;
  messageId: string;
  threadId?: string;
  index: number;
  role?: string;
  onImageClick?: (asset: MediaAsset) => void;
  onUseImageInChat?: (image: ChatReferenceImage) => void;
  onQuizStateChange?: (context: QuizFollowUpContext) => void;
};

// ─── Part Shapes ─────────────────────────────────────────────────────────────

export type FilePart = {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  assetId?: string;
  parentAssetId?: string;
  rootAssetId?: string;
  version?: number;
  editPrompt?: string;
};

export type ToolLikePart = UIMessagePart<any, any> & {
  errorText?: string;
  input?: unknown;
  output?: unknown;
  state?: unknown;
  toolName?: string;
  type: string;
};

// ─── Tool Output Shapes ──────────────────────────────────────────────────────

export type CertificateToolOutput = {
  count?: number;
  downloadLabel?: string;
  fileName?: string;
  fileUrl?: string;
  jobId?: string;
  outputMode?: string;
  success?: boolean;
  url?: string;
};

export type CertificatePreviewOutput = {
  canGenerate?: boolean;
  missingRequiredByRecipient?: Array<{
    missingFieldIds: string[];
    recipientIndex: number;
  }>;
  outputMode?: string;
  success?: boolean;
  unknownFieldIdsByRecipient?: Array<{
    recipientIndex: number;
    unknownFieldIds: string[];
  }>;
};

export type ExamPrepToolOutput = {
  success?: boolean;
  groundedFromKnowledgeBase?: boolean;
  sources?: string[];
  instructions?: string;
  quiz?: Array<{
    answer: string;
    explanation: string;
    id: string;
    options?: string[];
    question: string;
    references?: number[];
    topic: string;
    type: "mcq" | "short_answer" | "true_false";
  }>;
  verdict?: string;
  score?: number;
  maxScore?: number;
  strengths?: Array<{ references?: number[]; text: string }>;
  missingPoints?: Array<{ references?: number[]; text: string }>;
  improvements?: Array<{ references?: number[]; text: string }>;
  modelAnswer?: string;
  overallAssessment?: string;
  weakAreas?: Array<{
    issue: string;
    references?: number[];
    severity: "high" | "medium" | "low";
    topic: string;
  }>;
  misconceptions?: Array<{ references?: number[]; text: string }>;
  recommendedActions?: Array<{ references?: number[]; text: string }>;
  nextStudyFocus?: string[];
  deckTitle?: string;
  studyTip?: string;
  flashcards?: Array<{
    back: string;
    front: string;
    id: string;
    references?: number[];
    topic: string;
  }>;
  groundingReferences?: Array<{
    documentId?: string;
    id: number;
    page?: number | null;
    section?: string;
    source: string;
  }>;
  daysRemaining?: number;
  priorityTopics?: string[];
  plan?: Array<{
    day: string;
    estimatedHours: number;
    focus: string;
    tasks: Array<{ references?: number[]; text: string }>;
  }>;
};

export type ImageGenerationToolOutput = {
  started?: boolean;
  status?: 'processing' | 'success' | 'failed';
  taskId?: string;
  generationId?: string;
  imageUrl?: string;
  imageUrls?: string[];
  thumbnailUrl?: string;
  thumbnailUrls?: string[];
  startedAt?: string;
  message?: string;
};

// ─── Type Guards ─────────────────────────────────────────────────────────────

export const isFilePart = (part: UIMessagePart<any, any>): part is FilePart => {
  if (part.type !== "file") return false;
  const r = part as Record<string, unknown>;
  return typeof r.mediaType === "string" && typeof r.url === "string";
};

export const isToolLikePart = (part: UIMessagePart<any, any>): part is ToolLikePart => {
  if (typeof part.type !== "string") return false;
  const r = part as Record<string, unknown>;
  return part.type.startsWith("tool-") && "input" in r;
};

export const isCertificateToolOutput = (output: unknown): output is CertificateToolOutput => {
  if (!output || typeof output !== "object") return false;
  const r = output as Record<string, unknown>;
  return (
    typeof r.success === "boolean" &&
    (typeof r.jobId === "string" || typeof r.fileUrl === "string" || typeof r.url === "string")
  );
};

export const isCertificatePreviewOutput = (output: unknown): output is CertificatePreviewOutput => {
  if (!output || typeof output !== "object") return false;
  const r = output as Record<string, unknown>;
  return (
    typeof r.success === "boolean" &&
    (Array.isArray(r.missingRequiredByRecipient) ||
      Array.isArray(r.unknownFieldIdsByRecipient) ||
      typeof r.canGenerate === "boolean")
  );
};

export const isExamPrepToolOutput = (output: unknown): output is ExamPrepToolOutput => {
  if (!output || typeof output !== "object") return false;
  const r = output as Record<string, unknown>;
  return (
    typeof r.success === "boolean" &&
    (Array.isArray(r.quiz) ||
      typeof r.verdict === "string" ||
      Array.isArray(r.plan) ||
      Array.isArray(r.weakAreas) ||
      Array.isArray(r.flashcards))
  );
};

export const isImageGenerationToolOutput = (output: unknown): output is ImageGenerationToolOutput => {
  if (!output || typeof output !== "object") return false;
  const r = output as Record<string, unknown>;
  return (
    typeof r.taskId === "string" &&
    typeof r.generationId === "string" &&
    (r.started === undefined || typeof r.started === "boolean")
  );
};

// ─── Tool Name Helpers ────────────────────────────────────────────────────────

export const normalizeToolName = (toolName: string) =>
  toolName.startsWith("tool-") ? toolName.slice(5) : toolName;

export const isCertificateToolName = (toolName: string) =>
  toolName.includes("generate_certificate") ||
  toolName.includes("preview_certificate_generation");

export const isExamPrepToolName = (toolName: string) =>
  toolName === "generate_practice_quiz" ||
  toolName === "grade_practice_answer" ||
  toolName === "create_study_plan" ||
  toolName === "analyze_learning_gaps" ||
  toolName === "generate_flashcards";

export const isImageGenerationToolName = (toolName: string) =>
  toolName === "generate_image";

export const shouldRenderExamPrepOutsideToolPanel = (toolName: string) =>
  toolName === "generate_practice_quiz" ||
  toolName === "create_study_plan" ||
  toolName === "analyze_learning_gaps" ||
  toolName === "generate_flashcards";
