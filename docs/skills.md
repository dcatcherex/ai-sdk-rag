# Skills Feature — Implementation Reference

This document covers the full architecture, data model, API contract, UI components, and chat-route integration for the Skills feature. It is intended for developers who need to maintain, extend, or debug any part of the skill system.

---

## Overview

A **Skill** is a reusable, self-contained prompt behavior that can be attached to an agent. When the agent is active in a chat session, skills whose trigger matches the user's message are automatically detected and their instruction fragment is injected into the system prompt. Skills can also unlock additional tool IDs at runtime.

Key capabilities:
- **CRUD management** — users create, edit, and delete their own skills
- **Three trigger modes** — `always` (always injected), `slash` (e.g. `/email`), `keyword` (substring match)
- **Agent attachment** — skills are attached to agents via `agent.skillIds[]`
- **Runtime injection** — triggered skill `promptFragment` is appended to the system prompt as an `<active_skills>` block
- **Tool unlocking** — a skill can specify additional `enabledTools[]` that are merged into the request's tool set
- **Import from GitHub** — users paste a GitHub URL to a `SKILL.md` file; the app fetches, parses, and saves the skill
- **Community gallery** — skills marked `isPublic` appear in a community tab; other users can install (clone) them

---

## File Structure

```
features/skills/
  types.ts                          ← All shared TypeScript types (client-safe, no DB imports)
  service.ts                        ← All server-side DB logic + trigger detection
  hooks/
    use-skills.ts                   ← TanStack Query hooks for CRUD + import + install
  components/
    skill-form-dialog.tsx           ← Create / edit skill dialog
    skills-list.tsx                 ← Main page component (My Skills + Community tabs)

app/api/skills/
  route.ts                          ← GET (list) + POST (create)
  [id]/
    route.ts                        ← PUT (update) + DELETE
    install/
      route.ts                      ← POST (install a community skill → clone to own library)
  import/
    route.ts                        ← POST (import from GitHub URL)

app/(main)/skills/
  page.tsx                          ← Thin page entry; renders <SkillsList />

db/schema.ts                        ← agentSkill table definition + agentSkillRelations
                                       agent table: skillIds text[] column added

scripts/migrate-agent-skills.ts     ← One-time migration script (already run)
```

---

## Data Model

### `agentSkill` table (`db/schema.ts`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PK | nanoid |
| `user_id` | `text` FK → `user.id` | owner; CASCADE delete |
| `name` | `text` | display name (max 100 chars) |
| `description` | `text` nullable | short summary (max 300 chars) |
| `trigger_type` | `text` | `'slash'` \| `'keyword'` \| `'always'` |
| `trigger` | `text` nullable | the slash command or keyword; `null` when `trigger_type = 'always'` |
| `prompt_fragment` | `text` | injected into system prompt when triggered |
| `enabled_tools` | `text[]` | additional tool IDs unlocked when this skill is active |
| `source_url` | `text` nullable | original GitHub URL if imported |
| `is_public` | `boolean` | `false` by default; `true` = visible in community gallery |
| `created_at` | `timestamp` | auto |
| `updated_at` | `timestamp` | auto-updated on change |

Index: `agent_skill_userId_idx` on `user_id`.

### `agent` table changes

```sql
ALTER TABLE agent
ADD COLUMN IF NOT EXISTS skill_ids text[] NOT NULL DEFAULT '{}'::text[]
```

`skill_ids` is an array of `agentSkill.id` values. The agent "owns" the skills in the sense that only skills belonging to the same user (or installed from community) can be meaningfully attached.

---

## TypeScript Types (`features/skills/types.ts`)

```typescript
export type SkillTriggerType = 'slash' | 'keyword' | 'always';

export type Skill = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  triggerType: SkillTriggerType;
  trigger: string | null;       // null when triggerType === 'always'
  promptFragment: string;
  enabledTools: string[];
  sourceUrl: string | null;
  isPublic: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type CreateSkillInput = { ... };   // subset of Skill fields
export type UpdateSkillInput = Partial<CreateSkillInput>;
export type SkillWithOwner = Skill & { ownerName?: string };
```

