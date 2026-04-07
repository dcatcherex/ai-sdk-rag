# Memory Recommendation for Vaja AI

This document is a discussion-ready recommendation for how Vaja AI should evolve its memory system beyond the current implementation.

It is intentionally written as a product and architecture discussion document, not a final technical spec.

Related document:

- `docs/memory-implementation.md` for the current shipped behavior

## Executive Summary

Vaja's current memory system is a good v1 for personalization, but it is not yet a full agent memory architecture.

Today, memory mostly acts as:

- a user profile layer
- a prompt injection block
- a lightweight fact extraction system

That is useful, but it does not yet support the broader "AI coworker" vision where agents can:

- remember project-specific context across sessions
- preserve useful decisions and patterns
- manage long-running work without relying on a growing raw message history
- separate short-term working context from long-term memory

My recommendation is:

1. Keep the current memory system, but rename it mentally and architecturally as `user profile memory`.
2. Add separate memory layers for agent and project/workspace use cases instead of stretching `user_memory` to do everything.
3. Treat context management and memory as related but different systems.
4. Roll this out in phases so we improve trust, control, and consistency before adding autonomous agent memory behaviors.

## Why This Matters

Vaja is not just building a chatbot. The product direction is closer to an AI coworker platform with:

- custom agents
- teams of agents
- skills
- LINE as a front door
- long-running work across many sessions

That product needs more than "remember a few user facts."

It needs a memory model that can answer different questions cleanly:

- Who is this user?
- What does this team or business care about?
- What is this project trying to achieve?
- What happened in this thread so far?
- What patterns has this agent learned that should be reused later?

If all of those are mixed into one table and one prompt block, the system will become hard to trust and hard to scale.

## Current State

Today, Vaja memory is strongest in these areas:

- remembers durable user facts
- supports manual review and editing
- works across web chat and linked LINE flows
- is simple enough to reason about
- has clear code ownership in `lib/memory.ts`

Today, it is weakest in these areas:

- no agent-scoped memory
- no project or workspace memory
- no structured long-running task memory
- no memory retrieval strategy beyond prompt injection
- no distinction between trusted profile facts and agent-authored notes
- no robust context editing strategy for long sessions
- inconsistent preference handling across entry points

## Recommendation: Move to a Layered Memory Model

The main recommendation is to stop thinking about memory as one thing.

Vaja should move toward four separate layers.

## Layer 1: User Profile Memory

This is what Vaja already has today.

Purpose:

- store durable facts about the user
- personalize responses
- carry preferences across sessions and channels

Examples:

- prefers Thai responses
- founder of a farm-tech startup
- uses pnpm and Next.js
- wants concise technical answers

Characteristics:

- user-scoped
- low-volume
- high-trust
- manually reviewable
- safe to inject into prompts in compact form

Recommendation:

- keep this layer
- improve validation, consistency, and token budgeting
- do not overload this layer with project notes or agent scratchpads

## Layer 2: Workspace or Project Memory

Purpose:

- store durable facts about a business, brand, team, project, or ongoing initiative
- give multiple agents shared context

Examples:

- Agrispark campaign goals
- brand voice guidelines
- project constraints
- approved terminology
- recurring business processes

Characteristics:

- workspace-, brand-, project-, or agent-team-scoped
- shared across users or selected collaborators
- should support review and ownership
- higher value for commercial/product use cases than user memory alone

Recommendation:

- model this separately from `user_memory`
- explicitly define scope and ownership
- treat this as a first-class future feature because it aligns strongly with the Vaja vision

## Layer 3: Thread or Session Working Memory

Purpose:

- compress the current conversation so the model can stay effective in long sessions
- preserve key state without replaying full history forever

Examples:

- summary of earlier decisions
- open questions
- current objective
- recent tool outputs worth keeping

Characteristics:

- short-lived
- thread-scoped
- optimized for context efficiency
- not necessarily durable long-term knowledge

Recommendation:

- continue using conversation summarization
- expand it into a more explicit working-memory block
- treat this as context management, not long-term memory storage

## Layer 4: Agent Notes or Learned Patterns

Purpose:

- allow agents to retain useful patterns, heuristics, and operating notes across sessions
- support "AI coworker gets better over time" behavior

Examples:

- when debugging this codebase, check Drizzle schema and route validation first
- this team prefers implementation docs in `docs/` before major refactors
- this workflow often fails because LINE and web settings drift

Characteristics:

- lower trust than user profile memory
- should be attributable to an agent, tool, or workflow
- should be reviewable and auditable
- should not automatically be injected everywhere

Recommendation:

- do not store this in `user_memory`
- introduce it later as a separate, more controlled layer
- require stronger safety controls before enabling autonomous note-writing

## Key Architectural Principle

The most important design rule is:

`Profile memory`, `shared business memory`, `thread working memory`, and `agent-authored notes` should not be treated as the same thing.

They have different:

- trust levels
- scopes
- lifetimes
- owners
- UX expectations
- safety risks

## Recommended Near-Term Direction

For the next stage, I would not jump straight to autonomous file-based memory tools.

Instead, I would recommend a safer sequence.

