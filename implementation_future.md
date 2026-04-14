# Implementation Future Notes

This document collects the **optional next improvements** for the tool architecture after the current registry-based structure has stabilized.

For the separate future proposal on **user-created tools as a product capability**, see:

- `docs/user-created-tools-implementation.md`

The current implementation is already in a good place:

- each tool has a `manifest.ts`, `schema.ts`, `service.ts`, and `agent.ts`
- `lib/tools/index.ts` is now registry-driven for manifest-managed tools
- `app/tools/[toolSlug]/page.tsx` uses a loader registry instead of a growing switch
- `ToolExecutionResult` exists and is enforced through action wrappers at the service boundary
- `lib/tool-registry.ts` derives manifest-managed metadata from `TOOL_MANIFESTS`

These future changes are **not required now**. They are here so the project can evolve cleanly when the number of tools grows.

---

## 1. Keep the current architectural rule strict

This should remain the main rule for the codebase:

- `service.ts` is the canonical place for business logic
- `agent.ts` should stay thin and call raw `run*()` service functions
- sidebar pages and API routes should call normalized `*Action()` wrappers
- export routes should use shared export infrastructure when possible

Recommended rule to enforce in future reviews:

- **Do not call raw `run*()` functions directly from sidebar pages or public API routes**
- **Do not add business logic to `agent.ts`**

---

## 2. Persist tool executions in the database

Right now `ToolExecutionResult` gives a good normalized return shape, but long-term it should also be persisted.

### Goal

Add persistent execution history so tools can support:

- rerun
- open previous results from sidebar
- agent-created results opening in sidebar later
- exports from saved artifacts instead of recomputing everything
- audit/history for expensive AI outputs

### Suggested tables

#### `toolRun`

Suggested fields:

- `id`
- `toolSlug`
- `toolId`
- `userId`
- `threadId`
- `source` (`sidebar` | `agent` | `api`)
- `inputJson`
- `outputJson`
- `status`
- `createdAt`
- `updatedAt`

#### `toolArtifact`

Suggested fields:

- `id`
- `toolRunId`
- `kind`
- `format` (`json` | `html` | `pdf` | `link`)
- `storageUrl`
- `payloadJson`
- `createdAt`

### Likely files

- `db/schema.ts`
- future migrations under `db/migrations/`
- tool `*Action()` wrappers in `features/<tool>/service.ts`

### Why later

Do this only after 2-3 tools are using the normalized action pattern consistently.

---

## 3. Standardize tool route conventions

The current repo has a mix of legacy routes and new tool routes. Over time, standardize on one predictable pattern.

### Recommended UI routes

- `/tools/[toolSlug]`
- `/tools/[toolSlug]/[runId]`
- `/tools/[toolSlug]/[runId]/print`

### Recommended API routes

- `/api/tools/[toolSlug]/run`
- `/api/tools/[toolSlug]/[runId]`
- `/api/tools/[toolSlug]/[runId]/export`
- `/api/tools/[toolSlug]/[runId]/pdf`

### Why

This makes every tool feel the same:

- sidebar and agent can point to the same result detail page
- export endpoints become predictable
- tool history becomes easier to build generically

### Migration note

Legacy routes like quiz or certificate-specific endpoints can stay during transition, then gradually map to the standard pattern.

---

## 4. Build shared sidebar tool infrastructure

As more tools are added, avoid building each tool page from scratch.

### Add shared UI primitives

Possible shared components:

- `features/tools/components/tool-page-shell.tsx`
- `features/tools/components/tool-result-shell.tsx`
- `features/tools/components/tool-history-list.tsx`
- `features/tools/components/tool-empty-state.tsx`
- `features/tools/components/tool-action-bar.tsx`

### Add shared hooks with React Query

Use **React Query** as the standard for tool data fetching and mutations.

Possible hooks:

- `features/tools/hooks/use-tool-run.ts`
- `features/tools/hooks/use-tool-run-history.ts`
- `features/tools/hooks/use-tool-run-detail.ts`
- `features/tools/hooks/use-tool-export.ts`

### Benefit

New tools only need:

- a tool-specific input form
- a tool-specific result renderer
- a service layer

Everything else can reuse shared infrastructure.

---

## 5. Strengthen typing around `ToolExecutionResult`

The current `ToolExecutionResult<TData>` type is good, but later it can be pushed further.

### Suggested improvement