---

## Service Layer (`features/skills/service.ts`)

All DB logic lives here. **Never duplicate this logic in API routes or components.**

### CRUD functions

| Function | Description |
|----------|-------------|
| `getSkills(userId)` | Returns own skills + public skills from other users (deduped) |
| `getSkillsByIds(skillIds[])` | Bulk fetch by ID array — used by chat route |
| `createSkill(userId, data)` | Insert new skill, returns full `Skill` |
| `updateSkill(userId, skillId, data)` | Update own skill (ownership enforced via `AND user_id = userId`) |
| `deleteSkill(userId, skillId)` | Delete own skill |
| `installSkill(userId, skillId)` | Clone a public skill into the caller's library (new row, `is_public = false`) |

### Import from GitHub

```typescript
importSkillFromUrl(userId: string, rawUrl: string): Promise<Skill>
```

**Flow:**
1. `toRawUrl(url)` — converts `github.com/.../blob/...` → `raw.githubusercontent.com/.../...`
2. `fetch(rawUrl)` — downloads the `SKILL.md` file
3. `parseSkillMd(markdown)` — extracts YAML frontmatter (`name`, `description`) + body as `promptFragment`
4. `createSkill(userId, {...})` — saves to DB with `sourceUrl = original URL`, `triggerType = 'always'` (user can edit later), `isPublic = false`

**SKILL.md format expected:**
```markdown
---
name: My Skill
description: What this skill does and when to use it.
---

## Instructions

You are now in [mode]. When the user asks...
```

Only `name` and `description` are read from frontmatter. The entire body becomes `promptFragment`.

### Trigger detection

```typescript
detectTriggeredSkills(skills: Skill[], userMessage: string): Skill[]
```

Called inside the chat route with the agent's attached skills and the last user message.

| `triggerType` | Match condition |
|---------------|----------------|
| `always` | Always included — no message comparison |
| `slash` | `userMessage` starts with `/trigger` (case-insensitive). Leading `/` is auto-normalised on save. |
| `keyword` | `userMessage.toLowerCase().includes(trigger.toLowerCase())` |

Returns the subset of `skills` that match. An empty array means no skill injection occurs.

---

## API Routes

All routes require an authenticated session (`auth.api.getSession`). They validate input with Zod before calling the service.

### `GET /api/skills`
Returns `Skill[]` — own skills + public community skills (deduped).

### `POST /api/skills`
Body: `CreateSkillInput`. Returns created `Skill` with status 201.

Required fields: `name`, `triggerType`, `promptFragment`.
If `triggerType !== 'always'`, `trigger` should be provided.

### `PUT /api/skills/:id`
Body: `UpdateSkillInput` (all fields optional). Returns updated `Skill`.
Returns 404 if not found or not owned by caller.

### `DELETE /api/skills/:id`
Returns `{ success: true }` or 404.

### `POST /api/skills/:id/install`
No body. Clones the skill (must be `isPublic = true`) into the caller's library.
Returns the new cloned `Skill` with status 201, or 404 if skill not found / not public.

### `POST /api/skills/import`
Body: `{ url: string }` — must be a GitHub URL.

**Security:** Only `github.com` and `raw.githubusercontent.com` URLs are accepted. Any other domain returns 400.

Returns the created `Skill` with status 201, or 422 on fetch/parse failure.

---

## TanStack Query Hooks (`features/skills/hooks/use-skills.ts`)

| Hook | Method | Endpoint |
|------|--------|----------|
| `useSkills()` | `GET` | `/api/skills` |
| `useCreateSkill()` | `POST` | `/api/skills` |
| `useUpdateSkill()` | `PUT` | `/api/skills/:id` |
| `useDeleteSkill()` | `DELETE` | `/api/skills/:id` |
| `useImportSkill()` | `POST` | `/api/skills/import` |
| `useInstallSkill()` | `POST` | `/api/skills/:id/install` |

