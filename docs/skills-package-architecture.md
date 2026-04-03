# Skills Package Architecture — Implementation Plan

> **Audience:** AI coders and developers maintaining or extending the Skills feature.
> **Status:** Proposed architecture for package-based, sync-aware skills.
> **Scope:** Extend the current `agentSkill` prompt-fragment system into a full Agent Skills package integration without breaking existing agents.

---

## 1. Why this document exists

The repo already ships a useful v1 Skills system:

- `features/skills/service.ts` stores reusable skills as user-owned DB rows
- `app/api/skills/import/route.ts` imports a remote `SKILL.md`
- `features/agents/components/agent-form.tsx` lets agents attach skills
- `app/api/chat/route.ts` injects triggered skill instructions into the prompt

That v1 is good for inline prompt snippets, but it does **not** fully support the open Agent Skills package model documented under `documents/agent-skill/`:

- a skill is a **directory**, not just a single markdown file
- the model should use **progressive disclosure**
- skills may include `references/`, `assets/`, and `scripts/`
- imports should be **syncable** and **auditable**

This document defines a repo-specific path from the current implementation to a package-aware architecture that works well with:

- `skills.sh`
- GitHub-hosted skill folders such as `vercel-labs/agent-skills/web-design-guidelines`
- future zip or uploaded packages
- existing user-authored inline skills

---

## 2. Goals and non-goals

## Goals

- Support importing a **skill package directory**, not only a raw `SKILL.md`
- Preserve the current user-facing concept of a **skill library** attached to agents
- Add **sync metadata** so installed skills can check for upstream updates
- Support **progressive disclosure** at runtime:
  - catalog first
  - full `SKILL.md` on activation
  - additional files on demand
- Keep existing agents working during migration
- Keep implementation aligned with the current modular schema layout under `db/schema/*`

## Non-goals for the first implementation

- Arbitrary unsandboxed execution of imported scripts
- Full bi-directional sync back to GitHub
- Cross-user deduplicated global package storage
- Org-wide skill governance or approval flows

---

## 3. Current state summary

## Current storage model

Today `db/schema/agents.ts` defines `agentSkill` as a user-owned row with:

- `name`
- `description`
- `triggerType`
- `trigger`
- `promptFragment`
- `enabledTools`
- `sourceUrl`
- `isPublic`

Agents store attached skills in `agent.skillIds: text[]`.

## Current runtime model

At chat time, the app:

- loads the attached skills
- matches `always`, `slash`, or `keyword`
- appends the matching `promptFragment` values to the system prompt

## Primary limitations

- imported packages are flattened into one prompt string
- packaged files are discarded
- `agent.skillIds[]` cannot store attachment-level settings
- there is no concept of upstream version, sync status, or local overrides
- runtime activation is rule-based only; it does not follow the catalog → activation → resource-loading model described in `documents/agent-skill/09-Adding-skills-support.md`

---

## 4. Core design decisions

## Decision 1: keep `agentSkill` as the user-owned installed skill

Do **not** replace `agentSkill` with a completely different concept immediately.

Instead, treat `agentSkill` as the installed skill record in the user’s library:

- inline skills stay supported
- imported package skills become richer installed skills
- existing CRUD routes remain mostly valid

This minimizes churn in:

- `features/skills/service.ts`
- `features/skills/hooks/use-skills.ts`
- `features/agents/components/agent-form.tsx`
- `app/api/skills/*`

## Decision 2: add package metadata and files around `agentSkill`

Instead of storing only a flattened prompt, add related tables for:

- canonical upstream source metadata
- packaged files
- per-agent attachment configuration
- sync events

## Decision 3: migrate away from `agent.skillIds[]` to an attachment table

`agent.skillIds[]` is too limited for package-based skills.

Each agent-skill attachment will eventually need its own settings:

- enabled/disabled
- activation mode override
- trigger override
- priority
- optional per-agent notes

Use a join table instead of an array column.

## Decision 4: keep runtime compatibility during migration

For an initial migration window:

- keep `agent.skillIds[]`
- add the new attachment table
- dual-read during chat
- backfill existing attachments
- remove or deprecate `agent.skillIds[]` only after UI and APIs are fully switched

