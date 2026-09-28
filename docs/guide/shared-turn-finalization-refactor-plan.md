# Shared Turn Finalization — Refactor Plan

**Status:** approved, not started
**Decision record:** `docs/adr/0002-shared-turn-finalization.md`
**Domain terms:** `CONTEXT.md` → "Turn Finalization", "Channel Persistence Adapter"
**Audience:** an AI coder or developer implementing this end-to-end. Work in the
phase order given; each phase compiles, passes tests, and is committable on its own.

---

## 1. Why (context for the implementer)

LINE OA turns currently bypass the shared finalization pipeline
(`features/chat/server/finalization.ts`). Consequences, all verified in code:

1. **LINE turns are never billed.** `prepareConversationTurn` computes `creditCost`
   and the LINE identity carries `billingUserId: context.channel.userId`, but there
   is zero `deductCredits` / `finalizeChatBilling` anywhere under `features/line-oa/`.
   LINE media generation (`media-handlers.ts`, `lib/generation/`) is also unbilled.
2. **LINE turns record no token usage and no audit runs** (no `tokenUsage` insert,
   no `chatRun` records).
3. **Persistence is forked and duplicated.** `persistLineTurn` in
   `features/line-oa/webhook/events/text-replies.ts` (~L109–139) is a raw
   `db.insert(chatMessage)` helper, and `features/line-oa/webhook/events/farm-records.ts`
   (~L221–251) contains a **byte-identical copy**. Together they have ~18 call sites.
4. **`finalizeLineTextConversationTurn`** (`features/agents/server/conversation-turn.ts`
   ~L211–281) is a LINE-specific finalizer living inside the shared runtime that takes
   ~18 fields including two injected callbacks (`persist`, `generateFollowUpSuggestions`)
   — the caller supplies the behavior the module should own.
5. **LINE resolves skills twice per text turn**: `webhook/index.ts` (~L171) resolves a
   skill runtime and builds a system prompt that only media handlers use; the canonical
   text path calls `prepareConversationTurn` without `skillRuntimeOverride`, so
   `prepareAgentRun` re-runs trigger detection **and the LLM skill-discovery call**.

Target: **one finalizer for every channel**, with per-channel persistence adapters.

---

## 2. Decisions already made — do not re-litigate

| Decision | Value |
|---|---|
| LINE billing | **Bill the channel owner** (`billingUserId`), same credit contract as web. Post-turn deduction, no pre-turn balance gate (gate is a flagged follow-up, see §9). |
| Scope | **All LINE paths** — the canonical AI reply *and* every direct-intent shortcut (weather, farm summary, farm-record create, case-workspace drafts, video, image). |
| Cost policy | Explicit `creditCost` on every turn: model cost for AI text turns, image-model cost for media turns, **0 for non-model lookups** (weather, farm summary). A path that bills nothing must pass 0. |
| Suggestions | Follow-up suggestion **generation** is Channel Adapter policy, NOT finalization. LINE generates before sending the reply (quick replies); the adapter passes results in for persistence only. |
| Persistence contracts | Web/shared-link: full-thread rewrite (`persistChatResult`). LINE: **append-only** at explicit positions. Both are legitimate; do NOT route LINE through `persistChatResult` — it would delete-and-reinsert the thread from LINE's limited history window and truncate history. |
| Unlinked LINE users | Memory extraction for users without an app account uses `extractAndStoreLineUserMemory` keyed by `lineUserId`. This branch survives, moved into the shared finalizer. |

---

## 3. Current architecture facts you will build on

Read these files before starting:

| File | What it is |
|---|---|
| `features/chat/server/finalization.ts` | The shared finalizer. `finalizeTextChatTurn` / `finalizeImageChatTurn`. Fatal persist step + best-effort steps (`working_memory`, `memory_extraction`, `audit`) via `Promise.allSettled`. Has an injection param `_impl` currently documented as **test-only**, with a footgun: a partial `_impl` silently no-ops every step not supplied. |
| `features/chat/server/persistence.ts` | `persistChatResult` — the web persistence implementation. **Also does token metering (`tokenUsage` insert) and billing (`finalizeChatBilling`) inside itself.** These must be hoisted out (Phase 1), otherwise a LINE persist adapter silently skips both. |
| `features/chat/server/billing.ts` | `finalizeChatBilling({ userId, guestSessionId, creditCost, ... })` — bills `userId`. Needs to bill a distinct `billingUserId` for LINE (channel owner ≠ message identity). Already has injected deduct functions and a test. |
| `features/agents/server/conversation-turn.ts` | The Conversation Turn Runtime. `prepareConversationTurn` → `runConversationTurnText` / `streamConversationTurnText` → `finalizeConversationTurnText`. Contains the LINE-specific `finalizeLineTextConversationTurn` (to be deleted). |
| `features/line-oa/webhook/events/text-replies.ts` | LINE canonical AI reply (`runCanonicalLineReply`) + several direct-intent paths + `persistLineTurn` copy #1. |
| `features/line-oa/webhook/events/farm-records.ts` | Farm-record direct intents + `persistLineTurn` copy #2 (byte-identical). |
| `features/line-oa/webhook/events/media-handlers.ts` | LINE image/video handling; uses the LINE-built system prompt. |
| `features/line-oa/webhook/index.ts` | Webhook entry; resolves `skillRuntime` (~L171) whose output the text path currently discards. |
| `lib/credits.ts` | `deductCredits`, `getCreditCost`. |

Existing tests to keep green: `features/chat/server/*.test.ts` (billing, finalization,
message-persistence, token-usage), `features/agents/server/conversation-turn.test.ts`.
Test runner: `node:test` (`node --test`).

> Line numbers in this plan are approximate (they drift). Re-locate with grep, e.g.
> `grep -n "persistLineTurn" features/line-oa/webhook/events/*.ts`.

---

## 4. Target architecture

```
Channel Adapter (web route / shared-link route / LINE webhook)
  │  owns: identity, limits, transport, rendering,
  │        follow-up suggestion GENERATION (ordering is channel policy)
  ▼
Conversation Turn Runtime
  prepareConversationTurn → run/stream → finalizeConversationTurn*
  ▼
Turn Finalization  (features/chat/server/finalization.ts — ONE for all channels)
  ├─ fatal:        persist            ← Channel Persistence Adapter seam
  ├─ best-effort:  billing            ← hoisted out of persistChatResult
  ├─ best-effort:  token_metering     ← hoisted out of persistChatResult
  ├─ best-effort:  working_memory
  ├─ best-effort:  memory_extraction  ← handles linked userId OR lineUserId
  └─ best-effort:  audit
```

Two production persistence adapters:

- `persistChatResult` (web/shared-link, full-thread rewrite) — minus billing/metering.
- `persistLineAppendTurn` (LINE, append-only) — new module, single home for the
  logic currently duplicated as `persistLineTurn`.

---

## 5. Implementation phases

### Phase 0 — Safety net (½ day)

1. Run the existing suite and record the baseline:
   `pnpm exec tsc --noEmit` and `node --test` (or the project's test invocation —
   check `package.json` scripts).
2. Add a characterization test for `persistChatResult` ordering if one doesn't
   exist: messages persisted → thread updated → token usage → billing. You are
   about to move the last two; lock in current behavior first.

### Phase 1 — Hoist billing + token metering out of the web persist (1 day)

**Goal:** `persistChatResult` persists only (messages, assets, thread row).
Billing and metering become named finalizer steps so they run for *any*
persistence adapter.

