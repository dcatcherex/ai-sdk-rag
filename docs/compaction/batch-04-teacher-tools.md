# Batch 4 — Remove teacher tools (quiz, certificate, exam-builder)

Issue #4 · Branch `compaction/04-teacher-tools` · Risk: Low

## Why
Teachers are deferred behind the shop-owner wedge. If they come back, rebuild as skills
(SKILL.md + chat) — not as platform modules.

## Delete

```
features/quiz/
features/certificate/
features/exam-builder/
app/api/tools/quiz/
app/api/tools/exam-builder/
app/api/quiz/                         (incl. print/[threadId]/[messageId]/pdf)
app/api/certificate/                  (generate, batch, jobs, templates)
app/quiz/                             (public print page)
lib/certificate-service.ts
lib/certificate-generator.ts
lib/certificate-print.ts
lib/certificate-fonts.ts
lib/certificate-fonts.server.ts
lib/quiz-pdf.ts
lib/quiz-print.ts
lib/tools/certificate.ts
```
Also delete any certificate/quiz/exam docs in `docs/` (grep filenames and headings).
Certificate font files under `public/` (grep `certificate-fonts.ts` for their paths) —
delete them if nothing else references them.

## Edit

### Tool registry
- `client.ts`, `server.ts`, `page-loaders.ts` — remove `quiz`, `certificate`, `exam-builder`.
- `features/tools/registry/server.ts` ~line 78 — remove `maxRecipients: ctx.toolOptions?.certificateMaxRecipients`.
- `features/tools/registry/types.ts` ~line 94 — remove `certificateMaxRecipients` from tool options.

### Certificate plumbing through the tool set
- `lib/tools/index.ts` — remove `certificateMaxRecipients` (lines ~13, 27–28, 42, 57, 82) and
  doc comments that mention certificate.
- `features/agents/server/run-tools.ts` — remove `certificateMaxRecipients` (lines ~20, 47, 59).
- `lib/support.ts` ~line 936 — remove `certificateMaxRecipients: 50`.
- `lib/tool-registry.ts` — update the header comment example (line 4).

### external-tools
- `features/certificate/provider-adapter.ts` used `@/features/external-tools` — goes with the
  folder. If `features/external-tools/registry.ts` registers a certificate provider, remove it.

### Stragglers
- `proxy.ts` — remove public route matchers for `/quiz` or certificate endpoints if present.
- `app/landing/page.tsx`, `features/chat/components/empty-state/task-starter-data.ts` —
  remove quiz/exam/certificate starters and cards.
- `CLAUDE.md` — remove Quiz/Certificate from directory tree, "Media & Tools" notes,
  `certificate-service.ts` / `certificate-generator.ts` lines in `lib/` listing,
  and `"certificate"` from the `SidebarNavItemId` example.

### Dependencies
After deleting, check each; `pnpm remove` only if zero imports remain:
- `pdf-lib` — still used by `features/case-workspace/service.ts` → **keep until batch 7**.
- Font/QR/zip libs only imported by deleted files (grep `from '<pkg>'`).
  `qrcode` is used by LINE payments — keep. `jszip` is used by skills export — keep.

## Verify
- `grep -rniE "features/(quiz|certificate|exam-builder)|certificate-|quiz-(pdf|print)|certificateMaxRecipients|/api/quiz|/api/certificate" app features lib components proxy.ts` → no hits.
