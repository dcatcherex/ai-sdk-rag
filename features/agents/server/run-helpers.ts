import type { AgentRunInputMessage } from './run-types';

type ToolResultRecord = {
  toolName?: unknown;
  dynamic?: unknown;
  result?: unknown;
  output?: unknown;
};

export function getLastUserPromptFromRunMessages(messages: AgentRunInputMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'user') continue;
    if (message.content.trim()) return message.content.trim();

    const textPart = message.parts?.find((part) =>
      Boolean(
        part &&
        typeof part === 'object' &&
        'type' in part &&
        'text' in part &&
        (part as { type?: unknown }).type === 'text' &&
        typeof (part as { text?: unknown }).text === 'string' &&
        (part as { text: string }).text.trim().length > 0,
      ),
    ) as { text: string } | undefined;

    if (textPart?.text.trim()) return textPart.text.trim();
  }

  return null;
}

export function buildAgentRunModelMessages(messages: AgentRunInputMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    parts:
      message.parts && message.parts.length > 0
        ? message.parts
        : [{ type: 'text', text: message.content }],
  }));
}

export function collectToolImageUrls(toolResults: unknown[] | undefined): string[] {
  if (!toolResults?.length) return [];

  return toolResults.flatMap((toolResult) => {
    if (!toolResult || typeof toolResult !== 'object') return [];

    const payload = ('result' in toolResult ? toolResult.result : undefined)
      ?? ('output' in toolResult ? toolResult.output : undefined);

    if (!payload || typeof payload !== 'object') return [];

    return [
      ...(('imageUrl' in payload && typeof payload.imageUrl === 'string') ? [payload.imageUrl] : []),
      ...(Array.isArray((payload as { imageUrls?: unknown[] }).imageUrls)
        ? (payload as { imageUrls: unknown[] }).imageUrls.filter((url): url is string => typeof url === 'string')
        : []),
      ...(Array.isArray((payload as { outputUrls?: unknown[] }).outputUrls)
        ? (payload as { outputUrls: unknown[] }).outputUrls.filter((url): url is string => typeof url === 'string')
        : []),
    ];
  });
}

export function buildToolResultsFallbackContext(toolResults: unknown[] | undefined): string {
  if (!toolResults?.length) return '';

  const lines = toolResults.map((toolResult, index) => {
    if (!toolResult || typeof toolResult !== 'object') {
      return `${index + 1}. Tool result unavailable`;
    }

    const record = toolResult as {
      toolName?: unknown;
      dynamic?: unknown;
      result?: unknown;
      output?: unknown;
    };

    const toolName =
      typeof record.toolName === 'string'
        ? record.toolName
        : typeof record.dynamic === 'string'
          ? record.dynamic
          : `tool_${index + 1}`;

    const payload = record.result ?? record.output ?? null;
    const serializedPayload = payload === null
      ? 'null'
      : JSON.stringify(payload, null, 2);

    return `${index + 1}. ${toolName}\n${serializedPayload}`;
  });

  return lines.join('\n\n').slice(0, 8000);
}

export function extractNamedToolPayload(
  toolResults: unknown[] | undefined,
  toolNames: string[],
): unknown {
  if (!toolResults?.length) return null;

  for (const toolResult of toolResults) {
    if (!toolResult || typeof toolResult !== 'object') continue;

    const record = toolResult as ToolResultRecord;
    const toolName =
      typeof record.toolName === 'string'
        ? record.toolName
        : typeof record.dynamic === 'string'
          ? record.dynamic
          : null;

    if (!toolName || !toolNames.includes(toolName)) continue;
    return record.result ?? record.output ?? null;
  }

  return null;
}

export function hasRequiredHeadings(text: string, headings: string[]): boolean {
  return headings.every((heading) => text.includes(heading));
}

export function isThaiText(text: string): boolean {
  return /[\u0E00-\u0E7F]/.test(text);
}

export function containsLikelyUnexpectedEnglish(text: string): boolean {
  const englishWordCount = (text.match(/[A-Za-z]{3,}/g) ?? []).length;
  return englishWordCount >= 8;
}

export function looksLikeRecordSummaryRequest(prompt: string | null | undefined): boolean {
  if (!prompt) return false;

  return /(สรุป.*บันทึก|บันทึก.*สัปดาห์|summary.*record|summarize.*record|weekly summary|monthly summary)/i.test(
    prompt,
  );
}

export function looksLikeDiagnosisRequest(prompt: string | null | undefined): boolean {
  if (!prompt) return false;

  return /(โรค|แมลง|ใบ|จุด|เหี่ยว|เน่า|รา|เชื้อรา|disease|pest|leaf|spot|blight|mold|fung)/i.test(
    prompt,
  );
}