1. In `features/chat/server/finalization.ts`:
   - Extend `FinalizationStepName` with `'billing' | 'token_metering'`.
   - Add to the impl type: `bill?: (input: BillInput) => Promise<void>` and
     `recordTokenUsage?: (input: TokenUsageInput) => Promise<void>`, with
     production defaults wired in `loadDefaults()` (default `bill` calls
     `finalizeChatBilling` with `deductCredits`/`deductGuestCredits`; default
     `recordTokenUsage` does the `tokenUsage` insert currently in
     `persistence.ts` ~L73–82).
   - Run both in the best-effort `Promise.allSettled` block, **after** the fatal
     persist step (preserves current ordering: web today bills after persist and
     both are already catch-and-log, i.e. best-effort in behavior).
2. In `features/chat/server/persistence.ts`: delete the `tokenUsage` insert and
   the `finalizeChatBilling` call (+ now-unused imports). `persistChatResult`
   keeps: prepare messages → preserve compare/team rows → delete+insert →
   media assets → thread update.
3. `ChatTurnFinishContext` (in `finalization.ts`): add
   `billingUserId?: string | null` — **defaults to `userId` when absent** so web
   and shared-link call sites need no change. The `bill` step uses
   `billingUserId ?? userId`.
4. Restructure the `if (!finishCtx.userId) return { ok: true };` early-return
   (~L185): billing must run when `billingUserId` is set even if `userId` is
   null (unlinked LINE user, channel owner pays). Gate each best-effort step on
   what it actually needs, not on `userId` globally:
   - billing → needs `billingUserId ?? userId` (or `guestSessionId`)
   - token_metering → needs nothing user-specific
   - working_memory → threadId (keep current behavior for guests: check what
     `refreshWorkingMemory` needs; if it was skipped for guests only via the
     early-return, decide per step and keep web behavior identical)
   - memory_extraction → `userId` OR (Phase 3) `lineUserId`
   - audit → `currentChatRunId`
5. **Verify:** tsc clean; billing/finalization/persistence tests green (update
   them — they will legitimately fail on the moved responsibilities); manually
   run one web chat turn (`pnpm dev`) and confirm a `creditTransaction` row and a
   `tokenUsage` row still appear.

### Phase 2 — Make the persist seam honest (½ day)

1. Rename `_impl` → `impl` in `finalizeTextChatTurn` / `finalizeImageChatTurn`
   and their input types. Update the two comments that describe it as test-only.
2. **Kill the silent no-op footgun:** with the current code, providing a partial
   impl replaces all unspecified steps with no-ops. Change the merge to:
   *every unspecified step falls back to the production default* from
   `loadDefaults()`. Tests that relied on "partial impl = everything else
   no-ops" must now pass explicit no-ops for the steps they want disabled —
   update them; the explicitness is the point.
3. **Verify:** tsc + tests; grep for `_impl` to catch stragglers
   (`conversation-turn.ts` forwards it? check `finalizeConversationTurnText`).

### Phase 3 — Extend the finish context for LINE identity (½ day)

1. Add to `ChatTurnFinishContext`: `lineUserId?: string | null`.
2. In the memory_extraction step: if `userId` → `extractAndStoreMemory` (current
   behavior); else if `lineUserId` → `extractAndStoreLineUserMemory` (import from
   `@/lib/memory`, lazily like the other defaults). Mirror the branch currently
   in `finalizeLineTextConversationTurn` (~L252–278), including passing
   `memoryContext` and the message list shape it expects (LINE passes plain
   `{role, content}` history — you will need to adapt: the shared step consumes
   `parts`-shaped messages; convert LINE history to that shape at the adapter or
   accept both shapes in the step. Prefer converting at the adapter so the
   finalizer keeps one message shape).
