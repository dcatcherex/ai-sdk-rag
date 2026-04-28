# Vaja: Kaset — Flex Message Implementation Guide

Status: implementation guide  
Last updated: 2026-04-28  
Audience: AI coders and developers building Flex Message templates for the AgriSpark demo

---

## Overview

This document specifies all 13 Flex Message templates required for Vaja: Kaset to serve farmers across the four agriculture skills. Each section includes:

- trigger condition (when to render)
- builder function signature
- full TypeScript implementation
- altText rule
- file location

All builders follow the pattern already established in `features/line-oa/webhook/flex/`.

---

## Codebase Conventions

### File layout

```
features/line-oa/webhook/flex/
  index.ts                  ← re-exports all builders (add new exports here)
  reply.ts                  ← generic bullet/plain reply (existing)
  welcome.ts                ← follow-event welcome card (existing)
  diagnosis.ts              ← #1 #2 #3  (new — pest-disease)
  weather.ts                ← #4 #5 #6  (new — weather-farm-risk)
  records.ts                ← #7 #8 #9  (new — farm-record-keeper)
  market.ts                 ← #10 #11   (new — crop-market-advisor)
  menu.ts                   ← #12       (new — main menu)
  broadcast.ts              ← #13       (new — officer broadcast)
```

### Shared types (import from `../types`)

```typescript
import type {
  FlexBubble,
  FlexComponent,
  FlexMessage,
  LineMessage,
  QuickReply,
  Sender,
} from '../types';
import { LINE_GREEN } from '../types';
```

### Builder function signature pattern

Every builder returns `LineMessage` (or `LineMessage[]` for carousels):

```typescript
export function buildXxx(
  data: XxxData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage
```

### Registering a new builder

Add the export to `features/line-oa/webhook/flex/index.ts`:

```typescript
export { buildDiagnosisCard, buildPhotoDiagnosisCard, buildSeverityAlert } from './diagnosis';
export { buildWeatherRiskCard, buildForecastCarousel, buildFloodAlertCard } from './weather';
export { buildLogConfirmCard, buildRecordEntryCard, buildWeeklySummaryCard } from './records';
export { buildPriceCheckCard, buildSellDecisionCard } from './market';
export { buildMainMenuCard } from './menu';
export { buildOfficerBroadcastCard } from './broadcast';
```

### Where to call builders

| Builder | Call site |
|---------|-----------|
| `buildDiagnosisCard` | `features/line-oa/webhook/events/message.ts` — after canonical agent run when skill = pest-disease-consult |
| `buildPhotoDiagnosisCard` | same file — photo observation path |
| `buildSeverityAlert` | same file — after parsing severity from diagnosis result |
| `buildWeatherRiskCard` | same file — after agent run when skill = weather-farm-risk |
| `buildForecastCarousel` | same file — when farmer explicitly asks for multi-day forecast |
| `buildFloodAlertCard` | same file — when riskLevel = 'high' from weather tool output |
| `buildLogConfirmCard` | `features/line-oa/webhook/events/message.ts` — before `log_activity` call |
| `buildRecordEntryCard` | same file — after `get_activity_records` returns a single record |
| `buildWeeklySummaryCard` | same file — after `summarize_activity_records` |
| `buildPriceCheckCard` | same file — when skill = crop-market-advisor |
| `buildSellDecisionCard` | same file — when farmer asks explicit sell-vs-hold question |
| `buildMainMenuCard` | `features/line-oa/webhook/events/follow.ts` and postback handler for "หน้าหลัก" |
| `buildOfficerBroadcastCard` | `features/line-oa/broadcast/service.ts` |

### Response contract parsing helper

The skill response contracts use consistent headings. Parse them before building Flex cards:

```typescript
// features/line-oa/webhook/utils/parse-contract.ts

export function parseContract(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = text.split('\n');
  let currentKey = '';
  for (const line of lines) {
    const match = line.match(/^(.+?):\s*(.*)/);
    if (match) {
      currentKey = match[1].trim();
      result[currentKey] = match[2].trim();
    } else if (currentKey && line.trim()) {
      result[currentKey] += ' ' + line.trim();
    }
  }
  return result;
}
```

Usage:

```typescript
const fields = parseContract(agentReply);
// Thai keys: fields['ปัญหาที่น่าจะเป็น'], fields['ความมั่นใจ'], etc.
// English keys: fields['Likely issue'], fields['Confidence'], etc.
```

---

## Severity Detection Helper

Used by diagnosis and weather builders to set card color:

```typescript
// Shared helper — inline in diagnosis.ts or extract to utils/severity.ts
type SeverityLevel = 'low' | 'medium' | 'high' | 'unknown';

export function parseSeverity(raw: string | undefined): SeverityLevel {
  if (!raw) return 'unknown';
  const s = raw.toLowerCase();
  if (s.includes('สูง') || s.includes('high') || s.includes('รุนแรง')) return 'high';
  if (s.includes('ปานกลาง') || s.includes('medium') || s.includes('moderate')) return 'medium';
  if (s.includes('ต่ำ') || s.includes('low') || s.includes('mild')) return 'low';
  return 'unknown';
}

const SEVERITY_COLOR: Record<SeverityLevel, string> = {
  high: '#D32F2F',
  medium: '#F57C00',
  low: '#388E3C',
  unknown: '#757575',
};
```

---

## Template 1 — Diagnosis Result Card

**File:** `features/line-oa/webhook/flex/diagnosis.ts`  
**Trigger:** Agent run completes with skill `pest-disease-consult` active and severity ≠ high  
**altText:** First 200 chars of the ปัญหาที่น่าจะเป็น field

