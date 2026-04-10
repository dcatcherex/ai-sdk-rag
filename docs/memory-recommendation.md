# Memory Recommendation for Vaja AI

This document proposes the target memory architecture Vaja should build to support the product vision in `docs/vaja-vision.md`.

It is intentionally more concrete than a brainstorm, but it is still a design document rather than a final code spec.

Read this together with:

- `docs/memory-implementation.md` for the shipped v1 behavior
- `docs/vaja-vision.md` for the product goals memory needs to serve

## Executive Summary

Vaja's current memory system is a good v1 for personalization.

It is not yet the memory system required for an agent-first cowork platform.

To support the Vaja vision, memory should evolve into a layered system with different scopes, trust levels, and retrieval strategies.

The most important shift is conceptual:

- stop treating memory as one table plus one prompt block
- start treating memory as product infrastructure

## Implementation Status

The first shipped slice of this recommendation now exists:

- `user profile memory` remains in `lib/memory.ts`
- `shared brand memory` now exists as approval-gated scoped memory in `memory_record`
- `thread working memory` now exists as persisted per-thread state in `thread_working_memory`

Still deferred:

- `workspace` memory
- `project` memory
- continuity archive retrieval
- agent-authored notes
- vector-backed retrieval for larger shared memory stores

## What Memory Must Do for the Vaja Vision

The Vaja vision says users collaborate with agents that have roles, memory, and skills, and that Vaja should provide long-term memory of the user's business, not just the current session.

For that to be true in product reality, the memory system must support:

- personal continuity across web and LINE
- shared memory for businesses, teams, brands, and projects
- long-running work across many sessions
- selective recall instead of bloated prompts
- trust, review, and auditability
- channel-aware behavior for LINE-first users
- safe gradual movement from supervised memory to more autonomous memory

## Core Design Principles

### 1. Different memory types must stay separate

Vaja should explicitly separate:

- user profile memory
- shared business memory
- thread working memory
- continuity archive
- agent-authored notes

These memory types have different:

- owners
- lifetimes
- trust levels
- UX expectations
- privacy requirements
- retrieval strategies

### 2. Scope is a first-class concept

Every durable memory record should clearly belong to a scope.

Recommended scope model:

- `user`
- `workspace`
- `brand`
- `project`
- `agent`
- `team`
- `line_contact`

If scope is ambiguous, the system will become hard to trust.

### 3. Memory and context management are related but different

Memory:

- durable
- reusable
- usually cross-session

Context management:

- current-turn or current-thread focused
- optimized for model effectiveness and token cost
- often disposable or re-computable

Summaries are not automatically memory.

### 4. Retrieval should match trust and size

Small high-trust memory can be prompt-injected directly.

Larger, lower-trust, or shared memory should be:

- retrieved selectively
- ranked by relevance
- attributed
- visible to the user when it matters

### 5. Trust is a product requirement

As Vaja moves toward more autonomous memory, the system must distinguish:

- user-entered facts
- system-extracted facts
- imported knowledge
- approved shared business memory
- agent-authored notes

Those should not behave as if they are equally trustworthy.

## Recommended Layered Architecture

## Layer 1: User Profile Memory

Purpose:

- personalize responses
- preserve durable user facts across sessions and channels

Examples:

- prefers Thai responses
- uses pnpm and Next.js
- wants concise technical explanations
- runs an agritech startup

Characteristics:

- low volume
- high trust
- user-scoped
- manually reviewable
- safe for compact prompt injection

Recommendation:

- keep the current `user_memory` behavior as the foundation for this layer
- improve validation and metadata
- do not overload it with business or agent notes

## Layer 2: Shared Business Memory

Purpose:

- capture durable knowledge about a business, workspace, brand, team, or project
- give multiple agents shared continuity

Examples:

- brand voice rules
- approved terminology
- campaign goals
- business constraints
- recurring processes
- customer-handling rules

Characteristics:

- shared scope
- higher commercial value than profile memory alone
- needs ownership, permissions, and review
- should usually be retrieved selectively, not injected blindly

Recommendation:

- make this the next major memory feature after profile-memory cleanup

## Layer 3: Thread Working Memory

Purpose:

- keep long-running chats coherent without replaying full history forever
- preserve thread state, not permanent knowledge

Examples:

- current objective
- decisions already made
- unresolved questions
- recent tool outputs worth preserving

Characteristics:

