import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

import { brand, brandShare, memoryRecord, workspaceMember } from "@/db/schema";
import type { WorkspaceMemberRole } from "@/features/collaboration/types";
import type { CreateBrandMemoryInput, UpdateBrandMemoryInput } from "@/features/memory/schema";
import type {
  BrandMemoryListResponse,
  BrandMemoryPermission,
  BrandMemoryRecord,
} from "@/features/memory/types";
import {
  createContentSummary,
  mapMemoryRecord,
  normalizeQueryTerms,
  scoreMemoryRecord,
  SHARED_MEMORY_MAX_CHARS,
  SHARED_MEMORY_MAX_RECORDS,
} from "./shared";

async function getDb() {
  return (await import("@/lib/db")).db;
}

export async function getBrandMemoryPermissions(
  userId: string,
  brandId: string,
): Promise<BrandMemoryPermission> {
  const db = await getDb();
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

async function getBrandMemoryRow(memoryId: string, brandId: string) {
  const db = await getDb();
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

  const db = await getDb();
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

  const db = await getDb();
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

  const db = await getDb();
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

  const db = await getDb();
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

  const db = await getDb();
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

  const db = await getDb();
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

  const db = await getDb();
  await db.delete(memoryRecord).where(eq(memoryRecord.id, row.id));
}

export function buildBrandMemoryPromptBlockFromRecords(
  records: BrandMemoryRecord[],
  query: string,
): { block: string; selectedIds: string[] } {
  const approvedRecords = records.filter((record) => record.status === "approved");
  const terms = normalizeQueryTerms(query);
  const scored = approvedRecords
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

  const candidates = (scored.length > 0
    ? scored
    : approvedRecords.map((record) => ({
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

  return {
    block: lines.length > 0 ? `<shared_memory scope="brand">\n${lines.join("\n")}\n</shared_memory>` : "",
    selectedIds,
  };
}

export async function buildBrandMemoryPromptBlock(
  userId: string,
  brandId: string | null,
  query: string,
): Promise<string> {
  if (!brandId) return "";

  const permissions = await getBrandMemoryPermissions(userId, brandId);
  if (!permissions.canRead) return "";

  const db = await getDb();
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

  const { block, selectedIds } = buildBrandMemoryPromptBlockFromRecords(rows.map(mapMemoryRecord), query);

  if (selectedIds.length > 0) {
    void db
      .update(memoryRecord)
      .set({ lastReferencedAt: new Date() })
      .where(inArray(memoryRecord.id, selectedIds))
      .catch((error) => console.error("Failed to mark shared memory references:", error));
  }

  return block;
}