```typescript
import type { FlexBubble, FlexComponent, FlexMessage, LineMessage, QuickReply, Sender } from '../types';
import { LINE_GREEN } from '../types';

export interface DiagnosisData {
  issue: string;           // ปัญหาที่น่าจะเป็น / Likely issue
  confidence: string;      // ความมั่นใจ / Confidence
  severity: string;        // ระดับความรุนแรง / Severity
  action: string;          // ควรทำทันที / Immediate action
  prevention: string;      // ป้องกันรอบต่อไป / Prevention
  escalate: string;        // ควรติดต่อเจ้าหน้าที่ / When to contact
}

function contractRow(label: string, value: string, labelColor = '#888888'): FlexComponent {
  return {
    type: 'box',
    layout: 'vertical',
    margin: 'md',
    contents: [
      { type: 'text', text: label, size: 'xs', color: labelColor, weight: 'bold' },
      { type: 'text', text: value || '—', size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
    ],
  };
}

export function buildDiagnosisCard(
  data: DiagnosisData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const severityColor =
    /สูง|high|รุนแรง/i.test(data.severity) ? '#D32F2F' :
    /ปานกลาง|medium/i.test(data.severity) ? '#F57C00' :
    '#388E3C';

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: LINE_GREEN,
      paddingAll: '16px',
      contents: [
        { type: 'text', text: '🌿 ผลการวินิจฉัยโรคพืช', weight: 'bold', color: '#FFFFFF', size: 'md' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        contractRow('ปัญหาที่น่าจะเป็น', data.issue, LINE_GREEN),
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [
                { type: 'text', text: 'ความมั่นใจ', size: 'xs', color: '#888888', weight: 'bold' },
                { type: 'text', text: data.confidence || '—', size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [
                { type: 'text', text: 'ระดับความรุนแรง', size: 'xs', color: '#888888', weight: 'bold' },
                { type: 'text', text: data.severity || '—', size: 'sm', color: severityColor, wrap: true, margin: 'sm', weight: 'bold' },
              ],
            },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        contractRow('ควรทำทันที', data.action),
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        contractRow('ป้องกันรอบต่อไป', data.prevention),
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        contractRow('ควรติดต่อเจ้าหน้าที่ส่งเสริมเมื่อไร', data.escalate, '#888888'),
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: 'ถามเพิ่มเติม', text: 'ถามเพิ่มเติมเกี่ยวกับโรคพืช' },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };

  const flexMsg: FlexMessage = {
    type: 'flex',
    altText: `ผลวินิจฉัย: ${data.issue.slice(0, 200)}`,
    contents: bubble,
  };

  return {
    ...flexMsg,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 2 — Photo Diagnosis Card

**File:** `features/line-oa/webhook/flex/diagnosis.ts` (same file, additional export)  
**Trigger:** Agent run completes on photo path (observation-derived text) with pest-disease-consult active  
**altText:** "ผลวินิจฉัยจากรูปภาพ: " + issue field (200 chars)

```typescript
export interface PhotoDiagnosisData extends DiagnosisData {
  imageUrl: string;        // original farmer photo URL from LINE (expires in 30 days)
  observation: string;     // short observation text derived from photo analysis
}

