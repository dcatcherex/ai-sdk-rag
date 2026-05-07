# Cross-Profession Core Roadmap

> Audience: product, engineering, and domain teams scaling Vaja beyond agriculture.
> Purpose: prioritize reusable platform capabilities (skills + tools + governance) that can be applied across professions with minimal rework.

---

## 1) Scope and principle

This roadmap focuses on shared infrastructure, not a single profession profile.

Design rule:

- Build one reusable runtime seam.
- Inject profession behavior via skills/profiles.
- Keep high-impact decisions human-reviewable until validated.

This aligns with Vaja's skill-first, agent-first, profession-agnostic direction.

---

## 2) Outcome targets

By completing this roadmap, Vaja should be able to:

1. Run text, image, and audio requests through one canonical agent/tool path.
2. Enforce consistent response contracts (confidence, severity/priority, next action, escalation).
3. Apply shared safety/uncertainty guardrails across all domain skills.
4. Detect cross-user signal clusters with human review before alerts are sent.
5. Measure quality and safety through a repeatable evaluation harness.

---

## 3) Phase plan (P0/P1/P2)

| Phase | Objective | Main deliverable |
| --- | --- | --- |
| P0 | Stabilize reusable execution foundation | Canonical multimodal path + response/safety contracts + evaluation harness |
| P1 | Add intelligence and governance | Signal detection + profile registry + knowledge/version governance + fair-share controls |
| P2 | Productize for scale | Profession starter kits + quality tiers + marketplace/sync readiness + compliance packs |

---

## 4) P0 — Reusable foundation (Now)

### 4.1 Milestone P0.1 — Canonical multimodal run path

Problem to solve:

- Some non-text flows can bypass the same skill/tool activation path used by text flows.

Deliverable:

- Single run entry where text/image/audio all become normalized inputs and continue through the same agent execution path.

Suggested owner:

- Core Platform Engineering

Acceptance criteria:

1. Text/image/audio requests invoke the same run orchestrator and tool-build path.
2. Skill activation behavior is equivalent across modalities for the same intent.
3. Run logs include modality and activation trace for each turn.
4. No alternate production code path exists that skips canonical skill/tool activation.

### 4.2 Milestone P0.2 — Structured response contract engine

Problem to solve:

- Response shape varies by prompt quality and channel path, reducing reliability.

Deliverable:

- Shared contract layer with required sections:
  - summary
  - confidence
  - severity/priority
  - immediate/next action
  - escalation condition

Suggested owner:

- AI Experience + Chat Platform

Acceptance criteria:

1. Contract schema is centralized and reused by all supported channels.
2. Contract validation occurs before final channel rendering.
3. Fallback behavior is deterministic when some fields are unavailable.
4. At least two profession profiles render correctly from the same contract.

### 4.3 Milestone P0.3 — Shared safety and uncertainty policy pack

Problem to solve:

- Safety constraints are present but not yet enforced as a shared, testable platform policy.

Deliverable:

- Central policy pack for conservative language, uncertainty behavior, disallowed advice classes, and escalation triggers.

Suggested owner:

- AI Safety + Domain QA

Acceptance criteria:

1. Policy checks execute for all assistant final responses.
2. Known policy violations trigger either auto-rewrite or safe fallback response.
3. Escalation trigger taxonomy is explicit and reusable across domains.
4. Safety policy tests run in CI and block regressions.

### 4.4 Milestone P0.4 — Real data connector reliability baseline

Problem to solve:

- Placeholder/fake tool data can invalidate demos and trust.

Deliverable:

- External connector standard with adapter status (`live`, `partial`, `unavailable`), timeout handling, and deterministic fallback semantics.

Suggested owner:

- Integrations Engineering

Acceptance criteria:

1. No production-facing tool path uses fake/random data.
2. Connector status is observable in logs and admin diagnostics.
3. Fallback mode is explicit in response metadata.
4. Connector timeout/error behavior is documented and tested.

### 4.5 Milestone P0.5 — Evaluation harness for pilot readiness

Problem to solve:

- Quality claims are hard to defend without repeatable scoring.

Deliverable:

- Scripted scenario suite and scorecard (correctness, safety, clarity, escalation behavior).

Suggested owner:

- Product QA + Domain Ops

Acceptance criteria:

1. Minimum 6 scripted scenarios per profession profile can run end-to-end.
2. Score outputs are stored with run metadata and version tags.
3. Baseline vs skill-enabled comparison is supported.
4. Release gate includes minimum passing thresholds per metric.

---

## 5) P1 — Intelligence and governance (Next)

### 5.1 Milestone P1.1 — Optional profile/entity registry

Deliverable:

- Conversational onboarding that can capture structured context (for example role, location, operating context, key assets) without requiring long forms.

