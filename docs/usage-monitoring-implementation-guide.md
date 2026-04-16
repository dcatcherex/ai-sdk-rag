# Infrastructure Usage Monitoring Implementation Guide

## Purpose

This document defines the recommended architecture for an internal admin monitoring surface that tracks infrastructure usage and operational limits for the Vaja platform.

It is intended for:

- AI coding agents implementing the feature later
- developers maintaining provider integrations
- operators debugging quota pressure and free-tier capacity
- future contributors estimating how many users the current stack can support

This guide focuses on monitoring for:

- Vercel platform usage
- Neon database usage
- Cloudflare R2 usage
- internal AI usage summaries derived from existing run ledgers

It does **not** assume that every provider exposes the same level of API support.

---

## Scope

The monitoring feature described here is an **internal admin operator surface**.

It should live alongside the existing admin console patterns in:

- `app/admin/`
- `app/api/admin/`
- `lib/admin.ts`

It is not the same thing as:

- end-user billing pages
- workspace-owner analytics
- team-level quota management
- customer-facing storage dashboards

Important rule:

- treat provider usage monitoring as internal operational tooling unless the permissions model is intentionally redesigned

---

## Current Context

The repo already has strong internal admin and observability foundations.

Existing relevant surfaces:

- `app/admin/page.tsx`
- `app/admin/chat-runs/page.tsx`
- `app/api/admin/chat-runs/*`
- `app/api/admin/ai-runs/*`
- `lib/admin.ts`
- `features/admin/ai-runs/*`
- `docs/admin-implementation-guide.md`
- `docs/ai-audit-observability-implementation.md`

Those surfaces already prove several useful patterns:

- internal admin routes must use `requireAdmin()`
- admin pages fetch reporting data from `/api/admin/...`
- reporting JSON should be small and normalized
- summary dashboards are convenience views, not the source of truth
- runtime usage is already partially observable from internal ledgers

This monitoring feature should extend those patterns instead of inventing a separate architecture.

---

## Problem Summary

Today, platform capacity estimates are mostly manual.

That creates several maintenance problems:

- free-tier limits can be hit without early warning
- capacity estimates are hard to update consistently
- usage lives across multiple providers with different dashboards
- some providers expose rich APIs while others expose only partial or account-level metrics
- AI provider usage inside the app and infrastructure usage outside the app are easy to confuse

Future maintainers need one clear answer for:

- what can be measured directly
- what must be estimated
- what should be tracked from internal ledgers instead of external provider APIs
- where to add or update provider integrations safely

---

## Decision

The recommended implementation is a **provider-adapter based admin monitoring layer** with a normalized response shape.

High-level flow:

```text
Admin page
  -> fetch('/api/admin/usage')
  -> route validates admin session
  -> route calls usage service
  -> usage service calls provider adapters
  -> adapters normalize provider metrics
  -> route returns a combined monitoring payload
  -> UI renders cards, limits, warnings, and trend summaries
```

Optional historical flow:

```text
Scheduled refresh or manual refresh
  -> usage service collects snapshots
  -> normalized snapshots saved to DB
  -> admin trend UI reads snapshots
```

Important rule:

- keep provider-specific API logic out of route files and out of page components

---

## Recommended Surface Map

### UI routes

Recommended pages:

- `app/admin/page.tsx`
  - compact summary cards only
- `app/admin/usage/page.tsx`
  - detailed infrastructure monitoring page

Recommended navigation label:

- `Usage`

### API routes

Recommended admin APIs:

- `GET /api/admin/usage`
  - live or near-live normalized usage summary
- `GET /api/admin/usage/snapshots`
  - optional historical snapshots for charts
- `POST /api/admin/usage/refresh`
  - optional manual refresh trigger for admins

Important rule:

- every admin usage route must call `requireAdmin()`

### Feature modules

Recommended future module:

```text
features/admin/usage/
  service.ts
  types.ts
  config.ts
  normalizers.ts
  providers/
    neon.ts
    r2.ts
    vercel.ts
    internal-ai.ts
  hooks/
    use-admin-usage.ts
  components/
    usage-summary-cards.tsx
    usage-provider-card.tsx
    usage-alerts.tsx
    usage-history-chart.tsx
```

This is the correct place for complexity if the feature grows.

Do not put provider clients directly into:

- `app/admin/usage/page.tsx`
- `app/api/admin/usage/route.ts`

---

## Provider Support Matrix

The monitoring system should distinguish between **live**, **partial**, **estimated**, and **manual** metrics.

### Neon

Recommended status:

- **live**

What Neon can provide well:

- project-level consumption history
- storage metrics
- compute metrics
- historical windows at hourly, daily, or monthly granularity

Important implementation note:

- Neon consumption API polling does **not** wake suspended compute according to the provider documentation

Recommended uses:

- storage usage
- compute usage
- trend snapshots
- free-tier pressure warnings

### Cloudflare R2

Recommended status:

- **live**

What R2 can provide well:

- bucket storage size over time
- object counts
- operation counts
- request volume by action type

Recommended implementation approach:

- query Cloudflare GraphQL analytics for `r2StorageAdaptiveGroups`
- query Cloudflare GraphQL analytics for `r2OperationsAdaptiveGroups`

Recommended uses:

- total bytes stored
- object count
- read/write operation estimates
- bucket-level trend charts

### Vercel

Recommended status:

- **partial** by default

What to assume today:

- Vercel clearly exposes usage in dashboard surfaces
- public, stable, project-scoped usage retrieval for every desired free-tier metric should be treated as **not guaranteed** until verified during implementation time

Important maintenance rule:

- do not hardcode the assumption that Vercel exposes a single clean API for bandwidth, function invocations, and runtime usage across all plan types

Recommended strategy:

- build a `vercel` adapter behind the same interface as other providers
- allow the adapter to return `status: 'partial'` or `status: 'unavailable'`
- prefer verified metrics when available
- fall back to internal app-derived estimates for some values when needed

Examples of app-derived estimates:

- request counts from internal route logs or run ledgers
- AI request volume from `chat_run`, `workspace_ai_run`, and `tool_run`
- uploaded asset volume from app-side storage writes

### Internal AI usage

Recommended status:

- **live** from internal ledgers

This is not the same thing as provider account billing.

What can be computed internally today or later with minimal risk:

- total AI runs
- runs by runtime
- runs by model
- token totals
- credit totals
- error rates
- per-day usage trends

Recommended source ledgers:

- `chat_run`
- `workspace_ai_run`
- `tool_run`
- `credit_transaction`

Important distinction:

- internal AI usage explains app behavior and relative demand
- it does **not** automatically prove remaining account balance at Gemini, OpenRouter, Vercel AI Gateway, or Kie

### Gemini, OpenRouter, Kie provider account usage

Recommended status:

- **manual** or **estimated** unless a verified provider API is intentionally integrated later

Recommended approach:

- show internal usage grouped by provider/model first
- keep account-level remaining credits or quotas optional
- if a provider exposes a stable usage or balance API later, add a new adapter without changing page contracts

---

## Normalized Data Contract

Every provider adapter should return a normalized structure so the admin UI does not care about raw provider response shape.

Recommended TypeScript model:

```ts
export type UsageMetricStatus = 'live' | 'partial' | 'estimated' | 'manual' | 'unavailable';

export type UsageProviderKey =
  | 'vercel'
  | 'neon'
  | 'r2'
  | 'internal-ai'
  | 'gemini'
  | 'openrouter'
  | 'kie';

export type UsageValueUnit =
  | 'count'
  | 'bytes'
  | 'seconds'
  | 'ms'
  | 'credits'
  | 'tokens'
  | 'percent'
  | 'requests';

export type UsageMetric = {
  key: string;
  label: string;
  value: number;
  unit: UsageValueUnit;
  limit: number | null;
  percentOfLimit: number | null;
  status: UsageMetricStatus;
  updatedAt: string;
  note: string | null;
};

export type UsageAlertLevel = 'info' | 'warning' | 'critical';

export type UsageAlert = {
  id: string;
  provider: UsageProviderKey;
  level: UsageAlertLevel;
  title: string;
  message: string;
};

export type UsageProviderSnapshot = {
  provider: UsageProviderKey;
  label: string;
  status: UsageMetricStatus;
  collectedAt: string;
  metrics: UsageMetric[];
  alerts: UsageAlert[];
  rawAvailable: boolean;
};

export type AdminUsageResponse = {
  generatedAt: string;
  providers: UsageProviderSnapshot[];
  summary: {
    healthyProviders: number;
    warningProviders: number;
    criticalProviders: number;
  };
};
```

Important rules:

- do not use `any`
- keep raw provider payloads out of client responses unless there is a strong debugging need
- if raw payload storage is needed, keep it server-side or in snapshot storage only

---

## Recommended File Responsibilities

### `app/api/admin/usage/route.ts`

Responsibilities:

- enforce `requireAdmin()`
- parse query options such as `live=true` or date range if needed
- call the monitoring service
- return normalized JSON

Should not own:

- provider HTTP clients
- provider-specific parsing
- complex threshold math

### `features/admin/usage/service.ts`

Responsibilities:

- orchestrate all provider adapters
- merge normalized provider results
- compute cross-provider summary counts
- optionally combine live data with stored snapshots

### `features/admin/usage/providers/*.ts`

Responsibilities:

- talk to one provider only
- validate environment configuration
- fetch provider data
- normalize into shared types
- downgrade gracefully to `partial`, `estimated`, or `unavailable`

