# External Tool Provider Migration - PRD and Implementation Plan

> Audience: Product, AI coders, and developers evolving Vaja's tool platform.
> Status: Phase 0–6 complete · Phase 7 pending.
> Triage label: `in-progress`.
> Scope: Defines how Vaja should externalize specialized tools while keeping the agent, skills, LINE OA, credits, and workspace experience coherent.
> Last updated: May 7, 2026.

---

## Implementation Progress

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0 — Classification & Runbook | ✅ Complete | Tool classification table in PRD. `certificate` selected as tracer bullet. |
| Phase 1 — Provider Contract & Adapter Runtime | ✅ Complete | `features/external-tools/` built: types, schema, errors, registry, provider-client, run-lifecycle, normalize, artifacts, service, index. `ToolExecutionMode`, `ExternalToolProviderMetadata`, `ToolProviderHealthStatus` added to `features/tools/registry/types.ts`. 12/12 tests passing. |
| Phase 2 — Certificate Tracer Bullet | ✅ Complete | `features/certificate/service.ts` is now an adapter: checks `CERTIFICATE_PROVIDER_URL` env, routes to external or local. `features/certificate/provider-adapter.ts` maps inputs/outputs. API routes (`generate`, `batch`) updated to import canonical service. Certificate provider auto-registered in `features/external-tools/registry.ts`. Provider app stub at `apps/certificate-provider/` with health, manifest, sync-run, and run-status endpoints. `pnpm-workspace.yaml` updated with `apps/*`. 20/20 tests passing. |
| Phase 3 — Shared Async Provider Jobs | ✅ Complete | `features/external-tools/callbacks.ts` (HMAC-verified callback processing, idempotent), `status.ts` + `status-normalize.ts` (user-scoped run status), `polling.ts` (provider poll-on-demand), `callback-crypto.ts` (pure HMAC-SHA256). API routes: `POST /api/external-tools/callback/[providerKey]` and `GET /api/external-tools/runs/[runId]?poll=true`. 33/33 tests passing. |
| Phase 4 — Vaja Media Provider | ✅ Complete | `features/external-tools/media/` bridge: `types.ts` (KieOutputJson, MediaJobStatus), `metadata.ts` (KIE_MEDIA_PROVIDER_METADATA with executionMode:'hybrid'), `kie-bridge.ts` (pure: kieRunToProviderEnvelope, toolRunToMediaJobStatus, scopeBrandContextForProvider). image/video/audio/speech manifests updated with `provider: KIE_MEDIA_PROVIDER_METADATA`. `lib/generation/create-media-run.ts` stores `{ providerRunId: kieTaskId }` in outputJson at creation so Phase 3 polling/callbacks can resolve KIE runs. 45/45 tests passing. |
| Phase 5 — Vaja Integrations Provider | ✅ Complete | `features/external-tools/integrations/` bridge: `metadata.ts` (GOOGLE_WORKSPACE_PROVIDER_METADATA with executionMode:'external', supportsSync:true), `google-bridge.ts` (pure: toGoogleSheetsProviderOptions, toGoogleDocsProviderOptions, toGoogleDriveProviderOptions, toGoogleSlidesProviderOptions + fromXxx extractors). All 4 Google manifests updated with `provider: GOOGLE_WORKSPACE_PROVIDER_METADATA`. All 4 service.ts files updated: action functions check `GOOGLE_INTEGRATIONS_PROVIDER_URL` and route to `runExternalTool()` + `toToolExecutionResult()` when set. `runXxx()` raw functions stay local (agent adapter path). `google-workspace` provider auto-registered in registry.ts. 60/60 tests passing. |
| Phase 6 — Vaja Web Publisher | ✅ Complete | `features/external-tools/web-publisher/` bridge: `metadata.ts` (WEBSITE_BUILDER_PROVIDER_METADATA hybrid/async, WEB_DEPLOY_PROVIDER_METADATA external/sync — both providerKey:'web-publisher'), `web-bridge.ts` (pure: toWebsiteBuilderProviderOptions, toWebDeployProviderOptions + fromXxx extractors). `website-builder/manifest.ts` and `deploy/manifest.ts` updated with provider metadata. `website-builder/service.ts` transformed from thin re-export to adapter: websiteGenerateAction + websiteEditAction check WEB_PUBLISHER_URL, delegate to runExternalTool() when set; runXxx() functions stay local. `deploy/service.ts` updated: runReadWebFile, runPreviewWebChange, runConfirmWebChange all check WEB_PUBLISHER_URL after assertDeployAccess — confirm-change passes vajaRunId so provider can look up its staged preview state. `web-publisher` registered in registry.ts. 74/74 tests passing. |
| Phase 7 — Marketplace Foundation | 🔲 Pending | Partner provider support (deferred until Phase 4-5 stable). |

