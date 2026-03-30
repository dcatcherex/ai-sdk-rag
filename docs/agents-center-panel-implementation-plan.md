# Agents Center-Panel Editor Implementation Plan

## Purpose

This document defines the implementation roadmap for migrating the current Agents editor from a large shared form into a settings-style sectioned editor with:

- center-panel replacement editing
- left-side section navigation
- focused section content
- `Structured` and `Raw` behavior modes inside `AI Behavior`

It is meant to guide both AI-assisted implementation and future developer work.

## Current State

The current implementation already moved agent editing out of a modal and into the center panel.

Current relevant components:

- `features/agents/components/agents-list.tsx`
- `features/agents/components/agent-editor-panel.tsx`
- `features/agents/components/agent-form.tsx`
- `features/agents/components/agent-form-dialog.tsx`

Current characteristics:

- `AgentsList` owns page mode and mutation orchestration.
- `AgentEditorPanel` is a basic center-panel shell.
- `AgentForm` still renders a large all-in-one form.
- `systemPrompt` is still treated as a single raw text field.
- The current backend shape is primarily oriented around `systemPrompt`, not structured behavior fields.

## Target State

The target editor should behave like a settings workspace, not a prompt IDE.

Target UX characteristics:

- left navigation with editor sections
- one active section at a time
- `AI Behavior` as the home of prompt editing
- `Structured` as the default authoring experience
- `Raw` as the advanced override mode
- progressive disclosure for advanced complexity

## Key Implementation Constraint

### Structured behavior persistence

A `Structured` editor needs a persistence strategy.

The current model already persists:

- `name`
- `description`
- `systemPrompt`
- `modelId`
- `enabledTools`
- `documentIds`
- `skillIds`
- `brandId`
- `isPublic`
- `starterPrompts`
- sharing relationships

However, `Structured` behavior fields such as role, tone, language rules, and business context are not yet first-class persisted data.

Without persistence, users would lose structured input after reopening the editor.

## Recommended Delivery Strategy

Implement in two layers:

### Layer 1: Settings-shell refactor

Deliver the settings-style navigation and sectioned UI using the existing backend contract.

This gives immediate UX improvement with lower risk.

### Layer 2: Structured behavior persistence

Add persistent storage for structured behavior so `Structured` becomes a true first-class editing mode.

This is the correct long-term architecture.

## Phase Plan

## Phase 1: Introduce the settings shell

### Goal

Replace the current large two-column editor body with a sectioned settings workspace while preserving all existing save behavior.

### Deliverables

- left-side section navigation
- active section rendering
- sticky header actions
- current fields redistributed into section components

### Target files

- `features/agents/components/agent-editor-panel.tsx`
- `features/agents/components/agent-form.tsx`
- `features/agents/components/agents-list.tsx`
- new: `features/agents/components/agent-settings-layout.tsx`
- new: `features/agents/components/agent-section-nav.tsx`

### Tasks

- Extract a reusable settings shell layout.
- Add `activeSection` state to the editor shell.
- Replace the full-body form render with one-section-at-a-time rendering.
- Keep submit and cancel actions page-level and visible.
- Keep `AgentForm` as the draft state owner during this phase.

### Section mapping for Phase 1

- `General`
  - `name`
  - `description`
  - `starterPrompts`
- `AI Behavior`
  - existing raw `systemPrompt`
- `Knowledge`
  - `brandId`
  - `documentIds`
  - `skillIds`
- `Tools`
  - `enabledTools`
- `Sharing`
  - `isPublic`
  - `sharedWith`
- `Model`
  - `modelId`

### Acceptance criteria

- User can still create and edit agents successfully.
- All current fields remain accessible.
- The editor feels like settings, not a giant form.
- Existing save and cancel behavior still works.

## Phase 2: Split the large form into section components

### Goal

Refactor the monolithic `AgentForm` UI into composable section components without changing the underlying draft ownership.

### Deliverables

- new section components
- smaller responsibilities per file
- reusable section rendering contracts

### Target files

- `features/agents/components/agent-form.tsx`
- new: `features/agents/components/agent-general-section.tsx`
- new: `features/agents/components/agent-behavior-section.tsx`
- new: `features/agents/components/agent-knowledge-section.tsx`
- new: `features/agents/components/agent-tools-section.tsx`
- new: `features/agents/components/agent-sharing-section.tsx`
- new: `features/agents/components/agent-model-section.tsx`

### Tasks

- Move section-specific UI from `AgentForm` into separate components.
- Keep `AgentForm` responsible for:
  - local draft state
  - derived values
  - field handlers
  - submit normalization
- Pass section-specific props down into section components.
- Keep `AgentFormDialog` as a compatibility wrapper around `AgentForm`.

### Acceptance criteria

- No field logic is duplicated across section components.
- `AgentForm` remains the single source of truth for draft values.
- The panel and dialog variants still share the same field behavior.

## Phase 3: Add `AI Behavior` tab model

### Goal

Introduce `Structured` and `Raw` tabs in the `AI Behavior` section while keeping raw prompt editing available.

### Deliverables

- `Structured` tab UI
- `Raw` tab UI
- section-level behavior mode state
- raw prompt preview/reset relationship

### Target files

- `features/agents/components/agent-behavior-section.tsx`
- new: `features/agents/components/agent-structured-behavior-form.tsx`
- new: `features/agents/components/agent-raw-prompt-editor.tsx`
- `features/agents/components/agent-editor-panel.tsx` or a dedicated shell hook for `behaviorMode`