Suggested owner:

- Product + Data Platform

Acceptance criteria:

1. Registry fields are domain-agnostic at core schema level.
2. Profile capture is optional and progressive.
3. Advice personalization reads registry values through a single resolver.

### 5.2 Milestone P1.2 — Cross-user signal detection + review queue

Deliverable:

- Deterministic clustering and thresholding that creates draft alerts for human review.

Suggested owner:

- Insights/Analytics Engineering

Acceptance criteria:

1. Detector version is logged on every cluster.
2. Draft/approve/send/dismiss lifecycle is fully auditable.
3. No auto-send path exists by default.
4. Cross-channel/workspace isolation is enforced.

### 5.3 Milestone P1.3 — Knowledge/source governance and versioning

Deliverable:

- Source register, expert-review workflow, and versioned skill/profile bundles.

Suggested owner:

- Knowledge Operations + Domain Leads

Acceptance criteria:

1. Every high-impact guidance section maps to source references.
2. Skill/profile versions are diffable and rollback-capable.
3. Review status (draft/reviewed/validated) is visible in admin UI.

### 5.4 Milestone P1.4 — Fair-share usage controls for shared access

Deliverable:

- Per-user/channel visibility, soft caps, emergency override, and transparent usage reporting.

Suggested owner:

- Platform Billing + Admin UX

Acceptance criteria:

1. Shared-pool usage can be monitored per actor and time window.
2. Soft-cap policy can be configured per workspace/channel.
3. Emergency override actions are permissioned and audited.

---

## 6) P2 — Scale and ecosystem (Later)

### 6.1 Milestone P2.1 — Profession starter kits

Deliverable:

- Reusable package template: response contract, safety policy, evaluation scenarios, and KPI mapping.

Suggested owner:

- Platform Product + Solutions Engineering

Acceptance criteria:

1. New profession onboarding uses a template, not ad-hoc implementation.
2. First usable profile can be launched with minimal code changes.

### 6.2 Milestone P2.2 — Skill quality tiers and evidence badges

Deliverable:

- Quality states: `draft`, `reviewed`, `validated` tied to evidence and test outcomes.

Suggested owner:

- Domain QA + Trust/Safety

Acceptance criteria:

1. Tier criteria are explicit and machine-checkable where possible.
2. Tier is visible in skill selection/install surfaces.

### 6.3 Milestone P2.3 — Marketplace and multi-file sync hardening

Deliverable:

- Robust install/sync/update workflow for multi-file skill packages with compatibility checks.

Suggested owner:

- Skills Platform Engineering

Acceptance criteria:

1. Package import supports references/assets/scripts with validation.
2. Breaking changes are detected before upgrade apply.
3. Sync history and rollback path are available.

### 6.4 Milestone P2.4 — Compliance and sector policy packs

Deliverable:

- Pluggable privacy/retention/consent policy presets by sector.

Suggested owner:

- Security/Compliance + Legal/Product

Acceptance criteria:

1. Policy presets can be applied per workspace/profile.
2. Data-handling behavior is traceable through audit logs.
3. Deletion/export workflows are consistent with configured policy.

---

## 7) Suggested ownership model (RACI-lite)

- Core Platform Engineering: runtime path, contract enforcement, integration seams.
- AI Safety + Domain QA: policy pack, uncertainty controls, escalation taxonomy.
- Product + Domain Operations: profile requirements, pilot scenarios, success metrics.
- Integrations + Analytics: external connectors, signal detection, operational observability.
- Billing/Admin UX: fair-share controls and operator-facing governance surfaces.

Use role ownership rather than person ownership so this roadmap remains stable through team changes.

---

## 8) Delivery sequence and gates

Recommended order:

1. P0.1 Canonical multimodal path
2. P0.2 Structured contract engine
3. P0.3 Safety policy pack
4. P0.4 Connector reliability baseline
5. P0.5 Evaluation harness
6. P1.2 Signal detection + review queue
7. P1.3 Knowledge governance
8. P1.4 Fair-share controls
9. P2 starter-kit and ecosystem milestones

Phase gates:

- Gate A (end P0): foundation is consistent and testable.
- Gate B (end P1): intelligence and governance are operator-ready.
- Gate C (end P2): repeatable expansion to multiple professions is productized.

---

## 9) Definition of done (roadmap-level)

Roadmap is considered successfully executed when:

1. At least two non-agriculture profession profiles run on the same core architecture without bespoke core rewrites.
2. Safety and escalation behavior are consistent across modalities and domains.
3. Quality metrics are measured with repeatable scenario harnesses and release thresholds.
4. Governance controls (review, audit, usage fairness, source traceability) are active and test-covered.
5. New profession onboarding follows a documented starter-kit workflow.