export function looksLikeSevereEscalationRequest(prompt: string | null | undefined): boolean {
  if (!prompt) return false;

  return /(ทั้งแปลง|เสียหาย|ภายในสองวัน|เร็วมาก|แรง ๆ|แรงๆ|ฉีดยาอะไรแรง|เหี่ยวเร็ว|ระบาดเร็ว|ตายเร็ว|severe|urgent|rapid)/i.test(prompt);
}

export function ensureSevereEscalationGuidance(text: string, preferThai: boolean): string {
  const hasOfficerGuidance = preferThai
    ? /(เจ้าหน้าที่|ส่งเสริม|เกษตรอำเภอ|ผู้เชี่ยวชาญ)/.test(text)
    : /(extension officer|expert|advisor|agronomist)/i.test(text);
  const hasUrgentTiming = preferThai
    ? /(ทันที|ด่วน|เร็ว|ภายใน)/.test(text)
    : /(quickly|urgent|immediately|as soon as)/i.test(text);

  if (hasOfficerGuidance && hasUrgentTiming) {
    return text;
  }

  const addition = preferThai
    ? [
        '',
        'ควรติดต่อเจ้าหน้าที่ส่งเสริมเมื่อไร:',
        '- กรณีนี้ควรติดต่อเจ้าหน้าที่ส่งเสริมการเกษตรหรือเกษตรอำเภอโดยเร็ว เพราะอาการลามเร็วและกระทบทั้งแปลงภายในสองวัน',
      ].join('\n')
    : [
        '',
        'When to contact an extension officer:',
        '- Contact an extension officer or local agronomist quickly because symptoms are spreading rapidly and affecting the whole field.',
      ].join('\n');

  return `${text.trim()}${addition}`;
}

export function inferFarmRecordSummaryRequest(prompt: string | null | undefined): {
  contextType: 'farm';
  period: 'week' | 'month' | 'all';
} | null {
  if (!looksLikeRecordSummaryRequest(prompt)) return null;
  if (!prompt) return null;

  const isFarmPrompt = /(ฟาร์ม|นา|แปลง|เกษตร|farm|rice|durian|longan|cassava|tomato)/i.test(prompt);
  if (!isFarmPrompt) return null;

  const period =
    /(เดือน|month)/i.test(prompt)
      ? 'month'
      : /(ทั้งหมด|all time|all records)/i.test(prompt)
        ? 'all'
        : 'week';

  return {
    contextType: 'farm',
    period,
  };
}

export function buildFallbackDiagnosisContract(userPrompt: string, preferThai: boolean): string {
  if (preferThai) {
    const cropHint = /มะเขือเทศ/.test(userPrompt)
      ? 'ใบมะเขือเทศมีความเสี่ยงเป็นโรคใบจุดหรือโรคเชื้อรา'
      : 'อาจเป็นโรคพืชหรือความเสียหายจากความชื้น/แมลง';

    return [
      'ปัญหาที่น่าจะเป็น:',
      cropHint,
      'ความมั่นใจ:',
      'ยังไม่แน่ชัดจากข้อมูลเท่าที่มี จึงควรถือเป็นการประเมินเบื้องต้น',
      'ระดับความรุนแรง:',
      'ปานกลาง และจะถือว่ารุนแรงขึ้นถ้าอาการลามเร็วหลายต้น',
      'ควรทำทันที:',
      '- แยกหรือทำเครื่องหมายต้นที่มีอาการ',
      '- เด็ดใบที่เสียหายมากออกและนำออกจากแปลง',
      '- ลดความชื้นสะสม เพิ่มการถ่ายเทอากาศ และตรวจการระบายน้ำ',
      '- หากจำเป็นต้องใช้สาร ให้เลือกตามชนิดสารหรือสารออกฤทธิ์ ทำตามฉลาก และสวม PPE',
      'ป้องกันรอบต่อไป:',
      '- ตรวจแปลงถี่ขึ้นในช่วงฝนหรือความชื้นสูง',
      '- หลีกเลี่ยงการรดน้ำโดนใบตอนเย็น',
      '- ทำความสะอาดเศษพืชป่วยและลดการสะสมเชื้อในแปลง',
      'ควรติดต่อเจ้าหน้าที่ส่งเสริมเมื่อไร:',
      '- เมื่ออาการลามเร็วทั้งแปลง',
      '- เมื่อเสี่ยงกระทบผลผลิตมาก',
      '- เมื่อยังแยกสาเหตุไม่ได้จากอาการหรือภาพที่มี',
    ].join('\n');
  }

  return [
    'Likely issue:',
    'A plant disease or moisture-related crop problem is possible, but this is only an initial triage.',
    'Confidence:',
    'Low to moderate based on limited details.',
    'Severity:',
    'Moderate, and higher if symptoms are spreading quickly across many plants.',
    'Immediate action:',
    '- Isolate or mark affected plants',
    '- Remove badly affected material',
    '- Improve airflow and drainage',
    '- If treatment is needed, follow the label and wear appropriate PPE',
    'Prevention:',
    '- Inspect fields more often during wet periods',
    '- Avoid prolonged leaf wetness',
    '- Remove infected plant debris',
    'When to contact an extension officer:',
    '- If spread is rapid',
    '- If crop-loss risk is high',
    '- If the cause remains unclear',
  ].join('\n');
}

