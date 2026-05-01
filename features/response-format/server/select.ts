import type {
  ResponseCard,
  ResponseFormat,
  ResponseIntent,
  ResponsePlan,
  ResponseQuickReply,
  ResponseSafety,
  ResponseWorkflow,
} from '@/features/response-format/types';
import { inferResponseSafety } from '@/features/response-format/safety';
import {
  buildWorkflowQuickReplies,
  mergeResponseQuickReplies,
  maybeBuildHumanReviewWorkflow,
  type ResponseWorkflowContext,
} from '@/features/response-format/workflow';

type ToolResultRecord = {
  toolName?: unknown;
  dynamic?: unknown;
  result?: unknown;
  output?: unknown;
};

type ToolPayload = Record<string, unknown> & {
  kind?: unknown;
};

type ToolResponseSelection = {
  intent: ResponseIntent;
  preferredFormats: ResponseFormat[];
  bodyText?: string;
  card?: ResponseCard;
  workflow?: ResponseWorkflow;
  metadata?: Record<string, unknown>;
};

export type BuildResponsePlanInput = {
  text: string;
  userText?: string;
  locale?: string;
  intent?: ResponseIntent;
  quickReplies?: ResponseQuickReply[];
  safety?: ResponseSafety;
  workflow?: ResponseWorkflow;
  workflowContext?: ResponseWorkflowContext;
  metadata?: Record<string, unknown>;
  toolResults?: unknown[];
};

export function detectFallbackFormat(text: string): 'plain_text' | 'structured_text' {
  const normalized = text.trim();
  if (!normalized) return 'plain_text';

  const hasMultipleLines = normalized.includes('\n');
  const hasMarkdownHeading = /^#{1,6}\s+/m.test(normalized);
  const hasBullets = /^[\s]*[-*+\u2022]\s+/m.test(normalized);
  const hasLabelSections = /^[A-Za-zก-๙0-9 _()/.-]+:\s+\S+/m.test(normalized);

  return hasMultipleLines || hasMarkdownHeading || hasBullets || hasLabelSections
    ? 'structured_text'
    : 'plain_text';
}

export function buildResponsePlan({
  text,
  userText,
  locale = 'th-TH',
  intent,
  quickReplies = [],
  safety,
  workflow,
  workflowContext,
  metadata,
  toolResults,
}: BuildResponsePlanInput): ResponsePlan {
  const toolSelection = selectResponseFromToolResults(toolResults, locale);
  const resolvedIntent = intent ?? toolSelection?.intent ?? 'answer';
  const resolvedSafety = safety ?? inferResponseSafety({
    userText,
    responseText: text.trim() || toolSelection?.bodyText || '',
    locale,
  });
  const resolvedWorkflow =
    workflow
    ?? toolSelection?.workflow
    ?? maybeBuildHumanReviewWorkflow({
      intent: resolvedIntent,
      locale,
      bodyText: text.trim() || toolSelection?.bodyText || '',
      safety: resolvedSafety,
      context: workflowContext,
    });
  const resolvedQuickReplies = mergeResponseQuickReplies(
    quickReplies,
    buildWorkflowQuickReplies(resolvedWorkflow, locale),
  );
  const formats = dedupeFormats([
    ...(toolSelection?.preferredFormats ?? [detectFallbackFormat(text)]),
    ...(resolvedQuickReplies.length > 0 ? ['quick_replies' as const] : []),
  ]);
  const bodyText = text.trim() || toolSelection?.bodyText || '';

  return {
    intent: resolvedIntent,
    locale,
    bodyText,
    formats,
    quickReplies: resolvedQuickReplies.length > 0 ? resolvedQuickReplies : undefined,
    ...(toolSelection?.card ? { card: toolSelection.card } : {}),
    ...(resolvedWorkflow ? { workflow: resolvedWorkflow } : {}),
    ...(resolvedSafety ? { safety: resolvedSafety } : {}),
    metadata: {
      ...(toolSelection?.metadata ?? {}),
      ...(metadata ?? {}),
    },
  };
}

export function selectResponseFromToolResults(
  toolResults: unknown[] | undefined,
  locale = 'th-TH',
): ToolResponseSelection | null {
  if (!toolResults?.length) return null;

  for (const toolResult of toolResults) {
    const record = normalizeToolRecord(toolResult);
    if (!record) continue;

    const selection = mapToolPayloadToSelection(record.toolName, record.payload, locale);
    if (selection) {
      return selection;
    }
  }

  return null;
}

