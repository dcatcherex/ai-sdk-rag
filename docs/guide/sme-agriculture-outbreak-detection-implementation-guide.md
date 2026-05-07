# SME Agriculture Alert Detection Profile Guide

> Audience: AI coders and developers implementing the agriculture profile on top of Vaja's shared alert-detection architecture.
> Purpose: define agriculture-specific mappings, thresholds, safety rules, and rollout details for SME-scale farmer channels.

---

## Relationship to core guide

This document is a domain profile, not a standalone architecture.

Read this first:

- `docs/guide/domain-alert-detection-implementation-guide.md`

Use this document for agriculture-specific decisions only (crop/symptom taxonomy, extension-officer escalation, and Thai farmer communication rules).

---

## 1) Why this guide exists

For SME farmer operations (for example, 50-500 farmers per channel), "outbreak detection" should not start with heavy machine learning.

The practical production pattern is:

1. Aggregate farmer symptom reports in a time window
2. Detect threshold crossings (unique reporters + frequency)
3. Create a draft alert
4. Require officer review before broadcast

This is low-cost, explainable, and safer for real agricultural decisions.

---

## 2) Current repo baseline

Already available in this repo:

- LINE conversations mapped to threads via `line_conversation` in `db/schema/line-oa.ts`
- Message persistence via `chat_message` in `db/schema/chat.ts`
- LINE broadcast primitives in `features/line-oa/broadcast/service.ts`
- Broadcast APIs in `app/api/line-oa/[id]/broadcasts/route.ts`
- Intent routing with agriculture symptom terms in `features/line-oa/webhook/events/intent-router.ts`
- Farm advisory skills (diagnosis, weather, record keeping) seeded in `scripts/seed-agents.ts`

Not yet implemented:

- Automated multi-user outbreak signal clustering
- Draft alert lifecycle for officer review
- Alert dedupe and cooldown controls

---

## 3) Decision: tool + skill split

Use both layers, each for a different responsibility.

### Tool responsibility (execution)

Owns deterministic computation:

- load candidate reports in a time window
- compute cluster counts and unique-reporter thresholds
- calculate severity score
- create/update draft alerts
- enforce dedupe and cooldown

### Skill responsibility (domain judgment)

Owns domain language and advisory style:

- what symptom groupings matter most for Thai crops
- how to phrase cautious alert copy
- what immediate action and prevention to include
- when to escalate to extension officers

Rule of thumb:

- Tool = "did a cluster happen?"
- Skill = "how should we explain and act on it?"

---

## 4) Production pattern for SME scale

Start SQL-first and officer-reviewed.

### Phase A (recommended first release)

- topic extraction: regex + intent hints
- aggregation: SQL windowed counts
- clustering key: `(channelId, district?, crop?, symptomTopic)`
- threshold: configurable per channel (default: 3 unique reporters in 48h)
- output: draft alert only (no auto-send)

### Phase B (after pilot confidence)

- optional embeddings/semantic grouping for synonym collapse
- map-level regional views
- model-assisted draft wording improvements

Do not start with external ML services for pilot-scale workloads.

---

## 5) Data model additions (agriculture profile)

Core architecture uses generic entities (`alert_signal`, `alert_cluster`).

For agriculture under current LINE OA implementation, map them as:

- `topic` -> `symptomTopic`
- `context1` -> `crop`
- `context2` -> `province` / `district`

Add these tables in `db/schema/line-oa.ts` (or equivalent domain-specific schema module if generalized later).

### 5.1 `line_outbreak_signal`

Normalized per-report signal rows (write-time extraction from incoming user messages).

Suggested fields:

- `id` (pk)
- `channelId` (fk -> `line_oa_channel.id`)
- `threadId` (fk -> `chat_thread.id`)
- `lineUserId` (raw LINE user/group sender key)
- `messageId` (fk-ish ref to `chat_message.id`, nullable if unavailable)
- `sourceType` (`text` | `image` | `audio_transcript`)
- `crop` (nullable)
- `symptomTopic` (not null)
- `district` (nullable)
- `province` (nullable)
- `confidence` (0-100 int)
- `detectorVersion` (text)
- `observedAt` (timestamp)
- `createdAt` / `updatedAt`

Indexes:

- `(channelId, observedAt)`
- `(channelId, symptomTopic, observedAt)`
- `(channelId, lineUserId, observedAt)`

### 5.2 `line_outbreak_alert`

Draft and reviewed alert lifecycle.

Suggested fields:

- `id` (pk)
- `channelId` (fk)
- `status` (`draft` | `reviewed` | `approved` | `sent` | `dismissed`)
- `symptomTopic` (not null)
- `crop` (nullable)
- `province` / `district` (nullable)
- `windowHours` (int)
- `reportCount` (int)
- `uniqueReporterCount` (int)
- `severityScore` (int 0-100)
- `dedupeFingerprint` (text)
- `draftTitle` (text)
- `draftBody` (text)
- `reviewedByUserId` (nullable)
- `reviewNote` (nullable)
- `sentBroadcastId` (nullable fk -> `line_broadcast.id`)
- `detectorVersion` (text)
- `detectedAt` (timestamp)
- `createdAt` / `updatedAt`

Indexes:

- `(channelId, status, detectedAt)`
- unique `(channelId, dedupeFingerprint, status)` for active statuses (`draft`, `reviewed`, `approved`)

Migration steps:

1. Add schema definitions in `db/schema/line-oa.ts`
2. Generate migration: `pnpm drizzle-kit generate`
3. Apply migration: `pnpm drizzle-kit migrate`

---

## 6) File-level implementation plan

Follow the existing tool architecture rule: one canonical `service.ts`.

### 6.1 New tool module

Create:

- `features/outbreak-detection/manifest.ts`
- `features/outbreak-detection/schema.ts`
- `features/outbreak-detection/service.ts`
- `features/outbreak-detection/agent.ts`
- `features/outbreak-detection/types.ts`

Register in:

- `features/tools/registry/client.ts`
- `features/tools/registry/server.ts`
- `features/tools/registry/page-loaders.ts`

UI page:

- `features/outbreak-detection/components/outbreak-detection-tool-page.tsx`

### 6.2 Outbreak service contract

In `features/outbreak-detection/service.ts`, expose:

- `runOutbreakDetection(input)` -> raw detection result
- `outbreakDetectionAction(input)` -> `ToolExecutionResult`
- `createDraftAlert(input)`
- `approveAndBroadcastAlert(input)`

Keep business logic only here. Agent wrappers and API routes are thin callers.

### 6.3 Webhook ingestion hook

In `features/line-oa/webhook/events/message.ts`:

- after message normalization and before/after AI reply, call a small signal extractor
- write rows to `line_outbreak_signal` for relevant agriculture symptom messages

Use `intent-router.ts` detection hints to avoid duplicate detection logic drift.

---

## 7) API and operator workflow

Add admin/channel-owner endpoints:

- `GET /api/line-oa/[id]/outbreak-alerts` (list drafts/reviewed/sent)
- `POST /api/line-oa/[id]/outbreak-alerts/run` (manual detector run)
- `POST /api/line-oa/[id]/outbreak-alerts/[alertId]/approve` (approve)
- `POST /api/line-oa/[id]/outbreak-alerts/[alertId]/send` (create/send broadcast)
- `POST /api/line-oa/[id]/outbreak-alerts/[alertId]/dismiss` (dismiss)

Auth model:

- channel ownership checks follow existing `line-oa` route patterns
- no cross-channel reads

Broadcast integration:

- approval/send path should create a `line_broadcast` draft using existing broadcast service
- send via `sendBroadcast()` in `features/line-oa/broadcast/service.ts`

---

