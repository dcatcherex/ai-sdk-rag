# Skills System Upgrade Guide

Implementation guide for AI coders and developers working on the Vaja Skills Engine.
Covers all gaps found during the Agent Skills standard audit (2026-05-04).

---

## Implementation Progress

| Gap | Status | Completed |
|-----|--------|-----------|
| Gap 1 — LLM-based model discovery | ✅ Done | 2026-05-04 |
| Gap 2 — Slash at any message position | ✅ Done | 2026-05-04 |
| Gap 3 — Decouple discoveryMode from activationMode | ✅ Done | 2026-05-04 |
| Gap 4 — Token budget cap in catalog | ✅ Done | 2026-05-04 |
| Gap 5 — Thai resource file fallback | ✅ Done | 2026-05-04 |
| Gap 6 — Scripts execution runtime (Phase A) | ✅ Done | 2026-05-04 |
| Gap 7 — Activation feedback in chat UI | ✅ Done | 2026-05-04 |
| Gap 8 — Slash trigger collision detection | ✅ Done | 2026-05-04 |
| Gap 9 — Skill eval / benchmark tooling | ✅ Done | 2026-05-04 |

### DB Migration Note

Migration file `db/migrations/0063_skill_discovery_mode.sql` is ready.
Apply after resolving the existing migration ledger conflict (run `pnpm run db:reconcile-migrations` first, then `pnpm drizzle-kit migrate`).
The migration adds `discovery_mode` to `agent_skill` and `discovery_mode_override` to `agent_skill_attachment`,
and backfills existing `activation_mode = 'model'` rows to `discovery_mode = 'catalog'`.

---

## Background

The current skills system implements the 3-tier progressive disclosure model correctly
(catalog → active → resources) but has three critical gaps against the real-world standard:

1. Model discovery is a **lexical token scorer** — fails completely on Thai input
2. Slash triggers only fire at **message start** — users cannot write `/command` mid-sentence
3. `activationMode` is a **single either/or field** — a skill cannot be both model-discoverable and slash-triggerable

This guide covers all 9 gaps in priority order, with file paths, exact diffs, and DB migration steps.

---

## Gap 1 — LLM-Based Model Discovery (Critical)

### Why it matters

`tokenizeForSkillMatch` splits on `[^a-z0-9]+`. Thai script produces **zero tokens**, so
`selectModelDiscoveredSkills()` always returns an empty array for Thai messages.
The Agent Skills standard says the description "carries the entire burden" for triggering —
the intent is that the LLM reads descriptions and decides, not a regex scorer.

### Architecture

Add a **pre-routing step** before `streamText()`. Call a small fast model once per request
that has model-mode skills attached. It reads the catalog and returns which skill IDs to activate.

```
user message
    ↓
resolveAgentSkillRuntime()           ← existing, gets all skills + rule-triggered ones
    ↓
[NEW] runLlmSkillDiscovery()         ← one generateObject() call with flash-lite
    ↓
merge rule-triggered + llm-discovered
    ↓
buildActiveSkillsBlock()             ← existing, unchanged
```

### Implementation

**File: `features/skills/server/llm-discovery.ts`** (new file)

```typescript
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { Skill } from '../types';

const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENAI_API_KEY!,
});

const discoveryModel = openrouter('google/gemini-2.5-flash-lite');

const discoveryResultSchema = z.object({
  skillIds: z.array(z.string()),
});

export async function runLlmSkillDiscovery(
  modelModeSkills: Skill[],
  userMessage: string,
): Promise<Skill[]> {
  if (modelModeSkills.length === 0 || !userMessage.trim()) return [];

  const catalog = modelModeSkills
    .map((s) => `ID: ${s.id}\nName: ${s.name}\nDescription: ${s.description ?? s.promptFragment.slice(0, 200)}`)
    .join('\n\n');

  let result: { skillIds: string[] };
  try {
    const { object } = await generateObject({
      model: discoveryModel,
      schema: discoveryResultSchema,
      prompt: [
        'You are a skill router. Given a user message, return the IDs of skills that are relevant to it.',
        'Return [] if no skill is relevant. Never invent IDs. Only use IDs from the list below.',
        '',
        `User message: "${userMessage}"`,
        '',
        'Available skills:',
        catalog,
      ].join('\n'),
    });
    result = object;
  } catch {
    return [];
  }

  const validIds = new Set(modelModeSkills.map((s) => s.id));
  const activatedIds = result.skillIds.filter((id) => validIds.has(id)).slice(0, 3);
  return modelModeSkills.filter((s) => activatedIds.includes(s.id));
}
```