---

## 5. Target data model

## 5.1 Schema placement

Because the repo now uses feature-based schema modules under `db/schema/*`, the new tables should live in a dedicated module:

- **new:** `db/schema/skills.ts`

And then be re-exported from:

- `db/schema.ts`

The existing `agentSkill` table can either:

- move into `db/schema/skills.ts`, or
- stay in `db/schema/agents.ts` for the first migration and move later

**Recommendation:** move all skill-related tables into `db/schema/skills.ts` once the package work starts, while keeping `@/db/schema` as the stable import surface.

## 5.2 Tables

### `skill_source`

Represents the canonical external origin of an imported package.

Suggested columns:

- `id` `text` PK
- `sourceType` `text`
  - `'github_subdir' | 'github_file' | 'skills_registry' | 'upload' | 'inline'`
- `canonicalUrl` `text`
- `repoOwner` `text`
- `repoName` `text`
- `repoRef` `text`
- `subdirPath` `text`
- `registrySlug` `text`
- `defaultEntryPath` `text` default `'SKILL.md'`
- `createdAt` `timestamp`
- `updatedAt` `timestamp`

Notes:

- `inline` is allowed so purely local skills can still fit the new type system.
- `repoRef` is the configured tracking ref, such as `main`.
- `canonicalUrl` should be normalized so `skills.sh` and GitHub URLs resolve to the same source identity when appropriate.

### `agent_skill`

Keep the table as the installed skill row, but extend it.

Existing columns to retain:

- `id`
- `userId`
- `name`
- `description`
- `triggerType`
- `trigger`
- `promptFragment`
- `enabledTools`
- `sourceUrl`
- `isPublic`
- timestamps

New columns to add:

- `skillKind` `text` not null default `'inline'`
  - `'inline' | 'package'`
- `activationMode` `text` not null default `'rule'`
  - `'rule' | 'model'`
- `sourceId` `text` FK → `skill_source.id`
- `entryFilePath` `text` not null default `'SKILL.md'`
- `installedRef` `text`
- `installedCommitSha` `text`
- `upstreamCommitSha` `text`
- `syncStatus` `text` not null default `'local'`
  - `'local' | 'synced' | 'update_available' | 'diverged' | 'error'`
- `pinnedToInstalledVersion` `boolean` not null default `false`
- `hasBundledFiles` `boolean` not null default `false`
- `packageManifest` `jsonb`
- `lastSyncCheckedAt` `timestamp`
- `lastSyncedAt` `timestamp`

Notes:

- `promptFragment` remains useful as the parsed body of `SKILL.md` for fast fallback and backward compatibility.
- `packageManifest` can store lightweight parsed metadata, diagnostics, and counts without loading every file.

### `agent_skill_file`

Stores the snapshot of packaged files for an installed skill.

Suggested columns:

- `id` `text` PK
- `skillId` `text` FK → `agent_skill.id` cascade delete
- `relativePath` `text`
- `fileKind` `text`
  - `'skill' | 'reference' | 'asset' | 'script' | 'other'`
- `mediaType` `text`
- `storageMode` `text`
  - `'inline_text' | 'blob'`
- `textContent` `text`
- `blobPath` `text`
- `sizeBytes` `integer`
- `checksum` `text`
- `createdAt` `timestamp`
- `updatedAt` `timestamp`

Indexes:

- unique `(skillId, relativePath)`
- index on `skillId`
- index on `fileKind`

Notes:

- Store markdown and small text references inline in Postgres first.
- Only move binary assets to blob storage if needed later.
- For phase 1, imported `scripts/` are stored but not executed.

### `agent_skill_attachment`

Replaces `agent.skillIds[]` over time.

Suggested columns:

- `id` `text` PK
- `agentId` `text` FK → `agent.id` cascade delete
- `skillId` `text` FK → `agent_skill.id` cascade delete
- `isEnabled` `boolean` not null default `true`
- `activationModeOverride` `text`
  - nullable override for `'rule' | 'model'`
