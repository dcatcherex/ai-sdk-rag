# Google Workspace Tools (Sheets, Docs, Slides, Drive) - Implementation Guide

This document defines how Vaja should support Google Workspace as first-class tools, with the initial focus on Google Sheets and Google Drive, then Google Docs and Google Slides for education and knowledge-work workflows.

The main decision is simple:

- Google Sheets, Google Docs, Google Slides, and Google Drive actions are `tools`
- Workflow instructions for using those tools are `skills`
- MCP support can be added later as an optional expansion path, not the first implementation

Read this after:

- `docs/vaja-vision.md`
- `docs/mcp-and-permission-policies-implementation.md`
- `docs/ready-to-use-agents-implementation.md`

---

## Current Progress

Implementation has started in the codebase.

- [x] Added `connected_account` schema for first-class Google integrations
- [x] Added Google Workspace OAuth env keys
- [x] Added fallback support for existing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars
- [x] Added Google OAuth connect, callback, status, and disconnect routes
- [x] Added Google Sheets helper, manifest, schema, service, agent adapter, and tool page scaffold
- [x] Added Google Drive helper, manifest, schema, service, agent adapter, and tool page scaffold
- [x] Registered Google Sheets and Google Drive in the tool registry and page loaders
- [x] Added test API routes for Google Sheets and Google Drive tool actions
- [x] Added lightweight control-room UI for connection status and manual action testing
- [x] Added manual SQL migration for `connected_account`
- [x] Added Drive picker support for recent `mediaAsset` and `toolArtifact` sources
- [x] Added Google Sheets spreadsheet creation in a specified Google Drive folder
- [x] Added Sheets preset helpers for teacher scorebooks and business CRM testing
- [x] Added vertical scrolling to Sheets and Drive tool pages so long content is reachable in the workspace panel
- [x] Expanded Google Workspace OAuth scopes for Docs and Slides support
- [x] Added Google Docs helper, manifest, schema, service, agent adapter, and tool page scaffold
- [x] Added Google Slides helper, manifest, schema, service, agent adapter, and tool page scaffold
- [x] Registered Google Docs and Google Slides in the tool registry and page loaders
- [x] Added test API routes for Google Docs and Google Slides tool actions
- [x] Added lightweight control-room UI for Google Docs and Google Slides manual action testing
- [x] Type-check passes with `pnpm exec tsc --noEmit`
- [x] Add Google Docs native tool package
- [x] Add Google Slides native tool package

---

## Table of Contents

