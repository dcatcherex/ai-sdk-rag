# Agent Run Service Implementation Guide

> Audience: AI coders and developers working on web chat, public shared-agent chat, and LINE OA.
> Purpose: establish one canonical agent execution path so every channel uses the same agent logic, with channel-specific limits layered on top.

## Progress Update

Last updated: 2026-04-27

- [x] Added shared channel-neutral runtime contracts in `features/agents/server/run-types.ts`
- [x] Added explicit per-channel defaults in `features/agents/server/channel-policies.ts`
- [x] Added `features/agents/server/run-service.ts` with shared preparation, text execution, image intent detection, and canonical image-start helpers
- [x] Switched web chat direct-image startup to the canonical shared helper
- [x] Switched LINE direct-image startup to the canonical shared helper
- [x] Migrated shared-link chat to shared preparation and canonical direct-image startup
- [x] Migrated the standard LINE text path to `prepareAgentRun()`
- [x] Migrated the full web chat preparation flow to `prepareAgentRun()`
- [x] Added cross-channel runtime coverage for shared policies and message/tool normalization helpers

---

## 1. Why This Exists

Vaja AI is agent-first. A user should get the same coworker brain whether they talk through:

- Web chat: `app/api/chat/route.ts`
- Public shared-agent link: `app/api/agent/[token]/chat/route.ts`
- LINE OA: `features/line-oa/webhook/events/message.ts`

Today these paths share some helpers, but each path still owns too much runtime logic. That causes behavior drift:

- Web can generate images through a direct async image route, while LINE may depend on the text model choosing a tool.
- Web has richer prompt assembly, memory, routing, model selection, observability, and image reference handling.
- Shared links use a simpler agent path and can miss newer web behavior.
- LINE has useful channel-specific behavior, but some agent/business logic lives directly inside the webhook handler.

The goal is:

```txt
Agent logic lives once.
Channels adapt input, output, identity, and limits.
```

---

## 2. Target Architecture

```txt
Web chat route
Shared link route
LINE webhook
        |
        v
Channel adapter
- Parse request/event
- Resolve caller identity and billing owner
- Resolve thread/conversation
- Apply channel limits and capabilities
        |
        v
features/agents/server/run-service.ts
- Resolve agent
- Resolve skills
- Resolve brand
- Resolve memory
- Resolve documents and tools
- Route model
- Detect direct media intent
- Execute text/image/tool run
- Return channel-neutral result events
        |
        v
Channel renderer
- Web: UI message stream
- Shared link: UI message stream plus share limits
- LINE: plain text reply, async push image/video, no markdown
```

The shared service should not import LINE SDK, React UI code, or route-specific response helpers. It should return structured results that each adapter can render.

---

## 3. Current Shared Building Blocks

These are already good foundations and should be reused:

| Concern | Current file |
|---|---|
| Agent base prompt | `features/agents/server/runtime.ts` |
| Skill runtime | `features/agents/server/runtime.ts`, `features/skills/service.ts` |
| Brand runtime | `features/agents/server/runtime.ts`, `features/agents/server/brand-resolution.ts` |
| Prompt assembly | `features/chat/server/prompt-assembly.ts` |
| Tool ID merging | `features/agents/server/runtime.ts` |
| Canonical tool set | `lib/tools/index.ts` |
| Agent tool wrappers | `lib/agent-tools.ts` |
| Image generation service | `features/image/service.ts` |
| Image model selection | `features/image/model-selection.ts` |
| Chat persistence | `features/chat/server/persistence.ts` |
| Model routing | `features/chat/server/routing.ts` |
| Credit accounting | `lib/credits.ts` |

The new service should compose these instead of replacing them.

---

## 4. New Files To Add

### `features/agents/server/run-types.ts`

Define channel-neutral runtime contracts.