3. Add `suggestions?: string[]` to the finish context **only if** persisted
   suggestions need to reach message metadata (check how web persists
   suggestions today — they ride inside message parts via
   `prepareTextMessagesForFinalization`; LINE persists them via
   `assistantMetadata` on the assistant row. Keep LINE's metadata approach
   inside its persistence adapter input instead if that's simpler).
4. **Verify:** tsc + tests. No behavior change yet for any channel.

### Phase 4 — LINE Channel Persistence Adapter (½–1 day)

1. New file `features/line-oa/webhook/persistence.ts` (or
   `features/line-oa/server/persistence.ts` — match local convention):

   ```ts
   // Channel Persistence Adapter for LINE: append-only, explicit positions.
   // See CONTEXT.md "Channel Persistence Adapter" and ADR-0002.
   export async function persistLineAppendTurn(input: {
     threadId: string;
     nextPosition: number;
     now: Date;
     userText: string;
     assistantText: string;
     assistantMetadata?: Record<string, unknown>;
   }): Promise<void> { /* body = current persistLineTurn, moved verbatim */ }
   ```

2. Export a factory that adapts it to the finalizer's `persist(input: PersistInput)`
   signature, closing over the LINE-specific fields the shared `PersistInput`
   doesn't carry (`nextPosition`, `now`, metadata):

   ```ts
   export function buildLinePersistAdapter(ctx: {
     nextPosition: number; now: Date;
     assistantMetadata?: Record<string, unknown>;
   }): TextFinalizationImpl['persist'] { ... }
   ```

   The adapter derives `userText`/`assistantText` from the last two
   `updatedMessages` it receives (or accept them via closure — choose one and
   be consistent; closure is simpler and avoids parsing parts).
3. Delete `persistLineTurn` from `text-replies.ts` AND `farm-records.ts`; point
   all ~18 call sites at `persistLineAppendTurn` (direct calls for now — they
   move onto the finalizer in Phase 6). Call-site inventory (re-grep to confirm):
   - `text-replies.ts`: ~L330, 462, 536, 578, 617, 676, 713, 731, 760
   - `farm-records.ts`: ~L327, 348, 366, 389, 443
4. **Verify:** tsc; grep confirms zero remaining `persistLineTurn` definitions;
   manually send a LINE message (or run the webhook handler test/dev harness) and
   confirm the turn still persists.

### Phase 5 — Port the canonical LINE AI reply (1–2 days, the core)

1. In `text-replies.ts` `runCanonicalLineReply`:
   - Keep: `prepareConversationTurn` → `runConversationTurnText` (unchanged).
   - **Suggestions move to the adapter:** generate follow-up suggestions here
     (the existing `generateFollowUpSuggestions` + `buildAssistantSuggestionContext`
     code), *before* sending the LINE reply, in parallel with nothing — or keep
     the current parallelism by running suggestions concurrently with the
     finalizer call via `Promise.all`.
   - Replace the `finalizeLineTextConversationTurn` call with
     `finalizeConversationTurnText` (from `conversation-turn.ts`), passing:
     - `impl: { persist: buildLinePersistAdapter({ nextPosition, now, assistantMetadata }) }`
     - finish fields: `threadId`, `userId: context.linkedUser?.userId ?? null`,
       **`billingUserId: context.channel.userId`**, `lineUserId: context.lineUserId`,
       `memoryContext`, `memoryEnabled/memoryExtractEnabled` from
       `context.shouldExtractMemory`, `followUpSuggestionsEnabled: false`
       (LINE handles suggestions itself), `currentTitle` (LINE threads: keep the
       existing title — check what `buildThreadUpdateValues` needs vs what the
       LINE adapter does; the LINE adapter only bumps `updatedAt`, so title
       fields in the finish context are inert for LINE — pass the current one).
     - `usage`: the token usage from `runConversationTurnText`'s result
       (`generateResult.usage` — verify the field name on the AI SDK result) so
       **token metering goes live for LINE**.
     - `creditCost` flows from the prepared turn automatically
       (`turn.creditCost`) — **billing goes live here.**
   - `updatedMessages`: build the two-message turn (user + assistant) in
     `ChatMessage` parts shape for the finalizer's best-effort steps, while the
     persist adapter writes its append-only rows. (The finalizer's
     `prepareTextMessagesForFinalization` runs on these — confirm it is harmless
     for LINE's plain text messages; if it injects web-only artifacts, gate that
     behind `followUpSuggestionsEnabled`/channel as needed.)
2. **Delete `finalizeLineTextConversationTurn`** from `conversation-turn.ts`
   (and its `LineHistoryMessage` type if now unused). tsc will list any other
   callers — port them the same way.
3. Audit runs (optional but cheap): if LINE should create `chatRun` audit
   records, call `startChatRun` in the adapter and pass `currentChatRunId`.
   If not now, pass `currentChatRunId: null` and note it in §9 follow-ups.
4. **Verify (the important one):**
   - Unit: extend `conversation-turn.test.ts` — a LINE-shaped finalize call with
     a fake persist adapter asserts: persist called once with appended rows,
     `bill` called with `billingUserId = channel owner`, `recordTokenUsage`
     called, memory branch hits `extractAndStoreLineUserMemory` when only
     `lineUserId` is set.
   - Manual: send a LINE text message to a dev channel. Confirm in DB:
     2 new `chatMessage` rows at correct positions, a `creditTransaction`
     deduction against the channel owner, a `tokenUsage` row. Confirm the reply
     still carries quick-reply suggestions.
   - Regression: web chat turn + shared-link turn still persist/bill exactly as
     before (Phase 1 characterization test plus one manual turn each).

### Phase 6 — Port the LINE direct-intent shortcut paths (1–2 days)

Convert each path from "reply + direct `persistLineAppendTurn`" to "reply +
`finalizeTextChatTurn` with the LINE persist adapter and an explicit cost".
Per approved cost policy:

| Path (text-replies.ts unless noted) | creditCost | usage |
|---|---|---|
| Weather risk (~L532–598) | `0` (no model call) | null |
| Farm-log summary (~L600–635) | `0` | null |
| Farm-record create (~L637–658, farm-records.ts paths) | `0` | null |
| Case-workspace drafts (~L660–728) | `0` unless a model call is made — check `case-workspace/service.ts` usage in this path; if it calls a model, bill that model's `getCreditCost` | as available |
| Video generation (~L730–747) | the video model's cost via `getCreditCost` (mirror what web charges — see `lib/api/creditGate.ts` usage in `app/api/video/route.ts`) | null |
| Image generation (~L749–799) | image-model cost — mirror web image turns (`turn.creditCost` from `imagePreflight` if it goes through `prepareCanonicalAgentImageGeneration`, else `getCreditCost(imageModelId)`) | null |

Mechanics per call site: wrap the existing persist call in a
`finalizeTextChatTurn` invocation with `impl.persist = buildLinePersistAdapter(...)`,
`billingUserId = channel.userId`, `creditCost` per the table, and no-op-irrelevant
flags (`memoryExtractEnabled: false` where these paths never extracted memory —
**preserve current behavior**; the win here is metering/billing/single pipeline,
not new side effects).

**Verify:** exercise each intent on a dev LINE channel (the repo has
`scripts/run-agrispark-demo-scenarios.ts` for farm flows — check if it covers
these); confirm 0-cost paths create no deduction and media paths deduct.

### Phase 7 — Fix the LINE double skill resolution (½ day, cost win)

1. In `features/line-oa/webhook/index.ts` (~L171) the resolved `skillRuntime`
   currently feeds only `buildLineAgentContext` (media prompt). Thread it into
   `runCanonicalLineReply`'s `prepareConversationTurn` call via the channel
   context's `skillRuntimeOverride` (see how `app/api/chat/route.ts` passes it
   through `buildWebChannelContext` → `run-context.ts` ~L102 short-circuit).
