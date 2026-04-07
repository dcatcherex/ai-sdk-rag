/**
 * Canonical record-keeper business logic.
 * Agent adapter, API routes, and any future sidebar page all call these functions.
 */

import { nanoid } from 'nanoid';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { activityRecord } from '@/db/schema/tools';
import type { LogActivityInput, GetRecordsInput, SummarizeRecordsInput, ActivityRecordRow } from './schema';

// ── Log Activity ──────────────────────────────────────────────────────────────

export async function runLogActivity(
  input: LogActivityInput,
  userId: string,
): Promise<{ id: string; date: string; activity: string }> {
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
    })
    .returning({ id: activityRecord.id, date: activityRecord.date, activity: activityRecord.activity });

  return { id: row.id, date: row.date, activity: row.activity };
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
