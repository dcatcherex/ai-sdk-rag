# Vaja AI Context

## Domain Terms

### Conversation Turn

A single user interaction with an agent across any supported channel: authenticated web chat, shared web agent link, or LINE OA.

A conversation turn starts with an incoming user message and ends after the assistant response has been delivered and the required side effects have been handled: persistence, billing, audit or analytics, memory, and channel-specific response rendering.

The core conversation turn semantics should be shared across channels. Channel differences belong in explicit policy and adapter code.

### Conversation Turn Runtime

The module responsible for the shared conversation turn sequence: resolving the active agent, skills, task flow state, prompt context, model, tools, run mode, billing amount, and persistence contract.

It should hide turn-ordering complexity behind a small interface so routes and webhook handlers do not need to know the full internal sequence.

The runtime owns:

- agent, skill, task-flow, model, tool, prompt, and run-mode resolution
- credit cost calculation and the billing contract
- the persistence/finalization contract for the turn
- shared text/image execution decisions across web, shared-link, and LINE channels

### Turn Finalization

The final stage of every conversation turn, owned by the Conversation Turn Runtime: message persistence, billing, token metering, working memory refresh, long-term memory extraction, and audit.

There is exactly one finalizer for all channels (`finalizeTextChatTurn` / `finalizeImageChatTurn` in `features/chat/server/finalization.ts`). Persistence is a fatal step; the rest are best-effort. Every turn passes an explicit credit cost — a turn that bills nothing must state 0.

Follow-up suggestion **generation** is not part of finalization. It is Channel Adapter policy, because its ordering depends on transport: LINE must generate suggestions before the reply is sent (quick replies attach to the outgoing message); web generates them during the stream. The adapter passes generated suggestions into finalization only for persistence.

### Channel Persistence Adapter

The per-channel implementation of the finalizer's persist step. Channels have legitimately different persistence contracts and each supplies an adapter at this seam:

- **Web / shared-link**: full-thread rewrite (`persistChatResult`) — the thread is re-persisted from the complete in-memory message list.
- **LINE**: append-only — the turn's user and assistant messages are appended at explicit positions, because LINE builds context from a limited history window and must never rewrite the whole thread.

A persistence adapter owns row shapes and write strategy only. It must not own billing, metering, memory, or audit — those belong to Turn Finalization.

### Channel Adapter

The channel-specific implementation for external I/O and presentation. Examples include web UI streaming, shared-link access limits, LINE reply tokens, LINE quick replies, Flex messages, and LINE analytics.

Adapters may supply policy, identity, and rendering behavior, but should not duplicate agent, skill, tool, model, or billing resolution.

Adapters own:

- authentication, guest identity, share-token validation, LINE event details, or other access checks
- channel-specific limits such as shared-link max uses, message caps, and link credit budgets
- response transport and rendering: UI streams, LINE replies, Flex messages, quick replies, stickers, and channel analytics
- channel-specific error presentation
