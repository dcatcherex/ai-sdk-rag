import { generateText } from 'ai';

import type { ResolvedDomainContext } from '@/features/domain-profiles/types';

export type LineAgricultureIntent =
  | 'confirm_pending'
  | 'cancel_pending'
  | 'edit_pending'
  | 'farm_log_create'
  | 'farm_log_summary'
  | 'farm_profile_setup'
  | 'weather_risk'
  | 'market_decision'
  | 'plant_diagnosis'
  | 'image_generation'
  | 'video_generation'
  | 'unknown';

export type LineIntentDecision = {
  intent: LineAgricultureIntent;
  confidence: number;
  source: 'regex' | 'classifier' | 'fallback';
  missing?: Array<'location' | 'pending_draft' | 'log_details'>;
  reason: string;
};

type RegexIntentInput = {
  text: string;
  hasPendingFarmRecordDraft?: boolean;
  domainContext?: ResolvedDomainContext | null;
};

const HIGH_CONFIDENCE = 0.92;
const MEDIUM_CONFIDENCE = 0.82;

const THAI_LOCATION_PATTERN =
  /(แม่ริม|เชียงใหม่|กรุงเทพฯ?|นครราชสีมา|โคราช|ขอนแก่น|อุบลราชธานี|สุรินทร์|บุรีรัมย์|ชลบุรี|ระยอง|จันทบุรี|ราชบุรี|นครปฐม|สุพรรณบุรี|พิษณุโลก|ลำพูน|ลำปาง|เชียงราย|สงขลา|หาดใหญ่|อยุธยา|สระบุรี|เพชรบุรี|ประจวบคีรีขันธ์|ตรัง|สุราษฎร์ธานี|นครศรีธรรมราช|ภูเก็ต)/u;

