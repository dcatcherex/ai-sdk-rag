import { and, desc, eq, like } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { db } from '@/lib/db';
import { campaignBrief, contentCalendarEntry } from '@/db/schema';
import type {
  CampaignBrief,
  CampaignStatus,
  CalendarEntry,
  CalendarEntryStatus,
  CalendarEntryContentType,
  CalendarChannel,
} from './types';

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapCampaignBrief(row: typeof campaignBrief.$inferSelect): CampaignBrief {
  return {
    id: row.id,
    userId: row.userId,
    brandId: row.brandId ?? null,
    title: row.title,
    goal: row.goal ?? null,
    offer: row.offer ?? null,
    keyMessage: row.keyMessage ?? null,
    cta: row.cta ?? null,
    channels: row.channels ?? [],
    startDate: row.startDate ?? null,
    endDate: row.endDate ?? null,
    status: (row.status as CampaignStatus) ?? 'draft',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapCalendarEntry(row: typeof contentCalendarEntry.$inferSelect): CalendarEntry {
  return {
    id: row.id,
    userId: row.userId,
    brandId: row.brandId ?? null,
    campaignId: row.campaignId ?? null,
    contentPieceId: row.contentPieceId ?? null,
    title: row.title,
    contentType: (row.contentType as CalendarEntryContentType) ?? 'other',
    channel: (row.channel as CalendarChannel) ?? null,
    status: (row.status as CalendarEntryStatus) ?? 'idea',
    plannedDate: row.plannedDate,
    notes: row.notes ?? null,
    color: row.color ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Campaign Brief Functions ───────────────────────────────────────────────────

export async function getCampaignBriefs(
  userId: string,
  opts?: { brandId?: string; status?: string },
): Promise<CampaignBrief[]> {
  const conditions = [eq(campaignBrief.userId, userId)];
  if (opts?.brandId) conditions.push(eq(campaignBrief.brandId, opts.brandId));
  if (opts?.status) conditions.push(eq(campaignBrief.status, opts.status));

  const rows = await db
    .select()
    .from(campaignBrief)
    .where(and(...conditions))
    .orderBy(desc(campaignBrief.createdAt));

  return rows.map(mapCampaignBrief);
}

export async function getCampaignBrief(userId: string, id: string): Promise<CampaignBrief | null> {
  const rows = await db
    .select()
    .from(campaignBrief)
    .where(and(eq(campaignBrief.id, id), eq(campaignBrief.userId, userId)))
    .limit(1);

  return rows[0] ? mapCampaignBrief(rows[0]) : null;
}

export async function createCampaignBrief(
  userId: string,
  data: Partial<Omit<CampaignBrief, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> & { title: string },
): Promise<CampaignBrief> {
  const id = nanoid();
  const rows = await db
    .insert(campaignBrief)
    .values({
      id,
      userId,
      brandId: data.brandId ?? null,
      title: data.title,
      goal: data.goal ?? null,
      offer: data.offer ?? null,
      keyMessage: data.keyMessage ?? null,
      cta: data.cta ?? null,
      channels: data.channels ?? [],
      startDate: data.startDate ?? null,
      endDate: data.endDate ?? null,
      status: data.status ?? 'draft',
    })
    .returning();

  return mapCampaignBrief(rows[0]);
}

export async function updateCampaignBrief(
  userId: string,
  id: string,
  data: Partial<Omit<CampaignBrief, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<CampaignBrief | null> {
  const rows = await db
    .update(campaignBrief)
    .set({
      ...(data.brandId !== undefined ? { brandId: data.brandId } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.goal !== undefined ? { goal: data.goal } : {}),
      ...(data.offer !== undefined ? { offer: data.offer } : {}),
      ...(data.keyMessage !== undefined ? { keyMessage: data.keyMessage } : {}),
      ...(data.cta !== undefined ? { cta: data.cta } : {}),
      ...(data.channels !== undefined ? { channels: data.channels } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
      ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(campaignBrief.id, id), eq(campaignBrief.userId, userId)))
    .returning();

  return rows[0] ? mapCampaignBrief(rows[0]) : null;
}

export async function deleteCampaignBrief(userId: string, id: string): Promise<void> {
  await db
    .delete(campaignBrief)
    .where(and(eq(campaignBrief.id, id), eq(campaignBrief.userId, userId)));
}

// ── Calendar Entry Functions ───────────────────────────────────────────────────

export async function getCalendarEntries(
  userId: string,
  opts?: { brandId?: string; campaignId?: string; month?: number; year?: number },
): Promise<CalendarEntry[]> {
  const conditions = [eq(contentCalendarEntry.userId, userId)];
  if (opts?.brandId) conditions.push(eq(contentCalendarEntry.brandId, opts.brandId));
  if (opts?.campaignId) conditions.push(eq(contentCalendarEntry.campaignId, opts.campaignId));
  if (opts?.year !== undefined && opts?.month !== undefined) {
    const mm = String(opts.month).padStart(2, '0');
    conditions.push(like(contentCalendarEntry.plannedDate, `${opts.year}-${mm}-%`));
  }

  const rows = await db
    .select()
    .from(contentCalendarEntry)
    .where(and(...conditions))
    .orderBy(contentCalendarEntry.plannedDate);

  return rows.map(mapCalendarEntry);
}

const ALL_STATUSES: CalendarEntryStatus[] = [
  'idea', 'briefed', 'drafting', 'review', 'approved', 'scheduled', 'published', 'repurposed',
];

export async function getKanbanEntries(
  userId: string,
  opts?: { brandId?: string; campaignId?: string },
): Promise<Record<CalendarEntryStatus, CalendarEntry[]>> {
  const entries = await getCalendarEntries(userId, opts);

  const result = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, [] as CalendarEntry[]]),
  ) as Record<CalendarEntryStatus, CalendarEntry[]>;

  for (const entry of entries) {
    if (result[entry.status]) {
      result[entry.status].push(entry);
    } else {
      result['idea'].push(entry);
    }
  }

  return result;
}

export async function createCalendarEntry(
  userId: string,
  data: Partial<Omit<CalendarEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> & {
    title: string;
    contentType: CalendarEntryContentType;
    plannedDate: string;
  },
): Promise<CalendarEntry> {
  const id = nanoid();
  const rows = await db
    .insert(contentCalendarEntry)
    .values({
      id,
      userId,
      brandId: data.brandId ?? null,
      campaignId: data.campaignId ?? null,
      contentPieceId: data.contentPieceId ?? null,
      title: data.title,
      contentType: data.contentType,
      channel: data.channel ?? null,
      status: data.status ?? 'idea',
      plannedDate: data.plannedDate,
      notes: data.notes ?? null,
      color: data.color ?? null,
    })
    .returning();

  return mapCalendarEntry(rows[0]);
}

export async function updateCalendarEntry(
  userId: string,
  id: string,
  data: Partial<Omit<CalendarEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
): Promise<CalendarEntry | null> {
  const rows = await db
    .update(contentCalendarEntry)
    .set({
      ...(data.brandId !== undefined ? { brandId: data.brandId } : {}),
      ...(data.campaignId !== undefined ? { campaignId: data.campaignId } : {}),
      ...(data.contentPieceId !== undefined ? { contentPieceId: data.contentPieceId } : {}),
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.contentType !== undefined ? { contentType: data.contentType } : {}),
      ...(data.channel !== undefined ? { channel: data.channel } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.plannedDate !== undefined ? { plannedDate: data.plannedDate } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(contentCalendarEntry.id, id), eq(contentCalendarEntry.userId, userId)))
    .returning();

  return rows[0] ? mapCalendarEntry(rows[0]) : null;
}

export async function deleteCalendarEntry(userId: string, id: string): Promise<void> {
  await db
    .delete(contentCalendarEntry)
    .where(and(eq(contentCalendarEntry.id, id), eq(contentCalendarEntry.userId, userId)));
}
