# Agent Skill Implementation Guide

> **Audience:** AI coders and developers extending the Skills and Agents system.
> **Status:** Working implementation guide for future development.
> **Scope:** Describes the current repo state, the intended Agent Skills model, and the recommended roadmap for completing the package-first architecture.

---

## 1. Purpose

This document is the practical implementation guide for Agent Skills in this repo.

Use it when you need to:

- understand how skills are currently stored and attached to agents
- extend the package-first skill model
- add or modify APIs for skill files, imports, and attachments
- improve runtime skill activation and progressive disclosure
- avoid breaking compatibility with existing agents and inline skills

This guide is intentionally repo-specific. It complements:

- `docs/skills.md`
- `docs/skills-package-architecture.md`
- `documents/agent-skill/03-Specification.md`
- `documents/agent-skill/09-Adding-skills-support.md`

---

## 2. Product direction

The long-term direction is to integrate with the open Agent Skills ecosystem as closely as practical.

That means:

- a skill should be treated as a package, not just a flat prompt string
- `SKILL.md` is the primary entry file
- additional bundled files should be preserved
- agent attachments should support per-agent overrides
- runtime behavior should move toward progressive disclosure instead of unconditional prompt flattening

The repo must still preserve backward compatibility during the migration.

---

## 3. Current implementation status

## 3.1 What is already implemented

The repo already has a meaningful package-first foundation.

### Storage and schema

Current schema module:

- `db/schema/skills.ts`

Current tables:

- `skill_source`
- `agent_skill`
- `agent_skill_file`
- `agent_skill_attachment`

Important current capabilities:

- `agent_skill` supports `skillKind`, `activationMode`, `sourceId`, `entryFilePath`, sync metadata, `hasBundledFiles`, and `packageManifest`
- `agent_skill_file` stores bundled file snapshots by `relativePath`
- `agent_skill_attachment` stores per-agent attachment overrides and ordering
- legacy `agent.skillIds` still exists for compatibility

### Service layer

Current main service file:

- `features/skills/service.ts`

Implemented service behavior includes:

- package-first creation via `createSkill()`
- GitHub package import via `importSkillFromUrl()`
- skill file listing via `getSkillFiles()`
- skill file content retrieval via `getSkillFileContent()`
- attachment read/write via `getSkillAttachmentsForAgent()` and `replaceSkillAttachmentsForAgent()`
- installation cloning via `installSkill()`

### Current API surface

Implemented routes include:

- `GET /api/skills`
- `POST /api/skills`
- `GET /api/skills/:id`
- `PUT /api/skills/:id`
- `DELETE /api/skills/:id`
- `POST /api/skills/import`
- `POST /api/skills/:id/install`
- `GET /api/skills/:id/files`
- `GET /api/skills/:id/files/content?path=...`
- `GET /api/agents/:id/skills`
- `PUT /api/agents/:id/skills`

### UI state

Current UI already supports:

- package-first create flow in `features/skills/components/skill-form-dialog.tsx`
- attachment-aware agent editor integration
- skill detail rendering that can show package metadata and files

### Import behavior

Current importer:

- `features/skills/server/package-import.ts`

Implemented behavior:

- supports GitHub tree and blob URLs
- parses `SKILL.md`
- preserves standard top-level folders such as `references/`, `assets/`, and `scripts/`
- preserves additional safe top-level files and folders
- ignores `.git` and `node_modules`
- snapshots imported files into `agent_skill_file`

---

## 3.2 What is not complete yet

The package-first foundation is present, but the implementation is not complete.

Main gaps:

- runtime still largely uses `promptFragment` injection rather than full progressive disclosure
- edit mode is still metadata-oriented and not yet a full package file editor
- package sync flows are not implemented
- imported or local package files are not yet editable through dedicated mutation endpoints
- the current service layer is growing large and should be split into focused server modules
- legacy `agent.skillIds` is still dual-written for compatibility

---

## 4. Canonical architecture to target

## 4.1 Core concepts