function decision(
  intent: LineAgricultureIntent,
  confidence: number,
  reason: string,
  missing?: LineIntentDecision['missing'],
): LineIntentDecision {
  return {
    intent,
    confidence,
    source: confidence > 0 ? 'regex' : 'fallback',
    ...(missing?.length ? { missing } : {}),
    reason,
  };
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function profileHasLocation(domainContext?: ResolvedDomainContext | null): boolean {
  const profileData = domainContext?.profile.data ?? {};
  return ['district', 'amphoe', 'province', 'location', 'area'].some((key) => {
    const value = profileData[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

export function extractWeatherLocation(
  text: string,
  domainContext?: ResolvedDomainContext | null,
): string | null {
  const explicit = text.match(THAI_LOCATION_PATTERN)?.[1];
  if (explicit) return explicit;

  const profileData = domainContext?.profile.data ?? {};
  for (const key of ['district', 'amphoe', 'province', 'location', 'area']) {
    const value = profileData[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function resolveLineAgricultureIntentByRegex(input: RegexIntentInput): LineIntentDecision {
  const text = normalizeText(input.text);
  const lower = text.toLowerCase();
  if (!text) {
    return { intent: 'unknown', confidence: 0, source: 'fallback', reason: 'empty message' };
  }

  if (input.hasPendingFarmRecordDraft) {
    if (/^(ใช่|ใช่ครับ|ใช่ค่ะ|โอเค|ตกลง|ยืนยัน|บันทึกเลย|save|save it|confirm|yes|ok|okay)$/iu.test(lower)) {
      return decision('confirm_pending', HIGH_CONFIDENCE, 'explicit confirmation while a farm record draft is pending');
    }
    if (/^(แก้ไข|ขอแก้ไข|แก้ข้อมูล|edit|change)$/iu.test(lower)) {
      return decision('edit_pending', HIGH_CONFIDENCE, 'explicit edit while a farm record draft is pending');
    }
    if (/^(ยกเลิก|ไม่เอา|cancel|no|ไม่ใช่)$/iu.test(lower)) {
      return decision('cancel_pending', HIGH_CONFIDENCE, 'explicit cancel while a farm record draft is pending');
    }
  }

  if (/(สร้างภาพ|วาดภาพ|ทำรูป|generate image|create image|draw)/iu.test(text)) {
    return decision('image_generation', HIGH_CONFIDENCE, 'explicit image generation request');
  }

  if (/(สร้างวิดีโอ|ทำวิดีโอ|generate video|create video)/iu.test(text)) {
    return decision('video_generation', HIGH_CONFIDENCE, 'explicit video generation request');
  }

  const asksSummary = /(สรุป|รายงาน|summary|report)/iu.test(text);
  const recordTopic = /(กิจกรรม|บันทึก|ฟาร์ม|แปลง|record|log|activity|farm)/iu.test(text);
  const asksLookup = /(ดู|เปิด|แสดง|ขอดู|เช็ค|ตรวจ|ค้น|หา|ย้อนหลัง|ประวัติ|รายการ|list|show|view|history|lookup)/iu.test(text);
  const timeRange = /(สัปดาห์นี้|อาทิตย์นี้|วันนี้|เดือนนี้|7\s*วัน|weekly|this week|today|month)/iu.test(text);
  if ((asksSummary && recordTopic) || (asksLookup && /(บันทึก|ประวัติ|รายการ|record|log|history)/iu.test(text))) {
    return decision('farm_log_summary', HIGH_CONFIDENCE, 'record summary or lookup request');
  }
  if (asksSummary && timeRange && /(ฟาร์ม|แปลง|กิจกรรม|farm|activity)/iu.test(text)) {
    return decision('farm_log_summary', HIGH_CONFIDENCE, 'weekly farm activity summary request');
  }

  const marketTerms = /(ควรขาย|ขาย.*ไหม|ขาย.*หรือรอ|รออีก|ถือไว้|ราคาตลาด|ราคา.*ตลาด|ราคา.*ไหม|ตลาด|sell|hold|market price|price)/iu;
  if (marketTerms.test(text)) {
    return decision('market_decision', HIGH_CONFIDENCE, 'market or sell/hold decision request');
  }

  const weatherTerms = /(สภาพอากาศ|อากาศ|พยากรณ์|ฝน|พายุ|น้ำท่วม|แล้ง|ความชื้น|ร้อน|หนาว|weather|forecast|rain|storm|flood|drought)/iu;
  const farmImpactTerms = /(เสี่ยง|ฟาร์ม|แปลง|ปลูก|เก็บเกี่ยว|มะเขือเทศ|พริก|ข้าว|พืช|กระทบ|ควรทำ|7\s*วัน|วันนี้|สัปดาห์|farm|crop|field|risk|impact|action)/iu;
  if (weatherTerms.test(text) && farmImpactTerms.test(text)) {
    const missing = extractWeatherLocation(text, input.domainContext) || profileHasLocation(input.domainContext)
      ? undefined
      : ['location' as const];
    return decision('weather_risk', HIGH_CONFIDENCE, 'weather forecast or farm risk request', missing);
  }

  const profileSetup =
    /^(ฉัน|ผม|เรา|ดิฉัน)\s*ปลูก/iu.test(text)
    && /(มีแปลง|อยู่ที่|ที่แม่ริม|เชียงใหม่|ไร่|โรงเรือน|สวน|ฟาร์ม)/iu.test(text)
    && !/(วันนี้|เมื่อวาน|บันทึก|ใส่ปุ๋ย|พ่นยา|รดน้ำ|เก็บเกี่ยว|ขาย)/iu.test(text);
  if (profileSetup) {
    return decision('farm_profile_setup', HIGH_CONFIDENCE, 'farm profile setup details, not an activity log');
  }

  const diagnosisTerms =
    /(โรค|แมลง|ใบ|จุด|เหี่ยว|เน่า|รา|เชื้อรา|ไวรัส|ด่าง|เหลือง|ไหม้|เสียหาย|ฉีดยา|ยาอะไร|disease|pest|leaf|spot|wilt|blight|mold|fung|virus)/iu;
  if (diagnosisTerms.test(text)) {
    return decision('plant_diagnosis', HIGH_CONFIDENCE, 'crop disease or pest diagnosis request');
  }

  const farmActionTerms =
    /(บันทึก|ซื้อ|ใส่ปุ๋ย|ยูเรีย|ปุ๋ย|พ่นยา|เก็บเกี่ยว|ขาย|รดน้ำ|ให้น้ำ|ปลูก|หว่าน|ถอนหญ้า|ตัดแต่ง|ฉีด|fertiliz|spray|harvest|sold|irrigat|plant|buy|bought|purchas)/iu;
  const hasLogDetail =
    /(\d+(?:[.,]\d+)?\s*(กก\.?|กิโลกรัม|กิโล|kg|ไร่|ตัน|ลิตร|ถุง|ต้น)|บาท|แปลง|วันนี้|เมื่อวาน|ค่าใช้จ่าย|ต้นทุน|รายได้)/iu.test(text);
  if (farmActionTerms.test(text)) {
    const missing = hasLogDetail ? undefined : ['log_details' as const];
    return decision(
      'farm_log_create',
      hasLogDetail ? HIGH_CONFIDENCE : MEDIUM_CONFIDENCE,
      hasLogDetail ? 'farm activity with concrete log detail' : 'farm activity mentioned but details may be incomplete',
      missing,
    );
  }

  return { intent: 'unknown', confidence: 0, source: 'fallback', reason: 'no deterministic agriculture intent match' };
}

function parseClassifierJson(text: string): Partial<LineIntentDecision> | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as Partial<LineIntentDecision>;
  } catch {
    return null;
  }
}

function sanitizeClassifierDecision(value: Partial<LineIntentDecision> | null): LineIntentDecision | null {
  if (!value || typeof value.intent !== 'string') return null;
  const allowed: readonly LineAgricultureIntent[] = [
    'farm_log_create',
    'farm_log_summary',
    'farm_profile_setup',
    'weather_risk',
    'market_decision',
    'plant_diagnosis',
    'unknown',
  ];
  if (!allowed.includes(value.intent as LineAgricultureIntent)) return null;

  const confidence = typeof value.confidence === 'number'
    ? Math.max(0, Math.min(1, value.confidence))
    : 0;
  const missing = Array.isArray(value.missing)
    ? value.missing.filter((item): item is 'location' | 'pending_draft' | 'log_details' =>
        item === 'location' || item === 'pending_draft' || item === 'log_details')
    : undefined;

  return {
    intent: value.intent as LineAgricultureIntent,
    confidence,
    source: 'classifier',
    ...(missing?.length ? { missing } : {}),
    reason: typeof value.reason === 'string' ? value.reason.slice(0, 180) : 'classifier decision',
  };
}

export type IntentRouterMode = 'regex_first' | 'ai_only' | 'regex_only';

export async function resolveLineAgricultureIntent(input: RegexIntentInput & {
  modelId: string;
  allowClassifier?: boolean;
  mode?: IntentRouterMode;
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<LineIntentDecision> {
  const mode = input.mode ?? (input.allowClassifier ? 'regex_first' : 'regex_only');

  if (mode === 'regex_only') {
    return resolveLineAgricultureIntentByRegex(input);
  }

  if (mode === 'ai_only') {
    return (await runClassifier(input.text, input.modelId, input.historyMessages)) ?? resolveLineAgricultureIntentByRegex(input);
  }

  // regex_first: try regex, fall back to classifier only for unknowns
  const regexDecision = resolveLineAgricultureIntentByRegex(input);
  if (regexDecision.intent !== 'unknown' && regexDecision.confidence >= MEDIUM_CONFIDENCE) {
    return regexDecision;
  }

  return (await runClassifier(input.text, input.modelId, input.historyMessages)) ?? regexDecision;
}

async function runClassifier(
  text: string,
  modelId: string,
  historyMessages?: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<LineIntentDecision | null> {
  try {
    const recentHistory = (historyMessages ?? []).slice(-4);
    const historyBlock = recentHistory.length > 0
      ? '\n\nRecent conversation:\n' + recentHistory.map((m) => `${m.role}: ${m.content}`).join('\n')
      : '';

    const result = await generateText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: modelId as any,
      system: [
        'Classify one LINE message for a Thai agriculture assistant.',
        'Return ONLY compact JSON with keys: intent, confidence, missing, reason.',
        'Allowed intents: farm_log_create, farm_log_summary, farm_profile_setup, weather_risk, market_decision, plant_diagnosis, unknown.',
        'Use the recent conversation for context (e.g. a short location reply follows a weather question).',
        'Be conservative. If the user asks whether to sell, choose market_decision. If the user asks weather/rain/forecast/farm risk, choose weather_risk and include missing:["location"] when no place is given. If the user asks to view/summarize records, choose farm_log_summary. If the user only states their farm/crop/location setup, choose farm_profile_setup. Choose farm_log_create only when they report a completed farm activity to save.',
      ].join(' '),
      prompt: `Message: ${text}${historyBlock}`,
    });

    const classifierDecision = sanitizeClassifierDecision(parseClassifierJson(result.text));
    if (classifierDecision && classifierDecision.confidence >= 0.78) {
      return classifierDecision;
    }
  } catch (err) {
    console.warn('[LINE] intent classifier failed:', err);
  }
  return null;
}