function normalizeToolRecord(
  value: unknown,
): { toolName: string | null; payload: ToolPayload | null } | null {
  if (!value || typeof value !== 'object') return null;

  const record = value as ToolResultRecord;
  const toolName =
    typeof record.toolName === 'string'
      ? record.toolName
      : typeof record.dynamic === 'string'
        ? record.dynamic
        : null;
  const payload = (record.result ?? record.output ?? null) as unknown;

  if (!payload || typeof payload !== 'object') {
    return { toolName, payload: null };
  }

  return {
    toolName,
    payload: payload as ToolPayload,
  };
}

function mapToolPayloadToSelection(
  toolName: string | null,
  payload: ToolPayload | null,
  locale: string,
): ToolResponseSelection | null {
  if (!payload) return null;

  const kind = typeof payload.kind === 'string' ? payload.kind : null;
  if (!kind) return null;
  const toolPayload = payload;

  switch (kind) {
    case 'record_saved': {
      const fallbackText = buildRecordSavedSummary(toolPayload, locale);
      const contextType = readString(toolPayload.contextType);
      const activity = readString(toolPayload.activity) ?? 'Saved activity';
      const date = readString(toolPayload.date) ?? '-';
      const cost = readString(toolPayload.cost) ?? '0';
      const plot =
        readNestedString(toolPayload, ['metadata', 'entityType'])
        ?? readNestedString(toolPayload, ['metadata', 'profileId'])
        ?? contextType
        ?? '-';
      return {
        intent: 'record_saved',
        preferredFormats: ['card', 'structured_text'],
        bodyText: fallbackText,
        card: {
          templateKey: contextType === 'farm' ? 'agriculture.record_entry' : 'common.confirmation',
          altText: locale.startsWith('th') ? 'บันทึกกิจกรรมสำเร็จ' : 'Record saved',
          data: contextType === 'farm'
            ? {
                activity,
                plot,
                date,
                cost,
                altText: locale.startsWith('th') ? 'บันทึกกิจกรรมสำเร็จ' : 'Record saved',
              }
            : {
                title: activity,
                summary: fallbackText,
                altText: locale.startsWith('th') ? 'บันทึกกิจกรรมสำเร็จ' : 'Record saved',
              },
          fallbackText,
        },
        metadata: {
          toolName,
          toolKind: kind,
          templateCandidate: contextType === 'farm'
            ? 'agriculture.record_entry'
            : 'common.confirmation',
        },
      };
    }
    case 'record_summary': {
      const fallbackText = buildRecordSummaryText(toolPayload, locale);
      return {
        intent: 'record_confirmation',
        preferredFormats: ['card', 'structured_text'],
        bodyText: fallbackText,
        card: {
          templateKey: 'common.summary',
          altText: locale.startsWith('th') ? 'สรุปบันทึก' : 'Record summary',
          data: {
            title: locale.startsWith('th') ? 'สรุปบันทึก' : 'Record summary',
            summary: fallbackText,
            altText: locale.startsWith('th') ? 'สรุปบันทึก' : 'Record summary',
          },
          fallbackText,
        },
        metadata: { toolName, toolKind: kind, templateCandidate: 'common.summary' },
      };
    }
    case 'weather_forecast': {
      const fallbackText = buildWeatherSummary(toolPayload, locale);
      return {
        intent: 'risk_summary',
        preferredFormats: ['card', 'structured_text'],
        bodyText: fallbackText,
        card: {
          templateKey: 'agriculture.weather_risk',
          altText: locale.startsWith('th') ? 'สรุปสภาพอากาศและความเสี่ยง' : 'Weather risk summary',
          data: {
            location: readNestedString(toolPayload, ['location', 'label']) ?? '-',
            temperature: String(readNestedNumber(toolPayload, ['current', 'temperatureC']) ?? '-'),
            humidity: String(readNestedNumber(toolPayload, ['current', 'humidityPercent']) ?? '-'),
            rain_chance: String(
              readNestedNumber(toolPayload, ['daily', '0', 'precipitationProbabilityPercent'])
              ?? readNestedNumber(toolPayload, ['current', 'precipitationMm'])
              ?? '-',
            ),
            farm_advice: readNestedString(toolPayload, ['riskSummary', 'headline']) ?? fallbackText,
            altText: locale.startsWith('th') ? 'สรุปสภาพอากาศและความเสี่ยง' : 'Weather risk summary',
          },
          fallbackText,
        },
        metadata: { toolName, toolKind: kind, templateCandidate: 'agriculture.weather_risk' },
      };
    }
    case 'profile_saved':
    case 'profile_updated':
    case 'entity_saved':
    case 'entity_updated':
      return {
        intent: 'record_confirmation',
        preferredFormats: ['structured_text'],
        bodyText: buildDomainWriteSummary(toolPayload, locale),
        metadata: { toolName, toolKind: kind, templateCandidate: 'common.confirmation' },
      };
    case 'profile_context':
    case 'entity_list':
      return {
        intent: 'answer',
        preferredFormats: ['structured_text'],
        bodyText: buildDomainContextSummary(toolPayload, locale),
        metadata: { toolName, toolKind: kind },
      };
    case 'content_plan_generated':
    case 'campaign_created':
    case 'calendar_entry_created':
    case 'content_draft_saved': {
      const fallbackText = buildContentSummary(toolPayload, locale);
      return {
        intent: 'content_plan',
        preferredFormats: ['card', 'structured_text'],
        bodyText: fallbackText,
        card: {
          templateKey: 'common.summary',
          altText: locale.startsWith('th') ? 'สรุปแผนคอนเทนต์' : 'Content plan summary',
          data: {
            title: locale.startsWith('th') ? 'อัปเดตแผนคอนเทนต์' : 'Content plan update',
            summary: fallbackText,
            altText: locale.startsWith('th') ? 'สรุปแผนคอนเทนต์' : 'Content plan summary',
          },
          fallbackText,
        },
        metadata: { toolName, toolKind: kind, templateCandidate: 'common.summary' },
      };
    }
    case 'approval_request_created': {
      const fallbackText = buildApprovalSummary(toolPayload, locale);
      return {
        intent: 'approval_request',
        preferredFormats: ['workflow', 'card', 'structured_text'],
        bodyText: fallbackText,
        card: {
          templateKey: 'common.approval_request',
          altText: locale.startsWith('th') ? 'คำขออนุมัติ' : 'Approval request',
          data: {
            title: locale.startsWith('th') ? 'คำขออนุมัติ' : 'Approval request',
            summary: fallbackText,
            status: readString(toolPayload.status) ?? 'pending',
            assigneeName: readString(toolPayload.assigneeName) ?? readString(toolPayload.assigneeId) ?? '',
            dueAt: readString(toolPayload.dueAt) ?? '',
            altText: locale.startsWith('th') ? 'คำขออนุมัติ' : 'Approval request',
          },
          fallbackText,
        },
        workflow: {
          type: 'approval',
          priority: 'normal',
          reason: fallbackText,
          assigneeRole: 'reviewer',
          data: {
            approvalRequestId: readString(toolPayload.approvalRequestId) ?? readString(toolPayload.id),
            contentPieceId: readString(toolPayload.contentPieceId),
            assigneeId: readString(toolPayload.assigneeId),
            dueAt: readString(toolPayload.dueAt),
            status: readString(toolPayload.status) ?? 'pending',
          },
        },
        metadata: { toolName, toolKind: kind, templateCandidate: 'common.approval_request' },
      };
    }
    default:
      return null;
  }
}

