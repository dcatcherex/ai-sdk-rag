# Scope Compaction — Implementation Plans (Sep 2026)

Decision record: `docs/vaja-vision.md` → **Scope Discipline**. Tracking: GitHub issues
#1–#10 (label `compaction`). This folder holds one executable plan per batch, written
so an AI coder with no prior context can do the batch in one PR.

Goal: shrink the app to the shop-owner-on-LINE wedge. Usage evidence (2026-09-28):
the only tool ever run is `image`; every module below has 0–1 rows of real data.

## Batch order (do them in order — later batches assume earlier ones are merged)

| # | Plan | Risk | Issue |
|---|------|------|-------|
| 1 | [AgriSpark](batch-01-agrispark.md) | **Medium** — touches LINE message path | #1 |
| 2 | [Google Workspace](batch-02-google-workspace.md) | Low | #2 |
| 3 | [Media & web builders](batch-03-media-web.md) | Low–Medium | #3 |
| 4 | [Teacher tools](batch-04-teacher-tools.md) | Low | #4 |
| 5 | [Content suite](batch-05-content-suite.md) | Medium — brands/memory/LINE edits | #5 |
| 6 | [Agent teams](batch-06-agent-teams.md) | Low | #6 |
| 7 | [Workspace modules](batch-07-workspace-modules.md) | **Medium** — chat route, agent form, LINE | #7 |
| 8 | [Domain profiles](batch-08-domain-profiles.md) | **High** — conversation-turn runtime | #8 |
| 9 | [Real-time voice](batch-09-realtime-voice.md) | Medium — **owner must confirm first** | #9 |
| 10 | [Drop tables](batch-10-drop-tables.md) | **High** — production data | #10 |

## Rules for every batch

1. **Branch per batch:** `compaction/NN-<name>` off latest `main`. One PR per batch.
2. **Before batch 1 only:** `git tag pre-compaction-2026-09 && git push origin pre-compaction-2026-09`.
3. **Delete, don't hide.** No feature flags, no commented-out code, no `// removed` notes.
4. **Never touch `db/schema/*` or migrations** in batches 1–9. Schema exports may become
   unused — that is expected. Batch 10 handles it.
5. **Never edit `components/ui/*`** (shadcn primitives).
6. Use `pnpm` only.
7. When you delete a module, also remove:
   - its registrations in `features/tools/registry/client.ts`, `server.ts`, `page-loaders.ts`
   - its nav entry in `features/workspace/catalog.ts` (sidebar is driven from here)
   - its `app/api/**` routes and `app/(main)/**` pages
   - its tests
   - its docs in `docs/*.md` (listed per batch) and its section in `CLAUDE.md`
8. **Stale tool IDs:** users' saved `enabledToolIds` / agent `enabledTools` may still contain
   deleted tool IDs. Confirm `buildToolSet()` (`lib/tools/index.ts`) and the registry
   silently ignore unknown IDs. If they throw, add a filter — do not write a data migration.
9. **Find stragglers** after deleting, for each removed module name `X`:
   ```bash
   grep -rn "features/X\|/api/X\|'X'\|\"X\"" app features lib components hooks --include=*.ts --include=*.tsx
   ```

## Definition of done (every batch)

```bash
pnpm exec tsc --noEmit      # must pass
pnpm lint                   # no new errors
pnpm test                   # (or the repo's test script) — remaining tests pass
pnpm build                  # must pass
```

Manual smoke test (`pnpm dev`):
- Web chat: new thread, send a message, get a streamed reply; generate an image.
- Agents page: open, edit and save an agent; attach a skill.
- Shared link: open `/agent/<token>/chat` for an existing public share and send a message.
- LINE: if a dev channel + tunnel is available, send a text and an image to the OA.
  Otherwise, run the LINE webhook unit tests and say so in the PR.

PR description must list: files deleted (count + lines removed via `git diff --stat`),
files edited, anything found that the plan did not anticipate.

## Handoff prompt (paste to the implementing AI)

> Read `CLAUDE.md`, `docs/compaction/README.md`, and `docs/compaction/batch-NN-*.md`.
> Implement batch NN exactly as written on branch `compaction/NN-<name>`. Follow the
> README rules and definition of done. If the code contradicts the plan (a file is
> missing, or a reference exists that the plan doesn't mention), handle it in the spirit
> of the plan and list it under "Deviations" in the PR. Do not expand scope. Do not
> touch `db/schema` or migrations. Open a PR that closes issue #NN.