### Installed skill

A row in `agent_skill` is the user-owned installed skill in the library.

A skill can be:

- `inline`
- `package`

### Source of truth

For package skills:

- `SKILL.md` is the canonical human-readable instructions file
- `promptFragment` is a derived compatibility field, not the ideal long-term source of truth

### Attachment

An attachment is the relationship between an agent and a skill.

Use `agent_skill_attachment` for:

- enable/disable
- priority ordering
- activation overrides
- trigger overrides
- future notes or agent-local behavior

### Skill files

Bundled files are stored in `agent_skill_file`.

Current file kinds:

- `skill`
- `reference`
- `asset`
- `script`
- `other`

---

## 4.2 Package structure expectations

Future implementation should continue to follow the Agent Skills standard as closely as practical.

Expected package shape:

```text
my-skill/
  SKILL.md
  references/
  assets/
  scripts/
  ...additional safe files
```

Expected `SKILL.md` semantics:

- YAML frontmatter contains package metadata
- markdown body contains instructions
- instructions may refer to additional relative files

Recommended frontmatter fields to preserve or generate when available:

- `name`
- `description`
- `license`
- `compatibility`
- `metadata`
- `allowed-tools`

---

## 5. Current repo touchpoints

## 5.1 Schema

Primary module:

- `db/schema/skills.ts`

Important table responsibilities:

- `skill_source`
  - canonical source identity for imports
- `agent_skill`
  - installed skill metadata and compatibility fields
- `agent_skill_file`
  - bundled package files snapshot
- `agent_skill_attachment`
  - per-agent overrides and ordering

## 5.2 Type definitions

Primary types file:

- `features/skills/types.ts`

Important types:

- `Skill`
- `SkillDetail`
- `SkillFile`
- `SkillSource`
- `CreateSkillInput`
- `CreateSkillFileInput`
- `AgentSkillAttachment`
- `AgentSkillAttachmentInput`

## 5.3 API routes

### Skill routes

- `app/api/skills/route.ts`
- `app/api/skills/[id]/route.ts`
- `app/api/skills/import/route.ts`
- `app/api/skills/[id]/files/route.ts`
- `app/api/skills/[id]/files/content/route.ts`

### Agent attachment route

- `app/api/agents/[id]/skills/route.ts`

## 5.4 UI

Main skill UI:

- `features/skills/components/skills-list.tsx`
- `features/skills/components/skill-form-dialog.tsx`

Agent-side attachment UI:

- `features/agents/components/agent-form.tsx`
- `features/agents/components/agent-knowledge-section.tsx`

## 5.5 Runtime integration

Current runtime integration entrypoint:

- `app/api/chat/route.ts`

This route currently:

- loads attached skills for the active agent
- resolves rule-triggered and model-discovered skills
- merges skill-enabled tools
- injects instructions/resources into the prompt pipeline

This remains the most sensitive integration point.

---

## 6. Invariants to preserve

Any future implementation must preserve these invariants.

- skill names should follow the standard slug format
  - lowercase letters, numbers, and single hyphens only
- `SKILL.md` remains the default package entry file
- `agent_skill_attachment` is the authoritative per-agent attachment model
- legacy `agent.skillIds` can be maintained only as a compatibility mirror until fully removed
- file paths must be normalized and must never escape the package root
- `.git` and `node_modules` must remain excluded from imported package content
- package file reads must enforce ownership or visibility checks
- public skill installation must clone into the user’s own library instead of mutating the source skill

---

## 7. Recommended module split

The current `features/skills/service.ts` works, but future work should move logic into focused server modules.

Recommended target structure:

```text
features/skills/
  types.ts
  service.ts
  server/
    queries.ts
    mutations.ts
    attachments.ts
    importer.ts
    package-import.ts
    parser.ts
    activation.ts
    resources.ts
    sync.ts
```

Suggested responsibilities:

- `queries.ts`
  - list/detail/file lookup queries
- `mutations.ts`
  - create, update, delete, install, package mutations
