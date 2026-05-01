# Privacy And Data Governance Implementation Guide

> Audience: AI coders, backend developers, frontend developers, product owners, and operators building Vaja for production.
> Purpose: define a profession-neutral privacy and governance layer for Vaja's LINE-first, skill-first AI cowork platform.

## Status

Current status:

- Vaja already has several privacy and governance building blocks.
- Production-grade privacy governance is partially implemented and should be strengthened before large deployments with cooperatives, schools, clinics, agencies, brands, or other organizations.
- This document is profession-neutral. Agriculture examples are only examples. The same architecture must support teachers, clinics, creators, government officers, sales teams, SMEs, and other professional groups.

Read this together with:

- `docs/vaja-vision.md`
- `docs/memory-implementation.md`
- `docs/prompt-architecture.md`
- `docs/agent-context-and-governance-spec.md`
- `docs/domain-neutral-profile-entity-layer-implementation.md`
- `docs/ai-audit-observability-implementation.md`
- `docs/line-oa-dev-guide.md`

## Core Principle

Vaja should treat professional conversations and structured profiles as sensitive operational data.

Do not design privacy around a single profession. A farm profile, classroom profile, patient context, sales pipeline, creator workspace, and government service request all deserve the same core protections:

- clear notice
- purpose limitation
- minimal collection
- scoped access
- explicit roles
- auditability
- deletion and correction paths
- de-identification for analytics and external sharing

## Current Building Blocks

Already present in the codebase:

- Auth and user identity via `lib/auth.ts`.
- User credit ledger via `userCredit` and `creditTransaction`.
- Chat persistence via `chatThread` and `chatMessage`.
- Chat run audit via `chatRun` and `features/chat/audit/`.
- Tool run audit via `toolRun` and `toolArtifact`.
- Workspace AI run audit via `workspaceAiRun`.
- User profile memory via `userMemory`.
- Shared brand memory via `memoryRecord`.
- Thread working memory via `threadWorkingMemory`.
- LINE channel scoping via `lineOaChannel`.
- LINE conversation mapping via `lineConversation`.
- LINE account linking via `lineAccountLink`.
- LINE daily channel analytics via `lineChannelDailyStat` and `lineChannelDailyUser`.
- Domain-neutral structured context via `domainProfile`, `domainEntity`, and `domainEntityRelation`.
- Brand/workspace sharing through `brandShare` and `workspaceMember`.
- Agent sharing through `agentShare` and public share links.

Important gaps:

- No unified role/permission policy service across all sensitive views.
- No canonical privacy notice or consent ledger.
- No admin/officer conversation-view audit table.
- No per-channel retention policy enforcement.
- No built-in export redaction/de-identification pipeline.
- No complete data subject request workflow.
- No third-party data sharing agreement registry.
- No production UI for privacy review, access logs, retention, and deletion requests.

## Data Classification

Add a shared data classification vocabulary. Use it in docs, code comments, audit logs, and review checklists.

Recommended classes:

| Class | Meaning | Examples |
| --- | --- | --- |
| `public` | Intended for public display | Published skill template metadata, public landing content |
| `internal` | Operational platform data | Feature flags, non-sensitive run status |
| `personal` | Identifies or can single out a person | User ID, LINE user ID, email, display name, profile image |
| `professional_context` | User or organization work context | Farm profile, classroom profile, brand profile, sales pipeline |
| `sensitive_professional` | Higher-risk professional data | Patient notes, student issues, legal matter details, precise farm boundaries |
| `credential` | Secrets and access tokens | LINE channel access token, R2 secret, OAuth token |
| `aggregate` | Statistics with no direct identifiers | Channel daily totals, de-identified usage trends |

Treat LINE user IDs as `personal`, not anonymous.

Treat precise location, photos, voice notes, patient/student/client details, and free-text conversation transcripts as potentially sensitive.

## Ownership And Scope Model

Every sensitive row should be resolvable to an owner scope.

Recommended scopes:

- `user`: private to an individual Vaja user.
- `line_user`: temporary or unlinked LINE identity, scoped by `channelId + lineUserId`.
- `brand`: shared business or workspace context.
- `channel`: LINE OA channel owned by an organization.
- `workspace`: group access context for teams and cooperatives.
- `public_share`: explicitly shared public-agent context.
- `system`: platform-owned operational metadata.