All mutations call `queryClient.invalidateQueries({ queryKey: ['skills'] })` on success to keep the cache fresh.

---

## UI Components

### `SkillFormDialog` (`features/skills/components/skill-form-dialog.tsx`)

Client component. Props:

```typescript
{
  open: boolean;
  skill?: Skill | null;       // null = create mode, populated = edit mode
  onClose: () => void;
  onSubmit: (data: CreateSkillInput) => void;
  isPending?: boolean;
}
```

Fields: name, description, trigger type (Select), trigger (conditional on type ≠ always), promptFragment (Textarea), isPublic (Switch).

Validation: submit is disabled unless `name`, `promptFragment`, and `trigger` (when required) are non-empty.

### `SkillsList` (`features/skills/components/skills-list.tsx`)

Main page component. Renders two tabs:
- **My Skills** — own skills, with edit and delete actions
- **Community** — public skills from other users, with Install action

Also contains:
- **Import from GitHub** dialog — text input for URL, calls `useImportSkill`
- **Delete confirmation** dialog
- `SkillGrid` — inner presentational component rendering the skill cards

### Agent Form Dialog — Skills Section

`features/agents/components/agent-form-dialog.tsx` was extended to include a Skills section.

- Calls `useSkills()` to load the user's skill library
- Renders a scrollable checklist of skills with trigger label badge
- Checked skill IDs are included in `CreateAgentInput.skillIds`
- On agent save, `skillIds` is sent to `POST /api/agents` or `PUT /api/agents/:id`

---

## Chat Route Integration (`app/api/chat/route.ts`)

Skills are loaded and detected in **Stage 2** of the chat pipeline.

### Stage 2 — after loading the active agent:

```typescript
// Load skills attached to the active agent
const agentSkillRows: Skill[] =
  activeAgent?.skillIds?.length
    ? await getSkillsByIds(activeAgent.skillIds)
    : [];

// Detect which skills are triggered by the last user message
const triggeredSkills = agentSkillRows.length > 0 && lastUserPrompt
  ? detectTriggeredSkills(agentSkillRows, lastUserPrompt)
  : [];

// Tool IDs unlocked by triggered skills
const skillToolIds = [...new Set(triggeredSkills.flatMap((s) => s.enabledTools))];
```

### Tool ID merging (before `buildToolSet`):

```typescript
const baseToolIds = activeAgent
  ? activeAgent.enabledTools
  : (userPrefs.enabledToolIds ?? null);

// Skill tools are merged in — agent base tools take priority in dedup
const activeToolIds = skillToolIds.length > 0
  ? [...new Set([...(baseToolIds ?? []), ...skillToolIds])]
  : baseToolIds;
```

### System prompt injection:

```typescript
const skillBlock = triggeredSkills.length > 0
  ? '\n\n<active_skills>\n' +
    triggeredSkills
      .map((s) => `## Skill: ${s.name}\n${s.promptFragment}`)
      .join('\n\n') +
    '\n</active_skills>'
  : '';
```

`skillBlock` is appended to `groundedSystemPrompt` after `brandBlock`. The model receives the triggered skill instructions inside an `<active_skills>` XML block so it's clearly scoped.

### Injection order in system prompt:

```
[agent / persona base prompt]
[RAG grounding instruction — if documents selected]
[memory context]
[brand context block]
<active_skills>
## Skill: Email Drafter
[promptFragment]