```ts
export type AgentRunChannel = 'web' | 'shared_link' | 'line';

export type AgentRunMode = 'text' | 'image' | 'video';

export type AgentRunIdentity = {
  channel: AgentRunChannel;
  userId: string | null;
  billingUserId: string;
  guestId?: string | null;
  lineUserId?: string | null;
  isOwner?: boolean;
};

export type AgentRunInputMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: unknown[];
};

export type AgentRunPolicy = {
  maxSteps: number;
  allowTools: boolean;
  allowMcp: boolean;
  allowMemoryRead: boolean;
  allowMemoryWrite: boolean;
  allowPromptEnhancement: boolean;
  allowDirectImageGeneration: boolean;
  allowDirectVideoGeneration: boolean;
  responseFormat: 'ui_stream' | 'plain_text';
};

export type AgentRunRequest = {
  identity: AgentRunIdentity;
  threadId: string;
  agentId?: string | null;
  activeBrandId?: string | null;
  selectedDocumentIds?: string[];
  messages: AgentRunInputMessage[];
  model?: string | 'auto' | null;
  enabledModelIds?: string[];
  useWebSearch?: boolean;
  policy: AgentRunPolicy;
  channelContext?: Record<string, unknown>;
};

export type AgentRunTextResult = {
  type: 'text';
  text: string;
  toolCallCount: number;
  imageUrls: string[];
  modelId: string;
  creditCost: number;
};

export type AgentRunImageStartedResult = {
  type: 'image_started';
  prompt: string;
  taskId: string;
  generationId: string;
  modelId: string;
  creditCost: number;
};

export type AgentRunResult = AgentRunTextResult | AgentRunImageStartedResult;
```

Keep this file mostly type-only. It should be safe to import from routes, LINE handlers, and tests.

### `features/agents/server/channel-policies.ts`

Define policy defaults per channel.

```ts
export const WEB_AGENT_RUN_POLICY = {
  maxSteps: 5,
  allowTools: true,
  allowMcp: true,
  allowMemoryRead: true,
  allowMemoryWrite: true,
  allowPromptEnhancement: true,
  allowDirectImageGeneration: true,
  allowDirectVideoGeneration: false,
  responseFormat: 'ui_stream',
} as const;

export const SHARED_LINK_AGENT_RUN_POLICY = {
  maxSteps: 5,
  allowTools: true,
  allowMcp: false,
  allowMemoryRead: false,
  allowMemoryWrite: false,
  allowPromptEnhancement: false,
  allowDirectImageGeneration: true,
  allowDirectVideoGeneration: false,
  responseFormat: 'ui_stream',
} as const;

export const LINE_AGENT_RUN_POLICY = {
  maxSteps: 5,
  allowTools: true,
  allowMcp: false,
  allowMemoryRead: true,
  allowMemoryWrite: true,
  allowPromptEnhancement: false,
  allowDirectImageGeneration: true,
  allowDirectVideoGeneration: true,
  responseFormat: 'plain_text',
} as const;
```

Policies are product decisions. Keep them explicit instead of hiding conditions deep in handlers.

### `features/agents/server/run-service.ts`

Own the canonical runtime flow.

High-level public API:

```ts
export async function prepareAgentRun(request: AgentRunRequest): Promise<PreparedAgentRun>;

export async function runAgentText(prepared: PreparedAgentRun): Promise<AgentRunTextResult>;

export async function startAgentImageRun(prepared: PreparedAgentRun): Promise<AgentRunImageStartedResult>;

export async function runAgent(request: AgentRunRequest): Promise<AgentRunResult>;
```

`prepareAgentRun()` should be the main shared seam. Web can still stream after preparation, while LINE can run non-streaming text.

---

## 5. Canonical Runtime Flow

The shared service should perform these stages in this order:

1. Resolve agent.
   - Authenticated web: explicit `agentId`, starter agent fallback, platform agent special case.
   - Shared link: agent from `publicAgentShare.agentId`.
   - LINE: channel default agent or rich-menu-selected active agent.

2. Resolve last user prompt.
   - Use one helper for UI message parts, plain LINE text, and shared-link messages.

3. Resolve skills.
   - Use `resolveAgentSkillRuntime(agent, lastUserPrompt)`.
   - This must behave the same across web, shared link, and LINE.

4. Resolve brand.
   - Use `resolveAgentBrandRuntime()`.
   - Brand blocking rules should apply before any model call.

5. Resolve memory.
   - Web: user memory, thread working memory, shared brand memory.
   - LINE linked user: user memory where allowed.
   - LINE unlinked user: LINE user memory where allowed.
   - Shared link: disabled by default unless explicitly designed later.

6. Resolve documents.
   - Merge agent documents and request-selected documents with `mergeAgentDocumentIds()`.

7. Resolve tools.
   - Use canonical `buildToolSet()` or `createAgentTools()`.
   - Add a channel override only when the output contract truly differs.
   - LINE-specific tools should be wrappers around canonical services, not separate business logic.

8. Route model.
   - Reuse `getModelByIntent()`.
   - Agent default model should be honored consistently.
   - Direct image intent should not depend only on the LLM choosing a tool.

9. Assemble prompt.
   - Use `buildAgentRunSystemPrompt()`.
   - Apply channel constraints through `extraBlocks`, not by forking the whole prompt path.

