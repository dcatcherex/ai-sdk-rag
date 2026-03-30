# Agents Center-Panel Editor Architecture

## Purpose

This document defines the component and state architecture for the Agents management experience after the shift from modal-based editing to a center-panel replacement editor.

The goal is to make agent editing feel like a primary workspace activity while remaining approachable for non-technical users. The editor should feel closer to a settings workspace than a prompt IDE.

## UX Model

The Agents surface now has two primary modes:

- `list`
  - Shows the agents grid and list-oriented actions.
- `editor`
  - Replaces the center panel with a full agent settings workspace for create or edit flows.

This mode switch happens inside the Agents feature container instead of opening a modal.

Inside `editor`, the UI should use a sectioned settings model:

- left section navigation
- focused main content panel
- sticky page-level actions
- progressive disclosure for advanced prompt editing

The prompt is no longer treated as the entire editing experience. Instead, it lives inside the `AI Behavior` section.

## Component Ownership

### `app/(main)/agents/page.tsx`

- Route entry only.
- Renders the feature root component.
- Should stay thin.

### `features/agents/components/agents-list.tsx`

Acts as the feature controller for the Agents page.

Responsibilities:

- Load agents via React Query hooks.
- Own page-level UI mode state.
- Decide whether the center panel shows the grid or the editor.
- Handle create, update, delete, and share entry points.
- Keep destructive confirmation and share dialogs outside the editor flow.

This is the authoritative place for:

- selected agent for editing
- whether the page is in browse or editor mode
- mutation success transitions back to browse mode

### `features/agents/components/agent-editor-panel.tsx`

Acts as the full center-panel editor shell for the settings workspace.

Responsibilities:

- Render the editor header and back action.
- Render the shared settings shell layout.
- Coordinate section navigation and section rendering.
- Compose the section-specific editor components.

This component should stay focused on layout and editor framing, not data fetching.

### `features/agents/components/agent-form.tsx`

Acts as the shared agent draft state owner and reusable field composition root.

Responsibilities:

- Manage local form state for all editable agent fields.
- Load supporting option data needed by the form.
- Normalize values into `CreateAgentInput` for submit.
- Provide data and handlers to section components.
- Support multiple presentation modes through props where still needed.

Current presentation modes:

- `dialog`
- `panel`

This component is the authoritative place for draft values, field-level behavior, and validation.

### `features/agents/components/agent-settings-layout.tsx`

Acts as the reusable settings workspace shell.

Responsibilities:

- Render left-side section navigation.
- Render the current section title, description, and content region.
- Provide a consistent layout pattern that can be reused by future settings-style surfaces.

This component should not own business logic. It is a layout primitive for sectioned settings pages.

### `features/agents/components/agent-section-nav.tsx`

Acts as the left-side navigation for the agent editor.

Responsibilities:

- Render the available sections.
- Show which section is active.
- Handle section selection.
- Optionally surface validation or unsaved indicators per section later.

This component should remain presentational.

### `features/agents/components/agent-general-section.tsx`

Acts as the `General` settings section.

Responsibilities:

- Render `name`, `description`, and `starterPrompts` fields.
- Keep basic agent identity and onboarding prompts grouped together.

### `features/agents/components/agent-behavior-section.tsx`

Acts as the `AI Behavior` settings section.

Responsibilities:

- Render the behavior mode tabs.
- Switch between `Structured` and `Raw` editing modes.
- Own the section-level UX for assistant behavior authoring.

This component is the conceptual home of prompt authoring, but it should not own page routing or mutation state.

### `features/agents/components/agent-structured-behavior-form.tsx`

Acts as the default behavior-authoring experience for non-technical users.

Responsibilities:

- Render guided fields such as role, tone, language rules, key instructions, and business context.
- Update structured behavior draft state.
- Support previewing the generated raw prompt.

### `features/agents/components/agent-raw-prompt-editor.tsx`

Acts as the advanced raw prompt editing surface.

Responsibilities:

- Render the raw `systemPrompt` textarea.
- Show metadata such as character, token, and line counts.
- Support reset-from-structured and divergence warning states.

### `features/agents/components/agent-knowledge-section.tsx`

Acts as the `Knowledge` settings section.

Responsibilities:

- Render brand selection.
- Render document selection.
- Render skills selection.

### `features/agents/components/agent-tools-section.tsx`

Acts as the `Tools` settings section.

Responsibilities:

- Render enabled tool selection.
- Explain tool capability in plain language.

### `features/agents/components/agent-sharing-section.tsx`

Acts as the `Sharing` settings section.

Responsibilities:

- Render public/private controls.
- Render targeted sharing controls.

### `features/agents/components/agent-model-section.tsx`

