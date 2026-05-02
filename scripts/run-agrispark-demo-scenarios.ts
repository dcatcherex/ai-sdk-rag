import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { eq } from 'drizzle-orm';

import { AGRISPARK_TEMPLATES } from '@/features/line-oa/flex/seeds/agrispark-templates';

const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve('server-only');
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
  children: [],
  paths: [],
} as unknown as NodeJS.Module;

const AGRISPARK_AGENT_ID = 'agrispark-farm-assistant-001';
const DEFAULT_MODEL_ID = 'google/gemini-2.5-flash-lite';
const OUTPUT_PATH = 'docs/contest/agrispark-demo-evidence-generated.md';

type Scenario = {
  id: string;
  title: string;
  inputType: 'text' | 'photo-derived' | 'voice-derived' | 'manual';
  runtimeUserText?: string;
  displayInput: string;
  note?: string;
  expectedHeadings?: string[];
  shouldStayThai?: boolean;
};

type ScenarioCheck = {
  label: string;
  passed: boolean;
  detail: string;
};

const DIAGNOSIS_HEADINGS = [
  'ปัญหาที่น่าจะเป็น:',
  'ความมั่นใจ:',
  'ระดับความรุนแรง:',
  'ควรทำทันที:',
  'ป้องกันรอบต่อไป:',
  'ควรติดต่อเจ้าหน้าที่ส่งเสริมเมื่อไร:',
];

const WEATHER_HEADINGS = [
  'ความเสี่ยงหลัก:',
  'ช่วงเวลา:',
  'ควรทำทันที:',
  'จุดที่ต้องเฝ้าระวัง:',
];

const RECORD_SUMMARY_HEADINGS = [
  'สรุปสัปดาห์นี้:',
  'งานที่ทำ:',
  'ค่าใช้จ่ายหรือผลผลิตที่บันทึก:',
  'สิ่งที่ควรทำต่อ:',
];

const SCENARIOS: Scenario[] = [
  {
    id: 'text-diagnosis',
    title: 'Text Diagnosis',
    inputType: 'text',
    runtimeUserText:
      'ใบมะเขือเทศเป็นจุดสีน้ำตาล ขอบใบเหลือง ช่วงนี้ฝนตกบ่อย ช่วยดูหน่อยครับ',
    displayInput:
      'ใบมะเขือเทศเป็นจุดสีน้ำตาล ขอบใบเหลือง ช่วงนี้ฝนตกบ่อย ช่วยดูหน่อยครับ',
    expectedHeadings: DIAGNOSIS_HEADINGS,
    shouldStayThai: true,
  },
  {
    id: 'photo-diagnosis',
    title: 'Photo Diagnosis',
    inputType: 'photo-derived',
    runtimeUserText: [
      '[Farmer sent photo]',
      'Observation: Tomato leaves show multiple brown circular lesions with yellowing around the edges.',
      'Damage appears heavier on older leaves and wet conditions may be contributing to spread.',
      'Please help using the normal Farm Advisor workflow.',
      'Respond in Thai using the standard diagnosis headings.',
    ].join('\n'),
    displayInput:
      'Simulated LINE photo case using the same derived-observation pattern as the production webhook.',
    note:
      'This scenario simulates the canonical LINE photo flow after image observation is derived.',
    expectedHeadings: DIAGNOSIS_HEADINGS,
    shouldStayThai: true,
  },
  {
    id: 'voice-farm-log',
    title: 'Voice Farm Log',
    inputType: 'voice-derived',
    runtimeUserText:
      'วันนี้ใส่ปุ๋ยยูเรีย 50 กิโล ข้าวหอมมะลิ ที่นาแปลงหลังบ้าน ช่วยบันทึกให้หน่อย',
    displayInput:
      'Transcript: วันนี้ใส่ปุ๋ยยูเรีย 50 กิโล ข้าวหอมมะลิ ที่นาแปลงหลังบ้าน ช่วยบันทึกให้หน่อย',
    note: 'This scenario simulates the canonical LINE voice flow after transcription.',
    shouldStayThai: true,
  },
  {
    id: 'weather-risk',
    title: 'Weather Risk',
    inputType: 'text',
    runtimeUserText:
      'สัปดาห์นี้เชียงใหม่ฝนจะหนักไหม ถ้าจะเก็บลำไยควรระวังอะไรบ้าง',
    displayInput:
      'สัปดาห์นี้เชียงใหม่ฝนจะหนักไหม ถ้าจะเก็บลำไยควรระวังอะไรบ้าง',
    expectedHeadings: WEATHER_HEADINGS,
    shouldStayThai: true,
  },
  {
    id: 'record-summary',
    title: 'Record Summary',
    inputType: 'text',
    runtimeUserText: 'สรุปบันทึกฟาร์มสัปดาห์นี้ให้หน่อย',
    displayInput: 'สรุปบันทึกฟาร์มสัปดาห์นี้ให้หน่อย',
    note:
      'If there are no records yet, a graceful no-records answer is acceptable for this run.',
    expectedHeadings: RECORD_SUMMARY_HEADINGS,
    shouldStayThai: true,
  },
  {
    id: 'officer-broadcast',
    title: 'Officer Broadcast',
    inputType: 'manual',
    displayInput: 'Manual control-room scenario',
    note:
      'This is a manual scenario. The generated block below provides a suggested reviewed broadcast message.',
    shouldStayThai: true,
  },
  {
    id: 'flex-template-gallery',
    title: 'Flex Template Gallery',
    inputType: 'manual',
    displayInput: 'Admin Flex Templates gallery',
    note:
      'Committee demo backup: show the Admin Panel > Flex Templates page and open each published AgriSpark template preview.',
    shouldStayThai: false,
  },
];