- thread-scoped
- short- to medium-lived
- optimized for context efficiency
- can be recomputed, but should also be persistable

Recommendation:

- evolve current summarization into a structured working-memory object
- persist it per thread instead of keeping it purely ephemeral

## Layer 4: Continuity Archive

Purpose:

- support "what did we decide before?" style recall across threads and sessions
- make old conversations searchable without loading raw transcripts into prompts

Examples:

- prior decisions
- historical campaign discussions
- past troubleshooting context
- customer-specific continuity in LINE threads

Characteristics:

- retrieval-first
- search-oriented
- useful for both web and LINE
- can be semantic, keyword, or hybrid

Recommendation:

- add this after shared memory and working memory are established
- use a dedicated retrieval path, not just prompt injection

## Layer 5: Agent Notes

Purpose:

- let agents improve over time by preserving operating notes and learned patterns

Examples:

- this team prefers docs before implementation
- this workflow often breaks when LINE and web settings drift
- this project usually needs brand review before publishing

Characteristics:

- lower trust than user-confirmed memory
- should be attributable to the writing agent or workflow
- should not be auto-injected everywhere
- needs stronger review controls

Recommendation:

- implement this last
- default to reviewable and gated behavior

## Recommended Retrieval Strategy by Layer

### User profile memory

Use:

- compact prompt injection

Why:

- small
- trusted
- broadly useful in many turns

### Shared business memory

Use:

- relevance-based retrieval by scope
- optional compact injection for pinned or approved records

Why:

- can grow large
- should not consume prompt space on every turn

### Thread working memory

Use:

- structured prompt block for the current thread

Why:

- it is explicitly current-context material

### Continuity archive

Use:

- search tool or server-side retrieval before model invocation

Why:

- this is recall infrastructure, not static prompt context

### Agent notes

Use:

- gated retrieval with attribution

Why:

- lower trust
- more likely to drift or contain operational noise

## Recommended Metadata Model

Every future durable memory record should have enough metadata to support trust, filtering, and UX.

Recommended fields:

- `id`
- `scopeType`
- `scopeId`
- `memoryType`
- `category`
- `content`
- `sourceType`
- `sourceUserId`
- `sourceAgentId`
- `sourceThreadId`
- `sourceMessageId`
- `confidence`
- `reviewStatus`
- `visibility`
- `pinned`
- `expiresAt`
- `supersededById`
- `createdAt`
- `updatedAt`

Recommended enums:

### `memoryType`

- `profile_fact`
- `shared_fact`
- `working_summary`
- `decision`
- `process_note`
- `agent_note`

### `sourceType`

- `user_manual`
- `user_confirmed`
- `model_extracted`
- `imported`
- `agent_authored`
- `system_generated`

### `reviewStatus`

- `approved`
- `suggested`
- `needs_review`
- `rejected`
- `archived`

### `visibility`

- `private`
- `workspace`
- `team`
- `agent`

## Suggested Data Model Direction

Do not stretch `user_memory` into a catch-all table.

Recommended direction:

### Keep current table

- `user_memory`

Use it only for:

- profile memory
- migration compatibility

### Add new durable memory table

Suggested name:

- `memory_record`

Use it for:

- shared business memory
- approved scoped memory
- future agent notes

### Add working-memory table

Suggested name:

- `thread_working_memory`

Suggested fields:

- `threadId`
- `summary`
- `currentObjective`
- `openLoops`
- `importantArtifacts`
- `lastCompactedMessageId`
- `updatedAt`

### Add retrieval index or embedding table later

Suggested name:

- `memory_embedding`

Use it only when continuity archive or semantic recall is introduced.

## Recommended Application Architecture

Vaja is already organized around feature modules. The memory system should follow that pattern as it grows.

Recommended direction:

### Keep current profile memory entry points stable for now

- `lib/memory.ts`

### Add a dedicated feature module for new work

Suggested location:

- `features/memory/`

Suggested files:

- `features/memory/service.ts`
- `features/memory/types.ts`
- `features/memory/retrieval.ts`
- `features/memory/working-memory.ts`
- `features/memory/server/search.ts`

This avoids turning `lib/memory.ts` into a long-term dumping ground for multiple memory systems.

## Recommended Runtime Integration

## Web chat

Target assembly order:

1. base system prompt
2. persona and agent instructions
3. thread working memory
4. user profile memory
5. shared business memory retrieved by scope and relevance
6. skill blocks
7. grounding or tool guidance