### Tasks

- Add `behaviorMode: 'structured' | 'raw'` to editor shell state or section-local state.
- Make `Structured` the default tab.
- Introduce guided fields for:
  - role
  - tone
  - language rules
  - key instructions
  - context
  - optional examples
- Keep the existing raw `systemPrompt` textarea in `Raw`.
- Add counts and metadata to the raw editor.
- Add a preview or reset action from structured behavior.

### Important note

At the end of Phase 3, the UX can exist before persistence is complete, but persistence should be treated as incomplete until Phase 4 is finished.

### Acceptance criteria

- Non-technical users can configure behavior without touching raw prompt text.
- Advanced users can still edit the final prompt directly.
- The UI clearly communicates when raw prompt has been manually customized.

## Phase 4: Persist structured behavior

### Goal

Make `Structured` behavior durable across reloads and future edits.

### Recommended backend change

Add a persisted field for structured behavior configuration.

Recommended shape:

- `behaviorConfig` or similar JSON field on the agent record

This should contain structured behavior inputs such as:

- `role`
- `tone`
- `languageRules`
- `keyInstructions`
- `context`
- `exampleReplies`
- optional metadata such as `rawPromptCustomized`

### Target files

- `db/schema.ts`
- migration file in `db/migrations/`
- API routes for agents create/update/read
- `features/agents/types.ts`
- any serialization/deserialization helpers if introduced

### Tasks

- Add schema support for structured behavior persistence.
- Update create and update API payload handling.
- Update read APIs so agent editor receives structured behavior when available.
- Define fallback behavior for older agents that only have `systemPrompt`.

### Recommended fallback rule

For legacy agents:

- use persisted `systemPrompt` as the source of truth
- initialize `Structured` in a minimal or empty state
- optionally show a message that structured fields are not yet derived from legacy prompt text

### Acceptance criteria

- Structured behavior survives page reload and later edits.
- Existing agents still remain editable.
- No data loss occurs for legacy raw prompts.

## Phase 5: Divergence handling and polish

### Goal

Make the relationship between `Structured` and `Raw` understandable and safe.

### Deliverables

- divergence warning UI
- explicit reset-from-structured action
- preview generated prompt
- unsaved-changes warning before leaving editor mode

### Target files

- `features/agents/components/agent-behavior-section.tsx`
- `features/agents/components/agent-structured-behavior-form.tsx`
- `features/agents/components/agent-raw-prompt-editor.tsx`
- `features/agents/components/agent-editor-panel.tsx`
- `features/agents/components/agents-list.tsx`

### Tasks

- Add a visible state when raw prompt has diverged from structured values.
- Add `Reset from structured` action.
- Add a generated prompt preview surface.
- Add unsaved-changes guard on back navigation.
- Add per-section validation or completion indicators if useful.

### Acceptance criteria

- Users understand whether they are editing guided behavior or raw prompt text.
- Users can recover from accidental raw edits.
- Leaving the editor does not silently discard changes.

## Recommended File Ownership After Refactor

### `agents-list.tsx`

Owns:

- list vs editor mode
- selected agent
- mutation calls
- delete/share secondary dialogs

Should not own:

- section state
- field state
- behavior-mode tab state

### `agent-editor-panel.tsx`

Owns:

- header actions
- active section state
- behavior tab state if kept at shell level
- composition of shell and sections

Should not own:

- agent mutation logic
- API reads for field options

### `agent-form.tsx`

Owns:

- local draft state
- derived field state
- submit normalization
- supporting option reads for documents, user sharing, brands, and skills unless later extracted into hooks/providers

Should not own:

- page mode
- route transitions
- delete/share modal state

## Migration Notes for Existing Code

### Keep during migration

- `AgentsList` page mode structure
- current mutation hooks
- `AgentFormDialog` compatibility wrapper
- current API payload contract

### Change incrementally

- first change layout and section rendering
- then split section components
- then add `Structured` UX
- then add persistence support

### Avoid doing all at once

Do not combine these into one large risky change:

- full layout rewrite
- section extraction
- structured prompt UX
- backend schema change
- prompt generation logic

These should be separate reviewable steps.

## Risks

### Risk: false sync between structured and raw

If the UI implies both are always synchronized, users may lose trust.

Mitigation:

- explicitly track customization state
- use reset and preview actions
- communicate divergence clearly

### Risk: structured data without persistence

Users may believe structured edits are permanent when they are not.

Mitigation:

- do not ship full structured authoring without a persistence plan
- if temporarily shipped, clearly scope as transitional

### Risk: monolithic component remains too large

If section extraction is skipped, the architecture becomes harder to maintain.

Mitigation:

- split by section before adding too much new UX

### Risk: non-technical users still see too much complexity

Mitigation:

- default to `Structured`
- keep advanced raw editing secondary
- avoid showing all sections at once

## Recommended Implementation Order

1. Phase 1: settings shell
2. Phase 2: section extraction
3. Phase 3: behavior tabs
4. Phase 4: persistence
5. Phase 5: polish and safeguards

## Definition of Done

The refactor is complete when:

- agent editing uses a settings-style center-panel workspace
- left-side section navigation is in place
- one section is edited at a time
- `AI Behavior` provides `Structured` and `Raw` modes
- structured behavior is persisted
- raw prompt divergence is handled explicitly
- create/edit parity is preserved
- secondary actions remain dialog-based where appropriate