function renderManualBroadcastTemplate(): string {
  return [
    'แจ้งเตือนจากทีมเกษตรในพื้นที่',
    '',
    'ช่วง 3-7 วันนี้มีความเสี่ยงฝนต่อเนื่องและความชื้นสูง',
    'เกษตรกรที่ปลูกพืชอ่อนแอต่อโรคใบไหม้หรือเชื้อราควรเข้าตรวจแปลงเร็วขึ้น',
    '',
    'สิ่งที่ควรทำทันที:',
    '- ตรวจใบและโคนต้นในแปลงที่อับชื้น',
    '- ระบายน้ำและลดน้ำขัง',
    '- หากต้องใช้สารป้องกันโรคพืช ให้ทำตามฉลากและสวมอุปกรณ์ป้องกัน',
    '',
    'หากอาการลามเร็วหรือไม่แน่ใจ ขอให้ติดต่อเจ้าหน้าที่ส่งเสริมการเกษตรในพื้นที่',
  ].join('\n');
}

function renderManualFlexTemplateCatalog(): string {
  return [
    'Published AgriSpark Flex templates to show in the committee demo:',
    '',
    ...AGRISPARK_TEMPLATES.map((template, index) =>
      `${index + 1}. ${template.name} - category: ${template.category}; tags: ${template.tags.join(', ')}`),
  ].join('\n');
}

function containsLikelyUnexpectedEnglish(text: string): boolean {
  const englishWordCount = (text.match(/[A-Za-z]{3,}/g) ?? []).length;
  return englishWordCount >= 8;
}

function analyzeTranscript(scenario: Scenario, transcript: string): ScenarioCheck[] {
  const checks: ScenarioCheck[] = [];

  if (scenario.expectedHeadings?.length) {
    const missing = scenario.expectedHeadings.filter(
      (heading) => !transcript.includes(heading),
    );

    checks.push({
      label: 'required-headings',
      passed: missing.length === 0,
      detail:
        missing.length === 0
          ? 'All expected headings were present.'
          : `Missing headings: ${missing.join(', ')}`,
    });
  }

  if (scenario.shouldStayThai) {
    const hasUnexpectedEnglish = containsLikelyUnexpectedEnglish(transcript);
    checks.push({
      label: 'thai-output',
      passed: !hasUnexpectedEnglish,
      detail: hasUnexpectedEnglish
        ? 'Transcript contains a large amount of English text.'
        : 'Transcript stayed primarily in Thai.',
    });
  }

  if (scenario.id === 'record-summary') {
    const askedProvince = /province|จังหวัด/i.test(transcript);
    checks.push({
      label: 'no-province-detour',
      passed: !askedProvince,
      detail: askedProvince
        ? 'Transcript asked for province even though this is a record summary.'
        : 'Transcript did not ask for province.',
    });
  }

  return checks;
}