10. Execute.
   - Text: `streamText()` for UI channels, `generateText()` for LINE if streaming is not needed.
   - Image: `triggerImageGeneration()` through one shared helper.
   - Video: keep LINE video generation channel-specific until there is a canonical video service.

11. Persist, audit, and bill.
   - Persistence should use channel-neutral message records where possible.
   - Billing owner may differ from caller:
     - Web: user pays.
     - Shared link: agent owner pays.
     - LINE: channel owner pays.

---

## 6. Channel Responsibilities

### Web Chat

The web route should eventually become:

```txt
parse request
auth user
resolve thread
call prepareAgentRun()
if prepared.mode is image: return UI tool event stream
else stream prepared model run as UI messages
```

Web-specific responsibilities:

- UI message stream shape
- file/image upload hydration
- interactive quiz context from client UI
- compare mode stays separate unless folded into agent runs later
- user-facing model selector metadata

### Public Shared-Agent Link

The shared route should eventually become:

```txt
validate share token/password/expiry
resolve guest thread
enforce share limits
call shared AgentRunService with billingUserId = agent owner
render UI stream
record share analytics
```

Shared-link-specific responsibilities:

- password/session validation
- `maxUses`, `guestMessageLimit`, `creditLimit`
- anonymous session persistence
- share analytics events
- no user private memory by default
- no MCP credentials by default

### LINE OA

The LINE handler should eventually become:

```txt
parse LINE event
resolve channel, LINE user, linked user, active agent
call AgentRunService
render as LINE messages
push async media when ready
record LINE analytics
```

LINE-specific responsibilities:

- reply token timing
- loading animation
- plain text output
- no markdown
- message length limits
- max LINE messages per reply
- image/video push after async generation
- rich menu agent selection
- account linking and payment commands
- group chat addressing

Do not put agent reasoning, prompt rules, tool business logic, or brand selection in the LINE handler unless it is truly LINE-only.

---

## 7. Direct Image Generation Rule

Image generation should be canonical.

Current practical bug class:

```txt
User asks LINE: "create social post ..."
Text model says it can do it or asks for more detail
No image job starts
```

Target behavior:

```txt
User asks any channel: "create social post ..."
AgentRunService detects image intent
AgentRunService starts triggerImageGeneration()
Channel renderer acknowledges and displays/pushes result
```

Shared helper to create:

```ts
export function wantsImageGeneration(text: string): boolean;

export async function startCanonicalAgentImageGeneration(input: {
  prompt: string;
  userId: string;
  threadId?: string;
  activeBrand?: Brand | null;
  referenceImageUrls?: string[];
  source: 'chat' | 'agent' | 'shared_link' | 'line';
}): Promise<AgentRunImageStartedResult>;
```

Use:

- `buildBrandImageContext()`
- `buildImageBrandSuffix()`
- `inferChatImageTaskHint()`
- `resolveAdminImageModel()`
- `triggerImageGeneration()`

Do not duplicate this sequence in web and LINE.

---

## 8. Tool Architecture Rules

Keep the existing tool rule:

```txt
Sidebar/API/Agent adapter -> service.ts
```

For channel-aware tools:

- Canonical business logic stays in the feature `service.ts`.
- Agent adapters stay thin.
- LINE wrappers may adapt the result to LINE delivery, but should still call the same service.
- Never copy content generation logic into `features/line-oa/webhook/tools.ts`.

Preferred pattern:

```txt
features/image/service.ts
  triggerImageGeneration()

features/image/agent.ts
  createImageAgentTools()

features/line-oa/webhook/tools.ts
  LINE delivery wrapper only
```

---

## 9. Migration Plan

### Phase 1: Extract Shared Preparation

Create:

- `features/agents/server/run-types.ts`
- `features/agents/server/channel-policies.ts`
- `features/agents/server/run-service.ts`

Move shared preparation logic from `app/api/chat/route.ts` into `prepareAgentRun()`:

- skill runtime
- brand runtime
- document merge
- tool ID merge
- model routing
- prompt assembly
- credit cost calculation

Keep web route behavior identical.

Validation:

```bash
pnpm exec tsc --noEmit
```

### Phase 2: Move Canonical Image Start

Create a shared image-start helper inside `run-service.ts` or `features/agents/server/media.ts`.

Replace duplicated direct image logic in:

- `app/api/chat/route.ts`
- `features/line-oa/webhook/events/message.ts`

Shared-link chat should gain the same direct image behavior if the share policy allows images.