## Skill: Formal Tone
[promptFragment]
</active_skills>
```

---

## Trigger Normalisation Rules

On save, `normaliseTrigger()` enforces:

| `triggerType` | Stored `trigger` value |
|---------------|------------------------|
| `always` | `null` |
| `slash` | Always starts with `/` — auto-prepended if missing |
| `keyword` | Stored as-is (trimmed) |

Matching is case-insensitive for both slash and keyword.

---

## Security Considerations

| Risk | Mitigation |
|------|-----------|
| Prompt injection via malicious skill content | Skills can only be created by authenticated users; `promptFragment` is stored verbatim. Review community skill content before installing. |
| Skills accessing other users' data | `getSkillsByIds` fetches by PK only — no cross-user data leakage; tool calls are always scoped to `userId` |
| Malicious GitHub imports | `POST /api/skills/import` only allows `github.com` / `raw.githubusercontent.com` domains |
| Community skill spoofing | Installed skills are **cloned** (new row owned by installer) — the original can change without affecting installed copies |
| Skill bloat in system prompt | Each `promptFragment` is injected at runtime; keep fragments concise (<500 tokens per skill recommended) |

---

## How to Extend

### Add a new trigger type

1. Add the value to `SkillTriggerType` in `features/skills/types.ts`
2. Add match logic in `detectTriggeredSkills()` in `features/skills/service.ts`
3. Add a `SelectItem` in `SkillFormDialog` trigger type selector
4. Update Zod schema in `app/api/skills/route.ts` to accept the new value
5. Add a label in `TRIGGER_LABELS` in `features/skills/components/skills-list.tsx`

### Add skill-level tool definitions

Currently `enabledTools` contains tool IDs from the existing registry. To let a skill define a *custom* inline tool:
1. Extend `agentSkill` with a `toolDefinitions jsonb` column
2. In the chat route, after detecting triggered skills, parse and register inline tool definitions before calling `streamText`

### Add skill versioning / changelog

Skills are append-only by user edit. For versioned skills (e.g. community gallery versions):
1. Add a `version integer` column to `agentSkill`
2. Store installed skills with a `sourceSkillId` reference for update-checking
3. Expose a "Check for updates" action in the community tab

### Support `.skill` file upload (zip format)

The `.skill` format (from Claude Code's skill system) is a zip file containing `SKILL.md` + optional `references/`, `scripts/`, `assets/` directories.

To support upload:
1. Add `POST /api/skills/upload` accepting `multipart/form-data`
2. Use a zip library (e.g. `jszip` or `adm-zip`) to extract `SKILL.md`
3. Parse with the existing `parseSkillMd()` helper in `service.ts`
4. Optionally store reference files in R2 and link them in the skill record

---

## Common Maintenance Tasks

### A user reports a skill is not triggering

1. Check `agentSkill.trigger_type` and `trigger` in the DB for that skill
2. Check `agent.skill_ids` includes the skill's ID
3. In the chat route, add a log after `detectTriggeredSkills` to inspect the match result
4. Verify the user's message actually starts with the slash command / contains the keyword

### A skill import fails

The `POST /api/skills/import` route returns the raw error message as the response body on 422. Common causes:
- URL is not a raw GitHub URL to a file (redirects won't work)
- The file doesn't exist (404 from GitHub)
- SKILL.md has malformed frontmatter (missing `---` delimiters)

### Deleting a skill that is attached to agents

`deleteSkill()` removes the `agentSkill` row. The agent's `skill_ids` array still contains the deleted ID — it becomes a dead reference.

**Current behaviour:** `getSkillsByIds` simply returns no row for the missing ID, so no error occurs and the skill is silently skipped during chat.

**To clean up:** run a periodic job or a one-time script that removes dead skill IDs from `agent.skill_ids`:

```sql
UPDATE agent
SET skill_ids = ARRAY(
  SELECT unnest(skill_ids)
  INTERSECT
  SELECT id FROM agent_skill
);
```

---

## Related Features

| Feature | Relationship |
|---------|-------------|
| **Agents** | Skills are attached to agents via `agent.skillIds`. Skills only activate when an agent is selected in chat. |
| **Brands** | Brand context and skill context are both injected into the system prompt; brand block comes first. |
| **Tools** | Skills can unlock additional tool IDs at runtime by populating `enabledTools`. |
| **Knowledge Base** | Skills do not directly interact with RAG — but a skill can instruct the model to call `searchKnowledge` in its `promptFragment`. |