Make action wrappers return concrete generic types instead of broad `ToolExecutionResult`.

Example direction:

```ts
Promise<ToolExecutionResult<GeneratePracticeQuizResult>>
```

### Why

This helps:

- tool page components
- result renderers
- export adapters
- future history/detail pages

### Likely files

- `features/<tool>/types.ts`
- `features/<tool>/service.ts`
- `features/tools/registry/types.ts`

---

## 6. Move remaining legacy domain logic into feature folders

Some areas are still transitional. That is fine for now.

### Main candidate

- `features/certificate/service.ts` currently re-exports from `lib/certificate-service.ts`

### Future goal

Move the actual certificate business logic into the feature folder so the feature boundary is fully honest.

Recommended long-term shape:

- `features/certificate/service.ts`
- `features/certificate/exports/*.ts`
- `features/certificate/components/*`
- low-level file/image generation can still stay in `lib/` if it is truly generic

### Why

This avoids having domain logic split between `features/` and `lib/` forever.

---

## 7. Expand the shared export system into a cross-tool artifact layer

The new export system is already a strong start.

### Direction

Build toward a reusable export flow for any tool that can output:

- print HTML
- PDF
- downloadable JSON
- CSV
- image artifacts

### Keep using

- `lib/export/service.ts`
- `lib/export/html-to-pdf.ts`
- `lib/export/url.ts`
- `lib/export/filename.ts`
- `components/print/*`

### Future additions

Possible files:

- `features/<tool>/exports/print.ts`
- `features/<tool>/exports/pdf.ts`
- `features/<tool>/exports/json.ts`
- `features/<tool>/exports/csv.ts`

### Benefit

This keeps export behavior consistent across quiz, certificate, flashcards, reports, and future tools.

---

## 8. Add tool access and capability policies

The manifest already has useful fields like:

- `supportsAgent`
- `supportsSidebar`
- `supportsExport`
- `access`

Later this can become more expressive.

### Possible future additions

- feature flag / rollout field
- billing plan requirements
- rate limit profile
- source restrictions (`agent` only, `sidebar` only, both)
- org or role-based restrictions

### Why

As more tools are added, not every tool should necessarily be visible everywhere.

---

## 9. Support history, rerun, and clone flows

Once `toolRun` exists, this becomes very valuable.

### Recommended capabilities

- open previous run from sidebar
- rerun with the same input
- clone a previous run into a new editable form
- open an agent-created result in a dedicated tool page

### UX pattern

Each tool page can evolve toward:

- `Create`
- `History`
- `Exports`

This fits the current direction well.

---

## 10. Optional future cleanup: reduce manual page registration further

The current `features/tools/registry/page-loaders.ts` approach is good and explicit.

There is no urgent need to change it.

### If tool count becomes very large

Possible future options:

- keep the explicit loader map
- or generate the map from a stricter convention
- or move page loader references into server registry metadata

### Recommendation

Keep the current explicit loader map unless it becomes painful. It is simple and easy to review.

---

## Suggested implementation order

If these future improvements are implemented later, this is the order I would use:

### Phase A — standardize usage

- enforce `*Action()` for sidebar/API
- keep raw `run*()` for agent adapters
- keep `service.ts` as the only business logic location

### Phase B — shared tool UI/runtime

- add shared React Query hooks for run/history/detail/export
- add shared tool page shell and result shell components

### Phase C — persistence

- add `toolRun`
- add `toolArtifact`
- persist normalized action results

### Phase D — route normalization

- introduce `/api/tools/[toolSlug]/run`
- introduce `/tools/[toolSlug]/[runId]`
- keep legacy routes temporarily if needed

### Phase E — domain cleanup

- migrate remaining legacy service logic into feature folders
- keep only truly generic helpers in `lib/`

### Phase F — advanced capabilities

- history UI
- rerun/clone
- export from persisted artifacts
- billing/access policies

---

## What should not be rushed

These should stay deferred until there is a real need:

- full automation of page loader registration
- deep generic abstractions before 3-5 tools actually need them
- over-normalizing every tool result too early if the UI does not use it yet
- large DB refactors before the execution-history workflow is clear

---

## Final recommendation

The current architecture is already strong enough to continue building tools.

The next future milestone should be:

- **shared tool run/history infrastructure using React Query**
- followed by **persistent `toolRun` and `toolArtifact` records**

That combination will make sidebar tools and agent tools feel like one unified system instead of separate entrypoints.
