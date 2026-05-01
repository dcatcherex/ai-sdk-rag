/**
 * Canonical record-keeper business logic.
 * Agent adapter, API routes, and any future sidebar page all call these functions.
 */

import { nanoid } from 'nanoid';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityRecord } from '@/db/schema/tools';
import type { LogActivityInput, GetRecordsInput, SummarizeRecordsInput, ActivityRecordRow } from './schema';

function normalizeMetadata(
  metadata: LogActivityInput['metadata'] | ActivityRecordRow['metadata'] | undefined,
): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries);
}

// ── Log Activity ──────────────────────────────────────────────────────────────

export async function runLogActivity(
  input: LogActivityInput,
  userId: string,
): Promise<{ id: string; date: string; activity: string; metadata: Record<string, unknown> | null }> {
  const metadata = normalizeMetadata(input.metadata);
  const [row] = await db
    .insert(activityRecord)
    .values({
      id: nanoid(),
      userId,
      contextType: input.contextType,
      category: input.category ?? null,
      entity: input.entity ?? null,
      date: input.date,
      activity: input.activity,
      quantity: input.quantity ?? null,
      cost: input.cost != null ? String(input.cost) : null,
      income: input.income != null ? String(input.income) : null,
      notes: input.notes ?? null,
      metadata,
    })
    .returning({
      id: activityRecord.id,
      date: activityRecord.date,
      activity: activityRecord.activity,
      metadata: activityRecord.metadata,
    });

  return {
    id: row.id,
    date: row.date,
    activity: row.activity,
    metadata: normalizeMetadata(row.metadata ?? undefined),
  };
}

// ── Get Records ───────────────────────────────────────────────────────────────

export async function runGetRecords(
  input: GetRecordsInput,
  userId: string,
): Promise<{ records: ActivityRecordRow[]; total: number }> {
  const conditions = [
    eq(activityRecord.userId, userId),
    eq(activityRecord.contextType, input.contextType),
  ];

  if (input.entity) conditions.push(eq(activityRecord.entity, input.entity));
  if (input.category) conditions.push(eq(activityRecord.category, input.category));
  if (input.startDate) conditions.push(gte(activityRecord.date, input.startDate));
  if (input.endDate) conditions.push(lte(activityRecord.date, input.endDate));

  const rows = await db
    .select()
    .from(activityRecord)
    .where(and(...conditions))
    .orderBy(desc(activityRecord.date), desc(activityRecord.createdAt))
    .limit(input.limit ?? 20);

  const records: ActivityRecordRow[] = rows.map((r) => ({
    id: r.id,
    contextType: r.contextType,
    category: r.category,
    entity: r.entity,
    date: r.date,
    activity: r.activity,
    quantity: r.quantity,
    cost: r.cost,
    income: r.income,
    notes: r.notes,
    metadata: normalizeMetadata(r.metadata ?? undefined),
    createdAt: r.createdAt.toISOString(),
  }));

  return { records, total: records.length };
}

// ── Summarize Records ─────────────────────────────────────────────────────────

export async function runSummarizeRecords(
  input: SummarizeRecordsInput,
  userId: string,
): Promise<{
  period: string;
  total: number;
  totalCost: number;
  totalIncome: number;
  records: ActivityRecordRow[];
}> {
  const today = new Date();
  let startDate: string | undefined;

  if (input.period === 'week') {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString().split('T')[0];
  } else if (input.period === 'month') {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    startDate = d.toISOString().split('T')[0];
  }

  const { records } = await runGetRecords(
    {
      contextType: input.contextType,
      entity: input.entity,
      startDate,
      limit: 100,
    },
    userId,
  );

  const totalCost = records.reduce((sum, r) => sum + (r.cost ? parseFloat(r.cost) : 0), 0);
  const totalIncome = records.reduce((sum, r) => sum + (r.income ? parseFloat(r.income) : 0), 0);

  return {
    period: input.period ?? 'week',
    total: records.length,
    totalCost,
    totalIncome,
    records,
  };
}
