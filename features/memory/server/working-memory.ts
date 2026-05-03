import { generateText } from "ai";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { chatMessage, chatThread, threadWorkingMemory } from "@/db/schema";
import type { ThreadWorkingMemoryRecord } from "@/features/memory/types";
import {
  formatConversationForModel,
  getPersistableMessageId,
  mapThreadWorkingMemory,
  parseWorkingMemoryResponse,
  type PromptableMessage,
} from "./shared";

export const WORKING_MEMORY_MODEL = "google/gemini-2.5-flash-lite";

async function getDb() {
  return (await import("@/lib/db")).db;
}

async function getThreadOwner(userId: string, threadId: string): Promise<{ id: string; brandId: string | null } | null> {
  const db = await getDb();
  const [threadRow] = await db
    .select({ id: chatThread.id, brandId: chatThread.brandId })
    .from(chatThread)
    .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, userId)))
    .limit(1);

  return threadRow ?? null;
}

export function formatThreadWorkingMemoryPromptBlock(record: ThreadWorkingMemoryRecord): string {
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

export async function buildThreadWorkingMemoryPromptBlock(threadId: string): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(threadWorkingMemory)
    .where(eq(threadWorkingMemory.threadId, threadId))
    .limit(1);

  if (!row) return "";

  const record = mapThreadWorkingMemory(row);
  return formatThreadWorkingMemoryPromptBlock(record);
}

export async function getThreadWorkingMemory(userId: string, threadId: string): Promise<ThreadWorkingMemoryRecord | null> {
  const threadRow = await getThreadOwner(userId, threadId);
  if (!threadRow) {
    throw new Error("NOT_FOUND");
  }

  const db = await getDb();
  const [row] = await db
    .select()
    .from(threadWorkingMemory)
    .where(eq(threadWorkingMemory.threadId, threadId))
    .limit(1);

  return row ? mapThreadWorkingMemory(row) : null;
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
  const db = await getDb();
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

  const db = await getDb();
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

  const db = await getDb();
  await db.delete(threadWorkingMemory).where(eq(threadWorkingMemory.threadId, threadId));
}