1. [Why This Belongs in Tools](#1-why-this-belongs-in-tools)
2. [Product Decision](#2-product-decision)
3. [Teacher and Trainer Workflows](#3-teacher-and-trainer-workflows)
4. [Delivery Strategy by Phase](#4-delivery-strategy-by-phase)
5. [Architecture Overview](#5-architecture-overview)
6. [Files to Add](#6-files-to-add)
7. [Database Design](#7-database-design)
8. [OAuth Flow](#8-oauth-flow)
9. [Google Sheets Tool Design](#9-google-sheets-tool-design)
10. [Google Docs Tool Design](#10-google-docs-tool-design)
11. [Google Slides Tool Design](#11-google-slides-tool-design)
12. [Google Drive Tool Design](#12-google-drive-tool-design)
13. [Sidebar and API Shape](#13-sidebar-and-api-shape)
14. [Agent Approval Policy](#14-agent-approval-policy)
15. [Skills on Top of These Tools](#15-skills-on-top-of-these-tools)
16. [MCP Relationship](#16-mcp-relationship)
17. [Implementation Order](#17-implementation-order)
18. [Common Mistakes](#18-common-mistakes)

---

## 1. Why This Belongs in Tools

In Vaja's architecture, a capability is a `tool` when it reads from or writes to an external system.

Google Sheets examples:

- append a customer row
- update a status cell
- read a planning table
- create a worksheet tab

Google Drive examples:

- upload a generated image
- save an exported file
- create a folder
- list files in a campaign folder

These are external actions with side effects, so they belong in `features/<tool>/service.ts` plus thin `agent.ts` adapters.

Skills are still useful here, but for a different job:

- teach the agent which spreadsheet is the source of truth
- explain column mapping and naming conventions
- define when it should ask before overwriting data
- tell it which Drive folder structure to use

---

## 2. Product Decision

Build Google Workspace in two layers:

### Layer A - Native Vaja tools first

Use first-class tool packages for the highest-value workflows:

- Google Sheets: read, append, update, create tab
- Google Docs: create a document from content or template, append sections, update placeholders
- Google Slides: create a deck from structured slide content and speaker notes
- Google Drive: upload file, save generated image, create folder, list files

Why:

- better approval UX
- better validation
- clearer audit trail in `tool_run`
- easier to support common Thai SME workflows
- stronger control over scopes and write behavior

### Layer B - MCP later

Later, users can also attach Google Workspace MCP servers to agents for broader coverage. Native tools remain the preferred path for common workflows.

---

## 3. Teacher and Trainer Workflows

These workflows are a strong reason to support more than just Sheets and Drive.

### Classroom record-keeping with Google Sheets

Teacher examples:

- create a gradebook spreadsheet for one class
- create one worksheet tab per term or subject
- append student scores after each quiz
- update attendance or homework completion columns
- summarize low-scoring students and write back support flags

Why this fits native tools well:

- the data model is tabular
- approval moments are clear
- writes can be constrained to a known spreadsheet

### Homework and handout creation with Google Docs

Teacher examples:

- create a homework document from a lesson topic
- generate worksheet text into a structured doc
- fill a school template with class name, topic, and due date
- append answer key on a separate page

Why this is feasible:

- Docs is mostly structured text with headings, tables, and lists
- Vaja already generates strong long-form content
- the tool can focus on document assembly rather than open-ended editing

### Teaching deck creation with Google Slides

Teacher examples:

- create a simple 10-slide deck for one lesson
- generate title, objectives, concept explanation, examples, and recap slides
- add speaker notes for the teacher
- create a quiz/review slide at the end

Why this is harder:

- slide layout is more brittle than docs or sheets
- freeform deck design is a large product surface
- the first version should be template-based, not arbitrary visual editing

### Teacher-facing conclusion

This is not too difficult overall, but it should be staged:

- Sheets: straightforward and high value
- Docs: realistic after Sheets
- Slides: realistic if constrained to template-based deck generation first

---

## 4. Delivery Strategy by Phase

Ship this in phases instead of treating all Google Workspace features as equally mature.

### Phase 1A - Google Sheets

- read rows from a range
- append a row using header mapping
- update a range
- create a worksheet tab

### Phase 1B - Google Drive

- upload a Vaja artifact or media asset to Drive
- save a generated image to Drive
- create a folder
- list files in a folder

Why first:

- strongest architecture fit
- easiest approval model
- supports business and teacher use cases immediately

### Phase 2 - Google Docs

- create a document from generated content
- create a document from a template with placeholder replacement
- append sections or answer keys
- optionally export doc link into Drive folder workflows

Why second:

- highly useful for teachers, trainers, admin staff, and writers
- lower complexity than Slides
- Vaja already has long-form generation that can feed directly into docs

### Phase 3 - Google Slides

- create a presentation deck from a structured outline
- create slides from a template deck
- populate slide title, bullets, image placeholders, and speaker notes

Why third:

- more design and layout complexity
- more room for user disappointment if version 1 over-promises
- best first shipped as constrained deck generation, not freeform editing

### Out of scope for the first release train

- Google Docs
- rich arbitrary document editing with full cursor-level operations
- freeform slide design editing
- Calendar
- Drive sharing permissions UI
- multiple Google accounts per workspace
- spreadsheet picker UI with full browsing
- domain-wide admin installs
- broad MCP replacement of native tools

---

## 5. Architecture Overview

```text
User connects Google account
        ->
OAuth callback stores Google Workspace account + refresh token
        ->
Agent gets Google Sheets / Drive tool access
        ->
Agent calls thin tool() wrapper in agent.ts
        ->
agent.ts calls canonical service.ts
        ->
service.ts refreshes token if needed, calls Google API, normalizes result
        ->
result stored in tool_run / tool_artifact
        ->
AI continues with grounded confirmation to the user
```

For generated files:

```text
Image tool or other tool creates asset
        ->
asset stored as mediaAsset or toolArtifact
        ->
google-drive service receives artifactId / mediaAssetId
        ->
service downloads or streams asset server-side
        ->
uploads to Google Drive
        ->
returns Drive fileId, mimeType, and links
```

This keeps the tool architecture aligned with the rule in `AGENTS.md`:

```text
Sidebar -> API route -> service.ts
Agent   -> agent.ts  -> service.ts
```

---

## 6. Files to Add

### New database schema

```text
db/schema/integrations.ts
```

### Google auth helpers

```text
lib/google/oauth.ts
lib/google/sheets.ts
lib/google/docs.ts
lib/google/slides.ts
lib/google/drive.ts
```

### OAuth routes

```text
app/api/integrations/google/connect/route.ts
app/api/integrations/google/callback/route.ts
app/api/integrations/google/disconnect/route.ts
app/api/integrations/google/status/route.ts
```

### Google Sheets tool

```text
features/google-sheets/
  manifest.ts
  schema.ts
  service.ts
  agent.ts
  types.ts
  components/google-sheets-tool-page.tsx
```

### Google Docs tool

```text
features/google-docs/
  manifest.ts
  schema.ts
  service.ts
  agent.ts
  types.ts
  components/google-docs-tool-page.tsx
```

### Google Slides tool

```text
features/google-slides/
  manifest.ts
  schema.ts
  service.ts
  agent.ts
  types.ts
  components/google-slides-tool-page.tsx
```

### Google Drive tool

```text
features/google-drive/
  manifest.ts
  schema.ts
  service.ts
  agent.ts
  types.ts
  components/google-drive-tool-page.tsx
```

### Sidebar APIs for the tool pages

```text
app/api/tools/google-sheets/read/route.ts
app/api/tools/google-sheets/append-row/route.ts
app/api/tools/google-sheets/update-range/route.ts
app/api/tools/google-sheets/create-tab/route.ts

app/api/tools/google-docs/create/route.ts
app/api/tools/google-docs/create-from-template/route.ts
app/api/tools/google-docs/append-section/route.ts

app/api/tools/google-slides/create-deck/route.ts
app/api/tools/google-slides/create-from-template/route.ts

app/api/tools/google-drive/upload/route.ts
app/api/tools/google-drive/create-folder/route.ts
app/api/tools/google-drive/list-files/route.ts
```

### Registry updates

```text
features/tools/registry/client.ts
features/tools/registry/server.ts
features/tools/registry/page-loaders.ts
```

### Optional skills and seed updates

```text
scripts/seed-agents.ts
docs/ready-to-use-agents-implementation.md
```

---

## 7. Database Design

Do not store Google OAuth tokens in `userPreferences.mcpCredentials`.

That field is acceptable for lightweight MCP credentials, but Google Workspace write access should be treated as a first-class integration.

Create a dedicated table:

```typescript
// db/schema/integrations.ts
import { relations, sql } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const connectedAccount = pgTable('connected_account', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'google'
  providerAccountId: text('provider_account_id').notNull(),
  email: text('email'),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  scopes: jsonb('scopes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index('connected_account_userId_idx').on(table.userId),
  index('connected_account_provider_idx').on(table.provider),
  uniqueIndex('connected_account_user_provider_providerAccount_idx')
    .on(table.userId, table.provider, table.providerAccountId),
]);

export const connectedAccountRelations = relations(connectedAccount, ({ one }) => ({
  user: one(user, { fields: [connectedAccount.userId], references: [user.id] }),
}));
```

### Why a dedicated table

- matches the existing `social_account` pattern
- supports refresh tokens and expiry cleanly
- can later support multiple Google accounts
- separates OAuth tokens from generic settings
- makes it easier to encrypt sensitive fields later

### Security requirement

Before production rollout, `accessToken` and `refreshToken` should be encrypted at rest.

For a first internal implementation, plaintext may be tolerated temporarily, but only behind a clear TODO and only if the feature is not broadly exposed.

---

## 8. OAuth Flow

Follow the same route pattern as the existing social connect flow.

### Proposed routes

```text
GET /api/integrations/google/connect?returnTo=/tools/google-drive
GET /api/integrations/google/callback?code=...&state=...
POST /api/integrations/google/disconnect
GET /api/integrations/google/status
```

### Environment variables

Use a dedicated Google OAuth app for Workspace tools:

```text
GOOGLE_WORKSPACE_CLIENT_ID
GOOGLE_WORKSPACE_CLIENT_SECRET
```

Do not assume the Better Auth sign-in Google app should also be reused for Drive and Sheets scopes.

### Recommended initial scopes

```text
openid
email
profile
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/documents
https://www.googleapis.com/auth/presentations
https://www.googleapis.com/auth/drive.file
```

Use `drive.file` first, not full `drive`, unless a specific feature truly requires broader access.

### Scope rollout recommendation

If we want to minimize approval friction and scope anxiety, ship scopes in waves:

1. first release: `spreadsheets` + `drive.file`
2. second release: add `documents`
3. third release: add `presentations`

If Google requires re-consent after adding scopes, the UI should clearly explain why.

### OAuth flow shape

1. User clicks connect from the tool page or settings UI.
2. `connect/route.ts` creates state cookie and redirects to Google.
3. `callback/route.ts` exchanges code for tokens.
4. Callback reads Google profile and stores or upserts `connected_account`.
5. User is redirected back to the requested tool page with success/error params.

### Shared helper functions

`lib/google/oauth.ts` should expose:

- `getActiveGoogleAccount(userId)`
- `refreshGoogleAccessToken(accountId)`
- `ensureGoogleScopes(account, requiredScopes)`
- `disconnectGoogleAccount(userId)`

---

## 9. Google Sheets Tool Design

### Tool package

```text
features/google-sheets/
```

### Manifest

```typescript
// features/google-sheets/manifest.ts
import type { ToolManifest } from '@/features/tools/registry/types';

export const googleSheetsManifest: ToolManifest = {
  id: 'google_sheets',
  slug: 'google-sheets',
  title: 'Google Sheets',
  description: 'Read and update Google Sheets from agents or the control room.',
  icon: 'Table2',
  category: 'admin',
  professions: ['all', 'teacher', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: false,
  defaultEnabled: false,
  sidebar: {
    label: 'Sheets',
    order: 250,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
```

### Tool names

Expose these AI SDK tools:

- `read_google_sheet_range`
- `append_google_sheet_row`
- `update_google_sheet_range`
- `create_google_sheet_tab`
- `create_google_spreadsheet`

### Input schema recommendation

```typescript
// features/google-sheets/schema.ts
import { z } from 'zod';

const cellValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const readSheetRangeInputSchema = z.object({
  spreadsheetId: z.string().min(1),
  range: z.string().min(1).describe('A1 notation, e.g. Sheet1!A1:F50'),
});

export const appendSheetRowInputSchema = z.object({
  spreadsheetId: z.string().min(1),
  sheetName: z.string().min(1),
  row: z.record(z.string(), cellValueSchema)
    .describe('Header-name to value map. Service resolves headers to columns.'),
});

export const updateSheetRangeInputSchema = z.object({
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
  values: z.array(z.array(cellValueSchema)).min(1),
});

export const createSheetTabInputSchema = z.object({
  spreadsheetId: z.string().min(1),
  title: z.string().min(1).max(100),
});

export const createSpreadsheetInputSchema = z.object({
  title: z.string().min(1).max(200),
  folderId: z.string().optional(),
  headers: z.array(z.string().min(1)).optional(),
});
```

### Implemented creation flow

The current implementation supports creating a brand new spreadsheet file and placing it inside a specific Google Drive folder.

Input:

- `title`: spreadsheet file name
- `folderId`: optional Drive folder ID
- `headers`: optional first-row header values

Behavior:

1. create a new Google Drive file with mime type `application/vnd.google-apps.spreadsheet`
2. if `folderId` is provided, create the file inside that Drive folder
3. if `headers` are provided, write them into `Sheet1!1:1`
4. return the new `spreadsheetId`, `webViewLink`, and resolved `folderId`

This is especially useful for:

- teacher scorebooks
- attendance trackers
- CRM or lead sheets
- per-campaign or per-class spreadsheet creation

### Service contract

`service.ts` owns all Google API logic. It should expose:

- `runReadSheetRange(input, userId)`
- `runAppendSheetRow(input, userId)`
- `runUpdateSheetRange(input, userId)`
- `runCreateSheetTab(input, userId)`
- `runCreateSpreadsheet(input, userId)`

And sidebar/API wrappers:

- `readSheetRangeAction(input, userId)`
- `appendSheetRowAction(input, userId)`
- `updateSheetRangeAction(input, userId)`
- `createSheetTabAction(input, userId)`
- `createSpreadsheetAction(input, userId)`

### Service behavior

Each service function should:

1. load the user's active Google connection
2. refresh token if needed
3. verify required scopes
4. call Google Sheets API
5. normalize the response into Vaja-friendly JSON
6. record the run in `tool_run`
7. return a `ToolExecutionResult`

For spreadsheet creation specifically, the service now uses both:

- Google Sheets scope
- Google Drive `drive.file` scope

This is required because the spreadsheet is created as a Drive file first, then initialized as a sheet.

### Agent adapter

```typescript
// features/google-sheets/agent.ts
import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import {
  readSheetRangeInputSchema,
  appendSheetRowInputSchema,
  updateSheetRangeInputSchema,
  createSheetTabInputSchema,
  createSpreadsheetInputSchema,
} from './schema';
import {
  runReadSheetRange,
  runAppendSheetRow,
  runUpdateSheetRange,
  runCreateSheetTab,
  runCreateSpreadsheet,
} from './service';

export function createGoogleSheetsAgentTools(
  ctx: Pick<AgentToolContext, 'userId'>,
) {
  const { userId } = ctx;

  return {
    read_google_sheet_range: tool({
      description: 'Read rows from a Google Sheet range using A1 notation.',
      inputSchema: readSheetRangeInputSchema,
      async execute(input) {
        return await runReadSheetRange(input, userId);
      },
    }),

    append_google_sheet_row: tool({
      description: 'Append one row to a Google Sheet using header names.',
      inputSchema: appendSheetRowInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runAppendSheetRow(input, userId);
      },
    }),

    update_google_sheet_range: tool({
      description: 'Update cells in a Google Sheet range.',
      inputSchema: updateSheetRangeInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runUpdateSheetRange(input, userId);
      },
    }),

    create_google_sheet_tab: tool({
      description: 'Create a new worksheet tab in an existing spreadsheet.',
      inputSchema: createSheetTabInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runCreateSheetTab(input, userId);
      },
    }),

    create_google_spreadsheet: tool({
      description: 'Create a new Google Spreadsheet, optionally inside a specific Google Drive folder and with an initial header row.',
      inputSchema: createSpreadsheetInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runCreateSpreadsheet(input, userId);
      },
    }),
  };
}
```

### Why append-by-header is important

For agents, header mapping is safer than raw column indexes. It lets a skill say:

- `customer_name` goes to the "Customer Name" column
- `status` goes to the "Status" column

without the model needing to reason about column letters.

### Current UI support

The current Sheets control-room page now supports:

- creating a spreadsheet in a specified Drive folder
- optional comma-separated header seeding
- copying the newly created spreadsheet ID into the target field for follow-up actions
- teacher and business presets for faster testing

---

## 10. Google Docs Tool Design

Google Docs is a strong second-phase tool because it maps cleanly to Vaja's existing long-form generation abilities.

### Best first version

Keep the first Docs tool focused on document creation and structured updates:

- create a new document from generated content
- create from a known template with placeholder replacement
- append a section at the end
- optionally insert a simple table

Avoid trying to build a full collaborative editor or cursor-level mutation API in v1.

### Teacher use cases

- create homework instructions
- create a printable worksheet
- create a lesson handout
- create an answer key document
- create a training handout for workshops

### Tool names

- `create_google_doc`
- `create_google_doc_from_template`
- `append_google_doc_section`

### Suggested input shapes

```typescript
import { z } from 'zod';

export const createGoogleDocInputSchema = z.object({
  title: z.string().min(1).max(200),
  contentMarkdown: z.string().min(1),
  folderId: z.string().optional(),
});

export const createGoogleDocFromTemplateInputSchema = z.object({
  templateDocumentId: z.string().min(1),
  title: z.string().min(1).max(200),
  replacements: z.record(z.string(), z.string()),
  folderId: z.string().optional(),
});

export const appendGoogleDocSectionInputSchema = z.object({
  documentId: z.string().min(1),
  heading: z.string().optional(),
  contentMarkdown: z.string().min(1),
});
```

### Service contract

`features/google-docs/service.ts` should expose:

- `runCreateGoogleDoc(input, userId)`
- `runCreateGoogleDocFromTemplate(input, userId)`
- `runAppendGoogleDocSection(input, userId)`

The service should convert markdown or structured content into a Google Docs batch update request.

### Implementation constraint

The first implementation should convert content into a limited formatting vocabulary:

- heading 1 to heading 3
- paragraphs
- bullet lists
- numbered lists
- simple tables

That keeps the tool reliable for homework and handouts.

---

## 11. Google Slides Tool Design

Google Slides is feasible, but it should not start as a fully general "design any deck however you want" tool.

### Recommended first version

Support only constrained presentation generation:

- create a new deck from a structured outline
- create from a template deck
- fill in title, bullets, speaker notes, and image placeholders

### Teacher use cases

- create a lesson introduction deck
- create review slides before an exam
- create workshop slides for teacher training
- create a recap deck from a long lesson plan

### Why Slides is harder than Docs

- layout quality matters more
- visual template consistency matters more
- the Google Slides API is more mechanical and lower-level than "write a document"

So the first version should be template-driven.

### Tool names

- `create_google_slides_deck`
- `create_google_slides_from_template`

### Suggested input shapes

```typescript
import { z } from 'zod';

export const slideSchema = z.object({
  title: z.string().min(1),
  bullets: z.array(z.string()).max(6).default([]),
  speakerNotes: z.string().optional(),
  imagePrompt: z.string().optional(),
});

export const createGoogleSlidesDeckInputSchema = z.object({
  title: z.string().min(1).max(200),
  slides: z.array(slideSchema).min(1).max(30),
  folderId: z.string().optional(),
});

export const createGoogleSlidesFromTemplateInputSchema = z.object({
  templatePresentationId: z.string().min(1),
  title: z.string().min(1).max(200),
  slides: z.array(slideSchema).min(1).max(30),
  folderId: z.string().optional(),
});
```

### V1 success criteria

If the user asks:

- "Create 8 slides for a ป.5 science lesson"
- "Make a deck from this workshop outline"

the tool should produce a clean, usable deck, even if it is not visually sophisticated.

That is enough for a first release.

---

## 12. Google Drive Tool Design

### Tool package

```text
features/google-drive/
```

### Manifest

```typescript
// features/google-drive/manifest.ts
import type { ToolManifest } from '@/features/tools/registry/types';

export const googleDriveManifest: ToolManifest = {
  id: 'google_drive',
  slug: 'google-drive',
  title: 'Google Drive',
  description: 'Store generated files and browse Google Drive folders from Vaja.',
  icon: 'FolderOpen',
  category: 'admin',
  professions: ['all', 'teacher', 'marketer', 'business'],
  supportsAgent: true,
  supportsSidebar: true,
  supportsExport: true,
  defaultEnabled: false,
  sidebar: {
    label: 'Drive',
    order: 252,
  },
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
```

### Tool names

- `upload_file_to_google_drive`
- `create_google_drive_folder`
- `list_google_drive_files`

### Current implementation status

Implemented now:

- `upload_file_to_google_drive`
- `create_google_drive_folder`
- `list_google_drive_files`

Planned later:

- `save_generated_image_to_google_drive`

The current upload tool already covers most of the image-save use case because it accepts:

- `mediaAssetId`
- `artifactId`
- `fileUrl`

So a dedicated image-save tool is optional rather than required for Phase 1.

### Input schema recommendation

```typescript
// features/google-drive/schema.ts
import { z } from 'zod';

export const uploadFileToDriveInputSchema = z.object({
  artifactId: z.string().optional(),
  mediaAssetId: z.string().optional(),
  fileUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  folderId: z.string().optional(),
}).refine(
  (v) => Boolean(v.artifactId || v.mediaAssetId || v.fileUrl),
  'One of artifactId, mediaAssetId, or fileUrl is required.',
);

export const createDriveFolderInputSchema = z.object({
  name: z.string().min(1).max(120),
  parentFolderId: z.string().optional(),
});

export const listDriveFilesInputSchema = z.object({
  folderId: z.string().optional(),
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});
```

### Implemented upload flow

The current Drive upload flow resolves one source from:

- `mediaAssetId`
- `artifactId`
- `fileUrl`

Behavior:

1. resolve the source to a server-side URL and metadata
2. fetch the file on the server
3. upload it to Google Drive using `drive.file`
4. return Drive metadata including:
   - `id`
   - `name`
   - `mimeType`
   - `webViewLink`
   - `webContentLink`

This means the same upload action can handle:

- generated images from `mediaAsset`
- exported tool outputs from `toolArtifact`
- direct file URLs

### Service contract

`service.ts` should expose:

- `runUploadFileToDrive(input, userId)`
- `runCreateDriveFolder(input, userId)`
- `runListDriveFiles(input, userId)`

And wrapper actions:

- `uploadFileToDriveAction(input, userId)`
- `createDriveFolderAction(input, userId)`
- `listDriveFilesAction(input, userId)`

The current implementation also includes internal source-resolution logic that maps:

- `mediaAssetId` -> `media_asset.url`
- `artifactId` -> `tool_artifact.storage_url`
- `fileUrl` -> direct remote file

### Service behavior

For upload operations:

1. resolve the source file from `artifactId`, `mediaAssetId`, or `fileUrl`
2. stream or download it on the server
3. upload to Google Drive using the connected account
4. return normalized metadata:
   - `id`
   - `name`
   - `mimeType`
   - `webViewLink`
   - `webContentLink`

For folder creation:

- create a Google Drive folder
- optionally place it inside a parent folder
- return folder metadata for follow-up actions

For file listing:

- optionally filter by folder ID
- optionally filter by name query
- return a lightweight file list for picker-style UI

### Artifact-first design

Prefer `artifactId` and `mediaAssetId` over raw base64 input.

That keeps large payloads out of chat messages and matches Vaja's existing persistence model:

- `toolArtifact`
- `mediaAsset`
- `toolRun`

### Current UI support

The current Drive control-room page now supports:

- connection status and disconnect
- listing files by folder or search query
- creating folders
- uploading from a direct URL
- selecting a recent `mediaAsset`
- selecting a recent `toolArtifact`
- scrolling inside the workspace panel for long content

This gives users a practical way to move existing Vaja outputs into Drive without copying URLs manually every time.

### Agent adapter approval policy

- `list_google_drive_files` can be read-only
- all write/create/upload actions should require approval by default

---

## 13. Sidebar and API Shape

Even though the agent can use these tools directly, the Google Workspace tools should also have control-room pages.

Sheets and Drive already follow this pattern. Docs and Slides should follow the same shape when implemented.

### Why sidebar pages matter

- lets users connect Google manually
- provides a visible place to test the connection
- gives a place to pick spreadsheet and folder IDs
- helps users trust the integration before giving it to an autonomous agent

### Registry updates

Current registry wiring is implemented for:

- `google_sheets`
- `google_drive`

These are registered in:

- `features/tools/registry/client.ts`
- `features/tools/registry/server.ts`
- `features/tools/registry/page-loaders.ts`

### Current sidebar pages

- `/tools/google-sheets` implemented
- `/tools/google-drive` implemented

### Planned sidebar pages

- `/tools/google-docs`
- `/tools/google-slides`

### Current API routes

Google integration routes:

- `GET /api/integrations/google/connect`
- `GET /api/integrations/google/callback`
- `GET /api/integrations/google/status`
- `POST /api/integrations/google/disconnect`

Google Sheets test routes:

- `POST /api/tools/google-sheets/create-spreadsheet`
- `POST /api/tools/google-sheets/read`
- `POST /api/tools/google-sheets/append-row`
- `POST /api/tools/google-sheets/update-range`
- `POST /api/tools/google-sheets/create-tab`

Google Drive test routes:

- `POST /api/tools/google-drive/list-files`
- `POST /api/tools/google-drive/create-folder`
- `POST /api/tools/google-drive/upload`

Picker/support routes:

- `GET /api/media-assets`
- `GET /api/tool-artifacts`

### Current Sheets page UI

Google Sheets page:

- connection status
- connect / refresh / disconnect actions
- linked Google account email
- create spreadsheet in a specified Drive folder
- optional header seeding when creating a spreadsheet
- spreadsheet ID input
- test read range
- test append row
- test update range
- create worksheet tab
- teacher scorebook preset
- business CRM preset
- latest JSON result viewer
- vertical page scrolling inside the workspace shell

### Current Drive page UI

Google Drive page:

- connection status
- connect / refresh / disconnect actions
- folder ID input
- file listing by folder or search query
- create folder
- upload from direct URL
- select recent `mediaAsset`
- select recent `toolArtifact`
- latest JSON result viewer
- vertical page scrolling inside the workspace shell

### Planned Docs page UI

Google Docs page:

- connection status
- template document ID input
- create from markdown
- create from placeholder template

### Planned Slides page UI

Google Slides page:

- connection status
- template presentation ID input
- deck outline preview
- create deck from lesson summary

---

## 14. Agent Approval Policy

These tools touch real external systems, so approval should be strict by default.

### Recommended defaults

| Tool | Default policy | Reason |
|---|---|---|
| `read_google_sheet_range` | `always_allow` | Read-only |
| `append_google_sheet_row` | `always_ask` | External write |
| `update_google_sheet_range` | `always_ask` | External write |
| `create_google_sheet_tab` | `always_ask` | External write |
| `create_google_doc` | `always_ask` | External write |
| `create_google_doc_from_template` | `always_ask` | External write |
| `append_google_doc_section` | `always_ask` | External write |
| `create_google_slides_deck` | `always_ask` | External write |
| `create_google_slides_from_template` | `always_ask` | External write |
| `list_google_drive_files` | `always_allow` | Read-only |
| `upload_file_to_google_drive` | `always_ask` | External write |
| `save_generated_image_to_google_drive` | `always_ask` | External write |
| `create_google_drive_folder` | `always_ask` | External write |

This matches the existing direction in:

- `features/distribution/agent.ts`
- `features/record-keeper/agent.ts`
- `docs/mcp-and-permission-policies-implementation.md`

---

## 15. Skills on Top of These Tools

These integrations become much more useful when paired with domain skills.

### Example skill: `sales-admin-sheet-sync`

Purpose:

- keep a sales or lead tracker up to date
- use one spreadsheet as the source of truth

Likely `enabledTools`:

- `google_sheets`

Prompt fragment ideas:

- append leads only after the user confirms the final fields
- map Thai customer names to the `Customer Name` header
- use ISO dates in the `Created At` column
- never overwrite an existing status without confirmation

### Example skill: `creative-asset-archiver`

Purpose:

- save generated images into a clean Drive folder structure

Likely `enabledTools`:

- `google_drive`
- `image`

Prompt fragment ideas:

- save final approved images only
- file name format: `campaign-name_YYYY-MM-DD_variant-a`
- create folder by year/month/campaign if missing

### Example skill: `classroom-record-keeper`

Purpose:

- maintain class score sheets and attendance records

Likely `enabledTools`:

- `google_sheets`

Prompt fragment ideas:

- one sheet tab per class or term
- confirm student identifier before updating marks
- never overwrite existing scores without explicit confirmation
- use Thai student names exactly as provided by the teacher

### Example skill: `homework-doc-builder`

Purpose:

- create homework sheets, answer keys, and class handouts

Likely `enabledTools`:

- `google_docs`
- `long_form`

Prompt fragment ideas:

- title should include subject, grade, and due date
- student-facing version should avoid answer leakage
- answer key should be created as a separate document or appendix

### Example skill: `lesson-slides-generator`

Purpose:

- convert lesson summaries into simple teaching slides

Likely `enabledTools`:

- `google_slides`
- `image`

Prompt fragment ideas:

- one teaching objective per slide
- no more than 5 short bullets per slide
- add speaker notes for explanations, not paragraphs on the slide itself

### Important boundary

Do not hardcode domain workflow into the platform core. Put reusable workflow guidance in `agentSkill.promptFragment`, not inside Google service logic.

---

## 16. MCP Relationship

This design does not conflict with the MCP roadmap.

### Native tools remain the best path for:

- append row to a CRM sheet
- save generated assets to Drive
- clear approval UX
- narrow write scopes
- stable support and debugging

### MCP becomes useful later for:

- broader Google Workspace coverage
- custom enterprise connectors
- uncommon operations not worth building natively

If a community Google Workspace MCP server is attached to an agent, those MCP tools should still default to `needsApproval: true`, as already defined in `lib/tools/mcp.ts`.

---

## 17. Implementation Order

### Step 1 - Data model

- add `db/schema/integrations.ts`
- generate and run Drizzle migration

### Step 2 - OAuth integration

- build Google connect/callback/disconnect/status routes
- add helper functions in `lib/google/oauth.ts`

### Step 3 - Google Sheets native tool

- create manifest, schema, service, agent, types
- register in tool registry
- add sidebar page and API routes

### Step 4 - Google Drive native tool

- create manifest, schema, service, agent, types
- register in tool registry
- add sidebar page and API routes

### Step 5 - Google Docs native tool

- create manifest, schema, service, agent, types
- support create, template replace, and append-section flows
- add sidebar page and API routes

### Step 6 - Google Slides native tool

- create manifest, schema, service, agent, types
- keep the first version template-driven
- add sidebar page and API routes

### Step 7 - Approval and UX

- ensure write operations use `needsApproval: true`
- add connection state and test actions to the tool pages

### Step 8 - Skills and seed templates

- add optional skills that unlock these tools
- attach them to relevant admin templates later

---

## 18. Common Mistakes

### 1. Putting Google write logic in a skill

Wrong. Skills should guide behavior, not perform the API action.

### 2. Storing Google OAuth tokens in `mcpCredentials`

Wrong for a first-class write integration. Use a dedicated integration table.

### 3. Letting the agent upload arbitrary blobs directly from chat text

Prefer `artifactId` or `mediaAssetId`. Keep file transfer server-side.

### 4. Using full Drive scope too early

Start with `drive.file` if possible.

### 5. Skipping approval on write actions

Drive uploads and Sheet updates are externally visible side effects.

### 6. Making the tool too low-level for the model

Prefer:

- append row by header map
- create docs from markdown or template replacements
- create slides from structured outline objects
- save generated image by asset ID

over:

- arbitrary column index writes
- arbitrary cursor-level Docs edits everywhere
- fully freeform slide element positioning in v1
- raw base64 file upload in tool input

### 7. Duplicating Google API logic between agent and route handlers

All business logic must live in canonical `service.ts`.

---

## Final Recommendation

Implement Google Workspace in phases:

- first: Google Sheets and Google Drive
- second: Google Docs
- third: Google Slides with template-based generation

Then layer skills on top to teach the agent how each business wants those tools used.

That matches Vaja's architecture cleanly:

- tools do the action
- skills provide domain behavior
- MCP remains an optional expansion path later
