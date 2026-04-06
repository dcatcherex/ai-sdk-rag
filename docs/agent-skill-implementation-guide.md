# Agent Skill Implementation Guide

> **Audience:** AI coders and developers extending the Skills and Agents system.
> **Status:** Working implementation guide for future development.
> **Scope:** Describes the current repo state, the intended Agent Skills model, and the recommended roadmap for completing the package-first architecture.

---

## 1. Mission

Build the repo toward a standard Agent Skills model without breaking existing agents.

Target end state:

- skills are package-first
- `SKILL.md` is the canonical entry file
- bundled files are preserved and editable
- agent-skill linkage is attachment-first
- runtime uses progressive disclosure
- imported skills can be synced safely

Use alongside:

- `docs/skills.md`
- `docs/skills-package-architecture.md`
- `documents/agent-skill/03-Specification.md`
- `documents/agent-skill/09-Adding-skills-support.md`

---

## 2. Current baseline

Already implemented:

- package-aware schema in `db/schema/skills.ts`
- package-first creation in `features/skills/service.ts`
- GitHub package import in `features/skills/server/package-import.ts`
- bundled file storage in `agent_skill_file`
- agent attachment storage in `agent_skill_attachment`
- read endpoints for skill file metadata and content
- agent editor support for attachment-based skill configuration

Not complete yet:

- package file editing for existing skills
- runtime progressive disclosure
- upstream sync lifecycle
- full removal of legacy `agent.skillIds` compatibility

## Phase progress

- Phase 1: in progress
- Phase 2: not started
- Phase 3: not started
- Phase 4: not started
- Phase 5: not started

---

## 3. Do not break

These are hard rules.

- **[name format]** skill names must remain lowercase slug format with numbers and hyphens only
- **[entry file]** `SKILL.md` remains the default package entry file
- **[attachment authority]** `agent_skill_attachment` is the real per-agent attachment model
- **[compatibility]** `agent.skillIds` is compatibility-only until explicitly removed
- **[path safety]** file paths must be normalized and must never escape the package root
- **[import exclusions]** `.git` and `node_modules` must stay excluded
- **[ownership]** skill detail and file endpoints must enforce access checks
- **[installation]** public skill install must clone into the caller’s library
- **[scripts]** bundled scripts must never execute automatically

---

## 4. Execution order

Implement in this order:

1. stabilize current package-first foundation
2. add package file editing
3. move runtime to progressive disclosure
4. add sync check/apply
5. remove legacy compatibility paths

Do not start later phases until the previous phase is stable.

---

## 5. Phase 1 - Stabilize the package-first foundation

## Goal

Make the current package creation/import path safe, testable, and easier to extend.

## Checklist

- [x] split `features/skills/service.ts` into smaller server modules
- [x] centralize `SKILL.md` parsing and generation helpers
- [x] document and normalize `packageManifest`
- [x] add tests for path normalization, file kind inference, and package creation
- [x] verify file detail rendering when `textContent` is null

## Progress update

Completed in this phase:

- `features/skills/service.ts` is now a thin facade over focused server modules:
  - `features/skills/server/queries.ts`
  - `features/skills/server/attachments.ts`
  - `features/skills/server/mutations.ts`
  - `features/skills/server/runtime.ts`
- `SKILL.md` parsing and generation are centralized in `features/skills/server/parser.ts`
- package path normalization, file-kind inference, media-type inference, and manifest generation are centralized in `features/skills/server/package-manifest.ts`
- package skill file preparation is centralized in `features/skills/server/package-files.ts`
- focused tests were added in:
  - `features/skills/server/package-manifest.test.ts`
  - `features/skills/server/parser.test.ts`
- skill detail rendering now shows an explicit fallback when a bundled file does not have inline `textContent`

## `packageManifest` shape

Phase 1 standardizes `packageManifest` as:

```ts
type SkillPackageManifest = {
  importedFileCount: number;
  counts: {
    references: number;
    assets: number;
    scripts: number;
    other: number;
  };
  preservedAdditionalPaths: string[];
  repo?: string;
  repoRef?: string;
  subdirPath?: string;
};
```

## Files to touch

- `features/skills/service.ts`
  - reduce into thin facade or re-export layer
- `features/skills/server/package-import.ts`
  - keep path filtering and import rules authoritative
- `features/skills/types.ts`
  - keep shared package types stable
- `features/skills/components/skills-list.tsx`
  - verify detail rendering for package files
- `db/schema/skills.ts`
  - only change if schema gaps are discovered

## Done when

- package create and import work without touching unrelated code
- file read endpoints behave consistently
- the service layer has clear module boundaries

---

## 6. Phase 2 - Add package file editing

## Goal

Allow package skills to be edited after creation.

## Checklist

- [ ] add file mutation endpoints
- [ ] allow editing `SKILL.md` content safely
- [ ] allow creating and deleting bundled files safely
- [ ] add file-tree UI for package skills
- [ ] keep inline skill editing working

## Files to touch

- `app/api/skills/[id]/files/route.ts`
  - extend beyond metadata reads if this route owns file creation/deletion
- `app/api/skills/[id]/files/content/route.ts`
  - add update behavior or add a sibling mutation route
- `features/skills/service.ts`
  - move package file mutation logic into dedicated server functions
- `features/skills/components/skill-form-dialog.tsx`
  - keep create flow package-first, do not overload with full edit UI unless explicitly intended
- `features/skills/components/skills-list.tsx`
  - add package file browser/editor entry point

## API target

- `GET /api/skills/:id/files`
- `GET /api/skills/:id/files/content?path=...`
- `PUT /api/skills/:id/files/content`
- `POST /api/skills/:id/files`
- `DELETE /api/skills/:id/files?path=...`