function dedupeFormats(formats: ResponseFormat[]): ResponseFormat[] {
  return [...new Set(formats)];
}

function buildRecordSavedSummary(payload: ToolPayload, locale: string): string {
  const activity = readString(payload.activity) ?? readString(payload.message) ?? 'Record saved';
  const date = readString(payload.date);
  const recordId = readString(payload.recordId) ?? readString(payload.id);

  if (locale.startsWith('th')) {
    return [
      'บันทึกรายการเรียบร้อย',
      `กิจกรรม: ${activity}`,
      ...(date ? [`วันที่: ${date}`] : []),
      ...(recordId ? [`รหัสบันทึก: ${recordId}`] : []),
    ].join('\n');
  }

  return [
    'Record saved successfully.',
    `Activity: ${activity}`,
    ...(date ? [`Date: ${date}`] : []),
    ...(recordId ? [`Record ID: ${recordId}`] : []),
  ].join('\n');
}

function buildRecordSummaryText(payload: ToolPayload, locale: string): string {
  const total = readNumber(payload.total) ?? 0;
  const period = readString(payload.period) ?? 'week';
  const totalCost = readNumber(payload.totalCost) ?? 0;
  const totalIncome = readNumber(payload.totalIncome) ?? 0;

  if (locale.startsWith('th')) {
    return [
      `สรุปบันทึกช่วง ${period}`,
      `จำนวนรายการ: ${total}`,
      `ต้นทุนรวม: ${totalCost}`,
      `รายรับรวม: ${totalIncome}`,
    ].join('\n');
  }

  return [
    `Record summary for ${period}`,
    `Total entries: ${total}`,
    `Total cost: ${totalCost}`,
    `Total income: ${totalIncome}`,
  ].join('\n');
}

