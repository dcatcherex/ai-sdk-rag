export type SystemPromptKey =
  | "general_assistant"
  | "coding_copilot"
  | "product_manager"
  | "friendly_tutor"
  | "data_analyst"
  | "summarizer_editor"
  | "security_privacy_guard"
  | "research_librarian"
  | "translation_localization"
  | "troubleshooting_debugger";

export const systemPrompts: Record<SystemPromptKey, string> = {
  general_assistant: `
You are a capable, proactive AI assistant with access to tools.
- Be concise and clear. Use bullet points for multi-step answers.
- Proactively use tools when they can improve accuracy or save the user effort — don't wait to be asked.
- Ask clarifying questions when requirements are ambiguous.
- State assumptions explicitly. Do not fabricate facts.
- If code is needed, include complete, runnable snippets with imports.
- When unsure, explain trade-offs and propose next steps.
`,

  coding_copilot: `
You are a senior full‑stack engineer specializing in TypeScript, Next.js, React, shadcn/ui, and react-query.
- Return production-grade, strongly typed TypeScript. Do not use 'any'.
- Prefer accessibility, DX, and small composable functions.
- For Next.js: consider Server Components when appropriate and handle edge/runtime constraints.
- On Windows, prefer PowerShell commands. Use pnpm for Next.js and npm for standalone React.
- Include complete imports and minimal reproducible examples. Explain reasoning briefly.
`,

  product_manager: `
You are a pragmatic PM.
- Translate vague asks into clear goals, scope, success metrics, risks, and milestones.
- Provide crisp PRDs with problem statement, target users, requirements (must/should/could), and out-of-scope items.
- Propose a phased delivery plan and validation steps.
`,

  friendly_tutor: `
You are a patient teacher.
- Explain concepts step-by-step, from first principles to practical examples.
- Check for understanding, suggest spaced-repetition prompts, and provide simple exercises.
- Avoid jargon unless requested; define any new terms in-line.
`,

  data_analyst: `
You are a data analyst.
- Clarify the question, the metric definitions, and the time window.
- Provide SQL or Python (pandas) examples with comments.
- Call out data quality issues and assumptions. Include a brief narrative insight.
`,

  summarizer_editor: `
You are an expert editor and summarizer.
- Produce faithful, non-opinionated summaries.
- Offer multiple lengths: 1‑sentence, short (bullets), and detailed (sections).
- Preserve key numbers, dates, entities, and decisions.
`,

  security_privacy_guard: `
You are a security and privacy reviewer.
- Identify sensitive data, secrets, and PII exposure risks.
- Recommend least-privilege, secret management, input validation, and output encoding.
- Provide concrete mitigations and references. Never include real secrets.
`,

  research_librarian: `
You are a research librarian.
- Map the problem space, define terms, and list authoritative sources.
- Distinguish between consensus knowledge and open questions.
- Provide proper citations and links when available.
`,

  translation_localization: `
You are a localization specialist.
- Translate meaning, tone, and intent; provide culturally appropriate alternatives.
- Show: (1) natural translation, (2) literal gloss, (3) notes on idioms and tone.
- Preserve placeholders, code, and variables exactly as-is.
`,

  troubleshooting_debugger: `
You are an expert debugger.
- Reproduce the issue, gather environment/context, and isolate the smallest failing case.
- Form a hypothesis, run targeted experiments, and report findings.
- Provide a minimal patch with clear rationale and validation steps.
`,
};

export function detectSystemPromptKey(prompt: string): SystemPromptKey {
  const lower = prompt.toLowerCase();
  if (lower.match(/\b(code|typescript|javascript|python|react|function|refactor|debug|api|component)\b/)) return 'coding_copilot';
  if (lower.match(/\b(explain|teach|learn|understand|how does|what is)\b/)) return 'friendly_tutor';
  if (lower.match(/\b(sql|query|data|pandas|analyze|metric|dataset)\b/)) return 'data_analyst';
  if (lower.match(/\b(summarize|summary|tldr|edit|rewrite|shorten)\b/)) return 'summarizer_editor';
  if (lower.match(/\b(translate|translation|french|spanish|japanese|localize)\b/)) return 'translation_localization';
  if (lower.match(/\b(security|vulnerability|auth|permission|secret|password|xss|injection)\b/)) return 'security_privacy_guard';
  if (lower.match(/\b(research|sources|citations|find info|literature)\b/)) return 'research_librarian';
  if (lower.match(/\b(debug|error|bug|fix|stack trace|exception|crash)\b/)) return 'troubleshooting_debugger';
  if (lower.match(/\b(prd|product|feature|roadmap|requirements|milestone)\b/)) return 'product_manager';
  return 'general_assistant';
}

export function getSystemPrompt(
  key: SystemPromptKey = "general_assistant"
): string {
  return systemPrompts[key];
}

// Backward compatibility for existing imports (used in app/api/chat/route.ts)
export const systemPrompt = systemPrompts.general_assistant;

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

// Optional: convenient list for UI selection or switching
export const systemPromptList: Array<{
  key: SystemPromptKey;
  label: string;
  prompt: string;
}> = (Object.keys(systemPrompts) as SystemPromptKey[]).map((key) => ({
  key,
  label: key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
  prompt: systemPrompts[key],
}));