- `triggerTypeOverride` `text`
- `triggerOverride` `text`
- `priority` `integer` not null default `0`
- `notes` `text`
- `createdAt` `timestamp`
- `updatedAt` `timestamp`

Constraint:

- unique `(agentId, skillId)`

Why this matters:

- the same installed skill can behave differently on different agents
- attachment metadata should not be forced into the global library row

### `agent_skill_sync_event`

Optional but recommended for auditability.

Suggested columns:

- `id` `text` PK
- `skillId` `text` FK → `agent_skill.id` cascade delete
- `eventType` `text`
  - `'imported' | 'check_succeeded' | 'check_failed' | 'updated' | 'pinned' | 'unpinned'`
- `fromCommitSha` `text`
- `toCommitSha` `text`
- `summary` `text`
- `createdAt` `timestamp`

This table is useful for the UI timeline and debugging sync issues.

---

## 6. TypeScript model changes

## 6.1 Split summary, detail, and attachment types

`features/skills/types.ts` should grow from a single flat `Skill` type into layered types.

Suggested types:

```ts
export type SkillKind = 'inline' | 'package';
export type SkillActivationMode = 'rule' | 'model';
export type SkillSyncStatus = 'local' | 'synced' | 'update_available' | 'diverged' | 'error';
export type SkillFileKind = 'skill' | 'reference' | 'asset' | 'script' | 'other';

export type SkillSummary = {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  skillKind: SkillKind;
  activationMode: SkillActivationMode;
  triggerType: SkillTriggerType;
  trigger: string | null;
  sourceUrl: string | null;
  syncStatus: SkillSyncStatus;
  hasBundledFiles: boolean;
  fileCounts: {
    references: number;
    assets: number;
    scripts: number;
  };
  isPublic: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type SkillFile = {
  id: string;
  relativePath: string;
  fileKind: SkillFileKind;
  mediaType: string | null;
  sizeBytes: number | null;
  textContent?: string;
};

export type SkillDetail = SkillSummary & {
  promptFragment: string;
  entryFilePath: string;
  installedCommitSha: string | null;
  upstreamCommitSha: string | null;
  pinnedToInstalledVersion: boolean;
  packageManifest: Record<string, unknown> | null;
  files: SkillFile[];
};
```

## 6.2 Keep create/update compatibility

Keep the current inline-skill API working:

- `CreateSkillInput`
- `UpdateSkillInput`

Add new inputs for package flows:

- `ImportSkillPackageInput`
- `SyncSkillInput`
- `AttachSkillInput`
- `UpdateSkillAttachmentInput`

---

## 7. Backend service architecture

The current `features/skills/service.ts` is a good starting point, but package support will make it too large if everything stays in one file.

Recommended split:

```text
features/skills/
  types.ts
  service.ts                      # thin re-export / facade only
  server/
    queries.ts                    # getSkills, getSkillDetail, attachments
    mutations.ts                  # create/update/delete inline skills
    importer.ts                   # GitHub / registry import orchestration
    parser.ts                     # parse SKILL.md, normalize metadata
    package-fetcher.ts            # fetch directory listings + file contents
    sync.ts                       # check/apply update flows
    activation.ts                 # rule-based and model-based activation
    resources.ts                  # resolve referenced files for runtime
```

## 7.1 `importer.ts`

Responsibilities:

- normalize incoming URL
- resolve `skills.sh` URL to canonical GitHub package identity
- fetch `SKILL.md`
- fetch additional allowed files from the package directory
- parse and validate frontmatter
- create or reuse `skill_source`
- create installed `agent_skill`
- store `agent_skill_file` rows
- store sync metadata and initial sync event

## 7.2 `package-fetcher.ts`

Responsibilities:

- support GitHub tree/subdir import
- convert page URLs into GitHub API or raw-content fetch plan
- enumerate package contents relative to the selected skill folder
- enforce allow/deny rules:
  - allow `SKILL.md`
  - allow `references/**`
  - allow `assets/**`
  - allow `scripts/**`
  - ignore `.git/`, `node_modules/`, large binaries, hidden junk
- cap package size and file count

Recommended limits for phase 1:

- max files: 50
- max total text bytes: 1 MB
- max single inline text file: 128 KB
- reject files outside the skill root

## 7.3 `activation.ts`

Responsibilities:

- load attached skills for the active agent
- apply attachment overrides
- separate into:
  - rule-driven skills
  - model-discoverable skills
- build the compact skill catalog
- select activations
- resolve additional resources when instructions reference them

This module should become the canonical runtime skill engine used by `app/api/chat/route.ts`.

---

## 8. API design

## 8.1 Keep existing routes, broaden semantics

### `GET /api/skills`

Return `SkillSummary[]`.

New response fields should include:

- `skillKind`
- `activationMode`
- `syncStatus`
- `hasBundledFiles`
- `fileCounts`

### `POST /api/skills`

Keep this as the inline skill creation route.

This remains the fastest path for manually-authored prompt skills.

### `PUT /api/skills/:id`

Allow editing of user-owned metadata:

- `name`
- `description`
- trigger fields
- activation mode
- `isPublic`
- maybe inline `promptFragment`

For package skills, do **not** let this route silently overwrite imported files. Use separate endpoints for package content updates.

## 8.2 Add detail and package routes

### `GET /api/skills/:id`

Returns `SkillDetail` including file metadata and sync info.

### `POST /api/skills/import`

Broaden current behavior.

Accepted inputs:

- GitHub repo subdirectory URL
- GitHub file URL to `SKILL.md`
- `skills.sh` page URL
- later: uploaded archive metadata

Recommended request body:

```json
{
  "url": "https://github.com/vercel-labs/agent-skills/tree/main/web-design-guidelines",
  "installMode": "snapshot"
}
```

Recommended behavior:

- normalize to canonical source
- import the full skill directory
- store package snapshot
- return `SkillDetail`

### `POST /api/skills/:id/sync/check`

Checks whether the upstream changed.

Response example:

```json
{
  "status": "update_available",
  "installedCommitSha": "abc123",
  "upstreamCommitSha": "def456",
  "changedFiles": [
    "SKILL.md",
    "references/checklist.md"
  ]
}
```

### `POST /api/skills/:id/sync/apply`

Applies an update after explicit user confirmation.

Recommended behavior:

- fetch upstream package snapshot
- compute changed files
- replace stored package files
- update `promptFragment`, `installedCommitSha`, `syncStatus`
- append `agent_skill_sync_event`

### `GET /api/skills/:id/files`

Returns file metadata only.

### `GET /api/skills/:id/files/content?path=references/foo.md`

Returns file content for the viewer.

This is better than returning all file contents on list endpoints.

## 8.3 Add attachment routes

### `GET /api/agents/:id/skills`

Returns the resolved agent-skill attachment list.

### `PUT /api/agents/:id/skills`

Bulk replace attachments.

Recommended payload:

```json
{
  "attachments": [
    {
      "skillId": "skill_123",
      "isEnabled": true,
      "activationModeOverride": "model",
      "triggerTypeOverride": null,
      "triggerOverride": null,
      "priority": 0,
      "notes": null
    }
  ]
}
```

This route should become the long-term replacement for writing `agent.skillIds[]`.

---

## 9. Frontend architecture

## 9.1 Skills library page

File to evolve:

- `features/skills/components/skills-list.tsx`

Recommended UX additions:

- keep **My skills** and **Community** tabs
- show richer cards for package skills:
  - source badge
  - sync badge
  - file counts
  - bundled resources badge
- add a **detail drawer** or page for:
  - `SKILL.md` preview
  - references list
  - scripts list
  - sync info
  - update actions

### Import flow

Replace the current simple GitHub URL dialog with a two-step flow:

1. paste URL
2. preview import result
   - detected skill name
   - source repo
   - included files
   - warnings
3. confirm install

This makes package import feel trustworthy.

## 9.2 Agent editor integration

Files to evolve:

- `features/agents/components/agent-form.tsx`
- `features/agents/components/agent-knowledge-section.tsx`

Recommended changes:

- show a more informative skills picker
- let users attach installed skills with per-agent overrides
- expose activation mode per attachment:
  - `Rule-based`
  - `Model-discovered`
- show package indicators such as:
  - `Imported`
  - `Needs update`
  - `Has references`
  - `Has scripts`

Once `agent_skill_attachment` exists, the form should save attachments through a dedicated agent-skills API instead of writing only `skillIds[]`.

## 9.3 Community install UX

Current community behavior clones a public skill into the user library.

Keep that model, but when the source skill is a package:

- clone the package snapshot too
- preserve source metadata
- if the package was originally imported from GitHub, keep that source linkage
- mark the installed clone as unpinned by default unless product wants a fixed snapshot

---

## 10. Runtime activation model

## 10.1 Preserve rule-based activation for v1 compatibility

Continue supporting:

- `always`
- `slash`
- `keyword`

These are simple, product-friendly, and already wired into the UI.

## 10.2 Add model-discovered activation for package skills

Introduce a new concept:

- `activationMode = 'model'`

For skills in this mode, the runtime should follow progressive disclosure:

### Stage A: expose a compact catalog

Inject only metadata for attached package skills:

```xml
<available_skills>
  <skill>
    <name>web-design-guidelines</name>
    <description>Review UI code for web interface guideline compliance.</description>
  </skill>
</available_skills>
```

### Stage B: decide which skill to activate

Recommended phase 1 implementation:

- do **not** add a second model call yet
- use a deterministic shortlist step based on description similarity and obvious lexical matching
- if exactly one strong candidate exists, activate it
- if multiple candidates remain, optionally fall back to a cheap classifier model step later

Recommended phase 2 implementation:

- introduce a small activation selection step using a low-cost model
- return selected skill names and reasons

### Stage C: load full instructions

For activated skills, load:

- parsed `promptFragment`
- structured metadata from `packageManifest`
- optionally a short resource list

### Stage D: resolve referenced files on demand

If the activated `SKILL.md` references bundled files, load only the specific files needed.

Examples:

- `references/checklist.md`
- `assets/template.html`
- `scripts/analyze.ts`

## 10.3 Prompt assembly

`app/api/chat/route.ts` should stop treating all skills as identical prompt fragments.

Target prompt structure:

```text
[agent base prompt]
[grounding / memory / brand blocks]
[available skills catalog for model-discovered skills]
[active rule-based skill instructions]
[activated package skill instructions]
[resolved supporting resources if needed]
```

## 10.4 Tool handling

Keep `enabledTools` at the skill level for now.

For activated package skills:

- merge `enabledTools` exactly as the current route does
- do not infer new executable tools from imported `scripts/`
- scripts remain informational until a safe execution model exists

---

## 11. Sync model

## 11.1 Install semantics

Imports should create a **snapshot** of upstream content in the user’s library.

This is important because:

- agent behavior should remain stable
- upstream changes should not silently change production behavior
- users need an audit trail

## 11.2 Check semantics

A sync check compares:

- `installedCommitSha`
- latest upstream commit affecting the skill folder

Possible outcomes:

- `synced`
- `update_available`
- `error`
- `diverged` for future local-edit support

## 11.3 Apply semantics

Updates should be **manual**.

Recommended UX:

- user clicks `Check for updates`
- app shows changed files
- user reviews
- user clicks `Apply update`

Do not silently live-sync imported packages attached to active agents.

---

## 12. Security model

## 12.1 Import boundaries

Continue restricting remote import to trusted source families initially:

- `github.com`
- `raw.githubusercontent.com`
- `skills.sh` resolved to GitHub

## 12.2 File filtering

On import:

- reject path traversal
- ignore unsupported giant binaries
- cap size and file count
- store scripts as data, not executable actions

## 12.3 Runtime boundaries

Package files should only affect model behavior through:

- prompt injection
- file previews in the UI
- explicitly approved future script runners

No automatic execution of imported scripts in phase 1.

---

## 13. Migration strategy

## Phase 1: package-aware import without breaking current skills

Changes:

- add `skill_source`
- add `agent_skill_file`
- extend `agent_skill`
- broaden `POST /api/skills/import`
- keep `agent.skillIds[]`
- keep current chat injection behavior