function buildWeatherSummary(payload: ToolPayload, locale: string): string {
  const location = readNestedString(payload, ['location', 'label'])
    ?? readNestedString(payload, ['location', 'name'])
    ?? 'the selected location';
  const temp = readNestedNumber(payload, ['current', 'temperatureC']);
  const riskHeadline = readNestedString(payload, ['riskSummary', 'headline']);

  if (locale.startsWith('th')) {
    return [
      `สรุปอากาศสำหรับ ${location}`,
      ...(temp !== null ? [`อุณหภูมิปัจจุบัน: ${temp}°C`] : []),
      ...(riskHeadline ? [`ความเสี่ยงสำคัญ: ${riskHeadline}`] : []),
    ].join('\n');
  }

  return [
    `Weather summary for ${location}`,
    ...(temp !== null ? [`Current temperature: ${temp}°C`] : []),
    ...(riskHeadline ? [`Key risk: ${riskHeadline}`] : []),
  ].join('\n');
}

function buildDomainWriteSummary(payload: ToolPayload, locale: string): string {
  const profile = readObject(payload.profile);
  const entity = readObject(payload.entity);
  const subject = profile ?? entity;
  const name = readString(subject?.name) ?? 'item';
  const domain = readString(subject?.domain);
  const entityType = readString(subject?.entityType);
  const action = readString(payload.message);

  if (locale.startsWith('th')) {
    return [
      action ?? 'บันทึกข้อมูลเรียบร้อย',
      `ชื่อ: ${name}`,
      ...(domain ? [`โดเมน: ${domain}`] : []),
      ...(entityType ? [`ประเภท: ${entityType}`] : []),
    ].join('\n');
  }

  return [
    action ?? 'Saved successfully.',
    `Name: ${name}`,
    ...(domain ? [`Domain: ${domain}`] : []),
    ...(entityType ? [`Type: ${entityType}`] : []),
  ].join('\n');
}

function buildDomainContextSummary(payload: ToolPayload, locale: string): string {
  const profile = readObject(payload.profile);
  const entities = Array.isArray(payload.entities) ? payload.entities : [];
  const profileName = readString(profile?.name);
  const domain = readString(profile?.domain);

  if (locale.startsWith('th')) {
    return [
      ...(profileName ? [`บริบทที่พบ: ${profileName}`] : ['พบบริบทที่เกี่ยวข้อง']),
      ...(domain ? [`โดเมน: ${domain}`] : []),
      `จำนวนรายการที่เกี่ยวข้อง: ${entities.length}`,
    ].join('\n');
  }

  return [
    ...(profileName ? [`Relevant profile: ${profileName}`] : ['Found relevant context']),
    ...(domain ? [`Domain: ${domain}`] : []),
    `Related entities: ${entities.length}`,
  ].join('\n');
}

function buildContentSummary(payload: ToolPayload, locale: string): string {
  const title = readString(payload.title)
    ?? readNestedString(payload, ['post', 'caption'])
    ?? readString(payload.message)
    ?? 'content plan';
  const status = readString(payload.status);
  const plannedDate = readString(payload.plannedDate);

  if (locale.startsWith('th')) {
    return [
      'จัดการแผนคอนเทนต์เรียบร้อย',
      `รายการ: ${title}`,
      ...(status ? [`สถานะ: ${status}`] : []),
      ...(plannedDate ? [`วันที่: ${plannedDate}`] : []),
    ].join('\n');
  }

  return [
    'Content planning action completed.',
    `Item: ${title}`,
    ...(status ? [`Status: ${status}`] : []),
    ...(plannedDate ? [`Date: ${plannedDate}`] : []),
  ].join('\n');
}

function buildApprovalSummary(payload: ToolPayload, locale: string): string {
  const contentTitle = readString(payload.contentPieceTitle) ?? readString(payload.title) ?? 'approval request';
  const assignee = readString(payload.assigneeName) ?? readString(payload.assigneeId);

  if (locale.startsWith('th')) {
    return [
      'สร้างคำขออนุมัติแล้ว',
      `รายการ: ${contentTitle}`,
      ...(assignee ? [`ผู้รับผิดชอบ: ${assignee}`] : []),
    ].join('\n');
  }

  return [
    'Approval request created.',
    `Item: ${contentTitle}`,
    ...(assignee ? [`Assignee: ${assignee}`] : []),
  ].join('\n');
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readNestedString(value: Record<string, unknown>, path: string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return readString(current);
}

function readNestedNumber(value: Record<string, unknown>, path: string[]): number | null {
  let current: unknown = value;
  for (const key of path) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return readNumber(current);
}
