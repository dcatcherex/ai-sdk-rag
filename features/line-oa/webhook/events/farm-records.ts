import type { messagingApi } from '@line/bot-sdk';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { chatMessage, chatThread } from '@/db/schema';
import { buildFallbackResponsePlan, buildResponsePlan, renderResponseForLine } from '@/features/response-format';
import type { ResponseFormat } from '@/features/response-format/types';
import { runLogActivity } from '@/features/record-keeper/service';
import type { LogActivityInput } from '@/features/record-keeper/schema';
import type { ResolvedDomainContext } from '@/features/domain-profiles/types';
import type { LineMessage, Sender } from '../types';

export type PendingFarmRecordDraft = LogActivityInput & {
  summaryText: string;
};

type HandleFarmRecordMessageInput = {
  userText: string;
  pendingMetadata: unknown;
  domainContext: ResolvedDomainContext | null;
  threadId: string;
  nextPosition: number;
  now: Date;
  channelUserId: string;
  replyToken: string;
  lineClient: messagingApi.MessagingApiClient;
  sender?: Sender;
};

function formatBangkokDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function detectConfirmationIntent(text: string): 'confirm' | 'edit' | 'cancel' | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;

  if (/^(ใช่|ใช่ครับ|ใช่ค่ะ|โอเค|ตกลง|ยืนยัน|confirm|yes|ok|okay|save|save it|บันทึกเลย)$/.test(normalized)) {
    return 'confirm';
  }

  if (/^(แก้ไข|ขอแก้ไข|แก้ข้อมูล|edit|change)$/.test(normalized)) {
    return 'edit';
  }

  if (/^(ยกเลิก|ไม่เอา|cancel|no|ไม่ใช่)$/.test(normalized)) {
    return 'cancel';
  }

  return null;
}

function inferFarmRecordCategory(text: string): string | undefined {
  if (/ปุ๋ย/u.test(text)) return 'fertilizer';
  if (/พ่น|ยา/u.test(text)) return 'pesticide';
  if (/เก็บเกี่ยว/u.test(text)) return 'harvest';
  if (/ขาย/u.test(text)) return 'sale';
  if (/ปลูก|หว่าน/u.test(text)) return 'planting';
  if (/รดน้ำ|ให้น้ำ/u.test(text)) return 'irrigation';
  return undefined;
}

function buildFarmRecordMetadata(domainContext: ResolvedDomainContext | null): LogActivityInput['metadata'] {
  if (!domainContext) {
    return { source: 'line' };
  }

  return {
    profileId: domainContext.profile.id,
    entityIds: domainContext.entities.map((entity) => entity.id),
    entityType: domainContext.entities[0]?.entityType,
    source: 'line',
  };
}

function parseFarmRecordDraft(
  text: string,
  domainContext: ResolvedDomainContext | null,
  now: Date,
): PendingFarmRecordDraft | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const looksLikeFarmRecord = /(บันทึก|ใส่ปุ๋ย|พ่นยา|เก็บเกี่ยว|ขาย|รดน้ำ|ให้น้ำ|ปลูก|หว่าน|fertiliz|spray|harvest|sold|irrigat|plant)/iu.test(trimmed);
  const looksLikeSummary = /(สรุป|summary|รายงาน|report)/iu.test(trimmed);
  if (!looksLikeFarmRecord || looksLikeSummary) return null;

  const quantityMatch = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(กก\.?|kg|kg\.|ไร่|ตัน|ลิตร|ถุง|ต้น)/iu);
  const costMatch = trimmed.match(/(?:ค่าใช้จ่าย|ต้นทุน|ราคา)\s*(\d[\d,]*(?:\.\d+)?)\s*บาท/iu);
  const entityMatch = trimmed.match(/(?:ที่|ใน)\s*(แปลง[^\n,]+?)(?=\s*(?:ค่าใช้จ่าย|ต้นทุน|ราคา|$))/u);

  let activity = trimmed
    .replace(/^(วันนี้|เมื่อวาน|พรุ่งนี้|เช้านี้|ตอนเช้า|ตอนเย็น|ช่วงเช้า|ช่วงเย็น)\s*/u, '')
    .replace(/(?:ค่าใช้จ่าย|ต้นทุน|ราคา)\s*\d[\d,]*(?:\.\d+)?\s*บาท/giu, '')
    .replace(/(?:ที่|ใน)\s*แปลง[^\n,]+?(?=\s*(?:ค่าใช้จ่าย|ต้นทุน|ราคา|$))/giu, '')
    .replace(/\d+(?:[.,]\d+)?\s*(กก\.?|kg|kg\.|ไร่|ตัน|ลิตร|ถุง|ต้น)/giu, '')
    .replace(/^บันทึก(?:กิจกรรม)?[:\s]*/iu, '')
    .trim();

  if (!activity) {
    activity = trimmed;
  }

  if (activity.length > 140) {
    activity = activity.slice(0, 140).trim();
  }

  const quantity = quantityMatch ? `${quantityMatch[1]} ${quantityMatch[2]}`.replace(/\s+/g, ' ').trim() : undefined;
  const entity = entityMatch?.[1]?.trim();
  const cost = costMatch ? Number(costMatch[1].replace(/,/g, '')) : undefined;
  const summaryLines = [
    'สรุปรายการที่จะบันทึก:',
    `กิจกรรม: ${activity}`,
    ...(entity ? [`แปลง: ${entity}`] : []),
    ...(quantity ? [`ปริมาณ: ${quantity}`] : []),
    ...(cost !== undefined ? [`ค่าใช้จ่าย: ${cost.toLocaleString('th-TH')} บาท`] : []),
    `วันที่: ${formatBangkokDate(now)}`,
    '',
    'ถ้าถูกต้อง กด "ใช่ บันทึกเลย" หรือพิมพ์ "ใช่"',
  ];

  return {
    contextType: 'farm',
    category: inferFarmRecordCategory(trimmed),
    entity,
    date: formatBangkokDate(now),
    activity,
    quantity,
    ...(cost !== undefined ? { cost } : {}),
    metadata: buildFarmRecordMetadata(domainContext),
    summaryText: summaryLines.join('\n'),
  };
}

