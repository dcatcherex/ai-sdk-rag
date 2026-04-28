# Flex Message Feature — Implementation Reference

## Overview

The Flex Message feature adds LINE Flex Message creation and management to Vaja AI, with:
- **Admin template library** (`/admin/flex-templates`) — platform-managed templates
- **User editor** (LINE OA → Flex Messages tab) — personal flex message editor
- **Broadcast integration** — send flex messages via LINE broadcast

## Architecture

```
Admin (/admin/flex-templates)
  → Create/edit/publish/archive platform flex templates
  → "Import AgriSpark Templates" seeds 13 agricultural templates

User (LINE OA → Flex Messages tab)
  → Browse template gallery (pick admin template as starting point)
  → JSON editor (textarea + Format/Validate) + CSS approximation preview
  → Save as personal draft → use in broadcast

Broadcast Panel (LINE OA → Broadcasts tab)
  → Message type toggle: Text | Flex Message
  → Pick from saved flex drafts
  → Broadcasts sent via LINE Messaging API
```

## Database Tables

### `line_flex_template`
Platform-managed templates. Admin creates, publishes, archives.
- `catalogStatus`: `draft | published | archived`
- `category`: `agriculture | ecommerce | general | alert | other`
- `flexPayload`: FlexContainer JSON (bubble or carousel)
- `altText`: Short notification text

### `line_flex_draft`
User's personal saved flex messages.
- Scoped to `userId` (+ optional `channelId`)
- `templateId`: Link to source template if forked

## Key Files

| File | Purpose |
|------|---------|
| `db/schema/line-oa.ts` | `lineFlexTemplate`, `lineFlexDraft` table definitions |
| `app/admin/flex-templates/page.tsx` | Admin template manager |
| `app/api/admin/flex-templates/*` | Admin CRUD + publish/archive/seed |
| `app/api/line-oa/flex-templates/route.ts` | GET published templates |
| `app/api/line-oa/flex-drafts/*` | User draft CRUD |
| `features/line-oa/flex/types.ts` | TypeScript types |
| `features/line-oa/flex/utils.ts` | `parseFlexJson`, `validateFlexPayload`, `buildSimulatorUrl` |
| `features/line-oa/flex/components/flex-preview.tsx` | CSS approximation renderer |
| `features/line-oa/flex/components/flex-editor.tsx` | Textarea + preview panel |
| `features/line-oa/flex/components/flex-template-gallery.tsx` | Template picker grid |
| `features/line-oa/flex/components/flex-draft-list.tsx` | Personal saved list |
| `features/line-oa/flex/components/flex-message-panel.tsx` | Main tab panel |
| `features/line-oa/flex/hooks/use-flex-templates.ts` | TanStack Query hooks |
| `features/line-oa/flex/hooks/use-flex-drafts.ts` | TanStack Query hooks |
| `features/line-oa/flex/seeds/agrispark-templates.ts` | 13 AgriSpark template seeds |
| `features/line-oa/broadcast/service.ts` | Updated to support `messageType: 'flex'` |
| `features/line-oa/components/broadcast-panel.tsx` | Updated with flex type toggle |
| `features/line-oa/components/line-oa-editor-panel.tsx` | Added "Flex Messages" tab |

## AgriSpark Templates (13 total)

All in category `agriculture`, auto-published on seed:

| # | Name | Description |
|---|------|-------------|
| 1 | `agrispark-diagnosis-result` | Pest/disease diagnosis result |
| 2 | `agrispark-severity-alert` | High severity alert (red) |
| 3 | `agrispark-weather-risk` | Weather risk summary |
| 4 | `agrispark-flood-alert` | Flood/storm emergency alert |
| 5 | `agrispark-log-confirm` | Activity log confirmation (postback) |
| 6 | `agrispark-weekly-summary` | Weekly activity summary |
| 7 | `agrispark-price-check` | Crop price check |
| 8 | `agrispark-sell-decision` | Sell vs hold decision frame |
| 9 | `agrispark-photo-diagnosis` | Photo diagnosis (hero image) |
| 10 | `agrispark-7day-forecast` | 7-day forecast carousel |
| 11 | `agrispark-main-menu` | Main AgriSpark menu |
| 12 | `agrispark-record-entry` | Activity record confirmation |
| 13 | `agrispark-officer-broadcast` | Officer-to-farmer broadcast |

## Seeding

Go to `/admin/flex-templates` → click **"Import AgriSpark Templates"**. Idempotent — skips existing names.

## Preview

The in-app preview is a CSS approximation (not pixel-perfect). Use **"Open in LINE Simulator →"** to verify in the official simulator.

Supported components: `bubble`, `carousel`, `box` (vertical/horizontal), `text`, `image`, `button`, `separator`.