Implementation rule:

Never authorize access from an ID alone. Always verify the caller can access the owning scope.

Examples:

- A `chatThread.id` is not enough. Check `chatThread.userId`, `guestSessionId`, `shareToken`, or LINE channel ownership.
- A `domainProfile.id` is not enough. Check `userId`, `brandId`, or `channelId + lineUserId`.
- A `brandId` is not enough. Check `brand.userId`, `brandShare`, or `workspaceMember`.

## Role Model

Add a central role vocabulary before expanding third-party access.

Recommended roles:

| Role | Intended access |
| --- | --- |
| `owner` | Full control over owned workspace/channel/profile |
| `workspace_admin` | Manage members, settings, usage, and approved shared context |
| `operator` | Help users and manage day-to-day workflows |
| `reviewer` | Review escalated conversations or outputs |
| `analyst` | See aggregate/de-identified analytics only |
| `support_admin` | Platform support with audited, time-bound access |
| `billing_admin` | Credits, invoices, and usage summaries |

Avoid generic `admin` checks in new code. Prefer explicit capability checks.

Example capabilities:

- `conversation.read`
- `conversation.read_escalated`
- `conversation.export`
- `domain_profile.read`
- `domain_profile.write`
- `memory.read`
- `memory.approve`
- `analytics.read_aggregate`
- `analytics.read_identified`
- `credits.manage`
- `privacy_request.manage`
- `retention.manage`
- `third_party_export.create`

## Proposed Module

Add a feature module:

```txt
features/privacy-governance/
  types.ts
  schema.ts
  service.ts
  access-control.ts
  redaction.ts
  retention.ts
  consent.ts
  audit.ts
  exports.ts
  server/
    queries.ts
    mutations.ts
  components/
    privacy-notice-panel.tsx
    privacy-request-list.tsx
    access-log-table.tsx
    retention-settings-panel.tsx
```

Add schema file:

```txt
db/schema/privacy.ts
```

Export it from:

```txt
db/schema.ts
```

Add APIs:

```txt
app/api/privacy/notice/route.ts
app/api/privacy/consents/route.ts
app/api/privacy/requests/route.ts
app/api/privacy/requests/[requestId]/route.ts
app/api/privacy/access-logs/route.ts
app/api/privacy/retention-policies/route.ts
app/api/privacy/exports/route.ts
```

## Recommended Tables

### `privacyNotice`

Stores the current privacy notice per organization/channel/workspace.

