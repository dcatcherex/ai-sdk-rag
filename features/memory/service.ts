import { generateText } from "ai";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { nanoid } from "nanoid";

import { brand, brandShare, chatMessage, chatThread, memoryRecord, threadWorkingMemory, workspaceMember } from "@/db/schema";
import { db } from "@/lib/db";
import type { WorkspaceMemberRole } from "@/features/collaboration/types";
import type {
  BrandMemoryListResponse,
  BrandMemoryPermission,
  BrandMemoryRecord,
  MemoryStatus,
  ThreadWorkingMemoryRecord,
} from "./types";
import type { CreateBrandMemoryInput, UpdateBrandMemoryInput } from "./schema";

const WORKING_MEMORY_MODEL = "google/gemini-2.5-flash-lite";
const SHARED_MEMORY_MAX_CHARS = 2200;
const SHARED_MEMORY_MAX_RECORDS = 6;

type PromptableMessage = {
  id?: string;
  role: string;
  parts?: Array<{ type?: string; text?: string }>;
  content?: string;
};

type WorkingMemoryShape = {
  summary: string;
  currentObjective: string | null;
  decisions: string[];
  openQuestions: string[];
  importantContext: string[];
  recentArtifacts: string[];
};

const emptyWorkingMemory = (): WorkingMemoryShape => ({
  summary: "",
  currentObjective: null,
  decisions: [],
  openQuestions: [],
  importantContext: [],
  recentArtifacts: [],
});

const normalizeArray = (value: unknown, limit = 5): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, limit);
};

const createContentSummary = (content: string): string => {
  const compact = content.replace(/\s+/g, " ").trim();
  if (compact.length <= 180) return compact;
  return `${compact.slice(0, 177).trimEnd()}...`;
};

const extractMessageText = (message: PromptableMessage): string => {
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

const getPersistableMessageId = (message: PromptableMessage | undefined): string | null => {
  const id = typeof message?.id === "string" ? message.id.trim() : "";
  return id.length > 0 ? id : null;
};

const formatConversationForModel = (messages: PromptableMessage[]): string =>
  messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      const text = extractMessageText(message);
      return text ? `${message.role}: ${text.slice(0, 1200)}` : "";
    })
    .filter(Boolean)
    .join("\n");

const parseWorkingMemoryResponse = (text: string): WorkingMemoryShape => {
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

const normalizeQueryTerms = (query: string): string[] =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 8);

const scoreMemoryRecord = (record: BrandMemoryRecord, terms: string[]): number => {
  if (terms.length === 0) return 0;

  const haystack = `${record.title} ${record.category ?? ""} ${record.summary ?? ""} ${record.content}`.toLowerCase();
  return terms.reduce((score, term) => {
    if (!haystack.includes(term)) return score;
    const bonus = record.title.toLowerCase().includes(term) ? 2 : 1;
    return score + bonus;
  }, 0);
};

const mapMemoryRecord = (row: typeof memoryRecord.$inferSelect): BrandMemoryRecord => ({
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

const mapThreadWorkingMemory = (
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

export async function getBrandMemoryPermissions(
  userId: string,
  brandId: string,
): Promise<BrandMemoryPermission> {
  const [brandRow] = await db
    .select({ id: brand.id, userId: brand.userId })
    .from(brand)
    .where(eq(brand.id, brandId))
    .limit(1);

  if (!brandRow) {
    return {
      canRead: false,
      canWrite: false,
      isOwner: false,
      workspaceRole: null,
    };
  }

  const isOwner = brandRow.userId === userId;

  const [shareRow, workspaceRow] = await Promise.all([
    db
      .select({ id: brandShare.id })
      .from(brandShare)
      .where(and(eq(brandShare.brandId, brandId), eq(brandShare.sharedWithUserId, userId)))
      .limit(1),
    db
      .select({ role: workspaceMember.role })
      .from(workspaceMember)
      .where(and(eq(workspaceMember.brandId, brandId), eq(workspaceMember.userId, userId)))
      .limit(1),
  ]);

  const workspaceRole = (workspaceRow[0]?.role as WorkspaceMemberRole | undefined) ?? null;
  const canRead = isOwner || shareRow.length > 0 || workspaceRole !== null;
  const canWrite = isOwner || workspaceRole === "admin";

  return {
    canRead,
    canWrite,
    isOwner,
    workspaceRole,
  };
}

async function getThreadOwner(userId: string, threadId: string): Promise<{ id: string; brandId: string | null } | null> {
  const [threadRow] = await db
    .select({ id: chatThread.id, brandId: chatThread.brandId })
    .from(chatThread)
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, userId)))
    .limit(1);

  return threadRow ?? null;
}