2. **Verify:** add a counter/log in dev around `resolveSkillRuntimeContext` and
   confirm one resolution per LINE text turn (was two, including a paid LLM
   discovery call).

---

## 6. Definition of done

- [ ] `persistLineTurn` no longer exists anywhere (grep).
- [ ] `finalizeLineTextConversationTurn` no longer exists.
- [ ] `persistChatResult` contains no billing and no token-usage code.
- [ ] Every LINE turn (canonical + all 6 shortcut paths) goes through
      `finalizeTextChatTurn`/`finalizeImageChatTurn` with an explicit `creditCost`.
- [ ] LINE AI text turn: deducts channel-owner credits, records token usage.
- [ ] LINE unlinked-user memory still extracts via `extractAndStoreLineUserMemory`.
- [ ] LINE quick-reply suggestions still work (generated adapter-side).
- [ ] Web + shared-link turns behave byte-for-byte as before (billing amount,
      transaction description, tokenUsage rows, message rows).
- [ ] `pnpm exec tsc --noEmit` clean; full `node --test` suite green.
- [ ] CLAUDE.md "LINE OA Integration" section updated to mention Turn
      Finalization + ADR-0002 (keep it short — the ADR is the source of truth).

## 7. Commit plan

One commit per phase, in order. Suggested messages:
`refactor(finalization): hoist billing + token metering out of persistChatResult`,
`refactor(finalization): promote impl to a real seam with default fallbacks`,
`feat(finalization): support LINE identity (billingUserId, lineUserId)`,
`refactor(line): single append-only Channel Persistence Adapter`,
`feat(line): canonical AI replies finalize through shared pipeline (billing+metering live)`,
`feat(line): direct-intent paths finalize through shared pipeline`,
`perf(line): reuse resolved skill runtime, halve skill discovery calls`.

