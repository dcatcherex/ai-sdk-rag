Explorers are back. Context first: CONTEXT.md defines the Conversation Turn Runtime / Channel Adapter seam, and ADR-0001 locks it in. The good news — the Skills Engine (resolveSkillRuntimeContext) is genuinely deep, the tool service.ts rule is followed consistently, and the finalization core (finalizeTextChatTurn → persistChatResult → finalizeChatBilling) is a coherent layered chain. The friction is elsewhere. Here are the deepening candidates, ranked by leverage:

---
1. The Conversation Turn Runtime is shallow — and the busiest channel doesn't use it

Files: features/agents/server/conversation-turn.ts (282 L), app/api/chat/route.ts (607 L), app/api/agent/[token]/chat/route.ts (493 L)

Problem: The runtime exposes 9 exported functions that callers must sequence themselves (prepareConversationTurn → streamConversationTurnText → buildConversationTurnFinishContext → finalizeConversationTurnText), threading a turn object and hand-building a 14-field finish-context literal — that literal is copy-pasted at 5+ call sites across the web and shared-link adapters. The interface is nearly as complex as the implementation: a caller must know the whole internal sequence anyway, so the module has no depth. Worse, the authenticated web chat route never calls prepareConversationTurn at all — it imports prepareAgentRun directly and re-implements the turn inline (~540 lines: skill detection, task-flow intercept, prompt assembly, model selection, credit gate, persistence ordering). The needs_more_info streaming intercept is duplicated near-verbatim between the web and shared-link adapters (~55 lines each).

Deletion test: delete conversation-turn.ts today and almost no complexity vanishes for the web channel — it already bypasses it. That's the signal it's a pass-through, not a deep module.

Solution: Deepen the runtime to something like one entry point per execution mode — runConversationTurn(channelInput) → ChannelOutput — that owns the full prepare→execute→finalize sequence internally, including the task-flow intercept and finish-context construction. Channel Adapters supply only what CONTEXT.md says they own: identity, limits, transport callbacks, rendering. Then port the web route onto it, shrinking it to a true Channel Adapter.

Benefits: This is enforcing ADR-0001, not contradicting it. Locality: turn-ordering bugs (billemory extraction) become one file's problem instead of three routes'. Leverage: the next channel (e.g., an embed widget from the vision doc's shared-link roadmap) is a thin adapter. Tests: the turn sequence becomes testable through one interface with fake channel adapters, instead of only via route-level integration.

---                                                                                                                                                                                                     2. LINE has a forked persistence/finalization pipeline
                                                                                                                                                                                                        Files: features/line-oa/webhook/events/text-replies.ts (L109–139), features/line-oa/webhook/ev51 — a byte-identical copy of persistLineTurn), conversation-turn.ts (L211–281)

Problem: LINE turns never touch persistChatResult/finalizeChatTurn. Instead a local persistLineTurn hand-inserts chatMessage rows (18 call sites across 2 files, one of them a verbatim duplicate), and finalizeLineTextConversationTurn — a LINE-specific method living inside the shared runtime — to injected callbacks (persist, generateFollowUpSuggestions). The runtime asks the adapter tosupply the behavior it's supposed to own: the definition of shallow. Net effect: two finalization pipelines with different persistence, billing, memory, and audit ordering — exactly the drift ADR-0001 exists to prevent. LINE also resolves skills twice per text turn (webhook builds a system prompt that the canonical text path discards and rebuilds — paying the LLM skill-discovery call twice).                          
Solution: Route LINE finalization through the shared finalization module (persistence adapter for LINE-specific rows if truly needed), delete both persistLineTurn copies, delete finalizeLineTextConversationTurcallback injection, and pass the already-resolved skill runtime into prepareConversationTurn vOverride.

Benefits: Locality — one place where a Conversation Turn becomes durable, for all channels. Immediate cost win: halves the skill-discovery LLM call on every LINE text message. Tests: LINE turn semantics get cothe existing finalization tests instead of being untested channel code.

---                                                                                                                                                                                                              3. Billing has no seam — ~9 independent paths move credits

Files: lib/credits.ts, lib/api/creditGate.ts, features/chat/server/billing.ts, features/agent-teams/server/{run-steps,planner-run,run-engine}.ts, app/api/agent/[token]/chat/route.ts, app/api/compare/route.ts, lib/website-service.ts, lib/support.ts

Problem: getCreditCost/deductCredits are called inline from at least 9 places; website-builder hard-codes its own COST bypassing getCreditCost entirely; only web chat and the agent run-service have an injected billing function. There is no single interface answering "what does this turn cost, gate it, charge it, refund it" — the invariant check balance → run → deduct → log is re-implemented per caller with subtly different ordering.

Solution: One credit-billing module with a small interface (gate, charge, refund around a run)tCreditCost becomes an implementation detail behind it.

Benefits: Leverage: your vision doc's Phase 1.5 unit-economics audit (≥50% margin per credit) computation has one home. Locality: pricing changes, margin guards, and per-channel spend capsland in one file. Tests: billing invariants (no deduct on failure, refund on error) become unit-testable once instead of hoped-for nine times.

---
4. Services hard-import the DB and the AI SDK at module scope — no test seam

Files: 24 of 44 feature service.ts files import @/lib/db at top level; 10 services hard-import generateText from ai + getModelSlot (which itself imports the DB)

Problem: Only ~5% of source files have tests, and the shape of the untested set is not random:th no seam. Evidence of real pain: case-workspace/service.test.ts must fake DATABASE_URL andlazy-require just to load the module, and can then only test the pure helpers. The interface of these services silently includes "a live Postgres and an AI provider" — hidden interface complexity.

Solution: Not a big-bang repository layer. Two incremental moves: (a) extend the existing queries.ts convention (8 features already have it) whenever a service is touched, so DB access is at least concentrated per
feature; (b) an injectable model-call seam (the pattern run-model.ts already uses with getCred today, so a hypothetical seam, but the second adapter is the test fake, which makes it real).

Benefits: Locality of queries per feature; the interface of each service becomes honest and te plus opportunistic refactors, not a project.

---
5. Quick wins (low effort, do alongside anything above)

- Delete dead mergeAgentToolIds (features/agents/server/runtime.ts:73) — duplicate of the live
- Collapse the two overlapping skill barrels (features/skills/service.ts + features/skills/server/runtime.ts) into one.
- Fix stale CLAUDE.md/AGENTS.md references to selectModelDiscoveredSkills() / getRelevantSkill functions no longer exist (actual: runLlmSkillDiscovery, getResolvedSkillResourcesForPrompt).AI coders navigate by these docs.
- Noted, not proposed as a refactor: agent-team specialists never get skill-unlocked tools or ure gap to decide on deliberately, and agent-teams is in your maintenance-only bucket anyway.