This keeps memory layered and makes its role visible.

## LINE OA

Memory design for LINE should respect the fact that LINE is both:

- a customer-facing channel
- the main entry point for many users

Recommendations:

- keep linked-user profile memory continuity
- keep unlinked LINE continuity lightweight and privacy-conscious
- add channel-aware memory controls before storing richer customer memory
- support line-contact or conversation scope when customer-specific continuity becomes a feature

## Agent teams

Agent teams need shared scoped memory more than they need richer personal memory.

Recommendations:

- let teams read shared project or workspace memory
- do not default to sharing private user profile memory with all agents
- make team-level memory explicit and reviewable

## Recommended UX Direction

Memory should not feel magical in a bad way.

Users should be able to answer:

- what does the AI remember?
- what kind of memory is this?
- where did it come from?
- who can see it?
- why did it affect this answer?
- can I edit, approve, or remove it?

Recommended UI surfaces:

### Personal memory

- current memory section evolves into profile memory manager

### Shared memory

- workspace, brand, project, or team tabs

### Working memory

- thread-level "conversation state" inspector

### Agent notes

- review queue or audit surface, not silent global injection

## Recommended Implementation Phases

## Phase 1: Strengthen current profile memory

Goals:

- improve trust
- improve consistency
- reduce tech debt

Recommended changes:

1. Keep `user_memory` explicitly framed as profile memory.
2. Update docs and naming in code comments to reflect that framing.
3. Add Zod validation to manual memory APIs.
4. Normalize or constrain categories at write time.
5. Add tests for extraction, dedup, pruning, and prompt formatting.
6. Add richer metadata where safe without changing the mental model too much.
7. Keep linked web and LINE behavior aligned on preference handling.

Why first:

- this makes the shipped feature safer immediately
- it preserves momentum without over-designing

## Phase 2: Add shared business memory

Goals:

- support brands, teams, projects, and businesses
- align memory with the actual Vaja product

Recommended changes:

1. Introduce scoped shared memory records.
2. Add ownership, permissions, and visibility rules.
3. Add review and approval UI.
4. Retrieve shared memory by scope and relevance.
5. Integrate brand and project memory into prompt assembly.

Why second:

- this is the biggest gap between current memory and the Vaja vision

## Phase 3: Add durable thread working memory

Goals:

- improve long-session quality
- reduce context cost

Recommended changes:

1. Persist structured thread working memory.
2. Separate recent raw messages from summarized state.
3. Preserve key tool results and open loops.
4. Add observability around prompt size and working-memory usage.

Why third:

- it improves quality without expanding durable memory trust boundaries too early

## Phase 4: Add continuity archive and retrieval

Goals:

- support cross-session recall
- reduce repeated user restating

Recommended changes:

1. Introduce continuity search across relevant prior threads or conversations.
2. Start with narrow scoped retrieval, not global memory dumping.
3. Add semantic or hybrid search only when there is enough data to justify it.
4. Keep retrieval explainable and observable.

Why fourth:

- this is powerful, but only becomes trustworthy when scope and metadata are already in place

## Phase 5: Add agent-authored notes

Goals:

- move toward true agent learning

Recommended changes:

1. Add a distinct `agent_note` class of memory.
2. Attribute every note to its writer and source context.
3. Default to reviewable or suggested status.
4. Limit where these notes can be injected or retrieved.
5. Add poisoning and stale-note mitigation.

Why last:

- this is the highest-risk memory capability

## What Not to Do

Avoid these moves:

### 1. Do not turn `user_memory` into the universal memory table

That will blur trust, scope, and UX.

### 2. Do not mix thread summaries with durable business memory

They solve different problems.

### 3. Do not inject large shared memory blocks into every prompt

That will hurt cost, performance, and answer quality.

### 4. Do not let agents silently write durable shared memory everywhere

That is too much autonomy too early.

### 5. Do not treat LINE customer memory casually

This area has stronger privacy and trust expectations than internal operator memory.

## Proposed Team Decision

If the team wants a clear direction, the recommended decision is:

1. Treat the current memory system as `user profile memory`.
2. Preserve it and improve it rather than replacing it.
3. Commit to a layered memory architecture.
4. Prioritize shared business memory next.
5. Add working memory, continuity retrieval, and agent notes in later phases.

## Appendix: Mapping the Oracle Notebook to Vaja

The Oracle notebook on memory and context engineering is a useful reference model.

