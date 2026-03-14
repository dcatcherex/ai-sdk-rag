# Brand Feature — Implementation Reference

This document covers the full architecture, data model, API, and integration points for the Brand feature. It is intended for developers who need to maintain, extend, or debug any part of the brand system.

---

## Overview

The Brand feature lets users create and manage one or more brand identities (name, colors, tone of voice, assets, etc.) and have that brand context automatically injected into AI outputs — chat responses, image generation, and certificate generation.

Key capabilities:
- CRUD management of brands with a rich settings UI
- Flexible color palette (up to 5+ named colors)
- Asset library (logo, product images, documents, etc.) stored in Cloudflare R2
- Per-user active brand (persisted in `localStorage`) piped into the chat route
- Agent-level brand binding — an agent can have a fixed brand regardless of sidebar selection
- Thread-level tracking — each conversation records which brand was active
- Usage analytics — per-brand conversation count and recent thread history
- Team sharing — brand owners can share brands with other registered users (read-only access)
- JSON import from an EdLab-compatible brand schema

---

## File Structure

```
features/brands/
  types.ts                        ← All shared TypeScript types (client-safe, no DB imports)
  service.ts                      ← All server-side DB logic + AI prompt helpers
  hooks/
    use-brands.ts                 ← TanStack Query hooks for all brand API calls
  components/
    brand-picker-button.tsx       ← Sidebar footer brand selector + localStorage helpers
    brands-section.tsx            ← Settings page root component
    brand-card.tsx                ← Minimal card in the left-hand brand list
    brand-preview.tsx             ← Right-hand preview panel (colors, assets, usage stats)
    brand-editor-sheet.tsx        ← Slide-over sheet: Profile / Voice / Visual / Assets / Sharing tabs
    assets-tab.tsx                ← Asset upload + gallery (used inside editor sheet)
    chip-input.tsx                ← Reusable chip/tag input (Enter or comma to add)
    color-palette-editor.tsx      ← Dynamic color list with hex picker + label + delete

app/api/brands/
  route.ts                        ← GET list, POST create
  [id]/
    route.ts                      ← GET one, PATCH update/setDefault, DELETE
    assets/
      route.ts                    ← GET assets, POST upload to R2
      [assetId]/route.ts          ← DELETE asset (also deletes from R2)
    share/
      route.ts                    ← GET share list, POST add user, DELETE remove user
    stats/
      route.ts                    ← GET thread count + recent threads for this brand

scripts/
  migrate-brands.ts               ← Creates brand + brand_asset tables (IF NOT EXISTS)
  migrate-brand-colors.ts         ← Migrates old 3-column colors → colors JSONB array
  migrate-brand-share.ts          ← Creates brand_share table (IF NOT EXISTS)
  migrate-agent-brand.ts          ← Adds brand_id column to agent table
  migrate-thread-brand.ts         ← Adds brand_id column to chat_thread table
```

---

## Database Schema

### `brand` table

| Column             | Type        | Notes |
|--------------------|-------------|-------|
| `id`               | `text` PK   | nanoid |
| `user_id`          | `text` FK   | → `user.id` CASCADE DELETE |
| `name`             | `text`      | required |
| `overview`         | `text`      | nullable |
| `website_url`      | `text`      | nullable |
| `industry`         | `text`      | nullable |
| `target_audience`  | `text`      | nullable |
| `tone_of_voice`    | `text[]`    | Postgres array, default `'{}'` |
| `brand_values`     | `text[]`    | Postgres array, default `'{}'` |
| `visual_aesthetics`| `text[]`    | Postgres array, default `'{}'` |
| `fonts`            | `text[]`    | Postgres array, default `'{}'` |
| `colors`           | `jsonb`     | `[{ hex: string, label: string }]`, default `'[]'` |
| `writing_dos`      | `text`      | nullable |
| `writing_donts`    | `text`      | nullable |
| `is_default`       | `boolean`   | only one per user should be true |
| `created_at`       | `timestamp` | |
| `updated_at`       | `timestamp` | auto-updated |

