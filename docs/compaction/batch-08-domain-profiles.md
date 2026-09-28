# Batch 8 — Remove domain-profiles from the runtime

Issue #8 · Branch `compaction/08-domain-profiles` · Risk: **High** (Conversation Turn Runtime)

Read first: `CONTEXT.md`, `docs/adr/0001-conversation-turn-runtime.md`,
`docs/adr/0002-shared-turn-finalization.md`.

## Why
Built for farm plots / students / patients. 1 row each in `domain_profile` /
`domain_entity`. Today every agent run resolves domain context (a DB lookup) and may
inject a `<domain_setup_opportunity>` block into the system prompt — cost with no user.
After batches 1 and 7 the only remaining consumers are the prompt pipeline and LINE.

## Approach
Remove the concept end to end: no `domainContextBlock`, no `domainSetupBlock`, no
`domainHint`. Do **not** leave empty-string plumbing behind.

## Delete

```
features/domain-profiles/
docs/domain-neutral-profile-entity-layer-implementation.md
```

## Edit — prompt pipeline (web chat, shared links, LINE all flow through here)

| File | Change |
|------|--------|
| `features/agents/server/run-context.ts` | Remove imports (lines 5–7), `getDomainProfileOwnerContext` (~35), `resolveRunDomainContext` (~59–75), the `resolvedDomainContext` entry in the `Promise.all` (~101–120), `resolvedDomainContextBlock` / `resolvedDomainSetupBlock` (~122–128), the three return fields (~138–140), and `domainContextBlock` / `domainSetupBlock` from the channel-context input type (~17–18) and result type (~30–32). |
| `features/agents/server/run-service.ts` | Remove `domainContextBlock` / `domainSetupBlock` from the input type (~57–58) and from the destructure/pass-through (~289–290, ~335–336). |
| `features/agents/server/run-prompt.ts` | Remove the two fields (~31–32, ~60–61). |
| `features/agents/server/runtime.ts` | Remove the two fields (~100–101, ~117–118). |
| `features/agents/server/runtime.test.ts` | Remove the two fixture fields (~43–44). |
| `features/chat/server/prompt-assembly.ts` | Remove fields (~20–22) and concatenation (~69–70, ~82–83). |
| `features/chat/server/prompt-context.ts` | Remove fields (~44–45) and the `domain_context` / `domain_setup` sections (~121–126); remove those section types from the union if declared. |
| `app/api/admin/agents/[id]/audit-snapshot/route.ts` | Remove the two `''` fields (~151–152). |
| `app/api/agents/[id]/preview-prompt/route.ts` | Remove the two `''` fields (~106–107). |
| `features/agents/server/conversation-turn.ts` | Remove `domainHint` from the follow-up input (~226) and the pass (~245). |
| `lib/follow-up-suggestions.ts` | Remove `domainHint` option and the "Active profession/domain" line (~46, ~59–60). |

Any prompt-snapshot / audit tests that assert on `<domain_context>` must be updated.

## Edit — LINE

- `features/line-oa/webhook/events/message.ts` — remove imports (lines 18–20),
  `resolveRelevantDomainContext` call, `domainContextBlock` / `domainSetupBlock`
  (~459–476), `domainContext` passing (~139), and `followUpDomainHint` (~180, ~198).
- `features/line-oa/webhook/events/text-replies.ts` — remove `ResolvedDomainContext`
  import (line 26), `domainContext` from the input type, and `followUpDomainHint`.
- `features/line-oa/webhook/events/media-handlers.ts` — remove `followUpDomainHint` /
  `domainHint` (~89, ~120, ~243–266, ~314–333, ~585, ~655–663, ~750). The image classifier
  and observation prompts become domain-neutral. The `isAgriculture` branch (~318) should
  already be gone after batch 1 — delete it if not.

## Edit — registry / nav
- `features/tools/registry/client.ts` (line ~30), `server.ts` (~53–54) — remove
  `domainProfilesManifest` and `createDomainProfilesAgentTools`.
- Any settings or agent-form UI for "domain profile" / "profession setup" — grep
  `domain-profile|domainProfile|DomainProfile` in `features/` and `app/`.

## Verify
- `grep -rnE "domain-profiles|DomainProfile|domainContext|domainSetup|domainHint|ResolvedDomainContext" app features lib components` → only `db/schema` hits.
- Snapshot the system prompt before/after for one agent via
  `app/api/agents/[id]/preview-prompt` — the only difference should be the missing
  domain blocks.
- Web chat, shared link, and LINE (or LINE unit tests) all reply normally.
