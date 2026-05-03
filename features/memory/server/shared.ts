import { memoryRecord, threadWorkingMemory } from "@/db/schema";
import type { BrandMemoryRecord, MemoryStatus, ThreadWorkingMemoryRecord } from "@/features/memory/types";

export const SHARED_MEMORY_MAX_CHARS = 2200;
export const SHARED_MEMORY_MAX_RECORDS = 6;

export type PromptableMessage = {
  id?: string;
  role: string;
  parts?: Array<{ type?: string; text?: string }>;
  content?: string;
};

export type WorkingMemoryShape = {
  summary: string;
  currentObjective: string | null;
  decisions: string[];
  openQuestions: string[];
  importantContext: string[];
  recentArtifacts: string[];
};

export const emptyWorkingMemory = (): WorkingMemoryShape => ({
  summary: "",
  currentObjective: null,
  decisions: [],
  openQuestions: [],
  importantContext: [],
  recentArtifacts: [],
});

export const normalizeArray = (value: unknown, limit = 5): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);
};

export const createContentSummary = (content: string): string => {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= 180) return compact;
  return `${compact.slice(0, 177).trimEnd()}...`;
};

export const extractMessageText = (message: PromptableMessage): string => {
  if (Array.isArray(message.parts)) {
    const text = message.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) return text;
  }

  return (message.content ?? "").replace(/\s+/g, " ").trim();
};

export const getPersistableMessageId = (message: PromptableMessage | undefined): string | null => {
  const id = typeof message?.id === "string" ? message.id.trim() : "";
  return id.length > 0 ? id : null;
};

export const formatConversationForModel = (messages: PromptableMessage[]): string =>
  messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      const text = extractMessageText(message);
      return text ? `${message.role}: ${text.slice(0, 1200)}` : "";
    })
    .filter(Boolean)
    .join("\n");

export const parseWorkingMemoryResponse = (text: string): WorkingMemoryShape => {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return emptyWorkingMemory();

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<WorkingMemoryShape>;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 500) : "",
      currentObjective:
        typeof parsed.currentObjective === "string" && parsed.currentObjective.trim()
          ? parsed.currentObjective.trim().slice(0, 240)
          : null,
      decisions: normalizeArray(parsed.decisions),
      openQuestions: normalizeArray(parsed.openQuestions),
      importantContext: normalizeArray(parsed.importantContext),
      recentArtifacts: normalizeArray(parsed.recentArtifacts),
    };
  } catch {
    return emptyWorkingMemory();
  }
};

export const normalizeQueryTerms = (query: string): string[] =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 8);

export const scoreMemoryRecord = (record: BrandMemoryRecord, terms: string[]): number => {
  if (terms.length === 0) return 0;

  const haystack = `${record.title} ${record.category ?? ""} ${record.summary ?? ""} ${record.content}`.toLowerCase();
  return terms.reduce((score, term) => {
    if (!haystack.includes(term)) return score;
    const bonus = record.title.toLowerCase().includes(term) ? 2 : 1;
    return score + bonus;
  }, 0);
};

export const mapMemoryRecord = (row: typeof memoryRecord.$inferSelect): BrandMemoryRecord => ({
  id: row.id,
  scopeType: row.scopeType as BrandMemoryRecord["scopeType"],
  scopeId: row.scopeId,
  memoryType: row.memoryType as BrandMemoryRecord["memoryType"],
  status: row.status as MemoryStatus,
  title: row.title,
  content: row.content,
  summary: row.summary,
  category: row.category,
  sourceType: row.sourceType as BrandMemoryRecord["sourceType"],
  sourceThreadId: row.sourceThreadId,
  createdByUserId: row.createdByUserId,
  approvedByUserId: row.approvedByUserId,
  rejectedByUserId: row.rejectedByUserId,
  confidence: row.confidence,
  metadata: (row.metadata ?? {}) as Record<string, unknown>,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  approvedAt: row.approvedAt,
  rejectedAt: row.rejectedAt,
  archivedAt: row.archivedAt,
  lastReferencedAt: row.lastReferencedAt,
});

export const mapThreadWorkingMemory = (
  row: typeof threadWorkingMemory.$inferSelect,
): ThreadWorkingMemoryRecord => ({
  id: row.id,
  threadId: row.threadId,
  brandId: row.brandId,
  summary: row.summary,
  currentObjective: row.currentObjective,
  decisions: normalizeArray(row.decisions),
  openQuestions: normalizeArray(row.openQuestions),
  importantContext: normalizeArray(row.importantContext),
  recentArtifacts: normalizeArray(row.recentArtifacts),
  lastMessageId: row.lastMessageId,
  refreshStatus: row.refreshStatus,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  refreshedAt: row.refreshedAt,
  clearedAt: row.clearedAt,
});
