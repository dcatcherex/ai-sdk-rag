# Brand Context Refactor Plan

> Audience: developers and product owners working on Brands, chat, image generation, and LINE OA flows.
> Purpose: define the refactor that removes duplicate brand context systems, establishes one canonical source of truth, and gives a safe migration path from `brand_profile` to `brand`.

---

## Status

Current status of this plan:

- this plan is **not fully complete**
- the agent-side brand-governance portion has been implemented
- the broader canonical-brand refactor described here is only partially complete

What is complete in code already:

- `brand` is now the effective runtime source for agent brand context
- canonical `brand` schema coverage has been expanded to include the major legacy `brand_profile` fields
- `brand_asset` now supports first-class `style_reference`
- agent brand governance is implemented with:
  - `brandMode`
  - `brandAccessPolicy`
  - `requiresBrandForRun`
  - `fallbackBehavior`
- runtime brand resolution is centralized and used by:
  - main chat
  - prompt preview
  - team chat
  - public shared-agent chat
- admin and user agent editors now expose explicit brand behavior
- the standalone web `Brand Profile` UI and `/api/tools/brand-profile/*` routes have been removed
- the brand editor now includes a setup/checklist flow and the newly added canonical fields
- LINE draft logic now lives in an explicit LINE-only module instead of the old generic `brand-profile` feature
- linked LINE users now resolve canonical brand context in the prompt path
- a migration script now exists to move legacy authenticated data into `brand`/`brand_asset` and LINE draft rows into `line_brand_draft`
- the migration script has been run successfully in this workspace and produced a migration report
- a final drop migration has been added for `brand_profile`

What is still incomplete from this refactor plan:

- the final drop migration for `brand_profile` still needs to be applied in the target database
- the old table should be removed only after confirming the migrated brand data looks correct in production
- there are no remaining product/runtime code paths that depend on `brand_profile`

What has now started as part of this refactor:

- main chat prompt guidance no longer tells the model to always call `get_brand_profile` first
- main chat image generation now begins preferring canonical brand style-reference assets when available
- image-tool descriptions now point at canonical active-brand assets instead of treating `get_brand_profile` as the default source
- LINE image tool guidance has been softened so legacy `brand_profile` use is compatibility-only, not the preferred path
- `Brand Profile` has been removed from the web tool registry, page loaders, and web `/api/tools/brand-profile/*` routes
- the prompt-assembly layer no longer carries a dedicated web `brand_profile` prompt block
- canonical brand editing now covers:
  - products and services
  - USP
  - price range
  - keywords
  - platforms
  - promotion style
  - competitors
  - customer pain points
  - voice examples
  - forbidden phrases
  - style reference mode
  - style description
  - color notes

Practical conclusion:

- the **agent brand mode implementation plan is complete**
- the **brand context refactor plan is implemented in code**
- the remaining work is now mainly **verification and applying the final table-drop migration**

---

## 1. Decision Summary

### Recommended decision

Use the existing `brand` system as the only canonical brand context model for authenticated users and all first-class product flows.

The current `brand_profile` feature should stop being treated as a parallel brand home. Its long-term role should be narrowed to one of these:

1. Temporary migration compatibility layer only.
2. Temporary LINE-only draft store for unlinked users.

### Why this is the right shape

- It matches the vision: brand is part of the user's workspace and agent context, not a separate prompt helper.
- It matches the current architecture: `brandId` already flows through chat, agents, threads, images, and sharing.
- It reduces maintenance cost: one schema, one editor, one prompt injection path, one asset system.
- It scales to the real product direction: multi-brand, shared brand ownership, agent-bound brands, and team workflows.

### Non-goals

- Do not keep both `Brands` and `Brand Profile` as equal first-class product surfaces.
- Do not make web users maintain brand data in both `brand` and `brand_profile`.
- Do not move brand logic into ad hoc tool prompts when it already belongs in `features/brands/service.ts`.

---

## 2. Current Problem

Today there are two overlapping systems:

### Canonical-ish platform brand system

- `features/brands/*`
- `db/schema/brands.ts`
- `app/api/brands/*`
- `app/api/chat/route.ts` via `brandId`

This system already supports:

- multi-brand ownership
- active brand selection
- agent-level brand binding
- sharing
- brand assets
- prompt injection into chat and image generation
- per-thread brand tracking

### Separate `brand_profile` tool system

- legacy storage in `db/schema/tools.ts` -> `brand_profile`
- `db/schema/tools.ts` -> `brand_profile`
- previously had a dedicated sidebar/tool page and web API routes
- those web entry points are now removed
- the remaining role of `brand_profile` is as a migration source only

This system currently acts like:

- a per-user key-value store
- a lightweight brand onboarding form
- an image style reference store
- a LINE-friendly fallback for users without full workspace state

### Resulting problems

1. Two sources of truth for overlapping fields.
2. Divergent naming and data shapes.
3. Confusing UX: "Brands" in Settings, but "Brand Profile" as another top-level tool.
4. Prompt drift: some flows trust `brandId`, others tell the model to call `get_brand_profile` first.
5. Poor multi-brand fit: `brand_profile` is per user or per LINE identity, not per brand.

---

## 3. Target Architecture

### Canonical rule

For authenticated users:

- `brand` is the only source of truth for brand context.
- `brand_asset` is the only source of truth for brand logos, style references, and other brand files.
- `brandId` is the only selector used by chat, agents, content, image generation, and approvals.

### Temporary exception

For unlinked LINE OA users:

- keep a lightweight draft context keyed by `lineUserId + channelId`
- do not present it as a full brand system
- convert it into a real `brand` record when the account is linked or when the owner chooses to save it

### Recommended runtime model

```
Authenticated web user
  -> active brandId or agent.brandId
  -> load brand + brand assets
  -> build brand context block
  -> inject into chat / content / image / guardrails

Linked LINE user
  -> resolve userId
  -> same canonical brand flow as web

Unlinked LINE user
  -> use line brand draft only
  -> optional later conversion to canonical brand
```

---

## 4. Naming Recommendations

### User-facing names

Use these consistently:

- `Brands` = the canonical feature name
- `Brand Setup` = the guided onboarding flow for filling out a brand
- `Brand Assets` = logos, reference images, documents, fonts, and related files
- `Style References` = the subset of brand assets used for image guidance
- `Brand Completeness` = progress state for setup

Avoid these names going forward:

- `Brand Profile` as a top-level feature
- `Brand Photos` as a separate product concept if the files are really brand assets

### Internal names

Recommended internal naming:

- Keep `features/brands` as the canonical module
- Add `features/brands/agent.ts` for thin AI tool wrappers
- Keep `buildBrandBlock()` and `buildImageBrandSuffix()` in `features/brands/service.ts`
- If a LINE-only draft store remains, rename it away from `brand_profile`

Preferred names for the temporary draft store:

- `line_brand_draft`
- `brand_context_draft`

Avoid keeping the name `brand_profile` because it implies a first-class canonical domain model when it should not be one.

### Tool naming

Do not keep a standalone tool/page called `Brand Profile`.

If AI tools are still needed, use brand-centric names:

- `get_active_brand_context`
- `update_brand_context`
- `list_brand_assets`
- `add_brand_asset`
- `remove_brand_asset`
- `get_brand_setup_status`

If LINE-only draft tools remain, make their scope explicit:

- `get_line_brand_draft`
- `save_line_brand_draft_field`

### Route and file naming

Recommended direction:

- keep `/api/brands/*` as canonical
- remove web reliance on `/api/tools/brand-profile/*`
- move any surviving onboarding UI under the Brands feature instead of the tools surface

---

## 5. Schema Recommendations

The current `brand` schema is already stronger than `brand_profile`, but it is missing some operational fields now stored in the tool store.

### Keep as-is in `brand`

These already map well:

- `name`
- `targetAudience`
- `toneOfVoice`
- `visualAesthetics`
- `colors`
- `writingDos`
- `writingDonts`
- `positioningStatement`
- `messagingPillars`
- `proofPoints`
- `exampleHeadlines`
- `exampleRejections`

### Add to `brand`

Recommended new columns for the canonical model:

- `productsServices: text | null`
- `usp: text | null`
- `priceRange: text | null`
- `keywords: text[]`
- `platforms: text[]`
- `promotionStyle: text | null`
- `competitors: text[]`
- `customerPainPoints: text[]`
- `voiceExamples: text[]`
- `forbiddenPhrases: text[]`
- `styleReferenceMode: text` with default `'direct'`
- `styleDescription: text | null`
- `colorNotes: text | null`

Notes:

- `colorNotes` preserves freeform imported palettes when they do not map cleanly to labeled hex colors.
- `forbiddenPhrases` is a cleaner canonical replacement for `do_not_say`.
- `voiceExamples` is more precise than forcing these into `exampleHeadlines`.

### Add to `brand_asset`

Two options are reasonable. The cleaner option is recommended.

Recommended option:

- add a new `kind` value: `style_reference`

Alternative option:

- keep existing `kind` values and use `metadata.role = 'style_reference'`

Recommendation:

- use first-class `kind: 'style_reference'` because style references are operationally important and queried often
- keep `logo` as-is
- continue using `document` for brand guides and supporting files

### Separate draft schema for LINE-only onboarding

If temporary draft storage is still needed for unlinked LINE users, create or rename toward a schema like:

```
line_brand_draft
  id
  line_user_id
  channel_id
  field
  value
  updated_at
```

This keeps the purpose explicit and avoids pretending this is the same as a real workspace brand.

---

## 6. Field Mapping From `brand_profile` to `brand`

Use this mapping during migration and compatibility work.

| `brand_profile` field | Target canonical field | Migration rule |
|---|---|---|
| `brand_name` | `brand.name` | direct |
| `products` | `brand.productsServices` | direct |
| `tone` | `brand.toneOfVoice` | split by comma/newline, trim, dedupe |
| `target_audience` | `brand.targetAudience` | direct |
| `usp` | `brand.usp` | direct |
| `price_range` | `brand.priceRange` | direct |
| `competitors` | `brand.competitors` | split into array |
| `keywords` | `brand.keywords` | split into array |
| `brand_voice_examples` | `brand.voiceExamples` | split by newline or paragraph |
| `do_not_say` | `brand.forbiddenPhrases` and optionally append to `writingDonts` | split into array, preserve raw text if needed |
| `promotion_style` | `brand.promotionStyle` | direct |
| `customer_pain_points` | `brand.customerPainPoints` | split into array |
| `platforms` | `brand.platforms` | split into array |
| `visual_style` | `brand.visualAesthetics` | split into array |
| `color_palette` | `brand.colors` and `brand.colorNotes` | parse structured colors when possible, preserve raw text in `colorNotes` |
| `logo_urls` | `brand_asset(kind='logo')` | create one asset row per URL |
| `style_reference_urls` | `brand_asset(kind='style_reference')` | create one asset row per URL |
| `style_reference_mode` | `brand.styleReferenceMode` | direct |
| `style_description` | `brand.styleDescription` | direct |

### Data quality rules

- Trim whitespace on all string fields.
- Drop empty array items after splitting.
- Dedupe arrays case-insensitively.
- Preserve original raw text in migration logs when transformation is lossy.

---

## 7. UX Refactor Recommendations

### Web app

The user should experience one brand home:

- `Settings -> Brands` remains the main editor
- add a `Setup` tab or `Guided Setup` mode inside the brand editor
- move the current progress ring and field-by-field completion UX from `Brand Profile` into that setup flow

Recommended tab model:

- `Profile`
- `Voice`
- `Strategy`
- `Visual`
- `Assets`
- `Knowledge`
- `Guardrails`
- `Sharing`
- `Setup` or `Checklist`

### Sidebar

Recommended changes:

- remove `Brand Profile` as a standalone sidebar item
- remove `Brand Photos` as a separate concept unless it becomes a view into `Brand Assets`
- keep brand switching in the sidebar footer via the brand picker

### Image generation UX

Image guidance should come from the active brand's assets and fields, not from a separate brand tool.

Recommended model:

- style references live under Brand Assets
- image generation reads:
  - `visualAesthetics`
  - `colors`
  - `styleReferenceMode`
  - `styleDescription`
  - assets of kind `style_reference`
  - logo assets when the prompt implies logo inclusion

---

## 8. Service and Tool Refactor

### Canonical service ownership