export function readPendingFarmRecordDraft(metadata: unknown): PendingFarmRecordDraft | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const draft = (metadata as { pendingFarmRecordDraft?: unknown }).pendingFarmRecordDraft;
  if (!draft || typeof draft !== 'object') return null;

  const record = draft as Record<string, unknown>;
  if (
    typeof record.contextType !== 'string' ||
    typeof record.date !== 'string' ||
    typeof record.activity !== 'string' ||
    typeof record.summaryText !== 'string'
  ) {
    return null;
  }

  return {
    contextType: record.contextType,
    category: typeof record.category === 'string' ? record.category : undefined,
    entity: typeof record.entity === 'string' ? record.entity : undefined,
    date: record.date,
    activity: record.activity,
    quantity: typeof record.quantity === 'string' ? record.quantity : undefined,
    cost: typeof record.cost === 'number' ? record.cost : undefined,
    income: typeof record.income === 'number' ? record.income : undefined,
    notes: typeof record.notes === 'string' ? record.notes : undefined,
    metadata: record.metadata && typeof record.metadata === 'object'
      ? (record.metadata as LogActivityInput['metadata'])
      : undefined,
    summaryText: record.summaryText,
  };
}

async function persistLineTurn(input: {
  threadId: string;
  nextPosition: number;
  now: Date;
  userText: string;
  assistantText: string;
  assistantMetadata?: Record<string, unknown>;
}) {
  await Promise.all([
    db.insert(chatMessage).values([
      {
        id: crypto.randomUUID(),
        threadId: input.threadId,
        role: 'user',
        parts: [{ type: 'text', text: input.userText }],
        position: input.nextPosition,
        createdAt: input.now,
      },
      {
        id: crypto.randomUUID(),
        threadId: input.threadId,
        role: 'assistant',
        parts: [{ type: 'text', text: input.assistantText }],
        ...(input.assistantMetadata ? { metadata: input.assistantMetadata } : {}),
        position: input.nextPosition + 1,
        createdAt: input.now,
      },
    ]),
    db.update(chatThread).set({ updatedAt: input.now }).where(eq(chatThread.id, input.threadId)),
  ]);
}

async function replyWithMessages(input: {
  lineClient: messagingApi.MessagingApiClient;
  replyToken: string;
  messages: LineMessage[];
}) {
  await input.lineClient.replyMessage({
    replyToken: input.replyToken,
    messages: input.messages,
  });
}

