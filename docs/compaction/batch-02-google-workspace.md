# Batch 2 — Remove Google Workspace integrations

Issue #2 · Branch `compaction/02-google-workspace` · Risk: Low (self-contained)

## Why
No shop-owner demand. Extra OAuth scopes + token storage to maintain.
**Google sign-in (Clerk) is unaffected** — this is the separate Drive/Docs/Sheets/Slides
OAuth connection in `lib/google/oauth.ts`.

## Delete

```
features/google-docs/
features/google-sheets/
features/google-slides/
features/google-drive/
features/google-workspace/
app/api/tools/google-docs/
app/api/tools/google-sheets/
app/api/tools/google-slides/
app/api/tools/google-drive/
app/api/integrations/google/          (connect, callback, disconnect, status)
lib/google/                           (docs, drive, sheets, slides, oauth)
docs/google-workspace-tools-implementation.md
```

## Edit
- `features/tools/registry/client.ts` — remove 4 Google manifests.
- `features/tools/registry/server.ts` — remove 4 manifests + 4 `create*AgentTools` imports/entries.
- `features/tools/registry/page-loaders.ts` — remove 4 Google page loaders.
- `features/external-tools/` — if it registers Google providers (grep `google` in
  `features/external-tools/registry.ts` / `index.ts`), remove those entries.
- `connectedAccount` (`db/schema/integrations.ts`) is also used by the content suite
  (`features/content-marketing/**`, `features/content-hub/**`). Those are deleted in
  batch 5 — **leave them untouched here**, and do not touch the schema.
- `.env.example` / env docs: remove Google Workspace OAuth vars **only if** they are
  distinct from the Clerk Google OAuth vars (e.g. `GOOGLE_WORKSPACE_*`, redirect URI).
  If shared, leave them.
- `CLAUDE.md` — remove any Google Workspace mentions.

## Verify
- `grep -rn "google-docs\|google-sheets\|google-slides\|google-drive\|google-workspace\|@/lib/google\|integrations/google" app features lib components` → only hits in content-marketing/content-hub (deleted in batch 5) or none.
- Sign-in with Google still works (Clerk).