**File: `features/skills/server/activation.ts`** — replace `selectModelDiscoveredSkills`:

```typescript
// REMOVE the old synchronous selectModelDiscoveredSkills() export entirely.
// It is replaced by runLlmSkillDiscovery() which is async.
```

**File: `features/skills/server/activation.ts`** — update `resolveSkillRuntimeContext`:

```typescript
// Before (lexical):
const modelDiscovered = selectModelDiscoveredSkills(skills, userMessage);

// After (LLM-based):
const { runLlmSkillDiscovery } = await import('./llm-discovery');
const modelModeSkills = skills.filter((s) => s.activationMode === 'model');
const modelDiscovered = await runLlmSkillDiscovery(modelModeSkills, userMessage);
```

**Update `service.ts` exports** — remove `selectModelDiscoveredSkills` from the public export
in `features/skills/service.ts` since it is now internal.

### Cost profile

- One `generateObject` call per request that has ≥1 model-mode skill
- flash-lite: ~0.01–0.03 THB per call at typical catalog sizes
- Call is skipped entirely when the agent has no model-mode skills or message is empty
- Add a 200ms timeout with a `Promise.race` fallback to empty array if the router is slow

---

## Gap 2 — Slash at Any Message Position (High)

### Why it matters

`msg.startsWith(trigger)` means `/recipe ต้มยำ` works but `"ช่วย /recipe ต้มยำ"` does not.
Users naturally write slash commands mid-sentence, especially in Thai.

### Implementation

**File: `features/skills/server/activation.ts`**, `detectTriggeredSkills()`, line ~37:

```typescript
// BEFORE
if (skill.triggerType === 'slash') {
  const trigger = skill.trigger.startsWith('/') ? skill.trigger : `/${skill.trigger}`;
  return msg.startsWith(trigger) || msgLower.startsWith(trigger.toLowerCase());
}

// AFTER
if (skill.triggerType === 'slash') {
  const trigger = (skill.trigger.startsWith('/') ? skill.trigger : `/${skill.trigger}`)
    .toLowerCase();
  // Match /command at start, after whitespace, or after Thai/Unicode chars
  // Negative lookbehind prevents matching mid-word (e.g. "de/sign")
  const pattern = new RegExp(`(?:^|[\\s\\u0E00-\\u0E7F])${escapeRegex(trigger)}(?=[\\s\\u0E00-\\u0E7F]|$)`, 'i');
  return pattern.test(msg);
}
```

Add the helper at the bottom of the file:

```typescript
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

The Unicode range `฀-๿` covers the Thai block so Thai characters are treated the
same as whitespace for word-boundary purposes.

---

## Gap 3 — Decouple Discovery Mode from Trigger Type (High)

### Why it matters

`activationMode: 'rule' | 'model'` forces a choice. A skill set to `model` is excluded from
`detectTriggeredSkills()` entirely (line 30: `if (skill.activationMode === 'model') return false`).
This makes it impossible for one skill to be both auto-discovered AND slash-triggered.

### Schema change

**File: `db/schema/skills.ts`** — add a new column:

```typescript
// Add alongside existing activationMode column
discoveryMode: text('discovery_mode').notNull().default('hidden'),
// Values: 'catalog' (listed for LLM to discover) | 'hidden' (rule-only, not in catalog)
```

Run migration:
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### Type change

**File: `features/skills/types.ts`**:

```typescript
export type SkillDiscoveryMode = 'catalog' | 'hidden';

// Add to Skill type:
discoveryMode: SkillDiscoveryMode;

// Keep activationMode for backward compat during transition, mark deprecated:
/** @deprecated use discoveryMode. Will be removed after migration. */
activationMode: SkillActivationMode;
```

### Logic change

**File: `features/skills/server/activation.ts`**:

```typescript
// detectTriggeredSkills — remove the activationMode guard:
// BEFORE: if (skill.activationMode === 'model') return false;
// AFTER: no guard — all skills with a rule trigger are checked regardless of discovery mode

// buildAvailableSkillsCatalog — switch to discoveryMode:
// BEFORE: const catalogSkills = skills.filter((skill) => skill.activationMode === 'model');
// AFTER:  const catalogSkills = skills.filter((skill) => skill.discoveryMode === 'catalog');