---

## Product Decision

Vaja should keep **tool presence** inside the platform, but move selected **tool execution** behind provider adapters.

In practice:

```text
Vaja agent or sidebar
  -> Vaja tool manifest and permission policy
  -> Vaja service adapter
  -> external tool provider API
  -> Vaja toolRun ledger, artifacts, credits, and chat result
```

This keeps Vaja as the skill-first agent workspace while letting specialized tools become independent services when they need heavier compute, richer configuration, third-party credentials, long-running jobs, or their own product surface.

The first tracer-bullet migration should be `certificate` because it already has a clear input/output shape, a canonical service facade, a separate generator layer, and rendering-heavy PDF/PNG output.

---

## Problem Statement

Vaja has many tools and the list is growing. Some tools are essential to the core workspace, but others are self-contained, compute-heavy, or complex enough to become standalone apps. If every advanced tool remains inside the main Next.js application, Vaja risks becoming harder to maintain, slower to deploy, harder to scale, and less focused on its core differentiator: agents with skills, memory, LINE OA, credits, and workspace context.

The product problem is not that Vaja has tools. Tools are necessary because agents need to perform structured work. The problem is that specialized execution logic is starting to share the same deployment, runtime, and code ownership as the core agent platform.

Users need a stable Vaja experience where agents can still find, explain, request approval for, and use tools. Developers need a way to let advanced tools evolve independently without breaking chat, skills, LINE OA, or the control room.

---

## Solution

Create an **External Tool Provider** architecture.

Vaja remains the **control plane**:

- tool registry and manifests
- agent tool adapter
- sidebar presence
- permissions and approvals
- credit estimation and deduction
- `toolRun` audit history
- artifact ownership
- skill-based tool unlocks
- LINE OA and workspace context

External providers become the **execution plane**:

- PDF/PNG rendering
- media generation and editing
- OAuth-heavy integrations
- website build and deploy pipelines
- domain-specific mini-products
- long-running jobs
- specialized data fetching

The migration should not create many one-off integrations. It should first introduce a small provider contract and a shared Vaja-side adapter. Then individual tools can move one at a time.

The desired end state is:

```text
Essential Vaja tools remain local.
Advanced tools expose provider APIs.
Agents and users still see one unified Vaja tool experience.
```

---

## User Stories

1. As a Vaja user, I want my agent to use specialized tools without leaving chat, so that I can keep working in one assistant experience.

2. As a Vaja user, I want advanced tools to remain visible in the sidebar when useful, so that I can configure or run them manually.

3. As a Vaja user, I want heavy jobs like certificate generation, video generation, or website publishing to start quickly, so that the app does not feel blocked.

4. As a Vaja user, I want tool results to appear in my chat history and run history, so that I can find past outputs later.

5. As a Vaja user, I want generated files to remain available through Vaja artifacts, so that external provider URLs do not become fragile product links.

6. As a Vaja user, I want the agent to ask for approval before tools perform writes or external side effects, so that I stay in control.

7. As a Vaja user, I want the same credit balance to pay for externalized tools, so that I do not need separate billing accounts for every tool.

8. As a Vaja user, I want clear error messages when an external provider is unavailable, so that I understand whether to retry or change my input.

9. As a Vaja user, I want tool output to look consistent whether the work runs inside Vaja or in a provider service, so that the experience feels reliable.

10. As a Vaja user, I want externalized tools to respect my workspace and LINE context, so that the tool output matches the work I am doing.