### Phase 1: Strengthen the current profile memory

Goals:

- make behavior consistent
- improve trust
- reduce accidental misuse

Recommended changes:

1. Make web, LINE, and compare respect the same memory preference rules.
2. Add Zod validation for manual memory APIs.
3. Normalize or constrain category values.
4. Add tests for extraction, dedup, pruning, and formatting.
5. Add token-aware prompt capping instead of only row-count capping.

Why this first:

- it improves the current product immediately
- it lowers risk before memory becomes more autonomous

### Phase 2: Introduce scoped shared memory

Goals:

- support project/business continuity
- align with agents, brands, and teams

Recommended changes:

1. Define a new memory scope model such as `user`, `workspace`, `brand`, `project`, `agent`, or `team`.
2. Add a separate shared-memory table or tables.
3. Add ownership, visibility, and editor permissions.
4. Add explicit UI for reviewing and approving shared memory.

Why this second:

- it delivers strong product value without requiring full autonomous memory writing
- it fits Vaja's collaborative positioning

### Phase 3: Improve working-memory and context management

Goals:

- make long-running sessions cheaper and more reliable
- prevent context drift

Recommended changes:

1. Expand conversation summaries into a structured working-memory block.
2. Distinguish between:
   - recent raw messages
   - summarized history
   - durable memory
3. Consider selective retention of tool outputs or distilled tool summaries.
4. Add observability around prompt size and memory injection cost.

Why this third:

- it improves agent quality without changing long-term memory trust boundaries too early

### Phase 4: Add agent-authored notes carefully

Goals:

- support pattern learning and reusable operational memory
- move closer to true agent memory

Recommended changes:

1. Add a separate storage model for agent-authored notes.
2. Record who or what wrote each note.
3. Add review, approval, and archive flows.
4. Limit where these notes can be injected.
5. Add poisoning detection and stronger trust rules.

Why this last:

- this is the most powerful step
- it is also the highest-risk step

## Recommendation on Memory Retrieval

The current design mainly injects memory directly into the prompt. That is acceptable for profile memory, but it should not become the universal pattern.

Suggested retrieval strategy by layer:

- User profile memory:
  - compact prompt injection
- Workspace/project memory:
  - selective retrieval by scope and relevance
- Thread working memory:
  - summarized prompt block
- Agent notes:
  - gated retrieval with attribution and reviewability

Recommendation:

- keep prompt injection for small, trusted memory blocks
- use retrieval and relevance scoring for larger, shared, or lower-trust memory sources

## Recommendation on Trust and Safety

As memory becomes more agent-driven, safety becomes a product requirement, not just a technical detail.

Vaja should explicitly distinguish:

- user-confirmed facts
- system-extracted facts
- shared team knowledge
- agent-authored notes

Each should have different trust rules.

Recommended metadata for future memory records:

- `scope`
- `sourceType`
- `sourceUserId`
- `sourceAgentId`
- `sourceThreadId`
- `sourceMessageId`
- `confidence`
- `reviewStatus`
- `visibility`
- `createdAt`
- `updatedAt`
- `expiresAt`

## Recommendation on UX

Memory should not feel magical in a bad way.

Users and teams should be able to answer:

- what does the AI remember?
- where did this memory come from?
- who can see it?
- can I edit or delete it?
- why did this memory affect the reply?

Recommended UX direction:

- keep the current user memory section
- later add separate tabs or surfaces for:
  - personal memory
  - workspace/project memory
  - agent notes
- show source and scope clearly
- support approval flows for shared or agent-authored memory

## What I Would Not Recommend

I would avoid these moves for now:

### 1. Do not turn `user_memory` into a catch-all table

That will create confusing behavior and trust problems later.

### 2. Do not let agents freely write durable shared memory without review

This creates poisoning and governance risk too early.

### 3. Do not rely on raw message history as the main long-session strategy

That gets expensive and brittle.

### 4. Do not mix prompt summarization with durable memory storage

They solve different problems and should remain conceptually separate.

## Discussion Questions for the Team

These are the main questions I think the team should discuss before implementation:

1. Is Vaja's next priority better personalization, or true long-running agent memory?
2. What scopes do we need first: `user`, `brand`, `project`, `agent`, or `team`?
3. Which memory types require manual approval before they are reused?
4. Should LINE and web share all user memory, or should some memory be channel-specific?
5. Which memory layers should be prompt-injected, and which should be retrieved on demand?
6. How should we explain remembered information to users in the UI?
7. How much autonomy should agents have to create notes without human review?

## Proposed Team Decision

If the team wants a practical next move, my recommendation is:

1. Approve the concept of a layered memory architecture.
2. Keep the current system as `user profile memory`.
3. Prioritize consistency fixes and trust improvements first.
4. Design shared scoped memory next.
5. Leave autonomous agent-note memory for a later phase.

That path gives Vaja a stronger foundation without overcommitting to a risky memory model too early.

## Final Opinion

The current implementation is good enough to keep and improve.

It should not be thrown away.

But it should also not be mistaken for the end-state memory architecture of an agent-first platform.

The right move is to treat today's memory as one useful layer in a broader memory system, then evolve deliberately from there.