export function formatFarmRecordSummary(payload: unknown, preferThai: boolean): string | null {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as {
    period?: unknown;
    total?: unknown;
    totalCost?: unknown;
    totalIncome?: unknown;
    records?: unknown;
  };

  const records = Array.isArray(record.records) ? record.records : [];
  const total = typeof record.total === 'number' ? record.total : records.length;
  const totalCost = typeof record.totalCost === 'number' ? record.totalCost : 0;
  const totalIncome = typeof record.totalIncome === 'number' ? record.totalIncome : 0;
  const period = typeof record.period === 'string' ? record.period : 'week';

  if (preferThai) {
    const periodLabel =
      period === 'month' ? 'เดือนนี้' : period === 'all' ? 'ทั้งหมด' : 'สัปดาห์นี้';

    if (total === 0) {
      return [
        'สรุปสัปดาห์นี้:',
        `ยังไม่มีบันทึก${periodLabel}`,
        'งานที่ทำ:',
        '- ยังไม่มีรายการ',
        'ค่าใช้จ่ายหรือผลผลิตที่บันทึก:',
        '- ค่าใช้จ่าย 0 บาท',
        '- รายรับ 0 บาท',
        'สิ่งที่ควรทำต่อ:',
        '- เริ่มบันทึกงานหลัก เช่น ใส่ปุ๋ย พ่นยา เก็บเกี่ยว หรือค่าใช้จ่าย',
      ].join('\n');
    }

    const workLines = records.slice(0, 5).map((entry) => {
      if (!entry || typeof entry !== 'object') return '- รายการบันทึก';
      const row = entry as {
        date?: unknown;
        activity?: unknown;
        quantity?: unknown;
        entity?: unknown;
      };
      const date = typeof row.date === 'string' ? row.date : '-';
      const activity = typeof row.activity === 'string' ? row.activity : 'รายการบันทึก';
      const quantity = typeof row.quantity === 'string' ? ` ${row.quantity}` : '';
      const entity = typeof row.entity === 'string' ? ` (${row.entity})` : '';
      return `- ${date} ${activity}${quantity}${entity}`;
    });

    return [
      'สรุปสัปดาห์นี้:',
      `มีบันทึก ${total} รายการใน${periodLabel}`,
      'งานที่ทำ:',
      ...workLines,
      'ค่าใช้จ่ายหรือผลผลิตที่บันทึก:',
      `- ค่าใช้จ่ายรวม ${totalCost.toLocaleString('th-TH')} บาท`,
      `- รายรับรวม ${totalIncome.toLocaleString('th-TH')} บาท`,
      'สิ่งที่ควรทำต่อ:',
      '- ตรวจว่ามีต้นทุนหรือผลผลิตรายการไหนที่ยังไม่ได้บันทึก',
    ].join('\n');
  }

  if (total === 0) {
    return [
      'This week at a glance:',
      'No records were found for this period.',
      'Work completed:',
      '- No logged activities yet',
      'Logged costs or output:',
      '- Total cost: 0',
      '- Total income: 0',
      'Suggested next steps:',
      '- Start logging major work such as fertilizer, spraying, harvest, or expenses',
    ].join('\n');
  }

  const workLines = records.slice(0, 5).map((entry) => {
    if (!entry || typeof entry !== 'object') return '- Logged activity';
    const row = entry as {
      date?: unknown;
      activity?: unknown;
      quantity?: unknown;
      entity?: unknown;
    };
    const date = typeof row.date === 'string' ? row.date : '-';
    const activity = typeof row.activity === 'string' ? row.activity : 'Logged activity';
    const quantity = typeof row.quantity === 'string' ? ` ${row.quantity}` : '';
    const entity = typeof row.entity === 'string' ? ` (${row.entity})` : '';
    return `- ${date} ${activity}${quantity}${entity}`;
  });

  return [
    'This week at a glance:',
    `Found ${total} records for this period.`,
    'Work completed:',
    ...workLines,
    'Logged costs or output:',
    `- Total cost: ${totalCost}`,
    `- Total income: ${totalIncome}`,
    'Suggested next steps:',
    '- Check whether any cost or output entries are still missing',
  ].join('\n');
}