export async function handleFarmRecordMessage(input: HandleFarmRecordMessageInput): Promise<boolean> {
  const pendingFarmRecordDraft = readPendingFarmRecordDraft(input.pendingMetadata);
  const confirmationIntent = pendingFarmRecordDraft
    ? detectConfirmationIntent(input.userText)
    : null;

  if (pendingFarmRecordDraft && confirmationIntent === 'confirm') {
    const saved = await runLogActivity(
      {
        contextType: pendingFarmRecordDraft.contextType,
        category: pendingFarmRecordDraft.category,
        entity: pendingFarmRecordDraft.entity,
        date: pendingFarmRecordDraft.date,
        activity: pendingFarmRecordDraft.activity,
        quantity: pendingFarmRecordDraft.quantity,
        cost: pendingFarmRecordDraft.cost,
        income: pendingFarmRecordDraft.income,
        notes: pendingFarmRecordDraft.notes,
        metadata: pendingFarmRecordDraft.metadata,
      },
      input.channelUserId,
    );

    const saveText = [
      'บันทึกเรียบร้อยแล้วครับ',
      `กิจกรรม: ${saved.activity}`,
      `วันที่: ${saved.date}`,
    ].join('\n');
    const savePlan = buildResponsePlan({
      text: saveText,
      userText: input.userText,
      locale: 'th-TH',
      toolResults: [
        {
          toolName: 'log_activity',
          result: {
            kind: 'record_saved',
            contextType: pendingFarmRecordDraft.contextType,
            activity: pendingFarmRecordDraft.activity,
            date: saved.date,
            ...(pendingFarmRecordDraft.cost !== undefined ? { cost: String(pendingFarmRecordDraft.cost) } : {}),
            metadata: pendingFarmRecordDraft.metadata ?? { source: 'line' },
            recordId: saved.id,
          },
        },
      ],
      quickReplies: [
        { actionType: 'message', label: 'สรุปบันทึกสัปดาห์นี้', text: 'สรุปบันทึกฟาร์มสัปดาห์นี้ให้หน่อย' },
        { actionType: 'message', label: 'บันทึกรายการเพิ่ม', text: 'จะบันทึกรายการเพิ่ม' },
      ],
      metadata: {
        channel: 'line',
        source: 'line_record_confirmation',
      },
    });

    await persistLineTurn({
      threadId: input.threadId,
      nextPosition: input.nextPosition,
      now: input.now,
      userText: input.userText,
      assistantText: saveText,
      assistantMetadata: {
        responseFormat: savePlan.metadata,
      },
    });
    await replyWithMessages({
      lineClient: input.lineClient,
      replyToken: input.replyToken,
      messages: renderResponseForLine(savePlan, { sender: input.sender }),
    });
    return true;
  }

  if (pendingFarmRecordDraft && confirmationIntent === 'edit') {
    const editText = 'ได้ครับ ส่งรายละเอียดใหม่มาอีกครั้ง แล้วผมจะสรุปให้ยืนยันก่อนบันทึก';
    await persistLineTurn({
      threadId: input.threadId,
      nextPosition: input.nextPosition,
      now: input.now,
      userText: input.userText,
      assistantText: editText,
    });
    await replyWithMessages({
      lineClient: input.lineClient,
      replyToken: input.replyToken,
      messages: [{ type: 'text', text: editText, ...(input.sender ? { sender: input.sender } : {}) }],
    });
    return true;
  }

  if (pendingFarmRecordDraft && confirmationIntent === 'cancel') {
    const cancelText = 'ยกเลิกรายการนี้แล้วครับ ถ้าต้องการบันทึกใหม่ ส่งรายละเอียดมาได้เลย';
    await persistLineTurn({
      threadId: input.threadId,
      nextPosition: input.nextPosition,
      now: input.now,
      userText: input.userText,
      assistantText: cancelText,
    });
    await replyWithMessages({
      lineClient: input.lineClient,
      replyToken: input.replyToken,
      messages: [{ type: 'text', text: cancelText, ...(input.sender ? { sender: input.sender } : {}) }],
    });
    return true;
  }

  const pendingDraft = parseFarmRecordDraft(input.userText, input.domainContext, input.now);
  if (!pendingDraft || pendingFarmRecordDraft) {
    return false;
  }

  const fallbackConfirmationPlan = buildFallbackResponsePlan({
    text: pendingDraft.summaryText,
    locale: 'th-TH',
    quickReplies: [
      { actionType: 'message', label: 'ใช่ บันทึกเลย', text: 'ใช่' },
      { actionType: 'message', label: 'แก้ไขข้อมูล', text: 'แก้ไข' },
      { actionType: 'message', label: 'ยกเลิก', text: 'ยกเลิก' },
    ],
    metadata: {
      channel: 'line',
      source: 'line_record_draft_confirmation',
    },
  });

  const confirmationFormats: ResponseFormat[] = [
    'card',
    ...fallbackConfirmationPlan.formats.filter(
      (format): format is Exclude<ResponseFormat, 'card'> => format !== 'card',
    ),
  ];

  const confirmationPlan = {
    ...fallbackConfirmationPlan,
    formats: confirmationFormats,
    card: {
      templateKey: 'common.summary',
      altText: 'ยืนยันรายการก่อนบันทึก',
      data: {
        title: 'ยืนยันรายการก่อนบันทึก',
        summary: pendingDraft.summaryText,
        altText: 'ยืนยันรายการก่อนบันทึก',
      },
      fallbackText: pendingDraft.summaryText,
    },
  };

  await persistLineTurn({
    threadId: input.threadId,
    nextPosition: input.nextPosition,
    now: input.now,
    userText: input.userText,
    assistantText: pendingDraft.summaryText,
    assistantMetadata: {
      pendingFarmRecordDraft: pendingDraft,
    },
  });
  await replyWithMessages({
    lineClient: input.lineClient,
    replyToken: input.replyToken,
    messages: renderResponseForLine(confirmationPlan, { sender: input.sender }),
  });
  return true;
}