## 8. Risks & gotchas (read before coding)

- **Do not route LINE through `persistChatResult`.** It deletes and reinserts the
  whole thread; LINE's limited history window would truncate the conversation.
- **`prepareTextMessagesForFinalization` side effects:** verify what it does to
  LINE's plain-text messages before Phase 5 (it handles follow-up-suggestion
  parts and response artifacts for web). If it mutates/injects web-only parts,
  make it a no-op path for LINE rather than skipping the finalizer.
- **Billing identity:** `finalizeChatBilling` currently bills `userId`. The new
  `billingUserId` must take precedence when set; when both are null and no
  guest session, no deduction (that's the 0-cost lookup case anyway).
- **Behavior freeze on best-effort ordering for web:** Phase 1 moves billing and
  metering but must not change *when* they run relative to persist for web.
  The characterization test from Phase 0 is your guard.
- **Positions:** LINE computes `nextPosition` from history before the turn runs.
  If a shortcut path sends multiple replies in one webhook event (some do —
  check the multi-persist call sites in farm-records.ts), each persist must get
  the correctly incremented position, same as today. Preserve the exact position
  arithmetic when wrapping in the finalizer.
- **Async webhook budget:** LINE reply tokens expire (~1 min) and the reply must
  go out fast. Keep the current ordering — send the LINE reply first, then run
  finalization — if that's what the code does today (verify in
  `runCanonicalLineReply`'s caller). Finalization must never block the reply.

## 9. Explicitly out of scope (flagged follow-ups)

1. **Zero-balance policy for LINE:** what happens when the channel owner's
   credits hit zero mid-conversation (hard stop vs grace). Deduction can go
   negative-tolerant for now (matches web's catch-and-log behavior). Needs a
   product decision + pre-turn gate. Track as an issue.
2. **LINE audit runs (`chatRun`)** if skipped in Phase 5 step 3.
3. **Candidate #1 from the architecture review** (deepening
   `prepareConversationTurn`'s overall interface and porting
   `app/api/chat/route.ts` onto the runtime) — separate effort; this plan
   deliberately doesn't touch the web route beyond Phase 1's hoist.
4. Web-side duplicate finish-context literals — solved properly by candidate #1.