Index: `brand_userId_idx` on `user_id`.

### `brand_asset` table

| Column       | Type        | Notes |
|--------------|-------------|-------|
| `id`         | `text` PK   | nanoid |
| `brand_id`   | `text` FK   | → `brand.id` CASCADE DELETE |
| `kind`       | `text`      | `'logo' \| 'product' \| 'creative' \| 'document' \| 'font' \| 'other'` |
| `collection` | `text`      | nullable — groups assets (e.g. campaign name) |
| `title`      | `text`      | display name |
| `r2_key`     | `text`      | Cloudflare R2 object key for deletion |
| `url`        | `text`      | public CDN URL |
| `mime_type`  | `text`      | e.g. `image/png` |
| `size_bytes` | `integer`   | nullable |
| `metadata`   | `jsonb`     | free-form, default `'{}'` |
| `sort_order` | `integer`   | default `0` |
| `created_at` | `timestamp` | |

Indexes: `brand_asset_brandId_idx`, `brand_asset_kind_idx`.

### `brand_share` table

| Column                | Type        | Notes |
|-----------------------|-------------|-------|
| `id`                  | `text` PK   | nanoid |
| `brand_id`            | `text` FK   | → `brand.id` CASCADE DELETE |
| `shared_with_user_id` | `text` FK   | → `user.id` CASCADE DELETE |
| `created_at`          | `timestamp` | |

Unique constraint: `(brand_id, shared_with_user_id)`.
Indexes: `brand_share_brandId_idx`, `brand_share_userId_idx`.

### Foreign keys added to other tables

| Table        | Column     | References     | On Delete  |
|--------------|------------|----------------|------------|
| `agent`      | `brand_id` | `brand.id`     | SET NULL   |
| `chat_thread`| `brand_id` | `brand.id`     | SET NULL   |

---

## TypeScript Types (`features/brands/types.ts`)

```typescript
type BrandColor = {
  hex: string;    // e.g. "#085d6e"
  label: string;  // e.g. "Primary"
};

type BrandSharedUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

type Brand = {
  id: string;
  userId: string;         // owner's user ID
  name: string;
  overview: string | null;
  websiteUrl: string | null;
  industry: string | null;
  targetAudience: string | null;
  toneOfVoice: string[];
  brandValues: string[];
  visualAesthetics: string[];
  fonts: string[];
  colors: BrandColor[];
  writingDos: string | null;
  writingDonts: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Populated by GET /api/brands (not stored in DB):
  isOwner?: boolean;         // true = user owns this brand
  sharedWith?: BrandSharedUser[];  // only populated for owned brands
};

type BrandAsset = { ... };        // mirrors brand_asset table
type BrandWithAssets = Brand & { assets: BrandAsset[] };
type BrandImportJson = { ... };   // EdLab-compatible import shape

const BRAND_ASSET_KINDS: BrandAssetKind[];
const SUGGESTED_COLOR_LABELS: ['Primary', 'Secondary', 'Accent', 'Background', 'Text'];
```

> **Important**: `types.ts` has zero server-side imports. It can be safely imported in client components. Never move DB-dependent code here.

---

## Service Layer (`features/brands/service.ts`)

All database operations live here. This file is **server-only** — never import it in client components.

### CRUD functions

| Function | Signature | Notes |
|----------|-----------|-------|
| `getBrands` | `(userId) → Brand[]` | Returns own brands + brands shared with user. Own brands include `isOwner: true` and populated `sharedWith`. Shared brands have `isOwner: false`. |
| `getBrand` | `(userId, brandId) → Brand \| null` | Access allowed if owner OR has a `brand_share` record. |
| `createBrand` | `(userId, data) → Brand` | |
| `updateBrand` | `(userId, brandId, data) → Brand \| null` | Only owner can update (userId check in WHERE). |
| `deleteBrand` | `(userId, brandId) → void` | Cascades to assets and shares. |
| `setDefaultBrand` | `(userId, brandId) → void` | Clears `is_default` on all user's brands first, then sets the target. |