async function resolveAgentOwner(agentId: string): Promise<string> {
  const [{ db }, { agent: agentTable }] = await Promise.all([
    import('@/lib/db'),
    import('@/db/schema'),
  ]);

  const [row] = await db
    .select({ id: agentTable.id, userId: agentTable.userId })
    .from(agentTable)
    .where(eq(agentTable.id, agentId))
    .limit(1);

  if (!row?.userId) {
    throw new Error(`Agent ${agentId} was not found or has no owner userId.`);
  }

  return row.userId;
}

async function runScenario(agentOwnerUserId: string, scenario: Scenario): Promise<string> {
  const [{ LINE_AGENT_RUN_POLICY }, { runAgent }] = await Promise.all([
    import('@/features/agents/server/channel-policies'),
    import('@/features/agents/server/run-service'),
  ]);

  if (scenario.inputType === 'manual') {
    if (scenario.id === 'flex-template-gallery') {
      return renderManualFlexTemplateCatalog();
    }

    return renderManualBroadcastTemplate();
  }

  const result = await runAgent({
    identity: {
      channel: 'line',
      userId: agentOwnerUserId,
      billingUserId: agentOwnerUserId,
      lineUserId: 'agrispark-demo-runner',
      isOwner: true,
    },
    threadId: `agrispark-demo-${scenario.id}`,
    agentId: AGRISPARK_AGENT_ID,
    model: DEFAULT_MODEL_ID,
    messages: [
      {
        role: 'user',
        content: scenario.runtimeUserText ?? '',
      },
    ],
    policy: LINE_AGENT_RUN_POLICY,
    channelContext: {
      memoryContext: '',
      extraBlocks: [],
    },
  });

  if (result.type !== 'text') {
    throw new Error(`Scenario ${scenario.id} returned ${result.type}, expected text.`);
  }

  return result.text.trim();
}

function renderMarkdown(
  results: Array<{
    scenario: Scenario;
    transcript: string;
    checks: ScenarioCheck[];
  }>,
): string {
  const lines: string[] = [
    '# AgriSpark Demo Evidence - Generated Transcript Pack',
    '',
    `Generated at: ${new Date().toISOString()}`,
    `Agent ID: ${AGRISPARK_AGENT_ID}`,
    `Model: ${DEFAULT_MODEL_ID}`,
    '',
    'Notes:',
    '',
    '- This file is generated by `scripts/run-agrispark-demo-scenarios.ts`.',
    '- Text, photo, and voice scenarios use the canonical Farm Advisor run path.',
    '- Photo and voice cases are simulated using the same derived-text shapes used by the LINE webhook.',
    '- QA checks below are heuristic and intended to catch obvious response-contract drift.',
    '',
  ];

  for (const entry of results) {
    lines.push(`## ${entry.scenario.title}`);
    lines.push('');
    lines.push(`Scenario ID: \`${entry.scenario.id}\``);
    lines.push(`Input type: \`${entry.scenario.inputType}\``);
    if (entry.scenario.note) {
      lines.push(`Note: ${entry.scenario.note}`);
    }
    lines.push('');
    lines.push('Input:');
    lines.push('');
    lines.push('```text');
    lines.push(entry.scenario.displayInput);
    lines.push('```');
    lines.push('');
    if (entry.checks.length > 0) {
      lines.push('QA checks:');
      lines.push('');
      for (const check of entry.checks) {
        const status = check.passed ? 'PASS' : 'FAIL';
        lines.push(`- ${status} \`${check.label}\`: ${check.detail}`);
      }
      lines.push('');
    }
    lines.push('Transcript:');
    lines.push('');
    lines.push('```text');
    lines.push(entry.transcript || '(empty response)');
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const ownerUserId = await resolveAgentOwner(AGRISPARK_AGENT_ID);
  const results: Array<{
    scenario: Scenario;
    transcript: string;
    checks: ScenarioCheck[];
  }> = [];

  for (const scenario of SCENARIOS) {
    console.log(`Running scenario: ${scenario.id}`);
    const transcript = await runScenario(ownerUserId, scenario);
    const checks = analyzeTranscript(scenario, transcript);
    results.push({ scenario, transcript, checks });
  }

  const markdown = renderMarkdown(results);
  await writeFile(OUTPUT_PATH, markdown, 'utf8');

  console.log(`Generated ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