Acts as the `Model` settings section.

Responsibilities:

- Render preferred model selection.
- Keep model choice separate from more common behavior settings.

### `features/agents/components/agent-form-dialog.tsx`

Compatibility wrapper around `AgentForm`.

Responsibilities:

- Preserve modal-based reuse when a dialog is still needed elsewhere.
- Avoid duplicating form logic.

Future contributors should not add new field logic here. Add it in `AgentForm`.

## State Model

### Page state

Owned by `AgentsList`.

Recommended shape:

- `mode: 'list' | 'create' | 'edit'`
- `editTarget: Agent | null`
- `deleteTarget: Agent | null`
- `shareTarget: Agent | null`

Rules:

- Only one primary center-panel mode is active at a time.
- `editTarget` is meaningful only when `mode === 'edit'`.
- Mutations return the page to `list` mode after successful save.

### Editor shell state

Owned by `AgentEditorPanel` or a dedicated editor-shell hook.

Recommended shape:

- `activeSection: 'general' | 'behavior' | 'knowledge' | 'tools' | 'sharing' | 'model'`
- `behaviorMode: 'structured' | 'raw'`

Rules:

- Only one settings section is shown in the main content area at a time.
- `Structured` should be the default behavior mode for most users.
- `Raw` is an advanced view and should remain secondary in the interaction model.

### Draft state

Owned by `AgentForm`.

Rules:

- The form should initialize from `agent` when editing.
- The form should reset to empty defaults when creating.
- The form should not own query cache invalidation or page navigation.

Recommended draft categories:

- `general`
  - `name`
  - `description`
  - `starterPrompts`
- `behaviorStructured`
  - `role`
  - `tone`
  - `languageRules`
  - `keyInstructions`
  - `context`
  - `exampleReplies`
- `behaviorRaw`
  - `systemPrompt`
  - `rawPromptCustomized`
- `knowledge`
  - `brandId`
  - `documentIds`
  - `skillIds`
- `tools`
  - `enabledTools`
- `sharing`
  - `isPublic`
  - `sharedWith`
- `model`
  - `modelId`

### Structured and raw prompt state

The editor must treat `Structured` and `Raw` behavior as related but not identical authoring modes.

Recommended rules:

- Structured behavior fields are the default authoring source.
- Raw prompt is generated from structured behavior until manually changed.
- Once the raw prompt is manually edited, mark the draft as customized.
- If raw prompt is customized, show that it may no longer match structured settings.
- Provide an explicit reset action to regenerate raw prompt from structured behavior.

The system should avoid pretending that both views always remain perfectly synchronized after manual raw editing.

## Data Flow

1. `AgentsList` loads agents.
2. User clicks `New agent` or `Edit`.
3. `AgentsList` switches into editor mode.
4. `AgentEditorPanel` renders the settings shell and active section.
5. `AgentForm` owns and distributes draft state across section components.
6. If the user edits structured behavior, the raw prompt can be regenerated from that structure.
7. If the user edits the raw prompt directly, the editor marks the prompt as customized.
8. `AgentForm` submits normalized `CreateAgentInput`.
9. `AgentsList` decides whether to call create or update mutations.
10. On success, React Query refreshes agents and the UI returns to list mode.

## Extension Guidelines

When adding new agent capabilities:

- Add new editable fields in `AgentForm` draft state first.
- Keep container-level view transitions in `AgentsList`.
- Keep section navigation and shell layout concerns in `AgentEditorPanel` and `AgentSettingsLayout`.
- Add new UI areas as settings sections when possible instead of extending a single giant form.
- Avoid introducing separate field logic in both panel and dialog variants.

If the editor grows further, prefer adding or refining section components rather than pushing more complexity into a single all-purpose form body.

## Suggested Future Enhancements

These fit the current architecture well:

- unsaved-changes guard before leaving editor mode
- structured prompt templates inside `agent-structured-behavior-form`
- generated prompt preview inside `agent-behavior-section`
- token and character estimation inside `agent-raw-prompt-editor`
- section completion or warning badges in `agent-section-nav`
- per-section validation summaries
- test-run or preview area for behavior evaluation
- route-based editing such as `/agents/[id]` if deep linking becomes important

## Invariants

- `systemPrompt` remains a required field.
- Create and edit flows must share the same field behavior.
- Agent editing should happen in the center panel, not in a cramped modal.
- The default editing experience should be accessible to non-technical users.
- `AI Behavior` should be the conceptual home of prompt editing.
- `Structured` should be the default behavior-authoring mode.
- `Raw` should remain available as an advanced override.
- Dialogs remain appropriate for secondary actions such as share and delete confirmation.