### Asset functions

| Function | Signature | Notes |
|----------|-----------|-------|
| `getBrandAssets` | `(brandId) → BrandAsset[]` | No userId check — callers must verify brand access first. |
| `createBrandAsset` | `(data) → BrandAsset` | |
| `deleteBrandAsset` | `(brandId, assetId) → void` | |

### Share functions

| Function | Signature | Notes |
|----------|-----------|-------|
| `getBrandShareList` | `(ownerId, brandId) → BrandSharedUser[]` | Verifies ownership via EXISTS subquery. |
| `addBrandShare` | `(ownerId, brandId, targetUserId) → void` | Throws if brand not found or target is the owner. Uses `onConflictDoNothing`. |
| `removeBrandShare` | `(ownerId, brandId, targetUserId) → void` | Verifies ownership before deleting. |

### AI prompt helpers

| Function | Signature | Purpose |
|----------|-----------|---------|
| `buildBrandBlock` | `(brand) → string` | Returns `<brand_context>...</brand_context>` XML block injected into chat system prompts. Includes name, overview, target audience, tone, values, visual style, colors, writing guidelines. |
| `buildImageBrandSuffix` | `(brand) → string` | Returns a short suffix (`. Visual style: ... Brand colors: ...`) appended to image generation prompts. Kept brief so it doesn't dominate the user's intent. |
| `importBrandFromJson` | `(userId, json) → Brand` | Parses an EdLab-compatible JSON and creates a brand. |

---

## API Routes

All routes authenticate via `auth.api.getSession({ headers })`. All mutating routes are scoped to the session user.

### `GET /api/brands`
Returns all brands the user owns + all brands shared with them.
Response: `Brand[]` (with `isOwner` and `sharedWith` populated).

### `POST /api/brands`
Creates a new brand. Body must include `name`.
Response: `Brand` (201).

### `GET /api/brands/[id]`
Returns a single brand. Accessible if owner or has share record.

### `PATCH /api/brands/[id]`
Two modes:
- `{ _action: 'setDefault' }` → marks as default
- Any other fields → partial update (owner only via `updateBrand`)