All brand business logic should live in `features/brands/service.ts`.

Add or consolidate helpers such as:

- `getEffectiveBrand(userId, brandId, agentId)`
- `getBrandSetupStatus(brandId)`
- `getBrandAssetsByKind(brandId, kind)`
- `buildBrandBlock(brand)`
- `buildImageBrandSuffix(brand)`
- `buildBrandImageContext(brand, assets)`
- `updateBrandFields(brandId, input)`

### Agent wrapper ownership

Create `features/brands/agent.ts` as thin wrappers around the service layer.

Do not keep agent-specific brand business logic in:

- `features/brand-profile/agent.ts`
- prompt strings inside unrelated routes

### Chat route change

Refactor `app/api/chat/route.ts` so that:

- the default brand path is `activeAgent?.brandId ?? brandId`
- brand context is always loaded from `brand`
- the tool instruction that says "ALWAYS call get_brand_profile first" is removed

If setup assistance is still needed, gate it behind setup status:

- if required canonical brand fields are missing, the assistant can ask for them
- when saved, it writes to the canonical brand record, not to `brand_profile`

### LINE tool change

Refactor `features/line-oa/webhook/tools.ts` so that:

- linked users use canonical brand tools
- unlinked users use draft-only tools with explicit naming
- image generation for LINE uses the same brand context builder as web when a real brand exists

---

## 9. Concrete Migration Plan

### Phase 0 - Freeze and decision

Goal: stop the duplication from growing.

Tasks:

1. Declare `brand` the canonical source of truth for authenticated users.
2. Stop adding new fields to `brand_profile`.
3. Stop expanding the standalone `Brand Profile` tool/page.
4. Mark `brand_profile` as deprecated in internal docs.

Exit criteria:

- team agrees on canonical model
- no new product work targets `brand_profile`

### Phase 1 - Schema expansion

Goal: make `brand` capable of holding all meaningful data currently stored in `brand_profile`.

Tasks:

1. Add the missing canonical columns to `db/schema/brands.ts`.
2. Add `style_reference` asset kind or equivalent metadata convention.
3. Generate and run migrations.
4. Update `features/brands/types.ts` and `features/brands/service.ts`.

Exit criteria:

- every meaningful `brand_profile` field has a canonical landing place
- status update:
  - implemented in schema and types
  - canonical editor support added for the new fields

### Phase 2 - Compatibility layer

Goal: switch reads and writes without forcing a risky big bang cutover.

Tasks:

1. Add brand service helpers that read canonical fields only.
2. Introduce a temporary adapter that can import legacy `brand_profile` data when no canonical value exists.
3. Update chat, image, and content flows to prefer canonical brand context.
4. Remove hard dependency on `get_brand_profile` in prompts.

Recommended compatibility rule:

- canonical brand data always wins
- legacy `brand_profile` only fills gaps during the migration window

Exit criteria:

- main generation flows no longer require `brand_profile`
- status update:
  - started
  - main chat/image flows now prefer canonical brand context
  - web prompt dependency on `get_brand_profile` has been removed

### Phase 3 - UI consolidation

Goal: remove the user-visible duplicate brand home.

Tasks:

1. Move the progress/checklist UX from `features/brand-profile/components/brand-profile-tool-page.tsx` into Brands settings.
2. Move style references and logos into Brand Assets UI.
3. Replace `Brand Photos` with `Brand Assets` or fold it into the existing Assets tab.
4. Remove `Brand Profile` from tool registry and page loaders for web users.

Exit criteria:

- users have one obvious place to manage brand context
- status update:
  - started
  - `Brand Profile` has been removed from the web tool registry and page loaders
  - unused web `/api/tools/brand-profile/*` routes have been deleted

### Phase 4 - Data migration

Goal: copy legacy user data into canonical brand records safely.

Tasks:

1. Write a migration script, for example `scripts/migrate-brand-profile-to-brands.ts`.
2. Group legacy rows by:
   - `userId` for authenticated users
   - `lineUserId + channelId` for LINE-only drafts
3. For authenticated users, apply these rules:
   - if user has no brands: create one canonical brand from legacy data
   - if user has one brand: merge legacy data into that brand when canonical fields are empty
   - if user has multiple brands: create a new imported brand unless there is an explicit name match