Outcome:

- imported skills can carry files and sync metadata
- no agent migration required yet

## Phase 2: add attachment table and dual-read

Changes:

- add `agent_skill_attachment`
- backfill from `agent.skillIds[]`
- update agent editor to save attachments
- chat route reads attachments first, then falls back to `skillIds[]`

Outcome:

- per-agent activation overrides become possible

## Phase 3: progressive disclosure runtime

Changes:

- introduce `activationMode = 'model'`
- add skill catalog injection
- add package-resource loading helpers
- convert chat route to use `features/skills/server/activation.ts`

Outcome:

- imported package skills work as intended instead of as flat prompt fragments

## Phase 4: optional safe script execution

Changes:

- define a sandboxed or adapter-based execution model
- require explicit trust boundaries
- map scripts to approved runtime capabilities

Outcome:

- advanced package skills can become truly operational, not just instructive

---

## 14. Concrete file-by-file implementation map

## Database

- **new:** `db/schema/skills.ts`
- **update:** `db/schema.ts`
- **migration:** add new tables and columns

## API

- **update:** `app/api/skills/route.ts`
- **update:** `app/api/skills/import/route.ts`
- **new:** `app/api/skills/[id]/route.ts` detail enrichment if needed
- **new:** `app/api/skills/[id]/sync/check/route.ts`
- **new:** `app/api/skills/[id]/sync/apply/route.ts`
- **new:** `app/api/skills/[id]/files/route.ts`
- **new:** `app/api/skills/[id]/files/content/route.ts`
- **new:** `app/api/agents/[id]/skills/route.ts`

## Feature layer

- **update:** `features/skills/types.ts`
- **refactor:** `features/skills/service.ts`
- **new:** `features/skills/server/queries.ts`
- **new:** `features/skills/server/mutations.ts`
- **new:** `features/skills/server/importer.ts`
- **new:** `features/skills/server/parser.ts`
- **new:** `features/skills/server/package-fetcher.ts`
- **new:** `features/skills/server/sync.ts`
- **new:** `features/skills/server/activation.ts`
- **new:** `features/skills/server/resources.ts`

## Hooks and UI

- **update:** `features/skills/hooks/use-skills.ts`
- **update:** `features/skills/components/skills-list.tsx`
- **new:** `features/skills/components/skill-detail-panel.tsx`
- **new:** `features/skills/components/import-skill-package-dialog.tsx`
- **update:** `features/agents/components/agent-form.tsx`
- **update:** `features/agents/components/agent-knowledge-section.tsx`

## Chat runtime

- **update:** `app/api/chat/route.ts`

---

## 15. Recommended first implementation slice

If only one slice is implemented next, it should be:

1. add `skill_source`, `agent_skill_file`, and new `agent_skill` package columns
2. broaden `POST /api/skills/import` to import GitHub subdirectories
3. store package files alongside the installed skill
4. add a skill detail view showing bundled files and sync info

This delivers the most visible product value quickly:

- users can install popular community skills cleanly
- the app preserves more than `SKILL.md`
- future sync and progressive disclosure become possible

---

## 16. Open questions to resolve before coding

- Should `skills.sh` URLs be stored as canonical sources, or should everything normalize to GitHub?
- Should package imports be allowed to become public community skills immediately, or only after manual review?
- Should local edits to imported `SKILL.md` be allowed in phase 1, or should imported packages remain read-only snapshots?
- Should activation mode default to `rule` for imported skills, or to `model` when no explicit trigger exists?
- Do we want one skill detail route that returns files lazily, or multiple resource-specific routes from the start?

---

## 17. Final recommendation

For this repo, the best path is **not** a full rewrite.

The best path is to:

- preserve `agentSkill` as the installed library record
- add package-aware tables and sync metadata
- migrate from `agent.skillIds[]` to `agent_skill_attachment`
- evolve the chat runtime toward progressive disclosure
- keep script execution out of scope until a safe sandbox exists

That gives `agent-first` strong interoperability with the open Agent Skills ecosystem while preserving the good parts of the current product UX.
