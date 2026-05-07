# Domain Alert Detection Implementation Guide

> Audience: AI coders and developers implementing cross-profession alert detection workflows in Vaja.
> Purpose: define a reusable, profession-agnostic architecture for cluster detection, draft alerts, human review, and channel broadcast.

---

## 1) Vision alignment

This guide follows Vaja's skill-first, profession-agnostic product vision:

- one shared platform runtime
- reusable detection infrastructure
- domain behavior injected through skills/profiles
- human-reviewed alerts for high-impact decisions

The core design is not agriculture-specific. Agriculture is one profile implementation.

---

## 2) Core decision: tool + skill split

### Tool layer (shared infrastructure)

Tool logic should be domain-agnostic and deterministic:

- collect candidate report signals in a time window
- group and score clusters
- create deduped draft alerts
- drive review and send lifecycle
- persist audit fields and detector version

### Skill/profile layer (domain behavior)

Skill/profile logic is domain-specific:

- topic vocabulary and canonical topic mapping
- severity interpretation guidance
- safe response contract and escalation wording
- role language (officer, manager, supervisor, etc.)

Rule:

- Tool answers: "did a meaningful cluster occur?"
- Skill answers: "what should people do next in this profession?"

---

## 3) Production pattern (SME-safe)

Use SQL-first detection and human review first.

### Phase A (default)

- extraction: regex/intent hints + optional LLM topic normalization
- aggregation: SQL windowed group-by
- thresholds: configurable per workspace/channel
- output: draft alert only (no auto-send)

### Phase B (optional)

- semantic merge for synonyms (embeddings)
- map/segment visualizations
- profile-specific auto-prioritization recommendations

Avoid heavy ML prediction as the first release.

---

## 4) Generic data model

Use schema names that are reusable across professions, even if initially implemented under LINE OA scopes.

### 4.1 `alert_signal`

One row per detected report signal from incoming events.

Suggested fields:

- `id` (pk)
- `channelId` (fk)
- `threadId` (fk)
- `actorId` (line user / sender key)
- `messageId` (nullable)
- `sourceType` (`text` | `image` | `audio_transcript` | `form`)
- `domain` (for example: `agriculture`, `healthcare`, `retail`)
- `topic` (canonical topic key)
- `context1` (nullable grouping context, for example district/site/branch)
- `context2` (nullable secondary context)
- `confidence` (0-100 int)
- `detectorVersion` (text)
- `observedAt` (timestamp)
- `createdAt` / `updatedAt`

Recommended indexes:

- `(channelId, observedAt)`
- `(channelId, topic, observedAt)`
- `(channelId, actorId, observedAt)`

### 4.2 `alert_cluster`

One row per draft/reviewed/sent alert cluster.

Suggested fields:

- `id` (pk)
- `channelId` (fk)
- `domain` (not null)
- `status` (`draft` | `reviewed` | `approved` | `sent` | `dismissed`)
- `topic` (not null)
- `context1` / `context2` (nullable)
- `windowHours` (int)
- `reportCount` (int)
- `uniqueReporterCount` (int)
- `severityScore` (int 0-100)
- `dedupeFingerprint` (text)
- `draftTitle` (text)
- `draftBody` (text)
- `reviewedByUserId` (nullable)
- `reviewNote` (nullable)
- `sentBroadcastId` (nullable)
- `detectorVersion` (text)
- `detectedAt` (timestamp)
- `createdAt` / `updatedAt`

Recommended indexes:

- `(channelId, status, detectedAt)`
- unique `(channelId, dedupeFingerprint, status)` for active states

---

## 5) File-level implementation (Vaja)

### 5.1 Shared tool module

Create a reusable module:

- `features/alert-detection/manifest.ts`
- `features/alert-detection/schema.ts`
- `features/alert-detection/service.ts`
- `features/alert-detection/agent.ts`
- `features/alert-detection/types.ts`

Register in:

- `features/tools/registry/client.ts`
- `features/tools/registry/server.ts`
- `features/tools/registry/page-loaders.ts`

### 5.2 Service contract

`features/alert-detection/service.ts` should own canonical business logic:

- `runAlertDetection(input)`
- `alertDetectionAction(input)`
- `createDraftAlert(input)`
- `approveAlert(input)`
- `sendAlert(input)`
- `dismissAlert(input)`

No duplicate business logic in agent wrappers or API routes.

### 5.3 Ingestion seam

At message/event ingestion points (for LINE OA, currently `features/line-oa/webhook/events/message.ts`):

- extract normalized candidate signal topics
- write `alert_signal` rows
- keep extraction helper centralized to avoid drift

---

## 6) API workflow

For each channel/workspace scope:

- `GET /api/.../alerts` list clusters by status/time
- `POST /api/.../alerts/run` run detector manually
- `POST /api/.../alerts/[alertId]/approve`
- `POST /api/.../alerts/[alertId]/send`
- `POST /api/.../alerts/[alertId]/dismiss`

All routes must enforce ownership and scope isolation.

---

## 7) Detection algorithm (shared baseline)

Inputs:

- `channelId`
- `domain`
- `windowHours` (default 48)
- `minUniqueReporters` (default 3)
- optional topic allow/deny lists

Steps:

1. Load `alert_signal` rows in the time window
2. Group by `(topic, context1?, context2?)`
3. Compute report and unique-reporter counts
4. Filter groups by threshold
5. Compute severity score
6. Build `dedupeFingerprint`
7. Upsert draft alerts if no active duplicate

Keep scoring deterministic and explainable in Phase A.

---

## 8) Profession profiles

Each profession defines a profile package that maps local language into canonical topics and draft guidance.

Recommended profile location pattern:

- `features/skills/packages/<domain>/alert-profile/SKILL.md`

Profile responsibilities:

- topic map and synonyms
- mandatory alert fields
- severity interpretation notes
- escalation and safety constraints

Examples:

- agriculture: crop disease/pest spread risk
- healthcare: symptom cluster surveillance
- retail: incident/fraud anomaly clusters
- education: integrity/incident trend clusters

---

## 9) Safety and governance

Non-negotiables:

- no automatic send in initial rollout
- every alert must be reviewable and dismissible
- uncertainty language when evidence is weak
- data minimization and de-identification for shared outputs
- detector version logging for traceability

---

## 10) Performance guidance

At SME scale, this is low to moderate load:

- indexed SQL group-by is sufficient
- run every 15-60 minutes or on demand
- no mandatory external ML service in first release

Scale options later:

- pre-aggregation tables
- partitioned signal storage
- optional semantic merge stage

---

## 11) Acceptance criteria (core)

Done when:

1. Signal ingestion is active and scoped correctly
2. Detector creates deduped draft clusters deterministically
3. Review/approve/send/dismiss lifecycle works end to end
4. Broadcast integration uses existing channel messaging service
5. Cross-channel isolation is enforced
6. No auto-send path exists by default
7. Unit + integration tests cover thresholds, dedupe, and review flow

---

## 12) Related profile guide

For the agriculture-specific implementation profile, see:

- `docs/guide/sme-agriculture-outbreak-detection-implementation-guide.md`