export function buildPhotoDiagnosisCard(
  data: PhotoDiagnosisData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const severityColor =
    /สูง|high|รุนแรง/i.test(data.severity) ? '#D32F2F' :
    /ปานกลาง|medium/i.test(data.severity) ? '#F57C00' :
    '#388E3C';

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'image',
      url: data.imageUrl,
      size: 'full',
      aspectRatio: '4:3',
      aspectMode: 'cover',
    },
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: LINE_GREEN,
      paddingAll: '12px',
      contents: [
        { type: 'text', text: '📷 วินิจฉัยจากรูปภาพ', weight: 'bold', color: '#FFFFFF', size: 'sm' },
        { type: 'text', text: data.observation, color: '#E8F5E9', size: 'xs', wrap: true, margin: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        contractRow('ปัญหาที่น่าจะเป็น', data.issue, LINE_GREEN),
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            {
              type: 'box', layout: 'vertical', flex: 1,
              contents: [
                { type: 'text', text: 'ความมั่นใจ', size: 'xs', color: '#888888', weight: 'bold' },
                { type: 'text', text: data.confidence || '—', size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
              ],
            },
            {
              type: 'box', layout: 'vertical', flex: 1,
              contents: [
                { type: 'text', text: 'ระดับความรุนแรง', size: 'xs', color: '#888888', weight: 'bold' },
                { type: 'text', text: data.severity || '—', size: 'sm', color: severityColor, wrap: true, margin: 'sm', weight: 'bold' },
              ],
            },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        contractRow('ควรทำทันที', data.action),
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        contractRow('ป้องกันรอบต่อไป', data.prevention),
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        contractRow('ควรติดต่อเจ้าหน้าที่ส่งเสริมเมื่อไร', data.escalate, '#888888'),
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: 'ส่งรูปเพิ่มเติม', text: 'ต้องการส่งรูปพืชเพิ่มเติม' },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };

  const flexMsg: FlexMessage = {
    type: 'flex',
    altText: `ผลวินิจฉัยจากรูปภาพ: ${data.issue.slice(0, 200)}`,
    contents: bubble,
  };

  return {
    ...flexMsg,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 3 — Severity Alert Card

**File:** `features/line-oa/webhook/flex/diagnosis.ts`  
**Trigger:** After parsing diagnosis result and severity = 'high'; send this INSTEAD of #1 or #2  
**altText:** "⚠️ แจ้งเตือนด่วน: " + issue field

```typescript
export function buildSeverityAlert(
  data: DiagnosisData,
  extensionOfficerTel: string | undefined,   // e.g. "1170" (Thai extension hotline)
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#D32F2F',
      paddingAll: '16px',
      contents: [
        { type: 'text', text: '⚠️ ความรุนแรงสูง — ต้องดำเนินการทันที', weight: 'bold', color: '#FFFFFF', size: 'sm', wrap: true },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        contractRow('ปัญหาที่น่าจะเป็น', data.issue, '#D32F2F'),
        { type: 'separator', margin: 'md', color: '#FFCDD2' },
        contractRow('ควรทำทันที', data.action),
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        contractRow('ป้องกันรอบต่อไป', data.prevention),
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          backgroundColor: '#FFF3E0',
          paddingAll: '12px',
          cornerRadius: '8px',
          contents: [
            { type: 'text', text: '📞 ควรติดต่อเจ้าหน้าที่', size: 'xs', color: '#E65100', weight: 'bold' },
            { type: 'text', text: data.escalate || 'แนะนำให้ติดต่อเจ้าหน้าที่ส่งเสริมการเกษตรในพื้นที่ทันที', size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      spacing: 'sm',
      contents: [
        ...(extensionOfficerTel ? [{
          type: 'button' as const,
          action: { type: 'uri' as const, label: `โทร ${extensionOfficerTel}`, uri: `tel:${extensionOfficerTel}` },
          style: 'primary' as const,
          color: '#D32F2F',
          height: 'sm' as const,
        }] : []),
        {
          type: 'button',
          action: { type: 'message', label: 'ถามเพิ่มเติม', text: 'ต้องการข้อมูลเพิ่มเติมเกี่ยวกับโรคนี้' },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };

  const flexMsg: FlexMessage = {
    type: 'flex',
    altText: `⚠️ แจ้งเตือนด่วน: ${data.issue.slice(0, 200)}`,
    contents: bubble,
  };

  return {
    ...flexMsg,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 4 — Weather Risk Summary Card

**File:** `features/line-oa/webhook/flex/weather.ts`  
**Trigger:** Agent run completes with skill `weather-farm-risk` active  
**altText:** "พยากรณ์เกษตร: " + mainRisk field

```typescript
import type { FlexBubble, FlexComponent, FlexMessage, LineMessage, QuickReply, Sender } from '../types';
import { LINE_GREEN } from '../types';

export interface WeatherRiskData {
  location: string;
  tempC: number;
  rainMm: number;
  windKph: number;
  mainRisk: string;        // ความเสี่ยงหลัก
  timeWindow: string;      // ช่วงเวลา (วันนี้ / 3 วัน / 7 วัน)
  action: string;          // ควรทำทันที
  watchOuts: string;       // จุดที่ต้องเฝ้าระวัง
  riskLevel: 'low' | 'medium' | 'high';
}

const RISK_COLOR: Record<string, string> = {
  low: '#388E3C',
  medium: '#F57C00',
  high: '#D32F2F',
};

const RISK_LABEL: Record<string, string> = {
  low: 'เสี่ยงต่ำ',
  medium: 'เสี่ยงปานกลาง',
  high: 'เสี่ยงสูง',
};

function weatherStatBox(icon: string, value: string, label: string): FlexComponent {
  return {
    type: 'box',
    layout: 'vertical',
    alignItems: 'center',
    flex: 1,
    contents: [
      { type: 'text', text: icon, size: 'xl', align: 'center' },
      { type: 'text', text: value, size: 'sm', weight: 'bold', align: 'center', color: '#333333' },
      { type: 'text', text: label, size: 'xxs', color: '#888888', align: 'center' },
    ],
  };
}

export function buildWeatherRiskCard(
  data: WeatherRiskData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const riskColor = RISK_COLOR[data.riskLevel] ?? '#757575';
  const riskLabel = RISK_LABEL[data.riskLevel] ?? 'ไม่ทราบ';

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'horizontal',
      backgroundColor: '#1565C0',
      paddingAll: '16px',
      alignItems: 'center',
      contents: [
        {
          type: 'box', layout: 'vertical', flex: 1,
          contents: [
            { type: 'text', text: '🌤 พยากรณ์เกษตร', weight: 'bold', color: '#FFFFFF', size: 'md' },
            { type: 'text', text: data.location, color: '#BBDEFB', size: 'sm', margin: 'xs' },
          ],
        },
        {
          type: 'box', layout: 'vertical', alignItems: 'flex-end', flex: 0,
          contents: [
            { type: 'text', text: riskLabel, size: 'xs', color: '#FFFFFF', weight: 'bold', backgroundColor: riskColor, paddingAll: '6px', cornerRadius: '12px' },
          ],
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'none',
          paddingBottom: '12px',
          contents: [
            weatherStatBox('🌡', `${data.tempC}°C`, 'อุณหภูมิ'),
            { type: 'separator', color: '#EEEEEE' },
            weatherStatBox('🌧', `${data.rainMm}mm`, 'ฝน'),
            { type: 'separator', color: '#EEEEEE' },
            weatherStatBox('💨', `${data.windKph}km/h`, 'ลม'),
          ],
        },
        { type: 'separator', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: 'ความเสี่ยงหลัก', size: 'xs', color: '#888888', weight: 'bold' },
            { type: 'text', text: data.mainRisk, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: `ช่วงเวลา: ${data.timeWindow}`, size: 'xs', color: '#888888', weight: 'bold' },
            { type: 'text', text: data.action, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: 'จุดที่ต้องเฝ้าระวัง', size: 'xs', color: '#888888', weight: 'bold' },
            { type: 'text', text: data.watchOuts, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: 'ดูพยากรณ์ 7 วัน', text: 'ขอดูพยากรณ์อากาศ 7 วันข้างหน้า' },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `พยากรณ์เกษตร ${data.location}: ${data.mainRisk.slice(0, 100)}`,
    contents: bubble,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 5 — 7-Day Forecast Carousel

**File:** `features/line-oa/webhook/flex/weather.ts`  
**Trigger:** Farmer explicitly asks for multi-day forecast; or taps "ดูพยากรณ์ 7 วัน" postback  
**altText:** "พยากรณ์ 7 วัน — " + location

```typescript
import type { FlexCarousel } from '@line/bot-sdk/dist/messaging-api/model/models';

export interface DailyForecast {
  date: string;            // e.g. "พ. 30 เม.ย."
  tempMaxC: number;
  tempMinC: number;
  rainMm: number;
  rainPct: number;         // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  farmNote: string;        // one short Thai sentence
}

export interface ForecastCarouselData {
  location: string;
  days: DailyForecast[];   // 5-7 items
}

function buildDayBubble(day: DailyForecast): FlexBubble {
  const riskColor = RISK_COLOR[day.riskLevel] ?? '#757575';
  const riskLabel = RISK_LABEL[day.riskLevel] ?? '—';

  return {
    type: 'bubble',
    size: 'micro',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#1565C0',
      paddingAll: '10px',
      contents: [
        { type: 'text', text: day.date, weight: 'bold', color: '#FFFFFF', size: 'sm', align: 'center' },
        { type: 'text', text: riskLabel, size: 'xxs', color: '#FFFFFF', align: 'center', backgroundColor: riskColor, paddingAll: '4px', cornerRadius: '8px', margin: 'xs' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '10px',
      spacing: 'sm',
      contents: [
        { type: 'text', text: `🌡 ${day.tempMinC}–${day.tempMaxC}°C`, size: 'xs', color: '#333333', align: 'center' },
        { type: 'text', text: `🌧 ${day.rainMm}mm (${day.rainPct}%)`, size: 'xs', color: '#1565C0', align: 'center' },
        { type: 'separator', margin: 'sm', color: '#EEEEEE' },
        { type: 'text', text: day.farmNote, size: 'xxs', color: '#555555', wrap: true, align: 'center' },
      ],
    },
  };
}

export function buildForecastCarousel(
  data: ForecastCarouselData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const carousel: FlexCarousel = {
    type: 'carousel',
    contents: data.days.map(buildDayBubble),
  };

  return {
    type: 'flex',
    altText: `พยากรณ์ 7 วัน — ${data.location}`,
    contents: carousel,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 6 — Flood / Storm Alert Card

**File:** `features/line-oa/webhook/flex/weather.ts`  
**Trigger:** `riskLevel = 'high'` from weather tool output; send this INSTEAD of #4  
**altText:** "⛈ แจ้งเตือนสภาพอากาศรุนแรง — " + location

```typescript
export interface FloodAlertData {
  location: string;
  eventDescription: string;  // e.g. "พายุฝนฟ้าคะนองรุนแรง คาดการณ์ฝนสะสม 80mm ใน 24 ชม."
  action: string;
  watchOuts: string;
  officialChannelUrl?: string;  // TMD or disaster site
}

export function buildFloodAlertCard(
  data: FloodAlertData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#D32F2F',
      paddingAll: '16px',
      contents: [
        { type: 'text', text: '⛈ แจ้งเตือนสภาพอากาศรุนแรง', weight: 'bold', color: '#FFFFFF', size: 'md', wrap: true },
        { type: 'text', text: data.location, color: '#FFCDD2', size: 'sm', margin: 'xs' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#FFF3E0',
          paddingAll: '12px',
          cornerRadius: '8px',
          contents: [
            { type: 'text', text: data.eventDescription, size: 'sm', color: '#BF360C', wrap: true, weight: 'bold' },
          ],
        },
        {
          type: 'box', layout: 'vertical', margin: 'lg',
          contents: [
            { type: 'text', text: 'ควรทำทันที', size: 'xs', color: '#888888', weight: 'bold' },
            { type: 'text', text: data.action, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: 'จุดที่ต้องเฝ้าระวัง', size: 'xs', color: '#888888', weight: 'bold' },
            { type: 'text', text: data.watchOuts, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: '⚠️ ความปลอดภัยส่วนตัวมาก่อนการเก็บเกี่ยว', size: 'xs', color: '#D32F2F', wrap: true, weight: 'bold' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      spacing: 'sm',
      contents: [
        ...(data.officialChannelUrl ? [{
          type: 'button' as const,
          action: { type: 'uri' as const, label: 'ดูพยากรณ์อากาศทางการ', uri: data.officialChannelUrl },
          style: 'primary' as const,
          color: '#D32F2F',
          height: 'sm' as const,
        }] : []),
        {
          type: 'button',
          action: { type: 'message', label: 'ถามสถานการณ์เพิ่มเติม', text: 'อยากทราบข้อมูลน้ำท่วมเพิ่มเติม' },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `⛈ แจ้งเตือนสภาพอากาศรุนแรง — ${data.location}`,
    contents: bubble,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 7 — Log Confirmation Card

**File:** `features/line-oa/webhook/flex/records.ts`  
**Trigger:** Agent extracts activity details from farmer message, BEFORE calling `log_activity`  
**altText:** "ยืนยันบันทึก: " + activity

**Important:** The farmer must tap "ยืนยัน" before the record is saved. Listen for the postback `action=confirm_log&token=<uuid>` and then call `log_activity`.

```typescript
import type { FlexBubble, FlexComponent, FlexMessage, LineMessage, QuickReply, Sender } from '../types';
import { LINE_GREEN } from '../types';

export interface LogConfirmData {
  confirmToken: string;    // UUID for postback matching
  date: string;            // e.g. "28 เม.ย. 2569"
  activity: string;        // e.g. "ฉีดยาฆ่าแมลง"
  crop: string;            // e.g. "มะเขือเทศ"
  area?: string;           // e.g. "2 ไร่"
  quantity?: string;       // e.g. "2 ลิตร"
  cost?: string;           // e.g. "320 บาท"
  notes?: string;
}

function logRow(label: string, value: string | undefined): FlexComponent | null {
  if (!value) return null;
  return {
    type: 'box',
    layout: 'horizontal',
    margin: 'sm',
    contents: [
      { type: 'text', text: label, size: 'xs', color: '#888888', flex: 2 },
      { type: 'text', text: value, size: 'sm', color: '#333333', flex: 3, wrap: true, align: 'end' },
    ],
  };
}

export function buildLogConfirmCard(
  data: LogConfirmData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const rows = [
    logRow('วันที่', data.date),
    logRow('กิจกรรม', data.activity),
    logRow('พืช', data.crop),
    logRow('พื้นที่', data.area),
    logRow('ปริมาณ', data.quantity),
    logRow('ค่าใช้จ่าย', data.cost),
    logRow('หมายเหตุ', data.notes),
  ].filter(Boolean) as FlexComponent[];

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: LINE_GREEN,
      paddingAll: '14px',
      contents: [
        { type: 'text', text: '📋 ยืนยันบันทึกกิจกรรมฟาร์ม', weight: 'bold', color: '#FFFFFF', size: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        { type: 'text', text: 'ข้อมูลที่จะบันทึก', size: 'xs', color: '#888888', weight: 'bold' },
        { type: 'separator', margin: 'sm', color: '#EEEEEE' },
        ...rows,
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'text',
          text: 'กดยืนยันเพื่อบันทึก หรือยกเลิกเพื่อแก้ไขข้อมูล',
          size: 'xs',
          color: '#888888',
          wrap: true,
          margin: 'md',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      paddingAll: '12px',
      spacing: 'sm',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: 'ยืนยัน',
            data: `action=confirm_log&token=${data.confirmToken}`,
            displayText: 'ยืนยันบันทึกกิจกรรม',
          },
          style: 'primary',
          color: LINE_GREEN,
          height: 'sm',
          flex: 1,
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: 'ยกเลิก',
            data: `action=cancel_log&token=${data.confirmToken}`,
            displayText: 'ยกเลิก',
          },
          style: 'secondary',
          height: 'sm',
          flex: 1,
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `ยืนยันบันทึก: ${data.activity} — ${data.crop} (${data.date})`,
    contents: bubble,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

### Handling the postback

In `features/line-oa/webhook/events/postback.ts`, add a handler for `action=confirm_log`:

```typescript
if (postbackData.action === 'confirm_log') {
  // retrieve pending log by token from a short-lived store (redis, db, or in-memory)
  const pendingLog = await getPendingLog(postbackData.token);
  if (pendingLog) {
    await callRecordKeeperTool('log_activity', pendingLog);
    await replyText(replyToken, '✅ บันทึกเรียบร้อยแล้วครับ');
  }
}
```

---

## Template 8 — Record Entry Card

**File:** `features/line-oa/webhook/flex/records.ts`  
**Trigger:** Farmer asks to review a specific logged activity (`get_activity_records` returns one record)  
**altText:** "บันทึก: " + activity + " — " + date

```typescript
export interface RecordEntryData {
  date: string;
  activity: string;
  crop: string;
  area?: string;
  quantity?: string;
  cost?: string;
  notes?: string;
}

export function buildRecordEntryCard(
  data: RecordEntryData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const rows = [
    logRow('วันที่', data.date),
    logRow('กิจกรรม', data.activity),
    logRow('พืช', data.crop),
    logRow('พื้นที่', data.area),
    logRow('ปริมาณ', data.quantity),
    logRow('ค่าใช้จ่าย', data.cost),
    logRow('หมายเหตุ', data.notes),
  ].filter(Boolean) as FlexComponent[];

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#37474F',
      paddingAll: '14px',
      contents: [
        { type: 'text', text: '📁 บันทึกกิจกรรมฟาร์ม', weight: 'bold', color: '#FFFFFF', size: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: rows,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: 'ดูสรุปทั้งหมด', text: 'ขอดูสรุปกิจกรรมฟาร์มทั้งหมด' },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `บันทึก: ${data.activity} — ${data.date}`,
    contents: bubble,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 9 — Weekly / Monthly Summary Card

**File:** `features/line-oa/webhook/flex/records.ts`  
**Trigger:** After `summarize_activity_records` returns; also after successful log confirmation  
**altText:** "สรุปกิจกรรมฟาร์ม: " + period

```typescript
export interface FarmSummaryData {
  period: string;          // e.g. "สัปดาห์นี้ (22–28 เม.ย.)"
  workCompleted: string;   // งานที่ทำ
  loggedOutput: string;    // ค่าใช้จ่ายหรือผลผลิตที่บันทึก
  nextSteps: string;       // สิ่งที่ควรทำต่อ
  totalActivities: number;
}

export function buildWeeklySummaryCard(
  data: FarmSummaryData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'horizontal',
      backgroundColor: LINE_GREEN,
      paddingAll: '14px',
      alignItems: 'center',
      contents: [
        {
          type: 'box', layout: 'vertical', flex: 1,
          contents: [
            { type: 'text', text: '📊 สรุปกิจกรรมฟาร์ม', weight: 'bold', color: '#FFFFFF', size: 'sm' },
            { type: 'text', text: data.period, color: '#E8F5E9', size: 'xs', margin: 'xs' },
          ],
        },
        {
          type: 'box', layout: 'vertical', alignItems: 'flex-end', flex: 0,
          contents: [
            { type: 'text', text: `${data.totalActivities} กิจกรรม`, size: 'xs', color: '#FFFFFF', weight: 'bold' },
          ],
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        {
          type: 'box', layout: 'vertical', margin: 'none',
          contents: [
            { type: 'text', text: 'งานที่ทำ', size: 'xs', color: '#888888', weight: 'bold' },
            { type: 'text', text: data.workCompleted, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: 'ค่าใช้จ่ายหรือผลผลิตที่บันทึก', size: 'xs', color: '#888888', weight: 'bold' },
            { type: 'text', text: data.loggedOutput, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: 'สิ่งที่ควรทำต่อ', size: 'xs', color: LINE_GREEN, weight: 'bold' },
            { type: 'text', text: data.nextSteps, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: 'บันทึกกิจกรรมใหม่', text: 'ต้องการบันทึกกิจกรรมฟาร์ม' },
          style: 'primary',
          color: LINE_GREEN,
          height: 'sm',
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `สรุปกิจกรรมฟาร์ม: ${data.period}`,
    contents: bubble,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 10 — Price Check Card

**File:** `features/line-oa/webhook/flex/market.ts`  
**Trigger:** Agent run completes with skill `crop-market-advisor` active  
**altText:** "ราคาพืชผล: " + crop name

```typescript
import type { FlexBubble, FlexComponent, FlexMessage, LineMessage, QuickReply, Sender } from '../types';
import { LINE_GREEN } from '../types';

export interface PriceCheckData {
  crop: string;
  currentPicture: string;   // ราคาที่เห็นตอนนี้
  keyFactors: string;       // ปัจจัยที่ควรดู
  decisionFrame: string;    // ควรตัดสินใจอย่างไร
  watchOuts: string;        // ข้อควรระวัง
}

export function buildPriceCheckCard(
  data: PriceCheckData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F57F17',
      paddingAll: '14px',
      contents: [
        { type: 'text', text: '📈 ข้อมูลราคาและตลาด', weight: 'bold', color: '#FFFFFF', size: 'md' },
        { type: 'text', text: data.crop, color: '#FFF9C4', size: 'sm', margin: 'xs' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        {
          type: 'box', layout: 'vertical', margin: 'none',
          contents: [
            { type: 'text', text: 'ราคาที่เห็นตอนนี้', size: 'xs', color: '#888888', weight: 'bold' },
            { type: 'text', text: data.currentPicture, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: 'ปัจจัยที่ควรดู', size: 'xs', color: '#888888', weight: 'bold' },
            { type: 'text', text: data.keyFactors, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: 'ควรตัดสินใจอย่างไร', size: 'xs', color: '#F57F17', weight: 'bold' },
            { type: 'text', text: data.decisionFrame, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          backgroundColor: '#FFF8E1',
          paddingAll: '10px',
          cornerRadius: '6px',
          contents: [
            { type: 'text', text: '⚠️ ข้อควรระวัง', size: 'xs', color: '#E65100', weight: 'bold' },
            { type: 'text', text: data.watchOuts, size: 'xs', color: '#555555', wrap: true, margin: 'xs' },
            { type: 'text', text: 'ราคาสินค้าเกษตรมีความผันผวน ข้อมูลนี้ไม่ใช่คำแนะนำทางการเงิน', size: 'xxs', color: '#888888', wrap: true, margin: 'xs' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: 'ถามราคาตลาดใหม่', text: 'ขอข้อมูลราคาพืชผลล่าสุด' },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `ราคาพืชผล: ${data.crop} — ${data.currentPicture.slice(0, 100)}`,
    contents: bubble,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 11 — Sell Decision Frame Card

**File:** `features/line-oa/webhook/flex/market.ts`  
**Trigger:** Farmer asks explicit "ควรขายตอนนี้ไหม" / "should I sell now" question  
**altText:** "กรอบการตัดสินใจขาย: " + crop

```typescript
export interface SellDecisionData {
  crop: string;
  sellReasons: string[];    // max 3 bullets for "ควรขาย"
  holdReasons: string[];    // max 3 bullets for "ควรรอ"
  recommendation: string;  // final framing sentence (not a command)
  disclaimer: string;
}

export function buildSellDecisionCard(
  data: SellDecisionData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const bulletList = (items: string[], color: string): FlexComponent[] =>
    items.map(item => ({
      type: 'box' as const,
      layout: 'horizontal' as const,
      spacing: 'sm' as const,
      margin: 'sm' as const,
      contents: [
        { type: 'text' as const, text: '●', size: 'xs' as const, color, flex: 0, offsetTop: '2px' },
        { type: 'text' as const, text: item, size: 'xs' as const, color: '#333333', flex: 1, wrap: true },
      ],
    }));

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F57F17',
      paddingAll: '14px',
      contents: [
        { type: 'text', text: '⚖️ กรอบการตัดสินใจขาย', weight: 'bold', color: '#FFFFFF', size: 'md' },
        { type: 'text', text: data.crop, color: '#FFF9C4', size: 'sm', margin: 'xs' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'md',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              backgroundColor: '#E8F5E9',
              paddingAll: '10px',
              cornerRadius: '8px',
              contents: [
                { type: 'text', text: '✅ ควรขาย', size: 'xs', color: '#388E3C', weight: 'bold' },
                ...bulletList(data.sellReasons, '#388E3C'),
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              backgroundColor: '#FFF3E0',
              paddingAll: '10px',
              cornerRadius: '8px',
              contents: [
                { type: 'text', text: '⏳ ควรรอ', size: 'xs', color: '#F57C00', weight: 'bold' },
                ...bulletList(data.holdReasons, '#F57C00'),
              ],
            },
          ],
        },
        { type: 'separator', margin: 'lg', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: data.recommendation, size: 'sm', color: '#333333', wrap: true },
            { type: 'text', text: data.disclaimer, size: 'xxs', color: '#888888', wrap: true, margin: 'sm' },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          action: { type: 'message', label: 'ถามราคาตลาดใหม่', text: 'ขอข้อมูลราคาพืชผลล่าสุด' },
          style: 'secondary',
          height: 'sm',
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `กรอบการตัดสินใจขาย: ${data.crop}`,
    contents: bubble,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 12 — Main Menu Card

**File:** `features/line-oa/webhook/flex/menu.ts`  
**Trigger:** Follow event (new user) OR postback `action=show_menu` from rich menu "หน้าหลัก" button  
**altText:** "วาจา: เกษตร — เลือกหัวข้อที่ต้องการ"

```typescript
import type { FlexBubble, FlexMessage, LineMessage, QuickReply, Sender } from '../types';
import { LINE_GREEN } from '../types';

export interface MainMenuData {
  agentName: string;
  logoUrl?: string;
}

export function buildMainMenuCard(
  data: MainMenuData,
  sender: Sender | undefined,
  quickReply?: QuickReply,
): LineMessage {
  const menuButton = (emoji: string, label: string, messageText: string) => ({
    type: 'button' as const,
    action: { type: 'message' as const, label: `${emoji} ${label}`, text: messageText },
    style: 'secondary' as const,
    height: 'sm' as const,
  });

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    ...(data.logoUrl ? {
      hero: {
        type: 'image',
        url: data.logoUrl,
        size: 'full',
        aspectRatio: '20:7',
        aspectMode: 'cover',
      },
    } : {}),
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      spacing: 'md',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          alignItems: 'center',
          contents: [
            { type: 'text', text: '🌾', size: 'xxl', flex: 0 },
            {
              type: 'text',
              text: data.agentName,
              weight: 'bold',
              size: 'xl',
              color: LINE_GREEN,
              flex: 1,
              margin: 'sm',
              adjustMode: 'shrink-to-fit',
            },
          ],
        },
        { type: 'text', text: 'เลือกเรื่องที่ต้องการความช่วยเหลือ', size: 'sm', color: '#555555', wrap: true },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'sm',
      contents: [
        menuButton('🌿', 'วินิจฉัยโรคพืช', 'ต้องการวินิจฉัยโรคหรือแมลงศัตรูพืช'),
        menuButton('🌤', 'พยากรณ์อากาศเกษตร', 'ขอพยากรณ์อากาศสำหรับการเกษตร'),
        menuButton('📋', 'บันทึกกิจกรรมฟาร์ม', 'ต้องการบันทึกกิจกรรมฟาร์ม'),
        menuButton('📈', 'ราคาพืชผล', 'ขอข้อมูลราคาพืชผลและตลาด'),
      ],
    },
  };

  return {
    type: 'flex',
    altText: 'วาจา: เกษตร — เลือกหัวข้อที่ต้องการ',
    contents: bubble,
    ...(sender ? { sender } : {}),
    ...(quickReply ? { quickReply } : {}),
  } as LineMessage;
}
```

---

## Template 13 — Officer Broadcast Card

**File:** `features/line-oa/webhook/flex/broadcast.ts`  
**Trigger:** Extension officer sends broadcast via LINE OA control room for high-severity events  
**altText:** "📢 ประกาศจากเจ้าหน้าที่: " + title

```typescript
import type { FlexBubble, FlexMessage, LineMessage } from '../types';

export interface OfficerBroadcastData {
  title: string;           // e.g. "แจ้งเตือนการระบาดของหนอนกระทู้"
  area: string;            // e.g. "จ.เชียงใหม่, จ.ลำพูน"
  crop: string;            // e.g. "ข้าวโพด"
  severity: 'medium' | 'high';
  description: string;     // what is happening
  recommendedAction: string;
  officerName: string;
  officerTel?: string;
  issuedDate: string;      // e.g. "28 เม.ย. 2569"
}

export function buildOfficerBroadcastCard(data: OfficerBroadcastData): LineMessage {
  const severityColor = data.severity === 'high' ? '#D32F2F' : '#F57C00';
  const severityLabel = data.severity === 'high' ? '🔴 ด่วนมาก' : '🟡 ระดับปานกลาง';

  const bubble: FlexBubble = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: severityColor,
      paddingAll: '16px',
      contents: [
        { type: 'text', text: '📢 ประกาศจากเจ้าหน้าที่ส่งเสริมการเกษตร', size: 'xs', color: '#FFFFFF' },
        { type: 'text', text: data.title, weight: 'bold', color: '#FFFFFF', size: 'md', wrap: true, margin: 'sm' },
        { type: 'text', text: severityLabel, size: 'xs', color: '#FFFFFF', margin: 'sm' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      spacing: 'none',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'none',
          contents: [
            { type: 'text', text: 'พื้นที่', size: 'xs', color: '#888888', flex: 2 },
            { type: 'text', text: data.area, size: 'sm', color: '#333333', flex: 3, wrap: true, align: 'end' },
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: 'พืชที่ได้รับผล', size: 'xs', color: '#888888', flex: 2 },
            { type: 'text', text: data.crop, size: 'sm', color: '#333333', flex: 3, wrap: true, align: 'end' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box', layout: 'vertical', margin: 'md',
          contents: [
            { type: 'text', text: 'สถานการณ์', size: 'xs', color: '#888888', weight: 'bold' },
            { type: 'text', text: data.description, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          backgroundColor: '#E8F5E9',
          paddingAll: '12px',
          cornerRadius: '8px',
          contents: [
            { type: 'text', text: '✅ คำแนะนำ', size: 'xs', color: '#388E3C', weight: 'bold' },
            { type: 'text', text: data.recommendedAction, size: 'sm', color: '#333333', wrap: true, margin: 'sm' },
          ],
        },
        { type: 'separator', margin: 'md', color: '#EEEEEE' },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            { type: 'text', text: 'โดย', size: 'xs', color: '#888888', flex: 2 },
            { type: 'text', text: data.officerName, size: 'xs', color: '#333333', flex: 3, align: 'end' },
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'xs',
          contents: [
            { type: 'text', text: 'วันที่', size: 'xs', color: '#888888', flex: 2 },
            { type: 'text', text: data.issuedDate, size: 'xs', color: '#333333', flex: 3, align: 'end' },
          ],
        },
      ],
    },
    ...(data.officerTel ? {
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '12px',
        contents: [
          {
            type: 'button',
            action: { type: 'uri', label: `📞 โทรหาเจ้าหน้าที่ ${data.officerTel}`, uri: `tel:${data.officerTel}` },
            style: 'primary',
            color: severityColor,
            height: 'sm',
          },
        ],
      },
    } : {}),
  };

  return {
    type: 'flex',
    altText: `📢 ประกาศจากเจ้าหน้าที่: ${data.title} — ${data.area}`,
    contents: bubble,
  } as LineMessage;
}
```

---

## Dispatching Flex Cards from message.ts

After canonical agent run, parse the response and dispatch the correct builder:

```typescript
// features/line-oa/webhook/events/message.ts (excerpt — add after runAgentText returns)

import {
  buildDiagnosisCard,
  buildPhotoDiagnosisCard,
  buildSeverityAlert,
  buildWeatherRiskCard,
  buildForecastCarousel,
  buildFloodAlertCard,
  buildWeeklySummaryCard,
  buildMainMenuCard,
} from '../flex';
import { parseContract } from '../utils/parse-contract';

function dispatchAgentReply(
  agentReply: string,
  activeSkills: string[],
  context: {
    isPhoto: boolean;
    imageUrl?: string;
    observation?: string;
    weatherData?: WeatherRiskData;
    farmSummary?: FarmSummaryData;
    sender: Sender | undefined;
    quickReply?: QuickReply;
  },
): LineMessage[] {
  // Pest/disease path
  if (activeSkills.includes('pest-disease-consult')) {
    const f = parseContract(agentReply);
    const isThai = /[฀-๿]/.test(agentReply);
    const data = isThai ? {
      issue: f['ปัญหาที่น่าจะเป็น'] ?? '',
      confidence: f['ความมั่นใจ'] ?? '',
      severity: f['ระดับความรุนแรง'] ?? '',
      action: f['ควรทำทันที'] ?? '',
      prevention: f['ป้องกันรอบต่อไป'] ?? '',
      escalate: f['ควรติดต่อเจ้าหน้าที่ส่งเสริมเมื่อไร'] ?? '',
    } : {
      issue: f['Likely issue'] ?? '',
      confidence: f['Confidence'] ?? '',
      severity: f['Severity'] ?? '',
      action: f['Immediate action'] ?? '',
      prevention: f['Prevention'] ?? '',
      escalate: f['When to contact an extension officer'] ?? '',
    };

    const severity = parseSeverity(data.severity);
    if (severity === 'high') {
      return [buildSeverityAlert(data, '1170', context.sender, context.quickReply)];
    }
    if (context.isPhoto && context.imageUrl && context.observation) {
      return [buildPhotoDiagnosisCard({ ...data, imageUrl: context.imageUrl, observation: context.observation }, context.sender, context.quickReply)];
    }
    return [buildDiagnosisCard(data, context.sender, context.quickReply)];
  }

  // Weather path
  if (activeSkills.includes('weather-farm-risk') && context.weatherData) {
    if (context.weatherData.riskLevel === 'high') {
      return [buildFloodAlertCard({
        location: context.weatherData.location,
        eventDescription: context.weatherData.mainRisk,
        action: context.weatherData.action,
        watchOuts: context.weatherData.watchOuts,
      }, context.sender, context.quickReply)];
    }
    return [buildWeatherRiskCard(context.weatherData, context.sender, context.quickReply)];
  }

  // Farm record summary path
  if (activeSkills.includes('farm-record-keeper') && context.farmSummary) {
    return [buildWeeklySummaryCard(context.farmSummary, context.sender, context.quickReply)];
  }

  // Fallback — use existing bullet/plain reply
  return buildReplyMessages(agentReply, context.sender, context.quickReply);
}
```

---

## Quick Reference — Template List

| # | Template | File | Container | Priority |
|---|----------|------|-----------|----------|
| 1 | Diagnosis Result Card | `diagnosis.ts` | Bubble | P0 — demo required |
| 2 | Photo Diagnosis Card | `diagnosis.ts` | Bubble (hero) | P0 — demo required |
| 3 | Severity Alert Card | `diagnosis.ts` | Bubble | P0 — safety critical |
| 4 | Weather Risk Summary Card | `weather.ts` | Bubble | P0 — demo required |
| 5 | 7-Day Forecast Carousel | `weather.ts` | Carousel | P1 |
| 6 | Flood / Storm Alert Card | `weather.ts` | Bubble | P1 — safety |
| 7 | Log Confirmation Card | `records.ts` | Bubble | P1 |
| 8 | Record Entry Card | `records.ts` | Bubble | P2 |
| 9 | Weekly Summary Card | `records.ts` | Bubble | P1 |
| 10 | Price Check Card | `market.ts` | Bubble | P1 |
| 11 | Sell Decision Frame Card | `market.ts` | Bubble | P2 |
| 12 | Main Menu Card | `menu.ts` | Bubble | P1 |
| 13 | Officer Broadcast Card | `broadcast.ts` | Bubble | P1 |

P0 = committee demo requires this working  
P1 = farmer pilot quality  
P2 = nice to have for the submission video  

---

## Testing

Preview every template in the [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/) before wiring to the webhook. Copy the `bubble` or `carousel` JSON object (not the outer `FlexMessage` wrapper) into the simulator.

Type-check after adding each file:

```bash
pnpm exec tsc --noEmit
```