It is not a drop-in architecture for Vaja, but it does validate the direction of a layered memory system.

The notebook is strongest as a reference for:

- memory taxonomy
- context compaction
- just-in-time retrieval
- entity extraction
- procedural or workflow memory
- semantic tool retrieval

It is weaker as a direct product blueprint because it assumes:

- a mostly single-agent runtime
- a local engineering-oriented environment
- looser separation between memory, tools, and knowledge systems
- less emphasis on scope, permissions, and shared-business governance

### Notebook Memory Types vs Vaja Memory Types

| Oracle notebook type | Best Vaja interpretation | Notes |
|---|---|---|
| `Conversational` | thread working memory + continuity archive | Good fit, but Vaja should separate current-thread state from long-term searchable continuity |
| `Knowledge Base` | RAG or knowledge layer, not core memory | Useful, but should stay conceptually distinct from memory whenever possible |
| `Workflow` | procedural memory | Strong fit for reusable agent or team patterns |
| `Toolbox` | tool discovery layer | Valuable pattern, but better treated as tool-selection infrastructure than business memory |
| `Entity` | structured extracted memory | Strong fit for people, brands, systems, projects, channels, and customer entities |
| `Summary` | working-memory compaction + JIT recall | Strong fit for thread-level compaction and later continuity retrieval |

### What Vaja Should Borrow

The strongest ideas to borrow are:

- multiple memory types instead of one generic memory bucket
- summaries as compact context with on-demand expansion
- entity extraction as a first-class enrichment step
- workflow memory for reusable procedures and successful patterns
- semantic tool retrieval to avoid passing too many tools into the prompt
- explicit context-window management instead of relying only on raw transcript replay

### What Vaja Should Not Copy Directly

Vaja should not directly copy these parts:

- treating all durable memory as vector memory
- treating RAG documents and memory as the same layer
- treating toolbox retrieval as part of business memory
- assuming one agent or one operator trust model
- skipping explicit scope, visibility, and review rules

The biggest product difference is that Vaja is:

- multi-user
- multi-agent
- shared-memory capable
- LINE-first
- business-facing

That means Vaja needs stronger rules for:

- ownership
- visibility
- privacy
- approval
- attribution
- channel boundaries

### Practical Interpretation for Vaja

Using the notebook as inspiration, the clean Vaja translation is:

1. `Conversational` becomes:
   - persisted thread working memory
   - continuity archive for later recall
2. `Workflow` becomes:
   - reusable procedural memory for agents, teams, and recurring tasks
3. `Entity` becomes:
   - extracted structured memory tied to scopes like user, brand, project, LINE contact, or workspace
4. `Summary` becomes:
   - compacted thread history with optional expand-on-demand behavior
5. `Toolbox` becomes:
   - semantically retrieved tool manifests, not business memory
6. `Knowledge Base` becomes:
   - RAG or knowledge search, not a substitute for memory design

### Recommended Vaja Taxonomy Inspired by the Notebook

If we adapt the notebook ideas cleanly, Vaja's near- to mid-term memory taxonomy should be:

- `user profile memory`
- `shared business memory`
- `thread working memory`
- `continuity archive`
- `procedural memory`
- `entity memory`
- `agent notes`

And adjacent but separate systems should be:

- `knowledge base / RAG`
- `tool discovery / toolbox retrieval`

### Suggested Build Order Influenced by the Notebook

The Oracle notebook most strongly supports this implementation order for Vaja:

1. strengthen current user profile memory
2. add persisted thread working memory and summary compaction
3. add entity extraction and storage with explicit scopes
4. add procedural memory for reusable workflows
5. add continuity retrieval across sessions
6. add semantic tool retrieval where tool count makes it worthwhile
7. add agent-authored notes last

### Bottom Line

The notebook confirms that Vaja should think in terms of:

- layered memory
- compact active context
- on-demand expansion
- structured extraction
- procedural learning

But Vaja still needs its own product architecture on top of those ideas because memory in Vaja is not only an agent-runtime problem.

It is also a:

- collaboration problem
- trust problem
- channel problem
- governance problem
- product UX problem

## Final Recommendation

Vaja should build memory as a layered product capability, not as a single prompt trick.

The current implementation is a solid first layer.

The next architecture should aim to make this statement true in a concrete way:

"Vaja agents have long-term memory of the user's business, can work across LINE and web, and can collaborate safely with shared context over time."

That is the memory architecture that supports the Vaja vision.