```ts
export const privacyNotice = pgTable("privacy_notice", {
  id: text("id").primaryKey(),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  locale: text("locale").notNull().default("th-TH"),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

### `privacyConsent`

Stores consent or acknowledgement events.

```ts
export const privacyConsent = pgTable("privacy_consent", {
  id: text("id").primaryKey(),
  noticeId: text("notice_id").references(() => privacyNotice.id, { onDelete: "set null" }),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  purpose: text("purpose").notNull(),
  status: text("status").notNull(),
  source: text("source").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Example purposes:

- `service_operation`
- `officer_review`
- `quality_improvement`
- `safety_escalation`
- `research_aggregate`
- `research_identifiable`
- `marketing_messages`

### `privacyAccessLog`

Logs sensitive reads and exports.

```ts
export const privacyAccessLog = pgTable("privacy_access_log", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id").notNull(),
  reason: text("reason"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Log at minimum:

- raw conversation views by non-owner users
- memory views and approvals
- domain profile views by organization staff
- exports
- deletion requests
- retention policy changes
- support impersonation or support access
- emergency overrides

### `privacyRequest`

Tracks access, correction, deletion, export, restriction, and consent withdrawal requests.

```ts
export const privacyRequest = pgTable("privacy_request", {
  id: text("id").primaryKey(),
  subjectType: text("subject_type").notNull(),
  subjectId: text("subject_id").notNull(),
  scopeType: text("scope_type"),
  scopeId: text("scope_id"),
  requestType: text("request_type").notNull(),
  status: text("status").notNull().default("open"),
  requestedByUserId: text("requested_by_user_id").references(() => user.id, { onDelete: "set null" }),
  requestText: text("request_text"),
  resolutionNote: text("resolution_note"),
  dueAt: timestamp("due_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

### `retentionPolicy`

Stores per-scope retention settings.

```ts
export const retentionPolicy = pgTable("retention_policy", {
  id: text("id").primaryKey(),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id").notNull(),
  rawChatRetentionDays: integer("raw_chat_retention_days"),
  memoryRetentionDays: integer("memory_retention_days"),
  mediaRetentionDays: integer("media_retention_days"),
  auditRetentionDays: integer("audit_retention_days"),
  aggregateRetentionDays: integer("aggregate_retention_days"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

Suggested defaults:

- Raw chat: 90 to 180 days for organization-managed LINE channels.
- User-owned chat: user controlled, with deletion support.
- Audit logs: 1 to 3 years depending on legal/commercial needs.
- Aggregates: longer retention if de-identified.
- Credentials: until revoked, with rotation support.

### `dataSharingAgreement`

Tracks third-party export permissions.

```ts
export const dataSharingAgreement = pgTable("data_sharing_agreement", {
  id: text("id").primaryKey(),
  scopeType: text("scope_type").notNull(),
  scopeId: text("scope_id").notNull(),
  partnerName: text("partner_name").notNull(),
  purpose: text("purpose").notNull(),
  dataLevel: text("data_level").notNull(),
  status: text("status").notNull().default("draft"),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  documentUrl: text("document_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
});
```

Data levels:

- `aggregate_only`
- `deidentified_records`
- `pseudonymous_records`
- `identified_records`

Default to `aggregate_only`.

## Access Control Service

Add:

```txt
features/privacy-governance/access-control.ts
```

Recommended API:

```ts
assertCanAccess({
  actorUserId,
  action,
  targetType,
  targetId,
  scopeType,
  scopeId,
});

canAccess(...): Promise<boolean>;

listActorCapabilities(actorUserId, scope): Promise<string[]>;
```

Rules:

- Centralize sensitive authorization checks.
- Use explicit capabilities.
- Default deny when scope cannot be resolved.
- Require a reason for high-risk reads and exports.
- Audit successful high-risk reads and failed export attempts.

High-risk target types:

- `chat_message`
- `chat_thread`
- `domain_profile`
- `domain_entity`
- `memory_record`
- `user_memory`
- `media_asset`
- `brand_photo`
- `line_account_link`
- `payment_order`

## Notice And Consent

Vaja should not hide operational review.

Every organization-managed channel should show a short onboarding notice:

```txt
This AI service is operated by {organization}. Your messages may be stored and reviewed by authorized staff for support, service quality, and escalation. Do not send information you do not want the organization to process. You can request deletion or correction through {contact}.
```

For LINE:

- Send notice on first interaction.
- Include a short version in rich menu or welcome message.
- Store acknowledgement in `privacyConsent`.
- Re-send or ask for acknowledgement when the notice version changes materially.

For web:

- Show privacy notice during onboarding.
- Add a privacy page in settings.
- Let users view and withdraw optional consents.

Consent is not always the only legal basis, especially for organization operations or public-interest programs. However, the app should still store a clear purpose and notice record for transparency.

## Conversation Review Model

Do not give all organization staff full raw chat access by default.

Recommended levels:

| Level | Data shown | Intended role |
| --- | --- | --- |
| Summary | AI-generated summary, topic, status, no full transcript | analyst, manager |
| Escalated case | Relevant messages around escalation only | reviewer, officer, operator |
| Full transcript | Entire conversation | owner, authorized support, limited admins |
| Export | Downloadable data | owner, privacy admin, approved partner process |

Add an escalation model before broad review:

- User asks for human help.
- AI detects safety, compliance, emergency, or high-risk topic.
- Officer marks conversation for follow-up.
- Admin manually escalates with reason.

Every escalated conversation should have:

- scope
- reason
- assigned role or user
- status
- audit log

## Redaction And De-Identification

Add:

```txt
features/privacy-governance/redaction.ts
```

Recommended functions:

```ts
redactForRole(input, role, purpose)
deidentifyRecord(input, options)
hashIdentifier(value, saltScope)
stripPreciseLocation(data)
stripMediaUrls(data)
```

Default redactions:

- Replace `lineUserId` with scoped hash.
- Remove email, phone number, national ID, address, and free-text identifiers where possible.
- Remove profile image URLs for analytics.
- Remove precise GPS and boundary polygons unless the purpose requires them.
- Remove media URLs unless the user consented or the reviewer needs them.
- Convert timestamps to day/week buckets for aggregate analytics when exact time is unnecessary.

Do not promise perfect anonymization for free text. Use "de-identified" or "redacted" unless the data has been formally anonymized.

## Retention And Deletion

Add:

```txt
features/privacy-governance/retention.ts
```

Recommended jobs:

- delete or archive raw chat older than policy
- delete expired media assets from R2
- remove stale unlinked LINE memory
- prune old tool outputs with sensitive payloads
- keep aggregate stats after identifiers are removed
- keep audit logs according to audit retention policy

Deletion request behavior:

- Delete user-owned chat, memory, domain profiles, media, and linked LINE records when legally appropriate.
- For organization-managed records, support deletion or anonymization depending on contractual/legal obligations.
- Keep minimal audit evidence that a deletion occurred.

Implementation note:

Never hard-delete by broad scope without previewing affected row counts. Build a service that enumerates target rows by table and scope before deletion.

## Exports And Third-Party Sharing

Add:

```txt
features/privacy-governance/exports.ts
```

Export rules:

- Default exports to aggregate or de-identified.
- Require capability `conversation.export` or `analytics.export`.
- Require a purpose and agreement ID for partner exports.
- Watermark or label exports with data level.
- Audit every export.
- For identified exports, require explicit approval and a valid legal basis.

Example export modes:

- `usage_aggregate`: counts, costs, categories.
- `domain_trends_deidentified`: grouped professional patterns.
- `case_review_pseudonymous`: redacted transcript with scoped IDs.
- `full_subject_export`: user-requested access export.

## Memory Governance

Keep memory layers separate:

- `userMemory`: personal profile facts.
- `memoryRecord`: shared brand or workspace facts.
- `threadWorkingMemory`: thread state.
- `domainProfile` and `domainEntity`: structured professional context.

Rules:

- Do not silently convert sensitive transcript details into shared memory.
- For shared memory, prefer review and approval.
- Let users clear thread working memory.
- Let users manage personal memory.
- For organization-scoped memory, show who approved it and when.

## Domain Profile Governance

Domain profiles are not just metadata. They can contain sensitive professional context.

Examples:

- Agriculture: farm location, plot size, crop issues.
- Education: student notes and class performance.
- Clinic: patient context.
- Sales: client pipeline and pricing.
- Creator: brand strategy and unpublished campaigns.

Rules:

- Access must follow profile owner scope.
- Cross-profession analytics must use de-identified aggregation.
- Precise location and health/student/client details should be treated as sensitive.
- Skills may define fields, but platform core must enforce access and audit rules.

## LINE-Specific Governance

LINE is a front door, not a privacy shortcut.

Rules:

- Treat `lineUserId` as personal data.
- Scope unlinked data by `channelId + lineUserId`.
- Do not merge LINE memory or domain profiles into a Vaja user unless account linking succeeds.
- Keep group chat context separate from individual user context.
- In group chats, do not reveal private individual memory unless explicitly appropriate.
- Show privacy notice per channel.
- Log officer/admin reads of LINE conversations.

## UI Requirements

Add surfaces gradually.

Minimum production UI:

- Privacy notice editor per channel/workspace.
- Consent/acknowledgement list.
- Access log table.
- Retention policy settings.
- Data request queue.
- Export request workflow.
- Role/capability management.

Useful user-facing controls:

- View my memory.
- Delete my memory.
- Request data export.
- Request deletion.
- See linked LINE accounts.
- Unlink LINE account.

## API Requirements

Every privacy route should:

- authenticate user
- resolve scope
- authorize capability
- validate input with Zod
- call service layer
- audit high-risk action
- return minimal JSON

Do not put privacy logic directly in route files.

## Implementation Phases

### Phase 1: Policy And Inventory

- Add this document to engineering onboarding.
- Add data classification notes to key schema docs.
- Identify all tables containing personal or sensitive professional data.
- Document current owner scope for each sensitive table.

### Phase 2: Consent And Notice

- Add `privacyNotice`.
- Add `privacyConsent`.
- Add LINE first-touch notice.
- Add web privacy acknowledgement.
- Add settings view for current notices and optional consents.

### Phase 3: Access Control And Audit

- Add central capability checks.
- Add `privacyAccessLog`.
- Audit non-owner reads of raw conversations, memory, profiles, and exports.
- Add admin access-log UI.

### Phase 4: Data Subject Requests

- Add `privacyRequest`.
- Add user-facing request form.
- Add admin queue.
- Add service helpers to enumerate subject data by scope.
- Add correction, deletion, and export workflows.

### Phase 5: Retention

- Add `retentionPolicy`.
- Add retention job in a safe dry-run-first style.
- Add media cleanup for R2 objects.
- Add per-channel/workspace retention settings.

### Phase 6: Redaction And Export Governance

- Add redaction helpers.
- Add de-identified export modes.
- Add `dataSharingAgreement`.
- Require agreement and purpose for partner exports.

### Phase 7: Production Hardening

- Add support access policy.
- Add emergency override workflow.
- Add breach/incident response checklist.
- Add periodic access review.
- Add tests around authorization and redaction.

## Testing Checklist

- Unauthorized user cannot read another user's chat, memory, domain profile, or media.
- Workspace member can only perform actions allowed by role.
- Analyst role sees aggregate data only.
- Reviewer role sees escalated cases only.
- Raw conversation views by non-owner are audited.
- Exports are audited and redacted according to export mode.
- LINE unlinked user data is scoped by `channelId + lineUserId`.
- Account linking migrates only the matching LINE user's data.
- Group chat context does not leak individual memory.
- Retention dry run reports affected rows before deletion.
- Deletion request removes or anonymizes expected records.
- Consent withdrawal blocks optional processing paths.

## AI Coder Guardrails

When implementing privacy-related code:

- Do not call LINE IDs anonymous. Use pseudonymous or personal identifier.
- Do not bypass ownership checks with direct DB reads in routes.
- Do not expose raw transcripts to broad admin roles by default.
- Do not export free-text conversations without redaction and audit.
- Do not merge memory, domain profiles, and chat transcripts into one table.
- Do not add profession-specific privacy rules to platform core unless multiple professions need the same primitive.
- Do not store secrets in audit logs or exported JSON.
- Do not log full prompts or raw media payloads unless there is a defined retention and access policy.
- Prefer summaries and scoped hashes for analytics.
- Prefer explicit capability checks over broad role names.

## Production Acceptance Criteria

Before large-scale deployment with third-party operators:

- Every organization-managed channel has a published privacy notice.
- Users are informed when authorized staff may review conversations.
- Non-owner raw conversation access is role-gated and audited.
- Exports require purpose, role, and audit.
- Deletion and correction requests can be handled operationally.
- Retention policies exist for chat, media, memory, audit logs, and aggregates.
- Partner sharing defaults to aggregate or de-identified data.
- Support/admin access is logged and reviewable.

## Suggested Committee Answer

Vaja handles privacy through scoped identity, clear notice, role-based access, audit logs, and data minimization. LINE users are identified by pseudonymous LINE user IDs, which Vaja treats as personal data. Vaja does not require national ID, phone number, precise GPS, or legal identity for normal use.

For organization-managed channels, officers or admins should only access data for the workspace or LINE OA channel they manage. Raw conversations should not be broadly visible by default. Production access should be role-based, purpose-limited, and audited, with separate views for aggregate analytics, escalated cases, and full transcripts.

For external reporting or research, Vaja should default to aggregate or de-identified data. Identifiable exports should require explicit approval, a valid purpose, and a data sharing agreement. This keeps Vaja aligned with Thailand PDPA principles while preserving the platform vision: many professions can use AI safely through shared skills, channels, and governance.

## References

- Thailand PDPA official guidance and consent resources: `https://pdpa.ditp.go.th/`
- Thai government PDPA template resources: `https://www.dol.go.th/PDPA`