11. As a LINE OA business owner, I want customer-facing flows to continue working even when specialized tools are external, so that LINE remains the front door.

12. As a LINE OA business owner, I want long-running outputs to notify or update the conversation when ready, so that customers are not left waiting.

13. As a teacher, I want advanced quiz or certificate tools to have richer configuration than chat alone can support, so that classroom materials fit my real workflow.

14. As a clinic user, I want patient intake and case workspace context to stay inside Vaja, so that sensitive workspace data is not sent to tools unnecessarily.

15. As a marketer, I want media and brand-photo generation to scale independently, so that creative generation does not slow down the whole control room.

16. As a developer, I want one provider contract for external tools, so that each new external tool does not invent its own API pattern.

17. As a developer, I want Vaja services to stay canonical, so that sidebar routes and agent adapters do not duplicate business logic.

18. As a developer, I want client components to import manifests only, so that externalization does not break the client-safe registry split.

19. As a developer, I want `toolRun` to remain the source of execution history, so that observability stays unified.

20. As a developer, I want provider calls to be testable behind adapters, so that migrations can be verified without running every external service.

21. As a developer, I want each external provider to declare schema and capabilities, so that Vaja can validate requests before sending them.

22. As a developer, I want idempotency keys for provider execution, so that retries do not create duplicate external side effects.

23. As an admin, I want to see external tool health and failure rates, so that support can quickly identify provider issues.

24. As an admin, I want tool migration status to be visible, so that we know which tools are local, external-ready, hybrid, or externalized.

25. As an admin, I want dangerous provider permissions to be explicit, so that external tools cannot silently receive broad user data.

26. As a future partner developer, I want a public contract for tool providers, so that I can build a tool that Vaja agents can use.

27. As a future marketplace creator, I want my specialized tool to expose a Vaja-compatible manifest, so that users can install it without custom code.

28. As a support engineer, I want provider errors, request IDs, and run IDs connected, so that I can debug a failed run end to end.

29. As a product owner, I want Vaja to keep essential tools internal, so that the core product remains fast and coherent.

30. As a product owner, I want niche tools to become separate apps when they grow, so that they can become their own revenue or partner surfaces.

---

## Implementation Decisions

### 1. Vaja Owns Tool Presence

Vaja continues to own:

- manifest registration
- sidebar availability
- agent tool definitions
- approval policy
- run history
- credits
- artifact ownership
- permission checks
- workspace and LINE context scoping

External providers do not decide whether a user or agent may run a tool. They execute only after Vaja has authorized and validated the request.

### 2. Providers Own Specialized Execution

Provider services own heavy or specialized execution:

- rendering
- media generation
- OAuth connector calls
- deployment pipelines
- long-running jobs
- provider-specific retries
- specialized configuration UI

The provider receives a scoped payload, not a raw chat transcript or full workspace dump by default.

### 3. Start With a Vaja-Side Adapter, Not a Full Marketplace

The first milestone is an internal provider adapter model. It should support first-party external services before supporting third-party providers.

This avoids overbuilding marketplace governance before the runtime contract is proven.

### 4. Keep One Canonical Service Per Tool

The existing architecture rule remains:

```text
Sidebar -> API route -> service.ts
Agent   -> agent.ts  -> service.ts
```

For externalized tools, `service.ts` becomes a local orchestration adapter:

- validate local invariants
- create or update `toolRun`
- call the provider client
- normalize provider output
- persist artifacts if needed
- return a Vaja `ToolExecutionResult`

The agent adapter remains thin.

### 5. Introduce Provider Metadata Without Breaking Existing Manifests

The first migration should avoid a large registry rewrite. Add optional provider metadata to registered tools or maintain a server-side provider registry.

Recommended metadata:

- execution mode: `local`, `external`, or `hybrid`
- provider key
- sync or async support
- configure URL support
- health check support
- estimated credit policy
- required Vaja permissions
- allowed sources: agent, sidebar, API, LINE

Existing local tools continue to work without provider metadata.

### 6. `toolRun` Remains the Execution Ledger

Use the existing run ledger for both local and external tools.

For phase 1, provider metadata can live inside `inputJson` and `outputJson`:

- provider key
- provider run ID
- provider request ID
- provider version
- idempotency key
- cost estimate
- queue state

Add schema columns only when query needs become real.

### 7. External Results Must Normalize Back Into Vaja Artifacts

External providers may return temporary URLs, but Vaja should own long-term artifact references.

Generated outputs should be normalized into existing storage concepts:

- `toolArtifact` for files and reports
- `mediaAsset` for generated media that appears in chat/gallery
- provider metadata in `toolRun.outputJson`

Do not make temporary provider URLs the durable product contract.

### 8. Provider Calls Use Explicit Context Payloads

External providers should receive structured context only:

- user-scoped run metadata
- selected input fields
- selected artifact IDs or signed file URLs
- selected brand fields only when required
- selected LINE/channel metadata only when required

Do not send full memory, full thread history, full workspace state, or full LINE logs by default.

### 9. Credits Stay Centralized

Vaja remains the billing surface.

The provider can return usage metadata, but Vaja owns:

- preflight estimate
- credit authorization
- final deduction or adjustment
- failed-run policy
- admin reporting

### 10. Migration Is Tool-by-Tool

No big-bang rewrite.

Migrate one candidate at a time using the same pattern:

1. classify tool as local, external-ready, hybrid, or keep-local
2. define provider contract for that tool
3. build provider client
4. switch Vaja `service.ts` to adapter mode behind a feature flag
5. run local and external paths in parallel if needed
6. cut over after tests and manual QA

---

## Tool Classification

### Strong Candidates To Externalize First

| Tool group | Recommendation | Reason |
| --- | --- | --- |
| `certificate` | Externalize first | Clear input/output boundary, rendering-heavy PDF/PNG generation, existing generator layer. |
| `audio`, `speech`, `video` | Externalize or consolidate behind media provider | Async compute, memory/CPU requirements, queue and callback lifecycle. |
| `image`, `brand-photos` | Externalize as Vaja Media provider | Generation/editing pipelines and brand photo storage can scale separately. |
| `google-sheets`, `google-docs`, `google-drive`, `google-slides` | Externalize connector execution later | OAuth token lifecycle and third-party API reliability are connector-service concerns. |
| `website-builder`, `deploy` | Externalize as Vaja Web Publisher | Mini-product with build/deploy pipeline, artifact hosting, and richer UI needs. |

### Consider Later

| Tool group | Recommendation | Reason |
| --- | --- | --- |
| `exam-builder`, `quiz` | Keep internal until assessment product grows | Basic generation is close to education skills; externalize if banks, grading, analytics, and classroom workflows deepen. |
| `crop-price` | Externalize data provider, keep workflow internal | Market data fetching is decoupled, but agriculture skill behavior should stay in Vaja. |
| `record-keeper` | Decide after coupling audit | If it is structured memory, keep internal. If it becomes a vertical accounting/farm ledger, externalize. |

### Keep Internal

| Tool group | Recommendation | Reason |
| --- | --- | --- |
| `content-marketing`, `long-form`, `repurposing` | Keep core flows internal | These depend on brand context, content calendar, LINE channel data, and Vaja's agent identity. |
| `analytics`, `distribution` | Keep orchestration internal | Deeply tied to LINE OA, content metrics, credits, approvals, and workspace reporting. |
| `brand-guardrails`, `collaboration` | Keep internal | They need real-time brand and approval context in the same workspace. |
| `platform-agent` | Keep internal | It is Vaja's meta-agent and must inspect platform state. |
| `domain-profiles`, `case-workspace` | Keep internal | They are workspace memory and professional context, not execution-only tools. |

### Hybrid Rule

When in doubt:

```text
Keep user/workspace intelligence internal.
Externalize specialized execution.
```

Examples:

- Case Workspace stays internal, but a domain-specific analysis engine can be external.
- Content planning stays internal, but file export/rendering can be external.
- Brand policy stays internal, but brand image generation can be external.
- Distribution orchestration stays internal, but a specific channel connector can be external.

---

## Provider Contract

### Required Provider Capabilities

Every provider should support:

- manifest discovery
- health check
- synchronous run for short jobs
- async start for long jobs
- status lookup
- result retrieval
- error normalization
- version reporting

### Recommended Provider Endpoints

```text
GET  /.well-known/vaja-tool-provider.json
GET  /health
POST /v1/tools/{toolSlug}/run
POST /v1/tools/{toolSlug}/runs
GET  /v1/runs/{providerRunId}
GET  /v1/runs/{providerRunId}/artifacts
POST /v1/runs/{providerRunId}/cancel
```

### Provider Manifest Shape

Provider manifests should declare:

- provider ID
- provider version
- tool slug
- display metadata
- input schema
- output schema
- artifact schema
- execution modes
- timeout limits
- idempotency support
- required permissions
- billing hints
- configuration URL if the provider owns advanced setup UI

### Vaja Request Envelope

Provider requests should use a stable envelope:

```text
requestId
idempotencyKey
vajaRunId
toolSlug
source
userRef
workspaceRef
threadRef
lineRef
input
artifacts
context
callbackUrl
metadata
```

Privacy rule:

`context` must be allowlisted per tool. It is not a place to dump all agent context.

### Vaja Response Envelope

Provider responses should normalize into:

```text
providerRunId
status
title
summary
data
artifacts
usage
error
createdAt
completedAt
```

Vaja then maps this into `ToolExecutionResult` and persisted run/artifact records.

---

## Security and Permission Decisions

1. Vaja authenticates users and agents before calling providers.

2. Vaja signs provider requests using service-to-service credentials.

3. Provider requests include a short-lived run token or signature, not user session cookies.

4. Providers cannot call Vaja internal APIs freely. They may only use callback URLs or explicit artifact upload URLs.

5. Mutable external actions require approval unless the tool is explicitly configured as safe.

6. Provider payloads must be scoped to the minimum data required.

7. External file URLs must be validated or converted to signed Vaja storage URLs before provider use.

8. Provider callbacks must be authenticated and idempotent.

9. Provider errors must not leak secrets, raw tokens, or internal stack traces to users.

10. Admin logs may include provider request IDs but should not include sensitive input payloads by default.

---

## Testing Decisions

Good tests should verify observable behavior at the Vaja interface:

- enabled tools appear in the correct registry surfaces
- agent tools call the canonical service
- service creates and updates `toolRun` correctly
- provider adapter sends the expected envelope
- provider adapter normalizes success, pending, and failure results
- approval flags are preserved for write tools
- artifacts are persisted or referenced consistently
- user/workspace ownership is enforced before provider calls
- retries use idempotency keys
- provider callbacks are authenticated and idempotent

Do not write brittle tests that assert implementation details inside a provider. The Vaja-side adapter is the main test surface.

### Modules To Test First

- provider registry and manifest resolver
- provider client
- external tool service adapter
- `certificate` migration adapter
- run lifecycle helpers
- callback route
- artifact normalization
- agent approval policy

### Prior Art In The Codebase

Use existing test patterns around:

- registry wiring
- user-created tool runtime execution
- media job lifecycle
- service-layer authorization
- API route Zod validation
- agent write-tool approval flags

---

## Out Of Scope

This PRD does not include:

- public third-party tool marketplace
- arbitrary external code execution
- marketplace review workflow
- full MCP replacement
- moving all tools at once
- moving workspace memory or case data out of Vaja
- changing the core skills engine
- redesigning the credit system from scratch
- replacing existing user-created tools
- requiring every provider to have its own UI

---

## Further Notes

This migration supports Vaja's core vision: the platform should stay general, skills should carry domain knowledge, and tools should perform structured work.

Externalizing execution should make Vaja more focused, not less integrated. The product experience should still feel like one agent workspace.

The highest-risk mistake would be splitting the UX before the provider contract is mature. The safest migration is to keep Vaja's current registry, agent, sidebar, credit, and run-history interfaces stable while only changing where selected execution happens.

---

# Implementation Plan

## Phase 0 - Classification and Runbook

Goal: make migration status explicit before changing runtime behavior.

Deliver:

- create a tool classification table in documentation
- add each current tool to one of: keep-local, external-ready, hybrid, defer
- document why each tool is classified that way
- select `certificate` as the tracer-bullet migration
- define rollback criteria for each migrated tool

Concrete work:

- Add this document to the normal planning queue.
- Update the tool architecture docs after the first migration succeeds.
- Add a short "externalization status" note to future tool implementation guides.

Acceptance criteria:

- Product and engineering can point to one migration sequence.
- There is no disagreement about why `certificate` goes first.
- Keep-local tools are protected from accidental externalization.

## Phase 1 - Provider Contract and Vaja Adapter Runtime

Goal: introduce the provider interface without moving any production tool yet.

New modules to add:

```text
features/external-tools/types.ts
features/external-tools/schema.ts
features/external-tools/provider-client.ts
features/external-tools/service.ts
features/external-tools/run-lifecycle.ts
features/external-tools/artifacts.ts
features/external-tools/errors.ts
features/external-tools/registry.ts
```

Responsibilities:

- `types.ts`: shared provider request/response types.
- `schema.ts`: Zod schemas for provider envelopes and normalized results.
- `provider-client.ts`: signed HTTP client with timeout, retry, and idempotency support.
- `service.ts`: provider lookup and high-level run orchestration.
- `run-lifecycle.ts`: helper functions to create, complete, fail, and reconcile `toolRun`.
- `artifacts.ts`: map provider artifacts into Vaja artifacts.
- `errors.ts`: normalize provider failure modes.
- `registry.ts`: server-only provider registry for first-party providers.

Existing modules to extend:

```text
features/tools/registry/types.ts
features/tools/registry/server.ts
db/schema/tools.ts
app/api/kie/callback/route.ts, only if shared callback logic is generalized later
```

Recommended additions to tool registry types:

```text
ToolExecutionMode = local | external | hybrid
ExternalToolProviderMetadata
ToolProviderHealthStatus
```

Avoid database schema changes in this phase unless necessary. Store provider run IDs in `toolRun.inputJson` and `toolRun.outputJson` first.

Acceptance criteria:

- A fake provider can execute a test tool through the adapter.
- Vaja creates a `toolRun` before provider execution.
- Success, pending, failed, and timeout states normalize into one result shape.
- Provider errors become user-safe messages.
- Type-check passes.

## Phase 2 - Certificate Tracer Bullet

Goal: migrate certificate execution behind the provider contract while preserving all existing Vaja behavior.

Why certificate first:

- clear I/O boundary
- rendering-heavy output
- separate generator already exists
- existing API routes and agent tools can keep their shape
- easy for manual QA because output files are visible

Vaja-side changes:

```text
features/certificate/service.ts
features/certificate/agent.ts
features/certificate/schema.ts
app/api/certificate/generate/route.ts
app/api/certificate/batch/route.ts
app/api/certificate/jobs/route.ts
app/api/certificate/jobs/[id]/route.ts
features/certificate/components/certificate-tool-page.tsx
```

Provider-side app:

```text
apps/certificate-provider/
  app/api/health/route.ts
  app/api/v1/tools/certificate/run/route.ts
  app/api/v1/tools/certificate/runs/route.ts
  app/api/v1/runs/[providerRunId]/route.ts
  lib/render-certificate.ts
  lib/provider-contract.ts
```

If this repo should not host provider apps, create a separate repository later. During the tracer bullet, an `apps/` workspace package is acceptable if it helps local development.

Migration approach:

1. Keep existing local certificate generation path.
2. Add external provider path behind an env flag.
3. Build adapter so `generateCertificateOutput` can call local or external execution.
4. Preserve the existing agent tool names.
5. Preserve the existing sidebar/API route behavior.
6. Store provider run metadata in the existing certificate job/run output.
7. Persist returned PDF/PNG artifacts into Vaja storage.
8. Compare local and external outputs with a small fixture set.
9. Switch default to external only after QA.
10. Keep local fallback until provider reliability is proven.

Acceptance criteria:

- Existing certificate sidebar flow still works.
- Existing certificate agent tools still work.
- Generated outputs are available from Vaja URLs.
- Batch and single-recipient generation both work.
- Failed provider runs update Vaja run history.
- Retried runs do not duplicate outputs when the idempotency key is reused.
- Feature flag can roll back to local execution.