## Done when

- a package skill can be created, opened, edited, and saved end-to-end
- file edits cannot write outside the package root

---

## 7. Phase 3 - Move runtime to progressive disclosure

## Goal

Stop treating package skills as only flattened `promptFragment` text.

## Checklist

- [ ] build a compact skill catalog from attachments
- [ ] separate discovery from activation
- [ ] disclose full `SKILL.md` only when activated
- [ ] disclose referenced files only when needed
- [ ] keep tool enablement working for triggered skills
- [ ] dedupe rule-triggered and model-selected skills

## Files to touch

- `app/api/chat/route.ts`
  - keep this as the main runtime integration point
- `features/skills/service.ts`
  - extract activation/resource logic out of the monolith
- `features/skills/server/activation.ts`
  - create this module when phase work starts
- `features/skills/server/resources.ts`
  - create this module for referenced file resolution
- `app/api/agents/[id]/skills/route.ts`
  - verify attachment contract still supports runtime needs

## Runtime sequence

1. load attachments for the active agent
2. build catalog from attached skills
3. run deterministic triggers and model discovery
4. disclose activated `SKILL.md`
5. disclose referenced files only if needed
6. merge skill-enabled tools

## Done when

- runtime meaningfully uses package structure
- prompt growth stays controlled
- existing agents still behave acceptably during migration

---

## 8. Phase 4 - Add sync lifecycle for imported skills

## Goal

Let imported skills check for upstream updates and apply them safely.

## Checklist

- [ ] compare installed snapshot with upstream snapshot
- [ ] store upstream commit metadata
- [ ] calculate changed file paths
- [ ] expose sync status in detail views
- [ ] require explicit apply action for updates

## Files to touch

- `features/skills/server/package-import.ts`
  - reuse fetch logic for upstream comparison
- `features/skills/service.ts`
  - move sync orchestration into dedicated server functions
- `features/skills/types.ts`
  - extend sync response types if needed
- `app/api/skills/[id]/route.ts`
  - keep metadata update separate from sync mutation flow
- `features/skills/components/skills-list.tsx`
  - surface sync status and actions

## API target

- `POST /api/skills/:id/sync/check`
- `POST /api/skills/:id/sync/apply`

## Done when

- imported skills can detect updates
- applying updates does not break ownership boundaries or local library semantics

---

## 9. Phase 5 - Remove legacy compatibility paths

## Goal

Make attachment-based linkage the only source of truth.

## Checklist

- [ ] stop dual-writing `agent.skillIds`
- [ ] remove fallback reads from legacy skill arrays
- [ ] remove compatibility-only code in agent editor and runtime
- [ ] update docs to describe the post-migration model only

## Files to touch

- `app/api/agents/[id]/skills/route.ts`
  - stop mirroring into `skillIds`
- `features/skills/service.ts`
  - remove fallback attachment generation from `skillIds`
- `features/agents/components/agent-form.tsx`
  - remove legacy normalization paths
- `app/api/chat/route.ts`
  - stop relying on legacy fallback skill IDs

## Done when

- attachment table is the only authoritative agent-skill link
- legacy `skillIds` logic is gone from runtime and editor flows

---

## 10. File-by-file ownership map

- **[schema]** `db/schema/skills.ts`
  - owns DB tables and indexes for skills
- **[shared types]** `features/skills/types.ts`
  - owns client-safe skill and attachment contracts
- **[service facade]** `features/skills/service.ts`
  - should become thin over focused server modules
- **[importer]** `features/skills/server/package-import.ts`
  - owns remote package loading and file filtering rules
- **[skill routes]** `app/api/skills/*`
  - own HTTP contracts and Zod validation
- **[agent attachment route]** `app/api/agents/[id]/skills/route.ts`
  - owns attachment reads/writes
- **[skill UI]** `features/skills/components/*`
  - owns create, detail, and future package editing UX
- **[agent UI]** `features/agents/components/*`
  - owns attachment editing in the agent workflow
- **[runtime]** `app/api/chat/route.ts`
  - owns chat-time activation and disclosure integration

---

## 11. Acceptance checks per change

Before merging any Agent Skills change, verify all of these.

- [ ] package skills still load in detail views
- [ ] agent attachments still save and reload correctly
- [ ] public skill install still clones instead of mutating the source skill
- [ ] file reads still enforce auth and ownership
- [ ] path traversal is rejected
- [ ] runtime still merges skill-enabled tools correctly
- [ ] no change silently breaks inline skills
- [ ] docs are updated if API or architecture changed

---

## 12. Minimum test checklist

- **[parser]** `SKILL.md` frontmatter parse and generation
- **[paths]** path normalization and traversal rejection
- **[create]** package creation writes `SKILL.md` and bundled files
- **[import]** GitHub package import preserves expected files
- **[files]** metadata and content endpoints enforce ownership
- **[attachments]** replace flow preserves ordering and overrides
- **[runtime]** rule-triggered and model-selected skills dedupe correctly

---

## 13. Immediate next tasks

If work resumes from the current repo state, do these next in order.

1. split `features/skills/service.ts`
2. add package file mutation endpoints
3. build package file editor UI
4. move runtime to progressive disclosure
5. add sync check/apply

---

## 14. Short summary

The repo already has the package-first base.

What remains is operational work:

- editable package contents
- progressive runtime disclosure
- sync lifecycle
- removal of compatibility-only legacy paths

Until that migration is complete, contributors should treat the system as a hybrid:

- package-first in storage and creation
- compatibility-aware in editing and runtime
