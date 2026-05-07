import {
  createDomainEntity,
  createDomainProfile,
  getDomainEntity,
  getDomainProfile,
  linkDomainEntities,
  listDomainEntities,
  listDomainProfiles,
  updateDomainEntity,
  updateDomainProfile,
} from '@/features/domain-profiles/service';
import {
  getOwnedEntityRow,
  listDomainProfilesForOwner,
  listEntitiesByIds,
  listRelationsForProfile,
} from '@/features/domain-profiles/server/queries';
import type { DomainEntityDto, DomainProfileDto } from '@/features/domain-profiles/types';
import { PDFDocument, StandardFonts } from 'pdf-lib';

import type {
  AssignCaseInput,
  CaseWorkspaceAgingBucket,
  CaseWorkspaceCase,
  CaseWorkspaceCaseContext,
  CaseWorkspaceContact,
  CaseWorkspaceDashboard,
  CaseWorkspaceDashboardMetrics,
  CaseWorkspaceExportFormat,
  CaseWorkspaceOwnerContext,
  CaseWorkspaceProfile,
  CaseWorkspaceReminderItem,
  CaseWorkspaceSummary,
  CaseWorkspaceTask,
  CaseWorkspaceTimelineItem,
  CaseWorkspaceTimelineKind,
  CreateCaseInput,
  CreateContactInput,
  CreateTaskInput,
  CreateTimelineNoteInput,
  CreateWorkspaceProfileInput,
  SearchCasesInput,
  UpdateCaseInput,
  UpdateContactInput,
  UpdateTaskInput,
} from './types';

const CASE_ENTITY_TYPE = 'case';
const CONTACT_ENTITY_TYPE = 'contact';
const TASK_ENTITY_TYPE = 'task';
const NOTE_ENTITY_TYPE = 'note';

const CASE_CONTACT_RELATION_TYPES = ['primary_contact', 'owns'] as const;
const CASE_TASK_RELATION_TYPE = 'has_task';
const CASE_NOTE_RELATION_TYPE = 'has_note';

type CaseDataTimelineEntry = {
  id: string;
  kind: CaseWorkspaceTimelineKind;
  title: string;
  body?: string;
  createdAt: string;
  actorUserId?: string;
  data?: Record<string, unknown>;
};

export type ResolvedCaseWorkspacePromptContext = {
  context: CaseWorkspaceCaseContext | null;
  shouldSuggestCreate: boolean;
};

export type PendingCaseWorkspaceDraft = {
  draftId: string;
  action: 'create_case' | 'add_note';
  profileId?: string;
  caseId?: string;
  title: string;
  body?: string;
  userText: string;
  summaryText: string;
  data: Record<string, unknown>;
};

function normalizeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeCaseStatus(value: unknown): CaseWorkspaceCase['status'] {
  switch (value) {
    case 'new':
    case 'in_progress':
    case 'waiting':
    case 'done':
    case 'archived':
      return value;
    default:
      return 'new';
  }
}

function normalizePriority(value: unknown): CaseWorkspaceCase['priority'] {
  switch (value) {
    case 'low':
    case 'normal':
    case 'high':
    case 'urgent':
      return value;
    default:
      return 'normal';
  }
}

function normalizeTaskStatus(value: unknown): CaseWorkspaceTask['status'] {
  switch (value) {
    case 'todo':
    case 'doing':
    case 'done':
    case 'cancelled':
      return value;
    default:
      return 'todo';
  }
}

function mapProfile(profile: DomainProfileDto): CaseWorkspaceProfile {
  return {
    id: profile.id,
    domain: profile.domain,
    name: profile.name,
    description: profile.description,
    locale: profile.locale,
    status: profile.status === 'archived' ? 'archived' : 'active',
    data: normalizeRecord(profile.data),
  };
}

function mapContact(entity: DomainEntityDto): CaseWorkspaceContact {
  return {
    id: entity.id,
    profileId: entity.profileId,
    name: entity.name,
    status: entity.status === 'archived' ? 'archived' : 'active',
    kind: 'contact',
    data: normalizeRecord(entity.data),
  };
}

function mapCase(entity: DomainEntityDto, contactId?: string | null): CaseWorkspaceCase {
  const data = normalizeRecord(entity.data);
  return {
    id: entity.id,
    profileId: entity.profileId,
    name: entity.name,
    status: normalizeCaseStatus(data.status ?? entity.status),
    priority: normalizePriority(data.priority),
    contactId: contactId ?? undefined,
    data,
  };
}

function mapTask(entity: DomainEntityDto, caseId: string): CaseWorkspaceTask {
  const data = normalizeRecord(entity.data);
  return {
    id: entity.id,
    caseId,
    title: entity.name,
    status: normalizeTaskStatus(data.status ?? entity.status),
    dueAt: typeof data.dueAt === 'string' ? data.dueAt : undefined,
    assigneeUserId: typeof data.assigneeUserId === 'string' ? data.assigneeUserId : undefined,
    data,
  };
}

function readTimelineEntries(data: Record<string, unknown>): CaseDataTimelineEntry[] {
  const raw = data.timeline;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const kind = record.kind;
    const title = record.title;
    const createdAt = record.createdAt;
    if (
      typeof kind !== 'string' ||
      typeof title !== 'string' ||
      typeof createdAt !== 'string'
    ) {
      return [];
    }

    return [{
      id: typeof record.id === 'string' ? record.id : crypto.randomUUID(),
      kind: normalizeTimelineKind(kind),
      title,
      body: typeof record.body === 'string' ? record.body : undefined,
      createdAt,
      actorUserId: typeof record.actorUserId === 'string' ? record.actorUserId : undefined,
      data: normalizeRecord(record.data),
    }];
  });
}

function normalizeTimelineKind(value: string): CaseWorkspaceTimelineKind {
  switch (value) {
    case 'note':
    case 'message_summary':
    case 'status_change':
    case 'task_change':
    case 'file_link':
    case 'ai_action':
      return value;
    default:
      return 'note';
  }
}