## Phase 3 - Shared Async Provider Jobs

Goal: make long-running external jobs first-class across providers.

Build or generalize:

```text
app/api/external-tools/callback/[providerKey]/route.ts
app/api/external-tools/runs/[runId]/route.ts
features/external-tools/callbacks.ts
features/external-tools/status.ts
features/external-tools/polling.ts
```

Responsibilities:

- accept authenticated provider callbacks
- map provider run IDs to Vaja `toolRun` records
- update pending, success, failure, timeout, and cancelled states
- hydrate artifacts after completion
- expose a user-scoped status endpoint for tool pages and chat components

Acceptance criteria:

- Async provider jobs can complete by callback or polling.
- Duplicate callbacks are harmless.
- Users cannot read another user's external run status.
- Admin tooling can inspect provider run IDs and Vaja run IDs together.

## Phase 4 - Vaja Media Provider

Goal: consolidate media execution behind one provider-style contract.

Candidate tools:

```text
features/image
features/brand-photos
features/video
features/audio
features/speech
```

Recommended approach:

- Do not disrupt the current KIE-backed media job system immediately.
- Wrap the current media job model in the external provider contract.
- Keep provider-specific logic behind media adapters.
- Normalize outputs into `mediaAsset` and `toolArtifact`.
- Keep chat hydration and gallery behavior inside Vaja.

Acceptance criteria:

- Chat media generation still uses the same pending/success/failure UX.
- Tool pages still show job progress.
- Brand photo generation can use brand context without sending full brand/workspace data.
- Media provider failures do not break text chat.

## Phase 5 - Vaja Integrations Provider

Goal: move connector execution and OAuth-heavy third-party API work out of the core app when ready.

Candidate tools:

```text
features/google-sheets
features/google-docs
features/google-drive
features/google-slides
```

Recommended approach:

- Keep connected account UX visible in Vaja.
- Decide whether tokens remain in Vaja or move to the integrations provider.
- If tokens move, migrate with an explicit secret-rotation plan.
- Keep Vaja approval policy and run ledger central.
- Keep read/write tool names stable for agents.

Acceptance criteria:

- Google tools still ask approval for writes.
- Read tools remain low-friction.
- OAuth reconnect and scope errors are user-readable.
- Runs still appear in Vaja admin and user history.

## Phase 6 - Vaja Web Publisher

Goal: externalize website building and deployment as its own product surface.

Candidate tools:

```text
features/website-builder
features/deploy
```

Recommended approach:

- Treat website generation, preview, deployment, and hosting as one external provider family.
- Keep Vaja agent orchestration and approval in the main app.
- Let the provider own advanced editor/configuration UI if needed.
- Return deploy previews, URLs, and PR links through Vaja artifacts.

Acceptance criteria:

- Agent can preview before deploy.
- Deploy requires approval.
- Existing web deploy history remains visible.
- Provider can scale build/deploy workers separately.

## Phase 7 - Optional External Tool Marketplace Foundation

Goal: prepare for partner providers only after first-party providers are stable.

Do not start here.

Potential future work:

- public provider documentation
- provider registration flow
- admin review workflow
- provider trust tiers
- marketplace billing splits
- provider analytics
- version compatibility checks

Acceptance criteria:

- At least two first-party providers are stable before marketplace work begins.
- Security review is complete.
- Billing and data-sharing policies are explicit.

---

# File-Level Migration Map

## Core Runtime

Add:

```text
features/external-tools/types.ts
features/external-tools/schema.ts
features/external-tools/provider-client.ts
features/external-tools/service.ts
features/external-tools/run-lifecycle.ts
features/external-tools/artifacts.ts
features/external-tools/errors.ts
features/external-tools/registry.ts
features/external-tools/__tests__/provider-client.test.ts
features/external-tools/__tests__/run-lifecycle.test.ts
```

Edit:

```text
features/tools/registry/types.ts
features/tools/registry/server.ts
features/tools/registry/client.ts, only if manifest metadata must be client-visible
lib/tools/index.ts, only if provider context must be forwarded to registry tools
db/schema/tools.ts, only if provider metadata columns become necessary
```