async function getBrandMemoryRow(memoryId: string, brandId: string) {
  const [row] = await db
    .select()
    .from(memoryRecord)
    .where(
      and(
        eq(memoryRecord.id, memoryId),
        eq(memoryRecord.scopeType, "brand"),
        eq(memoryRecord.scopeId, brandId),
      ),
    )
    .limit(1);

  return row ?? null;
}

async function requireBrandMemoryWriteAccess(userId: string, brandId: string): Promise<void> {
  const permissions = await getBrandMemoryPermissions(userId, brandId);
  if (!permissions.canWrite) {
    throw new Error("FORBIDDEN");
  }
}

export async function listBrandMemory(
  userId: string,
  brandId: string,
): Promise<BrandMemoryListResponse> {
  const permissions = await getBrandMemoryPermissions(userId, brandId);
  if (!permissions.canRead) {
    throw new Error("FORBIDDEN");
  }

  const rows = await db
    .select()
    .from(memoryRecord)
    .where(and(eq(memoryRecord.scopeType, "brand"), eq(memoryRecord.scopeId, brandId)))
    .orderBy(
      asc(memoryRecord.status),
      desc(memoryRecord.updatedAt),
    );

  return {
    records: rows.map(mapMemoryRecord),
    permissions,
  };
}

export async function createBrandMemory(
  userId: string,
  brandId: string,
  input: CreateBrandMemoryInput,
): Promise<BrandMemoryRecord> {
  await requireBrandMemoryWriteAccess(userId, brandId);

  const [created] = await db
    .insert(memoryRecord)
    .values({
      id: nanoid(),
      scopeType: "brand",
      scopeId: brandId,
      memoryType: "shared_fact",
      status: "pending_review",
      title: input.title.trim(),
      category: input.category?.trim() || null,
      content: input.content.trim(),
      summary: createContentSummary(input.content),
      sourceType: "manual",
      createdByUserId: userId,
      metadata: {},
      confidence: 100,
    })
    .returning();

  return mapMemoryRecord(created);
}