4. Convert `logo_urls` and `style_reference_urls` into `brand_asset` rows.
5. Produce a migration report with:
   - created brands
   - updated brands
   - imported assets
   - ambiguous cases
   - failed rows

Recommended ambiguity handling:

- prefer safe duplication over incorrect merging
- if uncertain, create `"<Brand Name> (Imported)"` and flag it for manual review

Exit criteria:

- all authenticated-user legacy brand data exists in canonical brand records

### Phase 5 - LINE separation

Goal: keep LINE support without preserving the wrong architecture.

Tasks:

1. Rename or replace `brand_profile` storage with `line_brand_draft`.
2. Restrict it to unlinked LINE users only.
3. When a LINE user links an account:
   - offer to convert the draft into a brand
   - or merge into an existing selected/default brand
4. Update LINE tool descriptions so they refer to "brand draft" only when no canonical brand exists.

Exit criteria:

- linked LINE users use the same brand model as web users
- temporary LINE drafts no longer masquerade as full brand records
- status update:
  - implemented in code
  - linked LINE users now resolve canonical brand context
  - unlinked LINE users now use an explicit LINE-only draft module

### Phase 6 - Deprecation and removal

Goal: fully retire the duplicate system.

Tasks:

1. Remove `features/brand-profile/*` from active product flows.
2. Remove `brand_profile` from tool registry and sidebar navigation.
3. Delete unused API routes under `/api/tools/brand-profile/*`.
4. Drop the old table only after one stable release with migration verification.

Exit criteria:

- one canonical brand system remains
- status update:
  - not complete
  - web-facing `Brand Profile` entry points are removed
  - legacy storage and LINE compatibility code still remain

---

## 10. Recommended File-Level Refactor

### Add or expand

- `features/brands/agent.ts`
- `features/brands/service.ts`
- `features/brands/components/brand-editor-sheet.tsx`
- `features/brands/components/assets-tab.tsx`
- `db/schema/brands.ts`
- `scripts/migrate-brand-profile-to-brands.ts`

### Refactor

- `app/api/chat/route.ts`
- `features/line-oa/webhook/tools.ts`
- `features/image/agent.ts` or related image prompt helpers that currently rely on `get_brand_profile`
- `features/tools/registry/page-loaders.ts`

### Deprecate and remove

- `features/brand-profile/agent.ts`
- `features/brand-profile/service.ts`
- `features/brand-profile/components/brand-profile-tool-page.tsx`
- `db/schema/tools.ts` -> `brand_profile` once migration is complete

---

## 11. Rollout and Backward Compatibility

### Safe rollout strategy

Use a two-step rollout:

1. Read canonical first, legacy second.
2. After migration verification, write canonical only.

### Recommended timeline

Release 1:

- schema expansion
- compatibility reads
- UI consolidation begins
- migration script runs

Release 2:

- canonical writes only
- legacy system hidden from web
- LINE draft split completed

Release 3:

- remove old routes/components
- drop old table if metrics confirm no remaining dependency

### Metrics to watch

- percentage of chat requests using canonical brand context
- percentage of web brand edits still hitting legacy routes
- migration success rate
- number of ambiguous migrations
- number of LINE draft conversions to canonical brands

---

## 12. Acceptance Criteria

This refactor is complete when all of the following are true:

1. Web users manage brand data only in `Settings -> Brands`.
2. Authenticated chat/content/image flows use only canonical brand data.
3. No prompt tells the model to always call `get_brand_profile`.
4. Logos and style references live in `brand_asset`.
5. Linked LINE users use the same canonical brand system as web.
6. Any remaining temporary draft store is clearly LINE-only and not presented as a first-class brand feature.
7. `Brand Profile` is no longer a top-level user-facing concept.

---

## 13. Final Recommendation

The right end state is:

- one canonical product concept: `Brand`
- one canonical data model: `brand` + `brand_asset`
- one canonical user home: `Settings -> Brands`
- one optional guided workflow: `Brand Setup`
- one temporary exception: `LINE Brand Draft` for unlinked users only

That gives the best fit with the Vaja vision, the current platform architecture, and long-term maintenance.