function normalizeComparableText(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseIsoDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDueSoon(value: unknown) {
  const date = parseIsoDate(value);
  if (!date) return false;
  const delta = date.getTime() - Date.now();
  return delta >= 0 && delta <= 7 * 24 * 60 * 60 * 1000;
}

function isOverdue(value: unknown) {
  const date = parseIsoDate(value);
  if (!date) return false;
  return date.getTime() < Date.now();
}

function diffInDaysFromNow(value: unknown) {
  const date = parseIsoDate(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

export function getCaseAgingBucket(caseRecord: CaseWorkspaceCase): CaseWorkspaceAgingBucket {
  const ageInDays = diffInDaysFromNow(caseRecord.data.lastContactAt);

  if (ageInDays == null || ageInDays <= 3) return 'new';
  if (ageInDays <= 7) return 'stale';
  if (ageInDays <= 14) return 'aging';
  return 'critical';
}

function buildTimelineItemFromNote(entity: DomainEntityDto, caseId: string): CaseWorkspaceTimelineItem {
  const data = normalizeRecord(entity.data);
  return {
    id: entity.id,
    caseId,
    kind: normalizeTimelineKind(typeof data.kind === 'string' ? data.kind : 'note'),
    title: entity.name,
    body: entity.description ?? undefined,
    createdAt: entity.createdAt.toISOString(),
    actorUserId: typeof data.actorUserId === 'string' ? data.actorUserId : undefined,
    data,
  };
}

function buildTimelineItemFromTask(task: CaseWorkspaceTask): CaseWorkspaceTimelineItem {
  return {
    id: `task-${task.id}`,
    caseId: task.caseId,
    kind: 'task_change',
    title: task.title,
    body: `Task is ${task.status.replace('_', ' ')}`,
    createdAt: typeof task.data.updatedAt === 'string' ? task.data.updatedAt : new Date().toISOString(),
    actorUserId: typeof task.data.assigneeUserId === 'string' ? task.data.assigneeUserId : undefined,
    data: task.data,
  };
}

function appendTimelineEntry(
  caseEntity: DomainEntityDto,
  entry: Omit<CaseDataTimelineEntry, 'id' | 'createdAt'> & { createdAt?: string; id?: string },
) {
  const data = normalizeRecord(caseEntity.data);
  const nextTimeline = [
    ...readTimelineEntries(data),
    {
      id: entry.id ?? crypto.randomUUID(),
      kind: entry.kind,
      title: entry.title,
      body: entry.body,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      actorUserId: entry.actorUserId,
      data: entry.data ?? {},
    },
  ];

  return {
    ...data,
    timeline: nextTimeline,
    updatedAt: new Date().toISOString(),
  };
}

async function requireProfile(profileId: string, owner: CaseWorkspaceOwnerContext) {
  const profile = await getDomainProfile(profileId, owner);
  if (!profile) {
    throw new Error('Case workspace profile not found');
  }
  return profile;
}

async function requireCaseEntity(caseId: string, owner: CaseWorkspaceOwnerContext) {
  const entity = await getDomainEntity(caseId, owner);
  if (!entity || entity.entityType !== CASE_ENTITY_TYPE) {
    throw new Error('Case not found');
  }
  return entity;
}

async function loadProfileRelations(profileId: string, owner: CaseWorkspaceOwnerContext) {
  await requireProfile(profileId, owner);
  return listRelationsForProfile(profileId);
}

async function resolveCaseContactId(caseEntity: DomainEntityDto, owner: CaseWorkspaceOwnerContext) {
  const relations = await loadProfileRelations(caseEntity.profileId, owner);
  const relation = relations.find(
    (item) =>
      item.fromEntityId === caseEntity.id
      && CASE_CONTACT_RELATION_TYPES.includes(item.relationType as (typeof CASE_CONTACT_RELATION_TYPES)[number]),
  );
  return relation?.toEntityId ?? null;
}

async function resolveCaseTasks(caseEntity: DomainEntityDto, owner: CaseWorkspaceOwnerContext) {
  const relations = await loadProfileRelations(caseEntity.profileId, owner);
  const taskIds = relations
    .filter((item) => item.fromEntityId === caseEntity.id && item.relationType === CASE_TASK_RELATION_TYPE)
    .map((item) => item.toEntityId);
  const taskEntities = taskIds.length > 0
    ? await listEntitiesByIds(taskIds)
    : [];

  return taskEntities
    .filter((item) => item.entityType === TASK_ENTITY_TYPE)
    .map((item) => mapTask(item, caseEntity.id));
}

async function resolveCaseNotes(caseEntity: DomainEntityDto, owner: CaseWorkspaceOwnerContext) {
  const relations = await loadProfileRelations(caseEntity.profileId, owner);
  const noteIds = relations
    .filter((item) => item.fromEntityId === caseEntity.id && item.relationType === CASE_NOTE_RELATION_TYPE)
    .map((item) => item.toEntityId);
  const noteEntities = noteIds.length > 0
    ? await listEntitiesByIds(noteIds)
    : [];

  return noteEntities
    .filter((item) => item.entityType === NOTE_ENTITY_TYPE)
    .map((item) => buildTimelineItemFromNote(item, caseEntity.id));
}

async function listProfileCaseEntities(profileId: string, owner: CaseWorkspaceOwnerContext) {
  await requireProfile(profileId, owner);
  const entities = await listDomainEntities(profileId, owner, {
    entityType: CASE_ENTITY_TYPE,
    limit: 200,
  });

  return entities ?? [];
}

async function resolveProfileCases(profileId: string, owner: CaseWorkspaceOwnerContext) {
  const entities = await listProfileCaseEntities(profileId, owner);
  return Promise.all(
    entities.map(async (entity) => mapCase(entity, await resolveCaseContactId(entity, owner))),
  );
}

async function resolveProfileTasks(profileId: string, owner: CaseWorkspaceOwnerContext) {
  const caseEntities = await listProfileCaseEntities(profileId, owner);
  const tasks = await Promise.all(caseEntities.map((entity) => resolveCaseTasks(entity, owner)));
  return tasks.flat();
}

export function buildCaseWorkspaceDashboardData(input: {
  profile: CaseWorkspaceProfile;
  cases: CaseWorkspaceCase[];
  tasks: CaseWorkspaceTask[];
}): CaseWorkspaceDashboard {
  const statusCounts: CaseWorkspaceDashboardMetrics['statusCounts'] = {
    new: 0,
    in_progress: 0,
    waiting: 0,
    done: 0,
    archived: 0,
  };
  const priorityCounts: CaseWorkspaceDashboardMetrics['priorityCounts'] = {
    low: 0,
    normal: 0,
    high: 0,
    urgent: 0,
  };
  const agingCounts: CaseWorkspaceDashboardMetrics['agingCounts'] = {
    new: 0,
    stale: 0,
    aging: 0,
    critical: 0,
  };

  const overdueTasks = input.tasks.filter(
    (task) => task.status !== 'done' && task.status !== 'cancelled' && isOverdue(task.dueAt),
  );
  const dueSoonTasks = input.tasks.filter(
    (task) => task.status !== 'done' && task.status !== 'cancelled' && isDueSoon(task.dueAt),
  );

  for (const caseRecord of input.cases) {
    statusCounts[caseRecord.status] += 1;
    priorityCounts[caseRecord.priority] += 1;
    agingCounts[getCaseAgingBucket(caseRecord)] += 1;
  }

  const reminders: CaseWorkspaceReminderItem[] = [
    ...input.cases.flatMap((caseRecord) => {
      const items: CaseWorkspaceReminderItem[] = [];
      if (caseRecord.status === 'waiting' && getCaseAgingBucket(caseRecord) !== 'new') {
        items.push({
          caseId: caseRecord.id,
          caseName: caseRecord.name,
          profileId: input.profile.id,
          profileName: input.profile.name,
          kind: 'follow_up',
          message: `Waiting case "${caseRecord.name}" may need a follow-up.`,
          dueAt: caseRecord.data.dueAt,
          assigneeUserId: typeof caseRecord.data.assigneeUserId === 'string' ? caseRecord.data.assigneeUserId : undefined,
          priority: caseRecord.priority,
        });
      }
      if (!normalizeComparableText(caseRecord.data.assigneeUserId) && caseRecord.status !== 'done' && caseRecord.status !== 'archived') {
        items.push({
          caseId: caseRecord.id,
          caseName: caseRecord.name,
          profileId: input.profile.id,
          profileName: input.profile.name,
          kind: 'case_unassigned',
          message: `Case "${caseRecord.name}" is still unassigned.`,
          dueAt: caseRecord.data.dueAt,
          priority: caseRecord.priority,
        });
      }
      return items;
    }),
    ...overdueTasks.map((task) => ({
      caseId: task.caseId,
      caseName: input.cases.find((caseRecord) => caseRecord.id === task.caseId)?.name ?? task.title,
      profileId: input.profile.id,
      profileName: input.profile.name,
      kind: 'task_overdue' as const,
      message: `Task "${task.title}" is overdue.`,
      dueAt: task.dueAt,
      assigneeUserId: task.assigneeUserId,
      priority: input.cases.find((caseRecord) => caseRecord.id === task.caseId)?.priority ?? 'normal',
    })),
    ...dueSoonTasks.map((task) => ({
      caseId: task.caseId,
      caseName: input.cases.find((caseRecord) => caseRecord.id === task.caseId)?.name ?? task.title,
      profileId: input.profile.id,
      profileName: input.profile.name,
      kind: 'task_due_soon' as const,
      message: `Task "${task.title}" is due soon.`,
      dueAt: task.dueAt,
      assigneeUserId: task.assigneeUserId,
      priority: input.cases.find((caseRecord) => caseRecord.id === task.caseId)?.priority ?? 'normal',
    })),
  ].sort((a, b) => {
    const dueA = a.dueAt ?? '';
    const dueB = b.dueAt ?? '';
    if (dueA && dueB) return dueA.localeCompare(dueB);
    if (dueA) return -1;
    if (dueB) return 1;
    return a.caseName.localeCompare(b.caseName);
  });

  return {
    profile: input.profile,
    metrics: {
      totalCases: input.cases.length,
      openCases: input.cases.filter((caseRecord) => !['done', 'archived'].includes(caseRecord.status)).length,
      waitingCases: statusCounts.waiting,
      overdueTasks: overdueTasks.length,
      dueSoonTasks: dueSoonTasks.length,
      unassignedCases: input.cases.filter(
        (caseRecord) =>
          !normalizeComparableText(caseRecord.data.assigneeUserId)
          && !['done', 'archived'].includes(caseRecord.status),
      ).length,
      statusCounts,
      priorityCounts,
      agingCounts,
    },
    reminders,
    overdueTasks,
    dueSoonTasks,
  };
}

function escapeCsvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildCaseWorkspaceCsvExport(input: {
  profile: CaseWorkspaceProfile;
  cases: CaseWorkspaceCase[];
  tasks: CaseWorkspaceTask[];
}) {
  const header = [
    'profile_id',
    'profile_name',
    'case_id',
    'case_name',
    'case_status',
    'case_priority',
    'assignee_user_id',
    'source',
    'due_at',
    'last_contact_at',
    'next_action',
    'task_id',
    'task_title',
    'task_status',
    'task_due_at',
    'task_assignee_user_id',
  ];
  const taskMap = new Map<string, CaseWorkspaceTask[]>();
  for (const task of input.tasks) {
    const list = taskMap.get(task.caseId) ?? [];
    list.push(task);
    taskMap.set(task.caseId, list);
  }

  const rows = input.cases.flatMap((caseRecord) => {
    const relatedTasks = taskMap.get(caseRecord.id) ?? [];
    if (relatedTasks.length === 0) {
      return [[
        input.profile.id,
        input.profile.name,
        caseRecord.id,
        caseRecord.name,
        caseRecord.status,
        caseRecord.priority,
        typeof caseRecord.data.assigneeUserId === 'string' ? caseRecord.data.assigneeUserId : '',
        caseRecord.data.source ?? '',
        caseRecord.data.dueAt ?? '',
        caseRecord.data.lastContactAt ?? '',
        caseRecord.data.nextAction ?? '',
        '',
        '',
        '',
        '',
        '',
      ]];
    }

    return relatedTasks.map((task) => [
      input.profile.id,
      input.profile.name,
      caseRecord.id,
      caseRecord.name,
      caseRecord.status,
      caseRecord.priority,
      typeof caseRecord.data.assigneeUserId === 'string' ? caseRecord.data.assigneeUserId : '',
      caseRecord.data.source ?? '',
      caseRecord.data.dueAt ?? '',
      caseRecord.data.lastContactAt ?? '',
      caseRecord.data.nextAction ?? '',
      task.id,
      task.title,
      task.status,
      task.dueAt ?? '',
      task.assigneeUserId ?? '',
    ]);
  });

  return [
    header.join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ].join('\n');
}

async function buildCaseWorkspacePdfExport(input: {
  profile: CaseWorkspaceProfile;
  dashboard: CaseWorkspaceDashboard;
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const lines = [
    `Case Workspace Report`,
    `${input.profile.name} (${input.profile.domain})`,
    '',
    `Total cases: ${input.dashboard.metrics.totalCases}`,
    `Open cases: ${input.dashboard.metrics.openCases}`,
    `Waiting cases: ${input.dashboard.metrics.waitingCases}`,
    `Overdue tasks: ${input.dashboard.metrics.overdueTasks}`,
    `Due soon tasks: ${input.dashboard.metrics.dueSoonTasks}`,
    `Unassigned cases: ${input.dashboard.metrics.unassignedCases}`,
    '',
    'Top reminders:',
    ...input.dashboard.reminders.slice(0, 12).map((item) => `- ${item.message}${item.dueAt ? ` (${item.dueAt})` : ''}`),
  ];

  let y = 752;
  for (const [index, line] of lines.entries()) {
    page.drawText(line, {
      x: 40,
      y,
      size: index < 2 ? 16 : 10,
      font: index < 2 ? boldFont : font,
    });
    y -= index < 2 ? 22 : 14;
    if (y < 40) break;
  }

  return pdf.save();
}

export function filterCasesByInput(
  cases: CaseWorkspaceCase[],
  input: SearchCasesInput,
  owner: CaseWorkspaceOwnerContext,
) {
  const query = input.query?.trim().toLowerCase();
  const ownerUserId = normalizeComparableText(owner.userId);

  return cases.filter((item) => {
    if (input.status && item.status !== input.status) return false;
    if (input.priority && item.priority !== input.priority) return false;
    if (input.source && item.data.source !== input.source) return false;
    if (input.dueSoon && !isDueSoon(item.data.dueAt)) return false;
    if (
      input.waitingOnReply
      && item.status !== 'waiting'
      && !normalizeComparableText(item.data.nextAction).includes('reply')
      && !normalizeComparableText(item.data.nextAction).includes('follow')
    ) {
      return false;
    }
    if (input.assignedToMe) {
      if (!ownerUserId) return false;
      if (normalizeComparableText(item.data.assigneeUserId) !== ownerUserId) {
        return false;
      }
    }

    if (!query) return true;

    const haystack = [
      item.name,
      item.data.summary,
      item.data.nextAction,
      item.data.professionType,
      item.data.source,
    ]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function detectCaseWorkspaceIntakeSignal(userText: string) {
  const text = userText.trim().toLowerCase();
  if (!text) return false;

  const patterns = [
    /\b(new|need help|problem|issue|complaint|follow up|follow-up|appointment|status|update|document|photo)\b/i,
    /\b(case|project|visit|deal|ticket|claim|campaign|lesson|order)\b/i,
    /(นัด|ปัญหา|ช่วยด้วย|ขอความช่วยเหลือ|ติดตาม|สถานะ|อัปเดต|เอกสาร|รูป|ภาพ|นัดหมาย|ร้องเรียน)/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

export function detectCaseWorkspaceFollowUpSignal(userText: string) {
  const text = userText.trim().toLowerCase();
  if (!text) return false;

  const patterns = [
    /\b(status|update|follow up|follow-up|document|photo|ready|approved|sent)\b/i,
    /(สถานะ|อัปเดต|ติดตาม|เอกสาร|รูป|ภาพ|พร้อม|ส่งแล้ว|อนุมัติแล้ว)/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

export function scoreCaseWorkspaceMatch(input: {
  caseRecord: CaseWorkspaceCase;
  userMessage: string;
  lineUserId?: string;
  channelId?: string;
}) {
  const query = normalizeComparableText(input.userMessage);
  const lineUserId = normalizeComparableText(input.lineUserId);
  const channelId = normalizeComparableText(input.channelId);
  const caseLineUserId = normalizeComparableText(input.caseRecord.data.lineUserId);
  const caseChannelId = normalizeComparableText(input.caseRecord.data.channelId);

  let score = 0;

  if (lineUserId && caseLineUserId === lineUserId) {
    score += 80;
  }

  if (lineUserId && channelId && caseLineUserId === lineUserId && caseChannelId === channelId) {
    score += 40;
  }

  const searchableFields = [
    input.caseRecord.name,
    input.caseRecord.data.summary,
    input.caseRecord.data.nextAction,
    input.caseRecord.data.professionType,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.toLowerCase());

  if (query) {
    for (const field of searchableFields) {
      if (field.includes(query) || query.includes(field)) {
        score += Math.max(12, Math.min(40, field.length));
      }
    }

    const tokens = query.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      if (token.length < 2) continue;
      if (searchableFields.some((field) => field.includes(token))) {
        score += 8;
      }
    }
  }

  const lastContactAt = parseIsoDate(input.caseRecord.data.lastContactAt);
  if (lastContactAt) {
    const daysOld = (Date.now() - lastContactAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld <= 3) score += 18;
    else if (daysOld <= 14) score += 10;
    else if (daysOld <= 30) score += 4;
  }

  return score;
}

export function renderCaseWorkspacePromptBlock(
  resolved: ResolvedCaseWorkspacePromptContext | null,
) {
  if (!resolved) return '';

  if (resolved.context) {
    const latestItems = resolved.context.timeline.slice(0, 5);
    const openTasks = resolved.context.tasks
      .filter((item) => item.status !== 'done' && item.status !== 'cancelled')
      .slice(0, 5);

    return [
      '<case_workspace_context>',
      `matched_case_name: ${resolved.context.case.name}`,
      `case_status: ${resolved.context.case.status}`,
      `case_priority: ${resolved.context.case.priority}`,
      ...(resolved.context.contact ? [`contact_name: ${resolved.context.contact.name}`] : []),
      ...(resolved.context.case.data.summary ? [`case_summary: ${resolved.context.case.data.summary}`] : []),
      ...(resolved.context.case.data.nextAction ? [`next_action: ${resolved.context.case.data.nextAction}`] : []),
      ...(resolved.context.case.data.dueAt ? [`case_due_at: ${resolved.context.case.data.dueAt}`] : []),
      ...(openTasks.length > 0
        ? [
            'open_tasks:',
            ...openTasks.map((item) => `- ${item.title} [${item.status}]${item.dueAt ? ` due ${item.dueAt}` : ''}`),
          ]
        : []),
      ...(latestItems.length > 0
        ? [
            'recent_timeline:',
            ...latestItems.map((item) => `- ${item.createdAt}: ${item.title}${item.body ? ` - ${item.body}` : ''}`),
          ]
        : []),
      'write_policy: Do not create or update contacts, cases, tasks, or notes unless the user explicitly confirms.',
      '</case_workspace_context>',
    ].join('\n');
  }

  if (resolved.shouldSuggestCreate) {
    return [
      '<case_workspace_intake_hint>',
      'No matching case was found, but this message looks like a new intake or follow-up.',
      'You may propose creating a case or adding a note, but only after explicit user confirmation.',
      '</case_workspace_intake_hint>',
    ].join('\n');
  }

  return '';
}

function summarizeUserTextForDraft(userText: string, maxLength = 140) {
  const normalized = userText.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

export function buildCreateCaseDraft(input: {
  userText: string;
  profileId?: string;
}): PendingCaseWorkspaceDraft {
  const title = summarizeUserTextForDraft(input.userText, 80);

  return {
    draftId: crypto.randomUUID(),
    action: 'create_case',
    profileId: input.profileId,
    title,
    body: input.userText.trim(),
    userText: input.userText,
    summaryText: [
      'This looks like a new case or intake.',
      `Draft case: ${title}`,
      '',
      'Confirm to create this case in the workspace, or cancel to keep it as chat only.',
    ].join('\n'),
    data: {
      source: 'line',
      summary: input.userText.trim(),
      lastContactAt: new Date().toISOString(),
    },
  };
}

export function buildAddCaseNoteDraft(input: {
  caseId: string;
  title?: string;
  userText: string;
}): PendingCaseWorkspaceDraft {
  const title = input.title ?? summarizeUserTextForDraft(input.userText, 80);

  return {
    draftId: crypto.randomUUID(),
    action: 'add_note',
    caseId: input.caseId,
    title,
    body: input.userText.trim(),
    userText: input.userText,
    summaryText: [
      'This message can be attached to the matched case timeline.',
      `Note title: ${title}`,
      '',
      'Confirm to save it as a LINE note, or cancel to leave it only in chat.',
    ].join('\n'),
    data: {
      source: 'line',
      kind: 'message_summary',
      lastContactAt: new Date().toISOString(),
    },
  };
}

export function readPendingCaseWorkspaceDraft(metadata: unknown): PendingCaseWorkspaceDraft | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as { pendingCaseWorkspaceDraft?: unknown }).pendingCaseWorkspaceDraft;
  if (!value || typeof value !== 'object') return null;

  const record = value as Record<string, unknown>;
  if (
    typeof record.draftId !== 'string'
    || typeof record.action !== 'string'
    || typeof record.title !== 'string'
    || typeof record.userText !== 'string'
    || typeof record.summaryText !== 'string'
  ) {
    return null;
  }

  if (record.action !== 'create_case' && record.action !== 'add_note') {
    return null;
  }

  return {
    draftId: record.draftId,
    action: record.action,
    profileId: typeof record.profileId === 'string' ? record.profileId : undefined,
    caseId: typeof record.caseId === 'string' ? record.caseId : undefined,
    title: record.title,
    body: typeof record.body === 'string' ? record.body : undefined,
    userText: record.userText,
    summaryText: record.summaryText,
    data: normalizeRecord(record.data),
  };
}

export async function createCaseWorkspaceProfile(
  input: CreateWorkspaceProfileInput,
  owner: CaseWorkspaceOwnerContext,
) {
  const profile = await createDomainProfile(
    {
      ...input,
      brandId: input.brandId ?? undefined,
      description: input.description ?? undefined,
    },
    owner,
  );
  return mapProfile(profile);
}

export async function listCaseWorkspaceProfiles(
  owner: CaseWorkspaceOwnerContext,
  filters?: { domain?: string; status?: 'active' | 'archived'; limit?: number },
) {
  const profiles = await listDomainProfiles(owner, filters);
  return profiles.map(mapProfile);
}

export async function createContact(input: CreateContactInput, owner: CaseWorkspaceOwnerContext) {
  await requireProfile(input.profileId, owner);
  const entity = await createDomainEntity(
    input.profileId,
    {
      entityType: CONTACT_ENTITY_TYPE,
      name: input.name,
      description: input.description ?? null,
      status: input.status,
      data: input.data ?? {},
    },
    owner,
  );
  return mapContact(entity);
}

export async function updateContact(
  contactId: string,
  patch: UpdateContactInput,
  owner: CaseWorkspaceOwnerContext,
) {
  const entity = await updateDomainEntity(
    contactId,
    {
      name: patch.name,
      description: patch.description,
      status: patch.status,
      data: patch.data,
    },
    owner,
  );
  return entity ? mapContact(entity) : null;
}

export async function listContacts(
  profileId: string,
  owner: CaseWorkspaceOwnerContext,
  filters?: { status?: 'active' | 'archived'; limit?: number },
) {
  const entities = await listDomainEntities(profileId, owner, {
    entityType: CONTACT_ENTITY_TYPE,
    status: filters?.status,
    limit: filters?.limit ?? 50,
  });

  return (entities ?? []).map(mapContact);
}

export async function createCase(input: CreateCaseInput, owner: CaseWorkspaceOwnerContext) {
  await requireProfile(input.profileId, owner);
  if (input.contactId) {
    const contact = await getDomainEntity(input.contactId, owner);
    if (!contact || contact.entityType !== CONTACT_ENTITY_TYPE) {
      throw new Error('Contact not found');
    }
  }

  const caseData = {
    ...(input.data ?? {}),
    status: input.status ?? 'new',
    priority: input.priority ?? 'normal',
    source: input.data?.source ?? 'manual',
    timeline: [
      {
        id: crypto.randomUUID(),
        kind: 'status_change',
        title: 'Case created',
        body: input.description ?? undefined,
        createdAt: new Date().toISOString(),
        data: {
          status: input.status ?? 'new',
          priority: input.priority ?? 'normal',
          source: input.data?.source ?? 'manual',
          actorUserId: owner.userId ?? null,
        },
      },
    ],
  };

  const entity = await createDomainEntity(
    input.profileId,
    {
      entityType: CASE_ENTITY_TYPE,
      name: input.name,
      description: input.description ?? null,
      status: 'active',
      data: caseData,
    },
    owner,
  );

  if (input.contactId) {
    await linkDomainEntities(
      {
        profileId: input.profileId,
        fromEntityId: entity.id,
        toEntityId: input.contactId,
        relationType: 'primary_contact',
      },
      owner,
    );
  }

  return mapCase(entity, input.contactId ?? null);
}

export async function updateCase(caseId: string, patch: UpdateCaseInput, owner: CaseWorkspaceOwnerContext) {
  const existing = await requireCaseEntity(caseId, owner);
  const existingData = normalizeRecord(existing.data);
  const nextData = {
    ...existingData,
    ...(patch.data ?? {}),
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.priority ? { priority: patch.priority } : {}),
  };

  const nextDataWithTimeline =
    patch.status && patch.status !== normalizeCaseStatus(existingData.status)
      ? appendTimelineEntry(existing, {
          kind: 'status_change',
          title: 'Case status updated',
          body: `Status changed to ${patch.status.replace('_', ' ')}`,
          data: { status: patch.status },
        })
      : nextData;

  const entity = await updateDomainEntity(
    caseId,
    {
      name: patch.name,
      description: patch.description,
      data: nextDataWithTimeline,
    },
    owner,
  );

  if (!entity) return null;

  return mapCase(entity, patch.contactId ?? (await resolveCaseContactId(entity, owner)));
}

export async function getCaseContext(caseId: string, owner: CaseWorkspaceOwnerContext): Promise<CaseWorkspaceCaseContext | null> {
  const caseEntity = await getDomainEntity(caseId, owner);
  if (!caseEntity || caseEntity.entityType !== CASE_ENTITY_TYPE) {
    return null;
  }

  const [profile, contactId, tasks, noteTimeline] = await Promise.all([
    getDomainProfile(caseEntity.profileId, owner),
    resolveCaseContactId(caseEntity, owner),
    resolveCaseTasks(caseEntity, owner),
    resolveCaseNotes(caseEntity, owner),
  ]);

  if (!profile) return null;

  const contact = contactId ? await getDomainEntity(contactId, owner) : null;
  const caseDto = mapCase(caseEntity, contactId);
  const caseTimeline = readTimelineEntries(normalizeRecord(caseEntity.data)).map((item) => ({
    id: item.id,
    caseId: caseEntity.id,
    kind: item.kind,
    title: item.title,
    body: item.body,
    createdAt: item.createdAt,
    actorUserId: item.actorUserId,
    data: item.data ?? {},
  }));

  const timeline = [...caseTimeline, ...noteTimeline, ...tasks.map(buildTimelineItemFromTask)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    profile: mapProfile(profile),
    contact: contact && contact.entityType === CONTACT_ENTITY_TYPE ? mapContact(contact) : null,
    case: caseDto,
    tasks,
    timeline,
  };
}

export async function searchCases(input: SearchCasesInput, owner: CaseWorkspaceOwnerContext) {
  const profiles = input.profileId
    ? [await requireProfile(input.profileId, owner)]
    : await listDomainProfilesForOwner(owner, { limit: 10 });

  const cases = await Promise.all(
    profiles.map(async (profile) => {
      const entities = await listDomainEntities(profile.id, owner, {
        entityType: CASE_ENTITY_TYPE,
        limit: input.limit ?? 25,
      });

      return Promise.all(
        (entities ?? []).map(async (entity) => mapCase(entity, await resolveCaseContactId(entity, owner))),
      );
    }),
  );

  return filterCasesByInput(cases.flat(), input, owner).slice(0, input.limit ?? 25);
}

export async function createTask(caseId: string, input: CreateTaskInput, owner: CaseWorkspaceOwnerContext) {
  const caseEntity = await requireCaseEntity(caseId, owner);
  const entity = await createDomainEntity(
    caseEntity.profileId,
    {
      entityType: TASK_ENTITY_TYPE,
      name: input.title,
      status: 'active',
      data: {
        ...(input.data ?? {}),
        status: input.status ?? 'todo',
        dueAt: input.dueAt,
        assigneeUserId: input.assigneeUserId,
        updatedAt: new Date().toISOString(),
      },
    },
    owner,
  );

  await linkDomainEntities(
    {
      profileId: caseEntity.profileId,
      fromEntityId: caseEntity.id,
      toEntityId: entity.id,
      relationType: CASE_TASK_RELATION_TYPE,
    },
    owner,
  );

  await updateDomainEntity(
    caseId,
    {
      data: appendTimelineEntry(caseEntity, {
        kind: 'task_change',
        title: 'Task created',
        body: input.title,
        data: {
          taskId: entity.id,
          status: input.status ?? 'todo',
          dueAt: input.dueAt,
          source: input.data?.source ?? 'manual',
        },
      }),
    },
    owner,
  );

  return mapTask(entity, caseId);
}

export async function updateTask(taskId: string, patch: UpdateTaskInput, owner: CaseWorkspaceOwnerContext) {
  const existingRow = await getOwnedEntityRow(taskId, owner);
  if (!existingRow || existingRow.entity.entityType !== TASK_ENTITY_TYPE) {
    return null;
  }

  const existingData = normalizeRecord(existingRow.entity.data);
  const nextData = {
    ...existingData,
    ...(patch.data ?? {}),
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.dueAt !== undefined ? { dueAt: patch.dueAt ?? undefined } : {}),
    ...(patch.assigneeUserId !== undefined ? { assigneeUserId: patch.assigneeUserId ?? undefined } : {}),
    updatedAt: new Date().toISOString(),
  };

  const entity = await updateDomainEntity(
    taskId,
    {
      name: patch.title,
      data: nextData,
    },
    owner,
  );

  if (!entity) return null;

  const relations = await loadProfileRelations(existingRow.entity.profileId, owner);
  const relation = relations.find(
    (item) => item.toEntityId === taskId && item.relationType === CASE_TASK_RELATION_TYPE,
  );

  if (relation) {
    const caseEntity = await requireCaseEntity(relation.fromEntityId, owner);
    await updateDomainEntity(
      caseEntity.id,
      {
        data: appendTimelineEntry(caseEntity, {
          kind: 'task_change',
          title: 'Task updated',
          body: patch.title ?? entity.name,
          data: {
            taskId: entity.id,
            status: patch.status ?? existingData.status,
          },
        }),
      },
      owner,
    );
  }

  return relation ? mapTask(entity, relation.fromEntityId) : null;
}

export async function listTasks(
  caseId: string,
  owner: CaseWorkspaceOwnerContext,
  filters?: { status?: CaseWorkspaceTask['status']; limit?: number },
) {
  const tasks = await resolveCaseTasks(await requireCaseEntity(caseId, owner), owner);
  return tasks
    .filter((task) => (filters?.status ? task.status === filters.status : true))
    .slice(0, filters?.limit ?? 100);
}

export async function addCaseNote(caseId: string, input: CreateTimelineNoteInput, owner: CaseWorkspaceOwnerContext) {
  const caseEntity = await requireCaseEntity(caseId, owner);
  const entity = await createDomainEntity(
    caseEntity.profileId,
    {
      entityType: NOTE_ENTITY_TYPE,
      name: input.title,
      description: input.body ?? null,
      status: 'active',
      data: {
        ...(input.data ?? {}),
        kind: input.kind ?? 'note',
        actorUserId: owner.userId ?? null,
        source: input.data?.source ?? 'manual',
      },
    },
    owner,
  );

  await linkDomainEntities(
    {
      profileId: caseEntity.profileId,
      fromEntityId: caseEntity.id,
      toEntityId: entity.id,
      relationType: CASE_NOTE_RELATION_TYPE,
    },
    owner,
  );

  await updateDomainEntity(
    caseEntity.id,
    {
      data: appendTimelineEntry(caseEntity, {
        kind: input.kind ?? 'note',
        title: input.title,
        body: input.body,
        actorUserId: owner.userId ?? undefined,
        data: {
          source: input.data?.source ?? 'manual',
          noteId: entity.id,
        },
      }),
    },
    owner,
  );

  return buildTimelineItemFromNote(entity, caseId);
}

export async function listCaseTimeline(caseId: string, owner: CaseWorkspaceOwnerContext) {
  const context = await getCaseContext(caseId, owner);
  return context?.timeline ?? [];
}

export async function createCaseFromLineMessage(
  input: {
    profileId?: string;
    caseName: string;
    messageText: string;
    channelId: string;
    lineUserId: string;
  },
  owner: CaseWorkspaceOwnerContext,
) {
  const profileId = input.profileId
    ?? (await listDomainProfiles(owner, { limit: 1 }))[0]?.id
    ?? (await createCaseWorkspaceProfile(
      {
        domain: 'general',
        name: 'LINE Workspace',
        data: { source: 'line', channelId: input.channelId },
      },
      owner,
    )).id;

  const createdCase = await createCase(
    {
      profileId,
      name: input.caseName,
      data: {
        source: 'line',
        lineUserId: input.lineUserId,
        channelId: input.channelId,
        lastContactAt: new Date().toISOString(),
      },
    },
    owner,
  );

  await addCaseNote(
    createdCase.id,
    {
      title: 'LINE intake',
      body: input.messageText,
      kind: 'message_summary',
      data: {
        source: 'line',
        lineUserId: input.lineUserId,
        channelId: input.channelId,
      },
    },
    owner,
  );

  return createdCase;
}

export async function summarizeCase(caseId: string, owner: CaseWorkspaceOwnerContext): Promise<CaseWorkspaceSummary | null> {
  const context = await getCaseContext(caseId, owner);
  if (!context) return null;

  const openTasks = context.tasks.filter((item) => item.status !== 'done' && item.status !== 'cancelled');
  const latestNote = context.timeline.find((item) => item.body);

  const summaryLines = [
    `Case: ${context.case.name}`,
    `Status: ${context.case.status.replace('_', ' ')}`,
    `Priority: ${context.case.priority}`,
    ...(context.contact ? [`Contact: ${context.contact.name}`] : []),
    ...(context.case.data.summary ? [`Summary: ${context.case.data.summary}`] : []),
    ...(context.case.data.nextAction ? [`Next action: ${context.case.data.nextAction}`] : []),
    ...(openTasks.length > 0 ? [`Open tasks: ${openTasks.map((item) => item.title).join(', ')}`] : []),
    ...(latestNote?.body ? [`Latest note: ${latestNote.body}`] : []),
  ];

  const replyDraft = [
    `Hello${context.contact ? ` ${context.contact.name}` : ''},`,
    '',
    `Here is the latest update on "${context.case.name}":`,
    `- Status: ${context.case.status.replace('_', ' ')}`,
    ...(context.case.data.nextAction ? [`- Next step: ${context.case.data.nextAction}`] : []),
    ...(openTasks[0]?.dueAt ? [`- Upcoming due date: ${openTasks[0].dueAt}`] : []),
    '',
    'We will keep you updated as the work moves forward.',
  ].join('\n');

  return {
    summary: summaryLines.join('\n'),
    replyDraft,
  };
}

export async function assignCase(
  caseId: string,
  input: AssignCaseInput,
  owner: CaseWorkspaceOwnerContext,
) {
  const existing = await requireCaseEntity(caseId, owner);
  const existingData = normalizeRecord(existing.data);
  const nextAssigneeUserId = input.assigneeUserId === 'me'
    ? owner.userId ?? undefined
    : input.assigneeUserId ?? undefined;
  const previousAssigneeUserId = normalizeComparableText(existingData.assigneeUserId);
  const changed = normalizeComparableText(nextAssigneeUserId) !== previousAssigneeUserId;

  let nextData: Record<string, unknown> = {
    ...existingData,
    assigneeUserId: nextAssigneeUserId,
    assignedAt: nextAssigneeUserId ? new Date().toISOString() : undefined,
  };

  if (changed) {
    nextData = appendTimelineEntry(
      { ...existing, data: nextData },
      {
        kind: 'ai_action',
        title: nextAssigneeUserId ? 'Case assigned' : 'Case unassigned',
        body: nextAssigneeUserId
          ? `Assigned to ${nextAssigneeUserId}`
          : 'Assignment cleared',
        actorUserId: owner.userId ?? undefined,
        data: {
          assigneeUserId: nextAssigneeUserId ?? null,
        },
      },
    );
  }

  const updated = await updateDomainEntity(
    caseId,
    {
      data: nextData,
    },
    owner,
  );

  if (!updated) return null;
  return mapCase(updated, await resolveCaseContactId(updated, owner));
}

export async function getCaseWorkspaceDashboard(
  profileId: string,
  owner: CaseWorkspaceOwnerContext,
): Promise<CaseWorkspaceDashboard> {
  const [profile, cases, tasks] = await Promise.all([
    requireProfile(profileId, owner),
    resolveProfileCases(profileId, owner),
    resolveProfileTasks(profileId, owner),
  ]);

  return buildCaseWorkspaceDashboardData({
    profile: mapProfile(profile),
    cases,
    tasks,
  });
}

export async function exportCaseWorkspace(
  profileId: string,
  format: CaseWorkspaceExportFormat,
  owner: CaseWorkspaceOwnerContext,
) {
  const [profile, cases, tasks] = await Promise.all([
    requireProfile(profileId, owner),
    resolveProfileCases(profileId, owner),
    resolveProfileTasks(profileId, owner),
  ]);

  const mappedProfile = mapProfile(profile);
  if (format === 'csv') {
    return {
      format,
      contentType: 'text/csv; charset=utf-8',
      fileName: `case-workspace-${profileId}.csv`,
      body: buildCaseWorkspaceCsvExport({
        profile: mappedProfile,
        cases,
        tasks,
      }),
    };
  }

  const dashboard = buildCaseWorkspaceDashboardData({
    profile: mappedProfile,
    cases,
    tasks,
  });

  return {
    format,
    contentType: 'application/pdf',
    fileName: `case-workspace-${profileId}.pdf`,
    body: await buildCaseWorkspacePdfExport({
      profile: mappedProfile,
      dashboard,
    }),
  };
}

export async function resolveRelevantCaseWorkspaceContext(
  input: {
    userMessage: string;
    profileId?: string;
    lineUserId?: string;
    channelId?: string;
    limit?: number;
  },
  owner: CaseWorkspaceOwnerContext,
): Promise<ResolvedCaseWorkspacePromptContext> {
  const cases = await searchCases(
    {
      profileId: input.profileId,
      query: input.userMessage,
      limit: input.limit ?? 50,
    },
    owner,
  );

  const ranked = cases
    .map((caseRecord) => ({
      caseRecord,
      score: scoreCaseWorkspaceMatch({
        caseRecord,
        userMessage: input.userMessage,
        lineUserId: input.lineUserId,
        channelId: input.channelId,
      }),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (best && best.score > 0) {
    return {
      context: await getCaseContext(best.caseRecord.id, owner),
      shouldSuggestCreate: false,
    };
  }

  return {
    context: null,
    shouldSuggestCreate: detectCaseWorkspaceIntakeSignal(input.userMessage),
  };
}

export async function listWorkspaceCasesByProfile(profileId: string, owner: CaseWorkspaceOwnerContext) {
  return searchCases({ profileId, limit: 100 }, owner);
}

export async function updateCaseWorkspaceProfile(
  profileId: string,
  patch: Partial<CreateWorkspaceProfileInput>,
  owner: CaseWorkspaceOwnerContext,
) {
  const profile = await updateDomainProfile(profileId, patch, owner);
  return profile ? mapProfile(profile) : null;
}
