import { and, eq } from "drizzle-orm";
import type { PrintableQuizQuestion, PrintableQuizReference } from "@/components/chat/printable-quiz";
import { chatMessage, chatThread } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

export type PrintableQuizMode = "worksheet" | "answer-key" | "both";

export type PrintableQuizTeacherOptions = {
  compact: boolean;
  showExplanations: boolean;
  showMarkBoxes: boolean;
  showReferences: boolean;
  showTopics: boolean;
};

type MessagePartRecord = {
  input?: unknown;
  output?: unknown;
  state?: unknown;
  toolName?: string;
  type?: unknown;
};

type ToolPartRecord = MessagePartRecord & {
  output?: unknown;
  toolName?: string;
  type: string;
};

type QuizToolOutput = {
  groundingReferences?: PrintableQuizReference[];
  instructions?: string;
  quiz?: PrintableQuizQuestion[];
  success?: boolean;
};

export type PrintableQuizData = {
  instructions?: string;
  questions: PrintableQuizQuestion[];
  threadId: string;
  title: string;
  groundingReferences: PrintableQuizReference[];
  messageId: string;
};

export const defaultTeacherOptions: PrintableQuizTeacherOptions = {
  compact: false,
  showExplanations: true,
  showMarkBoxes: true,
  showReferences: true,
  showTopics: true,
};

export const parseMode = (value: string | string[] | undefined): PrintableQuizMode => {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (normalized === "worksheet" || normalized === "answer-key" || normalized === "both") {
    return normalized;
  }

  return "both";
};

const parseBoolean = (value: string | string[] | undefined, fallback: boolean) => {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return fallback;
};

export const parseTeacherOptions = (searchParams: Record<string, string | string[] | undefined>): PrintableQuizTeacherOptions => ({
  compact: parseBoolean(searchParams.compact, defaultTeacherOptions.compact),
  showExplanations: parseBoolean(searchParams.showExplanations, defaultTeacherOptions.showExplanations),
  showMarkBoxes: parseBoolean(searchParams.showMarkBoxes, defaultTeacherOptions.showMarkBoxes),
  showReferences: parseBoolean(searchParams.showReferences, defaultTeacherOptions.showReferences),
  showTopics: parseBoolean(searchParams.showTopics, defaultTeacherOptions.showTopics),
});

const normalizeToolName = (toolName: string) =>
  toolName.startsWith("tool-") ? toolName.slice(5) : toolName;

const isMessagePartRecord = (value: unknown): value is MessagePartRecord => {
  return typeof value === "object" && value !== null;
};

const isToolPart = (part: MessagePartRecord): part is ToolPartRecord => {
  if (typeof part.type !== "string") {
    return false;
  }

  if (part.type.startsWith("tool-")) {
    return true;
  }

  return typeof part.toolName === "string";
};

const isQuizToolOutput = (value: unknown): value is QuizToolOutput => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.success === true && Array.isArray(record.quiz);
};

export async function getQuizPrintSessionUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function getQuizPrintDataForUser(userId: string, threadId: string, messageId: string): Promise<PrintableQuizData | null> {
  const [threadRow, messageRows] = await Promise.all([
    db
      .select({ id: chatThread.id, title: chatThread.title })
      .from(chatThread)
      .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, userId)))
      .limit(1),
    db
      .select({ id: chatMessage.id, parts: chatMessage.parts, role: chatMessage.role, position: chatMessage.position })
      .from(chatMessage)
      .where(eq(chatMessage.threadId, threadId)),
  ]);

  if (!threadRow[0] || messageRows.length === 0) {
    return null;
  }

  const findQuizOutput = (rawParts: unknown): QuizToolOutput | null => {
    const parts = Array.isArray(rawParts)
      ? rawParts.filter(isMessagePartRecord)
      : [];

    const quizToolPart = parts.find((part) => {
      if (!isToolPart(part)) {
        return false;
      }

      const toolName = normalizeToolName(part.toolName ?? part.type);
      return toolName === "generate_practice_quiz" && isQuizToolOutput(part.output);
    });

    if (!quizToolPart || !isQuizToolOutput(quizToolPart.output)) {
      return null;
    }

    return quizToolPart.output;
  };

  const requestedRow = messageRows.find((row) => row.id === messageId);
  const requestedQuizOutput = requestedRow ? findQuizOutput(requestedRow.parts) : null;
  const fallbackRow = [...messageRows]
    .sort((left, right) => right.position - left.position)
    .find((row) => row.role === "assistant" && findQuizOutput(row.parts));
  const resolvedRow = requestedQuizOutput
    ? requestedRow
    : fallbackRow;
  const quizOutput = requestedQuizOutput
    ?? (fallbackRow ? findQuizOutput(fallbackRow.parts) : null);

  if (!resolvedRow || !quizOutput) {
    return null;
  }

  const normalizedMessageId = resolvedRow.id;

  return {
    groundingReferences: quizOutput.groundingReferences ?? [],
    instructions: quizOutput.instructions,
    messageId: normalizedMessageId,
    questions: quizOutput.quiz ?? [],
    threadId,
    title: threadRow[0].title ?? "Printable practice quiz",
  };
}

export async function getAuthenticatedQuizPrintData(threadId: string, messageId: string): Promise<PrintableQuizData | null> {
  const userId = await getQuizPrintSessionUserId();

  if (!userId) {
    return null;
  }

  return getQuizPrintDataForUser(userId, threadId, messageId);
}