export async function updateBrandMemory(
  userId: string,
  brandId: string,
  memoryId: string,
  input: UpdateBrandMemoryInput,
): Promise<BrandMemoryRecord> {
  await requireBrandMemoryWriteAccess(userId, brandId);

  const row = await getBrandMemoryRow(memoryId, brandId);
  if (!row) {
    throw new Error("NOT_FOUND");
  }

  const [updated] = await db
    .update(memoryRecord)
    .set({
      title: input.title.trim(),
      category: input.category?.trim() || null,
      content: input.content.trim(),
      summary: createContentSummary(input.content),
      status: "pending_review",
      approvedByUserId: null,
      rejectedByUserId: null,
      approvedAt: null,
      rejectedAt: null,
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(memoryRecord.id, row.id))
    .returning();

  return mapMemoryRecord(updated);
}

export async function approveBrandMemory(
  userId: string,
  brandId: string,
  memoryId: string,
): Promise<BrandMemoryRecord> {
  await requireBrandMemoryWriteAccess(userId, brandId);

  const row = await getBrandMemoryRow(memoryId, brandId);
  if (!row) {
    throw new Error("NOT_FOUND");
  }

  const [updated] = await db
    .update(memoryRecord)
    .set({
      status: "approved",
      approvedByUserId: userId,
      rejectedByUserId: null,
      approvedAt: new Date(),
      rejectedAt: null,
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(memoryRecord.id, row.id))
    .returning();

  return mapMemoryRecord(updated);
}

export async function rejectBrandMemory(
  userId: string,
  brandId: string,
  memoryId: string,
): Promise<BrandMemoryRecord> {
  await requireBrandMemoryWriteAccess(userId, brandId);

  const row = await getBrandMemoryRow(memoryId, brandId);
  if (!row) {
    throw new Error("NOT_FOUND");
  }

  const [updated] = await db
    .update(memoryRecord)
    .set({
      status: "rejected",
      approvedByUserId: null,
      rejectedByUserId: userId,
      approvedAt: null,
      rejectedAt: new Date(),
      archivedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(memoryRecord.id, row.id))
    .returning();

  return mapMemoryRecord(updated);
}

export async function archiveBrandMemory(
  userId: string,
  brandId: string,
  memoryId: string,
): Promise<BrandMemoryRecord> {
  await requireBrandMemoryWriteAccess(userId, brandId);

  const row = await getBrandMemoryRow(memoryId, brandId);
  if (!row) {
    throw new Error("NOT_FOUND");
  }

  const [updated] = await db
    .update(memoryRecord)
    .set({
      status: "archived",
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(memoryRecord.id, row.id))
    .returning();

  return mapMemoryRecord(updated);
}

export async function deleteBrandMemory(
  userId: string,
  brandId: string,
  memoryId: string,
): Promise<void> {
  await requireBrandMemoryWriteAccess(userId, brandId);

  const row = await getBrandMemoryRow(memoryId, brandId);
  if (!row) {
    throw new Error("NOT_FOUND");
  }

  await db.delete(memoryRecord).where(eq(memoryRecord.id, row.id));
}

export async function buildBrandMemoryPromptBlock(
  userId: string,
  brandId: string | null,
  query: string,
): Promise<string> {
  if (!brandId) return "";

  const permissions = await getBrandMemoryPermissions(userId, brandId);
  if (!permissions.canRead) return "";

  const rows = await db
    .select()
    .from(memoryRecord)
    .where(
      and(
        eq(memoryRecord.scopeType, "brand"),
        eq(memoryRecord.scopeId, brandId),
        eq(memoryRecord.status, "approved"),
      ),
    )
    .orderBy(desc(memoryRecord.updatedAt))
    .limit(24);

  const mapped = rows.map(mapMemoryRecord);
  const terms = normalizeQueryTerms(query);
  const scored = mapped
    .map((record) => ({
      record,
      score: scoreMemoryRecord(record, terms),
      updatedAt: new Date(record.updatedAt).getTime(),
    }))
    .filter((item) => terms.length === 0 || item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.updatedAt - a.updatedAt;
    });

  const candidates = (scored.length > 0 ? scored : mapped.map((record) => ({
    record,
    score: 0,
    updatedAt: new Date(record.updatedAt).getTime(),
  }))).slice(0, SHARED_MEMORY_MAX_RECORDS);

  const lines: string[] = [];
  let usedChars = 0;
  const selectedIds: string[] = [];

  for (const item of candidates) {
    const detail = item.record.summary || createContentSummary(item.record.content);
    const category = item.record.category ? `[${item.record.category}] ` : "";
    const line = `${category}${item.record.title}: ${detail}`;

    if (usedChars + line.length + 1 > SHARED_MEMORY_MAX_CHARS) break;

    lines.push(line);
    usedChars += line.length + 1;
    selectedIds.push(item.record.id);
  }

  if (selectedIds.length > 0) {
    void db
      .update(memoryRecord)
      .set({ lastReferencedAt: new Date() })
      .where(inArray(memoryRecord.id, selectedIds))
      .catch((error) => console.error("Failed to mark shared memory references:", error));
  }

  if (lines.length === 0) return "";
  return `<shared_memory scope="brand">\n${lines.join("\n")}\n</shared_memory>`;
}

export async function getThreadWorkingMemory(userId: string, threadId: string): Promise<ThreadWorkingMemoryRecord | null> {
  const threadRow = await getThreadOwner(userId, threadId);
  if (!threadRow) {
    throw new Error("NOT_FOUND");
  }

  const [row] = await db
    .select()
    .from(threadWorkingMemory)
    .where(eq(threadWorkingMemory.threadId, threadId))
    .limit(1);

  return row ? mapThreadWorkingMemory(row) : null;
}

export async function buildThreadWorkingMemoryPromptBlock(threadId: string): Promise<string> {
  const [row] = await db
    .select()
    .from(threadWorkingMemory)
    .where(eq(threadWorkingMemory.threadId, threadId))
    .limit(1);

  if (!row) return "";

  const record = mapThreadWorkingMemory(row);
  const sections: string[] = [];

  if (record.summary.trim()) {
    sections.push(`Summary: ${record.summary.trim()}`);
  }
  if (record.currentObjective?.trim()) {
    sections.push(`Current objective: ${record.currentObjective.trim()}`);
  }
  if (record.decisions.length > 0) {
    sections.push(`Decisions:\n- ${record.decisions.join("\n- ")}`);
  }
  if (record.openQuestions.length > 0) {
    sections.push(`Open questions:\n- ${record.openQuestions.join("\n- ")}`);
  }
  if (record.importantContext.length > 0) {
    sections.push(`Important context:\n- ${record.importantContext.join("\n- ")}`);
  }
  if (record.recentArtifacts.length > 0) {
    sections.push(`Recent artifacts:\n- ${record.recentArtifacts.join("\n- ")}`);
  }

  if (sections.length === 0) return "";
  return `<thread_working_memory>\n${sections.join("\n\n")}\n</thread_working_memory>`;
}

export async function refreshThreadWorkingMemoryFromMessages({
  threadId,
  brandId,
  messages,
}: {
  threadId: string;
  brandId: string | null;
  messages: PromptableMessage[];
}): Promise<ThreadWorkingMemoryRecord | null> {
  const conversation = formatConversationForModel(messages.slice(-24));
  if (!conversation.trim()) {
    await db.delete(threadWorkingMemory).where(eq(threadWorkingMemory.threadId, threadId));
    return null;
  }

  const prompt = `Summarize the current working state of this chat thread as JSON.

Return ONLY JSON with this shape:
{
  "summary": "1-2 sentence summary of the thread so far",
  "currentObjective": "the user's current active goal or null",
  "decisions": ["decision already made"],
  "openQuestions": ["question still unresolved"],
  "importantContext": ["critical context that should stay in mind"],
  "recentArtifacts": ["notable tool output, draft, or artifact"]
}

Rules:
- Focus on current thread state, not long-term profile facts
- Keep every string concise
- Max 5 items in each array
- Use empty arrays when nothing is relevant
- Do not invent missing decisions or artifacts`;

  const { text } = await generateText({
    model: WORKING_MEMORY_MODEL,
    system: "You produce compact, faithful working memory for an ongoing chat thread.",
    prompt: `${prompt}\n\nConversation:\n${conversation}`,
  });

  const parsed = parseWorkingMemoryResponse(text);
  const lastMessage = messages[messages.length - 1];
  const lastMessageId = getPersistableMessageId(lastMessage);
  const now = new Date();

  const [row] = await db
    .insert(threadWorkingMemory)
    .values({
      id: nanoid(),
      threadId,
      brandId,
      summary: parsed.summary,
      currentObjective: parsed.currentObjective,
      decisions: parsed.decisions,
      openQuestions: parsed.openQuestions,
      importantContext: parsed.importantContext,
      recentArtifacts: parsed.recentArtifacts,
      lastMessageId,
      refreshStatus: "ready",
      refreshedAt: now,
      clearedAt: null,
    })
    .onConflictDoUpdate({
      target: threadWorkingMemory.threadId,
      set: {
        brandId,
        summary: parsed.summary,
        currentObjective: parsed.currentObjective,
        decisions: parsed.decisions,
        openQuestions: parsed.openQuestions,
        importantContext: parsed.importantContext,
        recentArtifacts: parsed.recentArtifacts,
        lastMessageId,
        refreshStatus: "ready",
        refreshedAt: now,
        clearedAt: null,
        updatedAt: now,
      },
    })
    .returning();

  return row ? mapThreadWorkingMemory(row) : null;
}

export async function refreshThreadWorkingMemory(
  userId: string,
  threadId: string,
): Promise<ThreadWorkingMemoryRecord | null> {
  const threadRow = await getThreadOwner(userId, threadId);
  if (!threadRow) {
    throw new Error("NOT_FOUND");
  }

  const rows = await db
    .select({ id: chatMessage.id, role: chatMessage.role, parts: chatMessage.parts })
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.position));

  const promptableMessages = rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: (row.parts ?? []) as Array<{ type?: string; text?: string }>,
  }));

  return refreshThreadWorkingMemoryFromMessages({
    threadId,
    brandId: threadRow.brandId,
    messages: promptableMessages,
  });
}

export async function clearThreadWorkingMemory(userId: string, threadId: string): Promise<void> {
  const threadRow = await getThreadOwner(userId, threadId);
  if (!threadRow) {
    throw new Error("NOT_FOUND");
  }

  await db.delete(threadWorkingMemory).where(eq(threadWorkingMemory.threadId, threadId));
}
