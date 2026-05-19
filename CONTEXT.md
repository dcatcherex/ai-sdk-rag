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

### Channel Adapter

The channel-specific implementation for external I/O and presentation. Examples include web UI streaming, shared-link access limits, LINE reply tokens, LINE quick replies, Flex messages, and LINE analytics.

Adapters may supply policy, identity, and rendering behavior, but should not duplicate agent, skill, tool, model, or billing resolution.

Adapters own:

- authentication, guest identity, share-token validation, LINE event details, or other access checks
- channel-specific limits such as shared-link max uses, message caps, and link credit budgets
- response transport and rendering: UI streams, LINE replies, Flex messages, quick replies, stickers, and channel analytics
- channel-specific error presentation