// runLlmSkillDiscovery — switch filter:
// BEFORE: skills.filter((s) => s.activationMode === 'model')
// AFTER:  skills.filter((s) => s.discoveryMode === 'catalog')
```

### Migration mapping

When backfilling existing rows:

| Old `activationMode` | New `discoveryMode` | `triggerType` kept? |
|---|---|---|
| `rule` | `hidden` | yes — slash/keyword/always unchanged |
| `model` | `catalog` | yes — but now also fires on slash if set |

Write a one-time SQL backfill in the migration file:
```sql
UPDATE agent_skill SET discovery_mode = 'catalog' WHERE activation_mode = 'model';
UPDATE agent_skill SET discovery_mode = 'hidden'  WHERE activation_mode = 'rule';
```

### UI change

In the skill form dialog (`features/skills/components/skill-form-dialog.tsx`), replace the
single "Activation Mode" dropdown with two independent fields:

- **Discovery**: "Listed in catalog (model can auto-discover)" / "Hidden (rule-only)"
- **Trigger**: "Always" / "Slash command" / "Keyword" / "None"

Both fields are independent — any combination is valid.

---

## Gap 4 — Token Budget Cap in Catalog (Medium, Trivial)

### Why it matters

The standard specifies ~100 tokens per skill in the catalog tier. Vaja's
`buildAvailableSkillsCatalog()` currently slices `promptFragment` to 120 chars and uses it as
the description fallback — but `promptFragment` can be thousands of tokens long. A skill without
an explicit `description` field would blow the catalog budget.

### Implementation

**File: `features/skills/server/activation.ts`**, `buildAvailableSkillsCatalog()`:

```typescript
// BEFORE
`<description>${escapeXml(skill.description ?? skill.promptFragment.slice(0, 120))}</description>`

// AFTER — enforce hard 200-char cap, never use promptFragment in catalog
const catalogDescription = (skill.description ?? skill.name).slice(0, 200);
`<description>${escapeXml(catalogDescription)}</description>`
```

The `promptFragment` belongs only in `<active_skills>`, never in the catalog block.
If a skill has no description, surface a warning in the skill editor UI.

---

## Gap 5 — Resource File Scoring for Thai (Medium)

### Why it matters

`selectRelevantReferenceFiles()` in `features/skills/server/resources.ts:61` uses
`tokenizeForSkillMatch` — same Thai-blind scorer. Reference files are never selected for
Thai-language messages.

### Implementation (after Gap 1 is done)

Once LLM discovery is live, extend it to also select reference files.
Add an optional `fileNames` parameter to `runLlmSkillDiscovery`:

```typescript
// In llm-discovery.ts, extend the schema:
const discoveryResultSchema = z.object({
  skillIds: z.array(z.string()),
  resourcePaths: z.record(z.string(), z.array(z.string())).optional(),
  // e.g. { "skill-id-abc": ["references/api.md", "references/pricing.md"] }
});
```

When activated skills have bundled files, pass their `relativePath` list to the router
and let it pick which files are relevant. This replaces `selectRelevantReferenceFiles()`
for the Thai case.

As a quick interim fix (no LLM call needed): fall back to injecting the first 2 reference
files alphabetically when `messageTokens.size === 0`, so Thai messages always get some context:

```typescript
// In resources.ts, selectRelevantReferenceFiles():
if (messageTokens.size === 0) {
  // Thai or non-ASCII message — inject first 2 reference files as fallback
  return files
    .filter((f) => f.fileKind === 'reference' && isPromptInjectableFile(f))
    .slice(0, 2);
}
```

---

## Gap 6 — Scripts Execution Runtime (Medium, High Effort)

### Why it matters

Skills can bundle executable scripts (`scripts/` directory, `fileKind: 'script'`).
Currently `isPromptInjectableFile()` explicitly excludes scripts from injection — they are
collected but dead. A skill claiming data analysis or PDF generation won't work.

### Phase A — Script content injection (quick win)

Inject script content as a fenced code block inside `<active_skills>` so the LLM can
see it and use a code interpreter tool if one is available:

```typescript
// In activation.ts, buildActivatedSkill():
const scriptFiles = files.filter((f) => f.fileKind === 'script' && f.textContent);
const scriptBlock = scriptFiles.length > 0
  ? '\n\n**Bundled scripts** (you may run these via the code interpreter tool):\n'
    + scriptFiles.map((f) => `\`\`\`\n# ${f.relativePath}\n${f.textContent}\n\`\`\``).join('\n')
  : '';