### Phase 3: Convert Shared-Link Chat

Update `app/api/agent/[token]/chat/route.ts` to call `prepareAgentRun()`.

Preserve these share-only guards before calling the service:

- token exists
- active
- not expired
- password verified
- max uses not exceeded
- guest message limit not exceeded
- credit limit not exceeded

Billing:

```txt
billingUserId = agentRow.userId
caller userId = null
channel = shared_link
```

### Phase 4: Convert LINE Text Path

Update `features/line-oa/webhook/events/message.ts` so standard text handling calls the shared service.

Keep these in LINE:

- account link commands
- registration
- top-up
- slip verification
- audio transcription
- incoming image/video analysis
- reply rendering
- async push delivery

Move these out of LINE:

- direct image prompt construction
- brand image context selection
- image model selection
- generic agent tool assembly
- generic prompt assembly

### Phase 5: Observability and Tests

Ensure all channels record comparable metadata:

- channel
- agentId
- resolved model
- route kind
- active skill IDs
- tool call count
- billing user
- credit cost

Use `chatRun` where a real user FK exists. For guest and LINE-only cases, either add a nullable runtime audit table or store equivalent analytics in channel tables.

---

## 10. Test Plan

### Unit Tests

Add tests near `features/agents/server/runtime.test.ts`.

Recommended new tests:

- `prepareAgentRun` activates the same skill for web, shared link, and LINE.
- `prepareAgentRun` applies brand blocking consistently.
- `mergeAgentToolIds` still preserves `null` as all tools.
- image intent detection works for English and Thai prompts.
- LINE policy adds plain-text channel constraints without changing core agent prompt blocks.
- shared-link policy disables private memory and MCP.

### Integration Tests

Use mocked model/tool calls where possible.

Scenarios:

- Web and LINE with same agent and same prompt produce same activated skills and same model route.
- Shared link bills owner, not guest.
- LINE owner image request reaches domain agent path, not management bot.
- Direct image prompt starts `triggerImageGeneration()` without requiring a model tool call.
- Brand-required agent blocks consistently in all channels.

### Manual Smoke Tests

Run:

```bash
pnpm exec tsc --noEmit
pnpm dev
```

Manual flows:

- Web: ask selected Marketing AI to create a social post image.
- Shared link: ask same shared agent the same prompt.
- LINE: send same prompt to linked OA.
- LINE owner account: send same image prompt and confirm it uses the domain agent path.
- LINE normal management request from owner: confirm it still uses management bot.

---

## 11. UX Best Practices

### Product Principle

The user should feel they are talking to the same coworker everywhere.

Web can expose richer controls. LINE should feel lighter. The agent behavior should still be consistent.

### Web

- Show model/tool progress inline.
- Show generated media as soon as async jobs complete.
- Preserve rich controls: model picker, document selection, reference images, quiz UI.
- Let users inspect generation details and artifacts.

### Shared Link

- Keep the UI simple and trust-building.
- Show limits clearly before the user hits them.
- Use owner-configured welcome message.
- Avoid exposing internal controls like model routing unless intended.
- Make failure states human: expired link, budget reached, owner out of credits.

### LINE

- Respond immediately for long tasks.
- Use plain text, no markdown.
- Keep replies short.
- Push media when ready.
- For image generation, say the job started instead of asking for details already provided.
- Use quick replies for next steps where helpful.
- In group chats, keep replies concise and relevant to the whole group.
- Make owner management mode explicit in copy or rich menu, because hidden routing creates confusion.

---

## 12. Common Mistakes

- Do not add new agent behavior only to `app/api/chat/route.ts`.
- Do not add LINE-only business logic if web and shared chat need the same behavior.
- Do not duplicate image prompt construction across channels.
- Do not import `service.ts` or `agent.ts` into client components.
- Do not make shared-link chat a second-class agent runtime.
- Do not let channel constraints rewrite the base agent prompt.
- Do not let public shared links read private user memory by accident.
- Do not let LINE owner management routing swallow customer-facing agent tasks like image generation.

---

## 13. Definition Of Done

This refactor is complete when:

- Web chat, public shared-agent chat, and LINE all call the shared run service.
- Agent skills activate consistently across channels.
- Brand resolution and blocking are consistent across channels.
- Direct image generation starts through one canonical helper.
- Tool sets are built from one canonical source, with only delivery wrappers per channel.
- Channel adapters contain only identity, limits, rendering, and channel-native commands.
- Type-check passes.
- Tests cover at least one same-agent/same-prompt scenario across web, shared link, and LINE.
