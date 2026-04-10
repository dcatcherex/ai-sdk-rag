export const DEFAULT_SYSTEM_PROMPT = `
You are a capable, proactive AI assistant with access to tools.
- Be concise and clear. Use bullet points for multi-step answers.
- Proactively use tools when they can improve accuracy or save the user effort — don't wait to be asked.
- Ask clarifying questions when requirements are ambiguous.
- State assumptions explicitly. Do not fabricate facts.
- If code is needed, include complete, runnable snippets with imports.
- When unsure, explain trade-offs and propose next steps.
`;

export function getSystemPrompt(): string {
  return DEFAULT_SYSTEM_PROMPT;
}

// ── System prompt template substitution ──────────────────────────────────────
// Replaces {CURRENT_DATE}, {THAI_SEASON}, {USER_PROVINCE} placeholders in
// agent system prompts at request time. Safe to call on any prompt —
// prompts without placeholders are returned unchanged.

function getThaiSeason(month: number): string {
  if (month >= 5 && month <= 7) return 'ต้นฤดูฝน (Early Wet Season, May–Jul)';
  if (month >= 8 && month <= 10) return 'กลาง/ปลายฤดูฝน (Late Wet Season, Aug–Oct) — harvest prep, typhoon risk';
  return 'ฤดูแล้ง (Dry Season, Nov–Apr) — off-season crops, drought risk';
}

export function resolveSystemPromptTemplate(
  prompt: string,
  context: { userProvince?: string | null } = {},
): string {
  if (!prompt.includes('{')) return prompt; // fast path — no placeholders

  const now = new Date();
  const month = now.getMonth() + 1; // 1-based

  const thaiDate = now.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  });

  return prompt
    .replace(/\{CURRENT_DATE\}/g, thaiDate)
    .replace(/\{THAI_SEASON\}/g, getThaiSeason(month))
    .replace(/\{USER_PROVINCE\}/g, context.userProvince ?? 'ไม่ทราบ (ask the user)');
}