## Certificate Tracer Bullet

Edit:

```text
features/certificate/service.ts
features/certificate/agent.ts, only if tool descriptions mention async behavior
features/certificate/schema.ts, if provider-specific limits need validation
app/api/certificate/generate/route.ts
app/api/certificate/batch/route.ts
app/api/certificate/jobs/route.ts
app/api/certificate/jobs/[id]/route.ts
features/certificate/components/certificate-tool-page.tsx
```

Add if provider app lives in this repo:

```text
apps/certificate-provider/
```

Add tests:

```text
features/certificate/__tests__/external-provider-adapter.test.ts
features/certificate/__tests__/certificate-run-lifecycle.test.ts
```

## Callback and Status

Add:

```text
app/api/external-tools/callback/[providerKey]/route.ts
app/api/external-tools/runs/[runId]/route.ts
features/external-tools/callbacks.ts
features/external-tools/status.ts
```

---

# Migration Risks and Mitigations

## Risk 1 - Too Many Services Too Early

Mitigation:

- Start with one provider contract and one tracer-bullet service.
- Do not split every tool immediately.
- Keep local fallback for the first migration.

## Risk 2 - UX Fragmentation

Mitigation:

- Vaja keeps manifests, sidebar links, approvals, credits, and run history.
- Provider configuration pages are optional, not the primary user journey.
- Results always return through Vaja.

## Risk 3 - Data Over-Sharing

Mitigation:

- Use allowlisted context payloads.
- Send artifact IDs or signed URLs instead of raw workspace dumps.
- Keep case workspace, memory, LINE logs, and brand policies internal unless explicitly required.

## Risk 4 - Billing Drift

Mitigation:

- Vaja owns preflight and final credit accounting.
- Provider returns usage metadata only.
- Failed or cancelled runs follow Vaja refund/adjustment policy.

## Risk 5 - Retry Duplicates

Mitigation:

- Every provider request gets an idempotency key.
- Provider `run` and `startRun` endpoints must be idempotent.
- Vaja records provider run IDs in `toolRun`.

## Risk 6 - Provider Downtime

Mitigation:

- Add health checks.
- Surface provider-specific but user-safe errors.
- Keep local fallback for tracer-bullet migration until stable.
- Add admin visibility for external provider failure rates.

---

# Recommended Delivery Order

1. Approve this PRD and classify current tools.
2. Build `features/external-tools`.
3. Add fake provider tests.
4. Migrate `certificate` behind feature flag.
5. Add callback/status routes.
6. Cut over certificate after QA.
7. Wrap media tools behind the provider contract.
8. Move Google connector execution only after token ownership is decided.
9. Externalize website builder/deploy as a product provider.
10. Revisit quiz, exam-builder, crop-price, and record-keeper after real usage data.

---

# Acceptance Criteria

The architecture is ready for broader migrations when:

1. Vaja can run a tool through an external provider without changing the agent-facing tool name.

2. Vaja can record pending, success, failure, and timeout states for an external provider run.

3. Vaja can persist or reference provider artifacts through existing artifact surfaces.

4. Vaja can retry provider calls safely with idempotency keys.

5. Vaja can roll back the certificate migration to local execution.

6. Agent write-tool approval behavior remains unchanged after externalization.

7. Client components still import manifests only.

8. API routes and agent adapters still call one canonical `service.ts`.

9. Users can see external tool results in the same run history surfaces as local tools.

10. Admins can diagnose provider failures using Vaja run IDs and provider request IDs.

---

# Final Recommendation

Proceed with externalization, but keep it disciplined.

The correct first move is not "turn Vaja into microservices." The correct first move is:

```text
one provider contract
one shared Vaja adapter runtime
one tracer-bullet migration
one rollback path
```

Use `certificate` to prove the model. Then migrate media, integrations, and web publishing only after the provider contract has survived real use.

Vaja should remain the place where skills, agents, LINE OA, credits, memory, and workspace context come together. External providers should make the platform more capable without pulling the center of gravity away from Vaja.