### `DELETE /api/brands/[id]`
Deletes brand and all cascading data (assets, shares, threads' brand_id set to NULL). Returns 204.

### `GET /api/brands/[id]/assets`
Lists assets for a brand.

### `POST /api/brands/[id]/assets`
Multipart form upload. Fields: `file` (binary), `kind`, `title`, `collection` (optional).
Uploads to Cloudflare R2, inserts `brand_asset` row.

### `DELETE /api/brands/[id]/assets/[assetId]`
Deletes R2 object + DB row.

### `GET /api/brands/[id]/share`
Returns list of users this brand is shared with. Owner only.

### `POST /api/brands/[id]/share`
Body: `{ userId: string }`. Adds a share record. Owner only. Idempotent (conflict ignored).

### `DELETE /api/brands/[id]/share`
Body: `{ userId: string }`. Removes share record. Owner only.

### `GET /api/brands/[id]/stats`
Returns `{ threadCount: number, recentThreads: { id, title, updatedAt }[] }`.
Counts `chat_thread` rows where `brand_id = id AND user_id = me`.
Returns the 5 most recent threads. Owner only.

### `POST /api/brands/import`
Body: `BrandImportJson`. Calls `importBrandFromJson`. Returns created `Brand`.

---

## Active Brand — localStorage Pattern

The active brand (which brand is currently "on" for chat) is stored in the browser, not the server session. This avoids server round-trips and lets it be changed per-tab instantly.

```typescript
// features/brands/components/brand-picker-button.tsx

const STORAGE_KEY = 'chat-active-brand-id';

export function getActiveBrandId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setActiveBrandId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (id === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, id);
  // Notify all components in the same tab
  window.dispatchEvent(new CustomEvent('active-brand-change', { detail: id }));
}
```

Components that need to react to changes (e.g. `BrandPickerButton`) subscribe to `window.addEventListener('active-brand-change', handler)` and clean up on unmount.

The `getActiveBrandId()` function is called **inside the transport body closure** in `use-chat-session.ts` so it reads the current value at message-send time, not at hook mount time.

---

## Chat Route Integration (`app/api/chat/route.ts`)

### How brand context flows into a chat response

```
User sends message
  │
  ├── transport body includes brandId = getActiveBrandId()
  │
  └── POST /api/chat
        │
        ├── Stage 1: auth + body parse
        │     └── extracts brandId from request
        │
        ├── Stage 2: parallel DB queries (user, thread, prefs, credits, agent, persona)
        │     └── agent row fetched (may have its own brandId)
        │
        └── Stage 3: parallel (memory, persona detection, brand fetch)
              │
              ├── effectiveBrandId = activeAgent?.brandId ?? brandId ?? null
              │     Agent's brand ALWAYS overrides the sidebar active brand.
              │
              └── DB query: brand WHERE id = effectiveBrandId
                    AND (userId = me OR EXISTS brandShare WHERE sharedWithUserId = me)
                    └── shared brands are valid — verified by share record
```

### System prompt injection

```typescript
const brandBlock = activeBrand ? `\n\n${buildBrandBlock(activeBrand)}` : '';

// Appended to groundedSystemPrompt for ALL paths:
// - Agent path
// - Grounded (RAG) path
// - Plain chat path
```

The `<brand_context>` block is always appended **last** in the system prompt, after memory context, so it has high recency salience.

### Image generation

```typescript
const imagePrompt = activeBrand
  ? baseImagePrompt + buildImageBrandSuffix(activeBrand)
  : baseImagePrompt;
```

`buildImageBrandSuffix` appends visual aesthetics and top 3 colors. It does NOT use the full brand block to avoid overpowering the user's prompt.

### Certificate tool instructions

When a brand is active, extra guidance is appended to `certificateToolInstructions`:
> "The user's active brand is 'X'. Primary brand color: #xxxxxx. Brand fonts: Y. Prefer these values when filling certificate fields unless the user specifies otherwise."

### Thread tracking

After every successful response (text or image), `persistChatResult` is called with `brandId: activeBrand?.id ?? null`. This writes to `chat_thread.brand_id`, enabling the stats API to count conversations per brand.

---

## Agent → Brand Binding

An agent can have a fixed `brandId` set via the Agent Form Dialog (Settings → Agents). When this agent is active in chat:

1. The agent's `brandId` takes priority over the user's sidebar-active brand.
2. The brand is fetched using the same shared-brand query (user must own OR have a share record for that brand — but since the agent's brand is the agent creator's brand, this works if users share the brand with their team first).

Schema: `agent.brand_id text REFERENCES brand(id) ON DELETE SET NULL`

---

## Settings UI Flow

```
app/(main)/settings/page.tsx
  └── activeTab === 'brands' → <BrandsSection />

features/brands/components/brands-section.tsx
  ├── Left column: <BrandCard /> × N   (click to select)
  └── Right column: <BrandPreview />   (selected brand)
        └── Shows: header, logo+fonts, color swatches, aesthetics, tone,
                   brand values, overview, writing guidelines, assets, usage stats

  On "Edit" hover: opens <BrandEditorSheet brand={b} />
  On "New Brand": opens <BrandEditorSheet brand={null} />

features/brands/components/brand-editor-sheet.tsx
  Tabs (only for existing brands):
    Profile    ← name, overview, website, industry, target audience
    Voice      ← tone of voice, brand values, writing dos/don'ts
    Visual     ← visual aesthetics, fonts, color palette
    Assets     ← upload + gallery (owner only)
    Sharing    ← add/remove team members (owner only)
```

---

## Sidebar Integration

`BrandPickerButton` is rendered in the sidebar footer between the user avatar and the settings button.

```
[Avatar] [Brand🏢] [⚙ Settings]
```

The dropdown shows:
- "No brand" (clears active brand)
- **Own brands** (with color swatch + name)
- **Shared with me** section (if any shared brands exist)

When a brand is active, a colored dot badge appears on the icon.

---

## Permission Model

| Action | Owner | Shared User |
|--------|-------|-------------|
| View brand in picker | ✓ | ✓ |
| Use brand in chat | ✓ | ✓ |
| Edit brand fields | ✓ | ✗ |
| Upload / delete assets | ✓ | ✗ |
| Share / unshare | ✓ | ✗ |
| Delete brand | ✓ | ✗ |
| View usage stats | ✓ (own threads) | ✗ |
| Set as default brand | ✓ | ✗ |

Enforcement is at the service layer — all mutating functions receive `userId` and check `brand.user_id = userId` before proceeding. Shared users can only read.

---

## TanStack Query Keys

All brand queries use keys defined in `brandKeys` (`features/brands/hooks/use-brands.ts`):

```typescript
brandKeys.all               // ['brands']          — brand list
brandKeys.assets(brandId)   // ['brands', id, 'assets']
brandKeys.stats(brandId)    // ['brands', id, 'stats']
```

After any mutation (create, update, delete, share change), `qc.invalidateQueries({ queryKey: brandKeys.all })` is called to refresh all brand-dependent UI.

---

## How to Add a New Brand Field

1. **DB**: Add column to `brand` table in `db/schema.ts`. Write a migration script in `scripts/`.
2. **Types**: Add field to `Brand` type in `features/brands/types.ts`.
3. **Service**: Include field in `createBrand`, `updateBrand` (via `BrandInput`), and `buildBrandBlock` / `buildImageBrandSuffix` if it should influence AI output.
4. **UI**: Add the form control to the appropriate tab in `brand-editor-sheet.tsx` and display it in `brand-preview.tsx`.

---

## How to Add a New Asset Kind

1. Add the new kind string to `BRAND_ASSET_KINDS` in `features/brands/types.ts`.
2. Add the corresponding `<SelectItem>` in `assets-tab.tsx`.
3. If the kind needs special handling in the preview (like `'logo'`), add a case in `brand-preview.tsx`.

---

## Migration History

| Script | What it does |
|--------|-------------|
| `migrate-brands.ts` | Creates `brand` and `brand_asset` tables |
| `migrate-brand-colors.ts` | Migrates old `color_primary / _secondary / _accent` text columns → `colors jsonb[]` |
| `migrate-brand-share.ts` | Creates `brand_share` table |
| `migrate-agent-brand.ts` | Adds `brand_id` column to `agent` table |
| `migrate-thread-brand.ts` | Adds `brand_id` column to `chat_thread` table |

All scripts are idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`). Run with:

```bash
pnpm tsx scripts/<script-name>.ts
```

---

## Common Gotchas

**Client/server import boundary**
`service.ts` imports `lib/db.ts` which imports the Neon database client. If `service.ts` is imported in a client component, the build will fail with "No database connection string was provided to neon()". Always import from `types.ts` or `hooks/use-brands.ts` in client components.

**JSONB `colors` column type**
Drizzle types `jsonb` columns as `unknown`. When selecting the `brand` table directly (not through `getBrands`), cast the result: `(row as Brand)`. The `getBrands` and `getBrand` service functions handle this internally.

**`isOwner` is not stored in the DB**
It is computed at query time in `getBrands` and is not part of the `brand` table. Do not try to PATCH it.

**Active brand priority in chat**
`activeAgent?.brandId` always wins over the sidebar active brand. If an agent has a brand set, the user's sidebar selection is ignored for that conversation. This is intentional so agent creators can lock brand context.

**`setDefaultBrand` race condition**
The function runs two sequential UPDATE queries (clear all → set one). For the typical single-user case this is fine. If multiple tabs trigger this simultaneously, the last write wins, which is acceptable behaviour.

**Stats are scoped to the current user**
`GET /api/brands/[id]/stats` only counts threads belonging to `session.user.id`. If a brand is shared across a team, each member's stats are separate. There is no aggregated team-level view currently.