Important rule:

- each provider adapter should fail independently so one broken provider does not blank the whole monitoring page

### `features/admin/usage/config.ts`

Responsibilities:

- define thresholds
- define default free-tier limits used for warning math
- define feature flags for optional providers

Important rule:

- do not scatter free-tier numbers across UI components and route files

### `app/admin/usage/page.tsx`

Responsibilities:

- render monitoring cards and charts
- explain freshness and data quality
- show alerts
- use TanStack Query for fetching

Should not own:

- provider math
- provider credentials
- admin authorization logic

---

## Environment Variables

The exact naming can be adjusted, but the feature should use explicit admin monitoring credentials.

Recommended variables:

```env
ADMIN_EMAILS=

USAGE_MONITORING_ENABLED=true
USAGE_MONITORING_ALLOW_LIVE_REFRESH=true
USAGE_MONITORING_DEFAULT_WINDOW_DAYS=7

USAGE_ALERT_WARNING_PERCENT=70
USAGE_ALERT_CRITICAL_PERCENT=90

VERCEL_MONITORING_TOKEN=
VERCEL_MONITORING_TEAM_ID=
VERCEL_MONITORING_PROJECT_ID=

NEON_API_KEY=
NEON_PROJECT_ID=
NEON_ORG_ID=

CLOUDFLARE_API_TOKEN=
CLOUDFLARE_ACCOUNT_ID=
R2_BUCKET_NAME=

USAGE_LIMIT_VERCEL_BANDWIDTH_BYTES=
USAGE_LIMIT_VERCEL_FUNCTION_INVOCATIONS=
USAGE_LIMIT_NEON_STORAGE_BYTES=
USAGE_LIMIT_NEON_COMPUTE_SECONDS=
USAGE_LIMIT_R2_STORAGE_BYTES=
USAGE_LIMIT_R2_CLASS_A_REQUESTS=
USAGE_LIMIT_R2_CLASS_B_REQUESTS=
```

Important rules:

- never expose provider tokens to the client
- read provider tokens only in server code
- treat configured limit values as overrideable because free-tier quotas can change over time
- do not hardcode plan numbers in the UI

---

## Historical Snapshots

Live monitoring is helpful, but snapshots are strongly recommended for trend analysis and maintenance.

### Why snapshots matter

Without snapshots, the system can show only the current state.

That is not enough for maintainers who need to answer:

- is usage accelerating
- how fast storage is growing
- which provider is becoming the real bottleneck
- whether free-tier pressure is seasonal or constant

### Recommended persistence

If snapshot storage is added, keep it in the database schema split by domain.

Recommended location:

- `db/schema/admin.ts`

Keep `@/db/schema` as the barrel import path.

Recommended table shape:

```ts
export type StoredUsageSnapshot = {
  id: string;
  provider: string;
  collectedAt: Date;
  status: string;
  metricsJson: Record<string, unknown>;
  alertsJson: Record<string, unknown>;
};
```

If stronger typing is needed later, split snapshot summary columns from JSON detail.

Recommended rule:

- store normalized snapshots, not raw provider payloads only

### Refresh strategy

Preferred order:

1. scheduled snapshot collection
2. admin-triggered refresh
3. opportunistic refresh on page open only as fallback

If Vercel Cron is not available or not appropriate for the plan:

- use a manual refresh button first
- optionally use an external scheduler later

---

## Alerting Rules

Alerting should be simple and predictable.

Recommended thresholds:

- below warning threshold: healthy
- at or above warning threshold: warning
- at or above critical threshold: critical

Suggested default behavior:

- compute `percentOfLimit` when a limit is known
- if no limit is known, do not invent one
- if a metric is estimated, label it visibly
- if a provider is unavailable, return a provider-level warning instead of failing the page

Recommended alert examples:

- Neon storage above 80% of configured limit
- R2 bucket storage above 70% of configured limit
- Vercel metrics unavailable, using estimated app-side request counts
- internal AI demand increased 40% week-over-week

---

## UI Guidance

Use existing admin UI patterns.

Recommended components:

- shadcn `Card`
- shadcn `Badge`
- shadcn `Tabs`
- existing chart approach used under `features/admin/ai-runs/components/charts.tsx`

Recommended layout:

- top summary cards for current provider pressure
- provider cards with metric rows and freshness labels
- alerts section
- optional history charts per provider
- explanatory note for `live`, `partial`, `estimated`, and `manual`

Important UI rule:

- always show data quality status next to provider metrics

Do not make operators guess whether a number is:

- direct from provider API
- app-derived estimate
- stale snapshot
- unavailable

---

## Vercel-Specific Guidance

Vercel is the most likely provider to require careful maintenance boundaries.

Recommended rule:

- treat the Vercel adapter as replaceable

Why:

- billing and usage surfaces may evolve
- plan-specific availability may differ
- some useful metrics may exist only in dashboards, account APIs, or future SDK surfaces

Implementation guidance:

- start with a narrow contract such as bandwidth, invocation count, and deployment/runtime freshness if available
- if verified API support is incomplete, return partial data instead of blocking the full page
- use internal app telemetry as a secondary estimate layer, not as a silent substitute

Important maintenance warning:

- never present estimated Vercel metrics as confirmed provider usage without labeling them clearly

---

## Neon-Specific Guidance

Neon should be the simplest provider to integrate directly.

Recommended metrics:

- storage bytes
- compute usage over window
- active time over window
- written data over window

Recommended implementation note:

- prefer consumption-history endpoints with explicit `from`, `to`, and `granularity`
- keep the requested metric list small and intentional
- store both current-period values and trend-ready snapshots

---

## Cloudflare R2-Specific Guidance

R2 should use analytics queries rather than object-by-object scans.

Important rule:

- do not estimate bucket size by listing every object from the app if provider analytics already exposes bucket-level storage metrics

Recommended metrics:

- payload size
- metadata size if useful
- object count
- operation counts by action type

Recommended implementation note:

- normalize action types into app-friendly labels only in the provider adapter
- keep raw Cloudflare query structure out of UI code

---

## Relationship To Existing AI Observability

This monitoring system should complement the AI observability system, not replace it.

Use cases are different:

- AI observability explains runtime behavior inside the product
- infrastructure monitoring explains platform capacity and external quota pressure

Recommended relationship:

- `/admin/chat-runs` remains the authoritative runtime activity surface
- `/admin/usage` becomes the authoritative infrastructure/provider usage surface
- `app/admin/page.tsx` may show compact summaries from both

Important rule:

- do not overload the AI Runs page with provider resource monitoring details

That page already has a clear responsibility.

---

## Testing Strategy

### Unit tests

Recommended coverage:

- provider adapter normalization
- threshold calculation
- partial/unavailable fallback behavior
- summary aggregation

### Integration tests

Recommended coverage:

- `GET /api/admin/usage` returns normalized shape
- unauthorized users receive `401`
- non-admin users receive `403`
- one provider failure does not break the full response

### Fixture strategy

Recommended rule:

- use recorded sample provider payloads as fixtures for adapter tests
- do not make provider network calls in normal test runs

---

## Recommended Rollout Plan

### Phase 1

Implement live summary only:

- `GET /api/admin/usage`
- Neon adapter
- R2 adapter
- internal AI adapter
- placeholder or partial Vercel adapter
- admin dashboard summary card

### Phase 2

Add detailed page:

- `app/admin/usage/page.tsx`
- provider cards
- alert badges
- data quality labels

### Phase 3

Add historical snapshots:

- DB snapshot table
- refresh route
- history charts

### Phase 4

Add optional provider account integrations:

- Gemini balance or quota if verified API exists
- OpenRouter balance/usage if verified API exists
- Kie usage if a stable internal or external endpoint exists

Important rule:

- ship the system even if some providers are partial
- do not wait for perfect parity across providers before making the admin surface useful

---

## Maintenance Rules

### 1. Keep provider boundaries explicit

One provider adapter per provider.

Do not create a single giant service with mixed parsing logic.

### 2. Keep limits configurable

Provider free-tier numbers change.

Do not hardcode them across files.

### 3. Distinguish measured vs estimated

Every metric must clearly communicate whether it is:

- live
- partial
- estimated
- manual
- unavailable

### 4. Prefer normalized snapshots over raw payload dependence

The UI and charts should depend on app-owned normalized shapes.

### 5. Fail soft

One broken provider integration should not break the entire admin usage page.

### 6. Preserve admin-only access

All routes must use `requireAdmin()`.

### 7. Update this guide when the monitoring architecture changes materially

Future maintainers should not have to rediscover how provider monitoring works.

---

## Definition Of Done For This Feature

A production-ready usage monitoring implementation is complete when:

- admin routes are server-gated with `requireAdmin()`
- provider integrations live behind adapter modules
- UI consumes normalized response types only
- Neon and R2 metrics are fetched directly from supported provider APIs
- Vercel metrics are either verified live metrics or clearly labeled partial/estimated values
- free-tier thresholds are config-driven
- provider failure degrades gracefully
- no client-side secret exposure exists
- this document is updated if the architecture differs from this guide

---

## Final Guidance

Build this feature as an **operator monitoring layer**, not as a billing system.

The most important long-term maintenance decision is this:

- **normalize everything at the boundary**

If future contributors preserve that rule, the app can evolve from:

- free-tier monitoring
- to soft alerts
- to trend-based planning
- to customer-facing quota systems later

without rewriting every page each time a provider changes its API surface.