- `attachments.ts`
  - normalize and persist agent attachment overrides
- `importer.ts`
  - orchestrate canonical source resolution and package persistence
- `parser.ts`
  - parse and validate `SKILL.md` frontmatter and body
- `activation.ts`
  - runtime skill selection and activation behavior
- `resources.ts`
  - resolve referenced files for runtime disclosure
- `sync.ts`
  - future upstream sync check/apply flows

---

## 8. Recommended future phases

## Phase 1: stabilize current package-first foundation

Goal:

- make the existing package-first create/import path safe and maintainable

Recommended tasks:

- split `features/skills/service.ts` into smaller server modules
- add focused unit coverage around path normalization and `SKILL.md` generation/parsing
- document the shape of `packageManifest`
- ensure detail views gracefully handle missing `textContent` for non-inline files

Definition of done:

- package create/import behavior is stable and easy to extend
- skill file APIs remain backward compatible

## Phase 2: add package editing APIs and UI

Goal:

- make package skills truly editable after creation

Recommended tasks:

- add mutation endpoints for package files
- allow updating `SKILL.md` and bundled files independently
- add a file-tree based skill editor UI
- keep metadata-only edit mode for inline skills or as fallback

Recommended API additions:

- `PUT /api/skills/:id/files/content`
- `POST /api/skills/:id/files`
- `DELETE /api/skills/:id/files?path=...`

Important rule:

- package edits must not silently corrupt path structure or overwrite the wrong file

Definition of done:

- a developer can create, inspect, and edit a package skill end-to-end in the app

## Phase 3: move runtime toward progressive disclosure

Goal:

- stop treating package skills as only flattened prompt fragments

Recommended tasks:

- build a compact skill catalog from attached skills
- activate skills by rule or model selection
- load full `SKILL.md` only when needed
- resolve additional referenced files only on demand
- track which resources were disclosed during a request

Recommended runtime sequence:

1. load agent attachments
2. build skill catalog
3. run rule and model selection
4. disclose activated `SKILL.md` instructions
5. disclose referenced files only if requested or necessary
6. merge skill-enabled tools

Definition of done:

- runtime uses package structure meaningfully rather than only `promptFragment`

## Phase 4: add sync lifecycle for imported skills

Goal:

- allow installed imported skills to check for and apply upstream updates safely

Recommended tasks:

- add upstream snapshot comparison
- store upstream commit SHA
- calculate changed file paths
- add sync status transitions
- add explicit user-confirmed apply flow

Recommended API additions:

- `POST /api/skills/:id/sync/check`
- `POST /api/skills/:id/sync/apply`

Definition of done:

- imported skills can detect and apply upstream changes without breaking local ownership boundaries

## Phase 5: retire legacy attachment compatibility

Goal:

- fully standardize on attachment-based agent-skill linking

Recommended tasks:

- migrate all reads to `agent_skill_attachment`
- stop writing `agent.skillIds` after compatibility window closes
- remove old code paths from agent forms and runtime

Definition of done:

- attachment table is the only authoritative linking mechanism

---

## 9. API contract guidance

## 9.1 Create skill

Current direction:

- `POST /api/skills` is package-first for new skill creation

Expect the request body to support:

- base metadata
- activation fields
- package metadata
- bundled files

Important implementation rule:

- generate `SKILL.md` in the backend from normalized input rather than trusting arbitrary client-generated entry content as the only source of truth

## 9.2 Update skill

Current direction:

- `PUT /api/skills/:id` remains a metadata-oriented update route

Do not overload this route with full package file mutation unless the contract is explicitly redesigned.

Prefer separate file mutation endpoints.

## 9.3 File reads

Current routes:

- `GET /api/skills/:id/files`
- `GET /api/skills/:id/files/content?path=...`

These should remain the primary read contract for file browsing UI.

## 9.4 Agent attachments

Current route:

- `GET /api/agents/:id/skills`
- `PUT /api/agents/:id/skills`

Current behavior:

- returns attachment records with resolved skill data
- updates attachment rows
- mirrors `skillIds` for compatibility

Future rule:

- keep the attachment route authoritative even while legacy mirroring exists

---

## 10. Runtime implementation guidance

## 10.1 Current behavior

`app/api/chat/route.ts` already integrates skills into the request lifecycle.

Today it effectively:

- fetches active agent skills
- determines triggered skills
- unlocks tool IDs from triggered skills
- prepares skill instructions/resources for prompt injection

## 10.2 Desired future behavior

The target runtime should align more closely with the Agent Skills specification.

Preferred model:

- discovery first
- activation second
- resource disclosure third

Recommended runtime rules:

- `always` skills should always appear in the catalog and normally activate
- `slash` and `keyword` skills should activate deterministically when matched
- `model` activation mode should allow discovery without forcing activation until selected
- scripts should never be blindly executed just because they are bundled
- resource disclosure should be limited to necessary files only

## 10.3 High-risk runtime areas

Be careful when changing:

- prompt assembly order
- tool enablement derived from skills
- deduplication between rule-triggered and model-discovered skills
- resource injection size growth
- compatibility for agents that still rely on legacy `skillIds`

---

## 11. Security and safety guidance

Always preserve these rules.

- only allow safe, normalized relative paths inside a package root
- reject path traversal patterns such as `../`
- exclude noisy or unsafe import roots like `.git` and `node_modules`
- never execute imported scripts automatically
- do not trust remote content shape without parsing and validation
- keep ownership checks on all skill detail and file read endpoints
- treat imported packages as snapshots, not executable trust bundles

---

## 12. Testing strategy

Recommended test coverage for future work:

### Parsing and normalization

- `SKILL.md` frontmatter parsing
- skill slug normalization
- path normalization and traversal rejection
- file kind inference
- media type inference

### Service behavior

- package skill creation generates `SKILL.md`
- file rows are inserted with expected `relativePath`
- install clones files and metadata correctly
- attachment replacement preserves ordering and overrides

### API behavior

- file list and file content endpoints enforce auth and ownership
- attachment endpoints return fallback legacy attachments when needed
- invalid file paths return 400 or 404 appropriately

### Runtime behavior

- rule-triggered skills activate correctly
- model-discovered skills dedupe correctly
- skill-enabled tools merge safely
- progressive disclosure changes do not explode prompt size unexpectedly

---

## 13. Recommended implementation checklist for future contributors

When implementing a new Agent Skills enhancement, use this checklist.

- confirm whether the change affects inline skills, package skills, or both
- identify whether `agent.skillIds` compatibility must still be preserved
- update shared types in `features/skills/types.ts` first
- keep schema changes in `db/schema/skills.ts`
- preserve `@/db/schema` barrel imports
- prefer service-layer changes over route-layer duplication
- add or update route validation with Zod
- keep file operations path-safe and ownership-checked
- verify the change against `app/api/chat/route.ts`
- verify the change against skill detail rendering and the agent editor
- update docs when the contract or architecture changes

---

## 14. Immediate recommended next tasks

If future work resumes from the current repo state, do these next.

### Highest priority

- build a package file editor UI for existing skills
- add package file mutation endpoints
- split the large skill service into focused server modules

### Medium priority

- formalize runtime resource disclosure
- add sync check/apply flows for imported skills
- document `packageManifest` structure in detail

### Later priority

- remove legacy `skillIds` mirroring after migration is complete
- support additional import sources beyond GitHub if needed

---

## 15. Summary

The repo is no longer purely inline-skill based.

It already has:

- package-aware schema
- package-first creation
- GitHub package import
- packaged file storage
- attachment-based agent linkage
- file metadata and content endpoints

The remaining work is to complete the system around that foundation:

- editable package contents
- progressive runtime disclosure
- sync lifecycle
- final removal of legacy compatibility paths

Until that migration is complete, contributors should treat the system as a hybrid:

- package-first in storage and creation
- compatibility-aware in editing and runtime