// append scriptBlock to instructionContent
```

### Phase B — Sandboxed execution tool (full implementation)

Register a `run_skill_script` tool in `lib/tools/index.ts` that:
1. Accepts `skillId` + `scriptPath` + `args`
2. Reads the bundled script content from `agentSkillFile`
3. Executes it in a sandboxed subprocess (Docker or Node VM)
4. Returns stdout/stderr

This is a larger feature tracked separately. The tool should only be available when the
agent has a skill with bundled scripts attached.

---

## Gap 7 — Activation Feedback in Chat UI (Low-Medium)

### Why it matters

Users don't know which skills fired. The standard recommends surfacing active skills
so users can understand AI behavior.

### Implementation

**Server side** — `ChatMessageMetadata` already exists. Add activated skill names:

```typescript
// In features/chat/types.ts, extend ChatMessageMetadata:
activatedSkills?: Array<{ id: string; name: string; source: 'rule' | 'model' }>;
```

In `finalization.ts`, pass `skillRuntime.activatedSkills` into the metadata when saving.

**Client side** — In `components/message-renderer/`, render small pill badges below
the assistant message when `metadata.activatedSkills` is present:

```tsx
{metadata.activatedSkills?.map((skill) => (
  <span key={skill.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground border rounded-full px-2 py-0.5">
    <Zap className="w-3 h-3" />
    {skill.name}
    {skill.source === 'model' && <span className="opacity-60">(auto)</span>}
  </span>
))}
```

---

## Gap 8 — Slash Trigger Collision Detection (Low)

### Why it matters

Two skills attached to the same agent with identical slash triggers will both fire silently.
Users get unpredictable behavior with no warning.

### Implementation

**Server side** — In `detectTriggeredSkills()`, after collecting triggered skills, check for
collisions and log:

```typescript
const slashTriggered = triggered.filter((s) => s.triggerType === 'slash');
const seen = new Map<string, string>();
for (const skill of slashTriggered) {
  const key = skill.trigger?.toLowerCase() ?? '';
  if (seen.has(key)) {
    console.warn(`[skills] Slash trigger collision: "${key}" matches both "${seen.get(key)}" and "${skill.name}". Both will activate.`);
  } else {
    seen.set(key, skill.name);
  }
}
```

**Agent builder UI** — When adding a skill in `features/skills/components/skill-form-dialog.tsx`,
check existing attached skills for trigger conflicts and show an inline warning before saving.

---

## Gap 9 — Skill Eval / Benchmark Tooling (Strategic)

### Why it matters

The standard (docs 06–07) shows that reliable triggering requires systematic eval —
test cases of messages that should and should not activate a skill. Without this,
description quality is guesswork.

### DB schema

**File: `db/schema/skills.ts`** — add:

```typescript
export const skillEvalCase = pgTable('skill_eval_case', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull().references(() => agentSkill.id, { onDelete: 'cascade' }),
  message: text('message').notNull(),
  shouldActivate: boolean('should_activate').notNull(),
  label: text('label'),  // optional: "short query", "thai input", "negation"
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const skillEvalRun = pgTable('skill_eval_run', {
  id: text('id').primaryKey(),
  skillId: text('skill_id').notNull(),
  ranAt: timestamp('ran_at').notNull().defaultNow(),
  precision: real('precision'),
  recall: real('recall'),
  f1: real('f1'),
  results: jsonb('results'),  // per-case: { message, expected, actual, activationSource }
});
```

### API routes

```
POST /api/skills/[id]/eval/cases     — add a test case
GET  /api/skills/[id]/eval/cases     — list test cases
POST /api/skills/[id]/eval/run       — run all cases, save SkillEvalRun, return metrics
GET  /api/skills/[id]/eval/runs      — list past runs
```

The `/run` endpoint calls `resolveSkillRuntimeContext([skill], message)` for each case
and checks whether the skill appears in `activatedSkills`.

### UI

A "Test Skill" tab in the skill detail page. Shows a table of test cases, a "Run eval" button,
and a metrics panel (precision, recall, F1, pass/fail per case).

---

## Implementation Order

```
✅ Week 1 (2026-05-04)
  Gap 4  — token budget cap in catalog     DONE
  Gap 2  — slash at any position           DONE
  Gap 3  — decouple discoveryMode field    DONE (DB migration 0063 pending apply)
  Gap 8  — collision detection             DONE
  Gap 1  — LLM-based discovery             DONE (features/skills/server/llm-discovery.ts)
  Gap 5  — Thai resource file fallback     DONE

✅ All 9 gaps implemented (2026-05-04)

Remaining work (Phase B and beyond):
  Gap 6 Phase B — sandboxed script execution tool (Docker/Node VM, tracked separately)
  Gap 7 UI      — skill detail page "Test Skill" tab wiring to eval API
```

---

## Key Files Reference

| File | What to change |
|---|---|
| `features/skills/server/activation.ts` | Gaps 1, 2, 3, 4, 8 |
| `features/skills/server/llm-discovery.ts` | Gap 1 (new file) |
| `features/skills/server/resources.ts` | Gap 5 |
| `features/skills/server/shared.ts` | Gap 2 (escapeRegex helper) |
| `features/skills/types.ts` | Gap 3 (SkillDiscoveryMode type) |
| `features/skills/service.ts` | Gap 1 (remove selectModelDiscoveredSkills export) |
| `features/skills/components/skill-form-dialog.tsx` | Gap 3 (UI), Gap 8 (conflict warning) |
| `features/agents/server/runtime.ts` | Gap 1 (resolveAgentSkillRuntime) |
| `db/schema/skills.ts` | Gap 3 (discoveryMode column), Gap 9 (eval tables) |
| `components/message-renderer/` | Gap 7 (skill badge UI) |
| `features/chat/types.ts` | Gap 7 (activatedSkills in metadata) |
| `app/api/skills/[id]/eval/` | Gap 9 (eval API routes, new directory) |

---

## Testing Checklist

**Gap 2 (slash position)** — ✅ implemented
- [ ] `/recipe ต้มยำ` — activates at start
- [ ] `ช่วย /recipe ต้มยำ` — activates mid-sentence
- [ ] `de/sign a logo` — does NOT activate (not a word boundary)

**Gap 3 (decouple modes)** — ✅ implemented, migration pending
- [ ] Skill with `discoveryMode: catalog` + `triggerType: slash` fires on both LLM discovery and `/command`
- [ ] Skill with `discoveryMode: hidden` + `triggerType: slash` does NOT appear in catalog but fires on `/command`
- [ ] Existing skills migrated correctly (backfill verified via SELECT after migration 0063 is applied)

**Gap 1 (LLM discovery)** — ✅ implemented
- [ ] Thai message `"ช่วยเขียนบทความ"` activates content-writing skill
- [ ] Message with no relevant skill returns empty array, no extra latency beyond timeout
- [ ] LLM router times out after 3 s and falls back gracefully to rule-triggered only

**Gap 4 (token budget)** — ✅ implemented
- [ ] Skill with no `description` field uses `name` in catalog, not `promptFragment`
- [ ] Catalog block stays under 2,000 tokens for 10 attached skills

**Gap 5 (Thai resource fallback)** — ✅ implemented
- [ ] Thai message with no tokens (`messageTokens.size === 0`) still gets first 2 reference files injected

**Gap 6 (script injection Phase A)** — ✅ implemented
- [ ] Skill with bundled `scripts/` files shows `**Bundled scripts**` block inside `<active_skills>`
- [ ] Script content visible to LLM, `isPromptInjectableFile` bypassed via `buildActivatedSkill`

**Gap 7 (activation badges)** — ✅ implemented
- [ ] Assistant message with activated skills shows small pill badges below content
- [ ] Auto-discovered skills show `(auto)` suffix
- [ ] `activatedSkills` array present in `ChatMessageMetadata` and persisted with message

**Gap 8 (collision detection)** — ✅ implemented
- [ ] Two skills with same `/command` trigger → console.warn logged, both activate

**Gap 9 (eval API)** — ✅ implemented
- [ ] `POST /api/skills/[id]/eval/cases` — add a test case
- [ ] `GET  /api/skills/[id]/eval/cases` — list test cases
- [ ] `POST /api/skills/[id]/eval/run`   — run all cases, compute precision/recall/F1
- [ ] `GET  /api/skills/[id]/eval/runs`  — list past runs
- [ ] DB migration `0064_skill_eval_tables.sql` ready to apply