## 8) Detection algorithm (Phase A)

Inputs:

- `channelId`
- `windowHours` (default 48)
- `minUniqueReporters` (default 3)
- optional `topicAllowList`

Steps:

1. Query `line_outbreak_signal` in window
2. Group by `(symptomTopic, district?, crop?)`
3. Compute:
   - `reportCount`
   - `uniqueReporterCount`
   - recency weighting
4. Keep groups where `uniqueReporterCount >= minUniqueReporters`
5. Compute `severityScore`
6. Build `dedupeFingerprint`
7. Create alert if not already active in cooldown window

Simple severity scoring (first cut):

- +40: `uniqueReporterCount >= 3`
- +20: `uniqueReporterCount >= 5`
- +20: `reportCount >= 8`
- +20: cluster appears within last 12h

Cap at 100.

---

## 9) Skill package for alert wording

Add a dedicated skill package, for example:

- `features/skills/packages/agriculture/outbreak-alert-drafter/SKILL.md`

It should define:

- conservative wording requirements
- mandatory fields (`risk`, `affected area`, `immediate actions`, `when to contact officer`)
- prohibited claims (no certainty without field verification)
- language contract (Thai-first for Thai channels)

This skill should draft operator-facing and farmer-facing versions, but send remains human-approved.

---

## 10) Safety and governance rules

Non-negotiable safeguards:

- no auto-broadcast in initial release
- every alert is reviewable and dismissible
- include uncertainty wording when evidence is weak
- avoid farmer-level personally identifying data in alert payloads
- aggregate/de-identify before any external sharing
- log detector version in both signal and alert rows for auditability

---

## 11) Performance and cost expectations

For SME scale, this is not compute intensive.

- SQL group-by over indexed signal table is sufficient
- run cadence: every 15-60 minutes, or manual on demand
- expected cost impact: low (DB query + normal API calls)
- no additional external ML service required for first production rollout

If channel volumes grow significantly, optimize by:

- partitioning `line_outbreak_signal` by month/channel class
- pre-aggregating hourly topic counters
- adding optional semantic merge only for ambiguous topics

---

## 12) Testing strategy

### Unit tests

- threshold crossing and non-crossing
- dedupe fingerprint behavior
- cooldown behavior
- severity scoring boundaries

### Integration tests

- ingest sample symptom messages -> detect -> create draft alert
- approve draft -> broadcast created -> broadcast sent
- dismiss draft prevents send

### Safety tests

- uncertain/low-signal clusters do not auto-send
- cross-channel isolation
- duplicate runs do not create duplicate active drafts

---

## 13) Acceptance criteria (MVP)

MVP is complete when all are true:

1. Signals are stored from LINE symptom messages
2. Detector produces deterministic draft alerts with thresholds
3. Duplicate alerts are suppressed via fingerprint/cooldown
4. Officer can review/approve/dismiss in app APIs
5. Approved alert can be sent via existing LINE broadcast service
6. No automatic send path exists without explicit approval
7. Core workflows have automated tests

---

## 14) What not to build yet

Defer until post-pilot:

- fully autonomous ML outbreak prediction
- nationwide geo heatmaps with external GIS systems
- cross-channel global auto-alerting
- direct farmer-level risk scoring models

First prove value with explainable, officer-reviewed clustering.

---

## 15) Quick implementation checklist

- [ ] Add `line_outbreak_signal` and `line_outbreak_alert` tables
- [ ] Add migration and apply with Drizzle
- [ ] Implement `features/outbreak-detection/service.ts`
- [ ] Register outbreak detection tool in tool registries
- [ ] Add LINE webhook signal ingestion hook
- [ ] Add outbreak alert review/send APIs under `app/api/line-oa/[id]/...`
- [ ] Reuse existing broadcast service for send
- [ ] Add agriculture alert drafting skill package
- [ ] Add unit + integration tests
- [ ] Run pilot with officer-reviewed workflow
