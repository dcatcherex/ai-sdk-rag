# Web Publisher — End-to-End User Flow

This document describes every user-facing journey in the Web Publisher feature — a chat-to-deploy pipeline that lets authorized colleagues edit website copy, clone pages, and publish blog posts through a Vaja AI chat interface, with GitHub PR creation and Vercel auto-deploy.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VAJA AI CHAT (Web App)                           │
│                                                                         │
│  User types request → Skill activates → Agent calls deploy tools        │
│                                                                         │
│  Tools: read_web_file · preview_web_change · confirm_web_change         │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                     Authorization check
                   (DEPLOY_ALLOWED_EMAILS)
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          features/deploy/service.ts                      │
│                                                                          │
│  read_web_file()        → GitHub Contents API (GET file + SHA)          │
│  preview_web_change()   → DB: toolRun record (status: pending)          │
│  confirm_web_change()   → GitHub Contents API:                          │
│                             1. GET main branch SHA                       │
│                             2. Create branch web-deploy/{type}/{ts}     │
│                             3. PUT file (create or update)              │
│                             4. POST pull request                        │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            GitHub                                        │
│                                                                          │
│  Branch created  →  File committed  →  PR opened                        │
└──────────────────┬───────────────────────────────────────────────────────┘
                   │
                   │  Vercel GitHub integration detects new PR
                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                            Vercel                                        │
│                                                                          │
│  PR opened   → Preview deployment → Bot posts preview URL on PR         │
│  PR merged   → Production deployment                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Flow 0 — Initial Setup (One-Time, Admin)

**Actor:** Site owner / admin

```
[Admin] Add environment variables to Vercel / .env.local
    │  GITHUB_TOKEN            ← Personal access token (repo scope)
    │  GITHUB_OWNER            ← GitHub username or org (e.g. "vaja-ai")
    │  GITHUB_REPO             ← Repository name (e.g. "website")
    │  GITHUB_DEFAULT_BRANCH   ← Target branch (e.g. "main")
    │  DEPLOY_ALLOWED_EMAILS   ← Comma-separated list of authorized emails
    │
    ▼
[Dashboard] Agents → Create or select a "Web Publisher" agent
    │  Set agent name, system prompt referencing web-publisher skill
    │
    ▼
[Dashboard] Agent Settings → Tools → Enable "web_deploy" tool
    │  enabledTools: ['web_deploy']
    │
    ▼
[Dashboard] Skills → Import Skill → paste path:
    │  features/deploy/skill/SKILL.md
    │  (or GitHub URL if hosted publicly)
    │  Skill is imported with keyword trigger: "web-publisher"
    │
    ▼
[Admin] Edit the 3 reference files to match your actual site
    │  skill/references/site-structure.md  ← list real routes + file paths
    │  skill/references/blog-template.md   ← real MDX frontmatter schema
    │  skill/references/style-guide.md     ← brand voice, tone, naming rules
    │
    ▼
[Dashboard] Skills → Attach "web-publisher" skill to the Web Publisher agent
    │  Skill activationMode: keyword
    │  Trigger keywords: ["web-publisher", "edit page", "blog post", "deploy"]
    │
    ▼
[Admin] Invite colleagues by adding their emails to DEPLOY_ALLOWED_EMAILS
    │  e.g. DEPLOY_ALLOWED_EMAILS=colleague@company.com,editor@company.com
    │
    ▼
[Result] Web Publisher agent is live — authorized users can now drive
         site changes entirely from chat
```

---

## Flow 1 — Copy Edit (Most Common)

**Actor:** Authorized editor / colleague

```
[Chat] User: "Change the homepage hero headline to
    │         'AI for every Thai professional'"
    │
    ▼
[Skill] web-publisher keyword detected
    │  Skill activates → injects site-structure.md + style-guide.md
    │  into system prompt context
    │
    ▼
[Agent] Determines this is a copy_edit to app/page.tsx
    │
    ▼
[Agent] Tool call: read_web_file("app/page.tsx")
    │
    ▼
[service.ts] read_web_file()
    │  GitHub Contents API: GET /repos/{owner}/{repo}/contents/app/page.tsx
    │  Returns: { content: "<file contents>", sha: "abc123..." }
    │
    ▼
[Agent] Receives current file content
    │  Identifies the hero headline JSX element
    │  Generates edited content — only the headline string changes,
    │  all surrounding code preserved exactly
    │
    ▼
[Agent] Tool call: preview_web_change({
    │    changeType: "copy_edit",
    │    targetPath: "app/page.tsx",
    │    originalSha: "abc123...",
    │    newContent: "<full file with headline changed>",
    │    prTitle: "Update homepage hero headline",
    │    prDescription: "Changes hero headline to 'AI for every Thai professional'",
    │    summary: "Homepage hero headline updated on line 14"
    │  })
    │
    ▼
[service.ts] preview_web_change()
    │  Validates: user email in DEPLOY_ALLOWED_EMAILS or ADMIN_EMAILS
    │  Inserts toolRun record:
    │    { toolSlug: 'web-deploy', status: 'pending',
    │      input: { changeType, targetPath, originalSha, newContent, ... } }
    │  Returns: { toolRunId: "run_xyz", changeType, targetPath, summary }
    │
    ▼
[Agent] Replies with preview summary:
    │  "Here's what will change:
    │   • File: app/page.tsx
    │   • Change: Homepage hero headline updated on line 14
    │   • PR title: 'Update homepage hero headline'
    │
    │   Shall I create the GitHub PR?"
    │
    ▼
[User] "Yes" / "Looks good, create the PR"
    │
    ▼
[Agent] Tool call: confirm_web_change("run_xyz")
    │
    ▼
[service.ts] confirm_web_change()
    │  1. Auth check: user email in allowed list
    │  2. Load pending toolRun by id, verify status === 'pending'
    │  3. GET main branch → extract latestSha for branch base
    │  4. GitHub: POST /repos/.../git/refs
    │       ref: "refs/heads/web-deploy/copy_edit/{timestamp}"
    │       sha: latestSha
    │  5. GitHub: PUT /repos/.../contents/app/page.tsx
    │       { message, content: base64(newContent), sha: originalSha,
    │         branch: "web-deploy/copy_edit/{timestamp}" }
    │  6. GitHub: POST /repos/.../pulls
    │       { title, body: prDescription, head: branch, base: "main" }
    │  7. DB: toolRun.status → 'completed', toolRun.output → { prUrl, prNumber }
    │  Returns: { prUrl: "https://github.com/.../pull/42", prNumber: 42 }
    │
    ▼
[Agent] "Done! PR #42 is open:
    │   https://github.com/vaja-ai/website/pull/42
    │   Vercel will post a preview URL on the PR shortly."
    │
    ▼
[GitHub] Vercel bot comments on PR:
    │  "✅ Preview deployed at https://vaja-ai-git-web-deploy-xyz.vercel.app"
    │
    ▼
[User] Opens preview URL → reviews change on live preview site
    │
    ▼
[User] Merges PR on GitHub → Vercel deploys to production
```

---

## Flow 2 — Page Clone

**Actor:** Authorized editor

```
[Chat] User: "Create a /use-cases/healthcare page like the /features
    │         page but about healthcare workers"
    │
    ▼
[Skill] web-publisher keyword detected → skill activates
    │  site-structure.md injected → agent knows /features maps to
    │  app/features/page.tsx
    │
    ▼
[Agent] Determines this is a page_clone
    │  Source: app/features/page.tsx
    │  Target: app/use-cases/healthcare/page.tsx (new file)
    │
    ▼
[Agent] Tool call: read_web_file("app/features/page.tsx")
    │
    ▼
[service.ts] read_web_file()
    │  GitHub Contents API: GET /repos/.../contents/app/features/page.tsx
    │  Returns: { content: "<features page code>", sha: "def456..." }
    │
    ▼
[Agent] Receives features page as layout template
    │  Generates new page content:
    │    - Replaces all features-specific copy with healthcare copy
    │    - Updates metadata: title, description, OG tags
    │    - Updates route references and internal links
    │    - Adapts section headings and body text for healthcare use case
    │    - Preserves component structure, imports, and styling
    │
    ▼
[Agent] Tool call: preview_web_change({
    │    changeType: "page_clone",
    │    targetPath: "app/use-cases/healthcare/page.tsx",
    │    originalSha: undefined,   ← no SHA: this is a new file
    │    newContent: "<healthcare page code>",
    │    prTitle: "Add /use-cases/healthcare page",
    │    prDescription: "New page cloned from /features, adapted for healthcare workers",
    │    summary: "New page at /use-cases/healthcare (cloned from /features layout)"
    │  })
    │
    ▼
[service.ts] preview_web_change()
    │  Auth check passes
    │  toolRun inserted (status: 'pending')
    │  Returns: { toolRunId: "run_abc", changeType, targetPath, summary }
    │
    ▼
[Agent] "Here's what will be created:
    │   • New file: app/use-cases/healthcare/page.tsx
    │   • Route: /use-cases/healthcare
    │   • Cloned from: /features page layout
    │   • Content adapted for: healthcare workers
    │
    │   Ready to open the PR?"
    │
    ▼
[User] "Yes, go ahead"
    │
    ▼
[Agent] Tool call: confirm_web_change("run_abc")
    │
    ▼
[service.ts] confirm_web_change()
    │  Branch: web-deploy/page_clone/{timestamp}
    │  PUT /repos/.../contents/app/use-cases/healthcare/page.tsx
    │    { message: "Add /use-cases/healthcare page",
    │      content: base64(newContent) }
    │    ← No sha field: GitHub Creates the file (does not update)
    │  PR opened with description:
    │    "Cloned from /features page, adapted for healthcare use case"
    │  toolRun.status → 'completed'
    │
    ▼
[Agent] "PR #43 is open:
    │   https://github.com/vaja-ai/website/pull/43
    │   Preview will be live shortly via Vercel."
    │
    ▼
[User] Reviews new page on preview URL, merges → production live
```

---

## Flow 3 — Blog Post

**Actor:** Authorized editor, or site owner writing from chat

```
[Chat] User: "Write a blog post: How Vaja AI helps Thai teachers
    │         save 2 hours a day"
    │
    ▼
[Skill] keyword detected → skill activates
    │  blog-template.md injected → agent knows MDX frontmatter schema,
    │  blog directory path (content/blog/), required fields
    │
    ▼
[Agent] This is a blog_post — no existing file to read
    │  Generates full MDX content following blog-template.md:
    │    - Suggests slug: vaja-ai-thai-teachers-time-saving
    │    - Generates frontmatter:
    │        title, description, date, author, tags, coverImage
    │    - Generates intro, 3-4 body sections with subheadings,
    │      a concrete example or story, and a closing CTA
    │    - Applies style-guide.md tone rules (warm, clear, Thai professional context)
    │
    ▼
[Agent] Tool call: preview_web_change({
    │    changeType: "blog_post",
    │    targetPath: "content/blog/vaja-ai-thai-teachers-time-saving.mdx",
    │    originalSha: undefined,   ← new file
    │    newContent: "<full MDX content>",
    │    prTitle: "Blog: How Vaja AI helps Thai teachers save 2 hours a day",
    │    prDescription: "New blog post about teacher time savings. ~800 words.",
    │    summary: "New post at /blog/vaja-ai-thai-teachers-time-saving"
    │  })
    │
    ▼
[service.ts] toolRun inserted (status: 'pending')
    │  Returns: { toolRunId: "run_bcd" }
    │
    ▼
[Agent] "Here's the preview:
    │   • Path: /blog/vaja-ai-thai-teachers-time-saving
    │   • Title: 'How Vaja AI helps Thai teachers save 2 hours a day'
    │   • ~800 words, 4 sections, Thai education focus
    │   • Tags: education, productivity, thai-teachers
    │
    │   [Shows first 2-3 paragraphs as preview]
    │
    │   Ready to publish, or would you like any changes?"
    │
    ▼
[User] "Can you make the intro more engaging? Start with a story."
    │
    ▼
[Agent] Rewrites the intro section with an opening story/anecdote
    │  Calls preview_web_change again with updated content
    │    → new toolRunId "run_cde" (old run_bcd stays pending, harmless)
    │
    ▼
[Agent] Shows updated preview of intro paragraph
    │
    ▼
[User] "Perfect, publish it"
    │
    ▼
[Agent] Tool call: confirm_web_change("run_cde")
    │
    ▼
[service.ts] confirm_web_change()
    │  Branch: web-deploy/blog_post/{timestamp}
    │  PUT /repos/.../contents/content/blog/vaja-ai-thai-teachers-time-saving.mdx
    │  PR opened
    │  toolRun "run_cde" → status: 'completed', output: { prUrl, prNumber }
    │  toolRun "run_bcd" stays pending (superseded, auto-ignored)
    │
    ▼
[Agent] "PR #44 is open:
    │   https://github.com/vaja-ai/website/pull/44
    │   Once merged, the post will go live at /blog/vaja-ai-thai-teachers-time-saving"
    │
    ▼
[Vercel] Preview URL posted on PR — user reads full post in context
    │
    ▼
[User] Merges PR → blog post is live in production
```

---

## Flow 4 — Access Denied (Edge Case)

**Actor:** Unauthorized user (email not in DEPLOY_ALLOWED_EMAILS)

```
[Chat] Unauthorized user: "Update the about page headline"
    │
    ▼
[Skill] Activates based on keyword
    │
    ▼
[Agent] Tool call: read_web_file("app/about/page.tsx")
    │  (or preview_web_change / confirm_web_change)
    │
    ▼
[service.ts] Authorization check
    │  user.email not in DEPLOY_ALLOWED_EMAILS
    │  not in ADMIN_EMAILS
    │  Throws: "Deploy access denied. Ask an admin to add your email
    │           to DEPLOY_ALLOWED_EMAILS."
    │
    ▼
[Agent] Relays the error clearly:
    │  "I'm not able to make site changes for your account. To get
    │   access, ask an admin to add dcatcherex@gmail.com to the
    │   DEPLOY_ALLOWED_EMAILS environment variable."
    │
    ▼
[No DB write, no GitHub call] — request ends here
```

---

## Flow 5 — File Not Found (Edge Case)

**Actor:** Authorized editor requesting an incorrect path

```
[Chat] User: "Edit the pricing page copy"
    │
    ▼
[Agent] Tool call: read_web_file("app/pricing/page.tsx")
    │
    ▼
[service.ts] read_web_file()
    │  GitHub Contents API returns 404
    │  Returns: { exists: false, path: "app/pricing/page.tsx" }
    │
    ▼
[Agent] "I couldn't find a file at app/pricing/page.tsx in the repo.
    │
    │   Here are some options:
    │   • If the pricing page is at a different path, let me know the
    │     correct location (check site-structure.md for known routes)
    │   • If you want to create a new pricing page, I can do that as
    │     a page_clone from an existing page
    │
    │   What would you like to do?"
    │
    ▼
[User] "The file is at app/(marketing)/pricing/page.tsx"
    │
    ▼
[Agent] Tool call: read_web_file("app/(marketing)/pricing/page.tsx")
    │  → found, flow continues as normal copy_edit
```

---

## Flow 6 — Revision Before Confirming (Common Variation)

**Actor:** Authorized editor who wants to iterate before creating the PR

```
[Agent] Shows preview summary after preview_web_change()
    │  toolRunId: "run_xyz" (status: pending)
    │
    ▼
[User] "Actually, change the CTA button text to 'Start for free' and
    │   make the tone warmer overall"
    │
    ▼
[Agent] Does not call confirm_web_change on the current version
    │  Generates revised content incorporating both changes
    │
    ▼
[Agent] Tool call: preview_web_change({
    │    ...same params but newContent is the revised version,
    │    summary: "Homepage hero headline + CTA updated, warmer tone"
    │  })
    │
    ▼
[service.ts] New toolRun inserted → toolRunId: "run_xyz2" (status: pending)
    │  Old "run_xyz" remains pending in DB — harmless, never confirmed
    │
    ▼
[Agent] Shows updated preview:
    │  "Updated version:
    │   • Headline: 'AI for every Thai professional'
    │   • CTA: 'Start for free'
    │   • Tone: warmer throughout
    │
    │   Shall I create the PR now?"
    │
    ▼
[User] "Yes, perfect"
    │
    ▼
[Agent] Tool call: confirm_web_change("run_xyz2")
    │  → branch → commit → PR opened
    │  run_xyz2 → status: 'completed'
    │  run_xyz stays pending (stale, ignored)
```

---

## Flow 7 — Deploy History (Sidebar Tool Page)

**Actor:** Any team member checking publish history

```
[User] Opens sidebar → Tools → Web Publisher
    │  Route: /tools/web-deploy
    │
    ▼
[UI] deploy-tool-page.tsx mounts
    │  Calls: GET /api/deploy/history
    │  Query: toolRun rows where toolSlug = 'web-deploy',
    │         ordered by createdAt DESC
    │
    ▼
[UI] Renders history list — each row shows:
    │
    │  ┌──────────────────────────────────────────────────────────────┐
    │  │ [📝] copy_edit    app/page.tsx                              │
    │  │      Homepage hero headline updated          Apr 16, 2026   │
    │  │      ● Published                            [PR #42 ↗]     │
    │  ├──────────────────────────────────────────────────────────────┤
    │  │ [📄] page_clone   app/use-cases/healthcare/page.tsx         │
    │  │      New page at /use-cases/healthcare       Apr 16, 2026   │
    │  │      ● Published                            [PR #43 ↗]     │
    │  ├──────────────────────────────────────────────────────────────┤
    │  │ [✍️] blog_post    content/blog/vaja-ai-thai-teachers...mdx  │
    │  │      New post: How Vaja AI helps Thai...     Apr 16, 2026   │
    │  │      ⏳ Awaiting confirm                     (no PR yet)    │
    │  └──────────────────────────────────────────────────────────────┘
    │
    ▼
Status badges:
    │  pending   → "⏳ Awaiting confirm"   (no PR link shown)
    │  completed → "● Published"           (PR link shown)
    │  failed    → "✗ Failed"             (error shown, no PR link)
    │
    ▼
[User] Clicks "PR #42 ↗" → opens GitHub pull request in new tab
```

---

## Future Flow — Via LINE OA

When LINE approval flows land (Phase 3):

```
[LINE OA] Colleague sends message to Web Publisher agent via LINE:
    │  "Edit the homepage headline to say 'AI ที่เข้าใจคนทำงานไทย'"
    │
    ▼
[Webhook] handleMessageEvent
    │  Agent has enabledTools: ['web_deploy']
    │  Skill activates in LINE context
    │
    ▼
[Agent] Same tool flow: read_web_file → generate → preview_web_change
    │
    ▼
[LINE] Bot sends Flex Message with change summary:
    │  ┌────────────────────────────────────────┐
    │  │ 📝 Proposed Change                    │
    │  │                                        │
    │  │ File: app/page.tsx                    │
    │  │ Homepage hero headline updated         │
    │  │ PR title: "Update homepage headline"   │
    │  │                                        │
    │  │      [✅ Confirm]  [❌ Cancel]         │
    │  └────────────────────────────────────────┘
    │
    ▼
[LINE] Colleague taps "✅ Confirm"
    │  Postback: "web_deploy_confirm:{toolRunId}"
    │
    ▼
[Webhook] handlePostbackEvent
    │  Calls confirm_web_change(toolRunId)
    │
    ▼
[LINE] Bot replies:
    │  "PR #45 created:
    │   https://github.com/vaja-ai/website/pull/45
    │   Vercel preview will be ready shortly."
```

---

## Edge Cases Summary

| Scenario | Where it fails | What happens |
|---|---|---|
| Unauthorized email | service.ts auth check | Error relayed by agent — no GitHub call made |
| File not found (404) | read_web_file() | Agent asks for correct path or offers to create |
| Stale SHA (file changed on main since read) | GitHub PUT returns 409 | service.ts throws conflict error → agent asks user to retry |
| confirm_web_change on already-completed run | toolRun.status check | Error: "This change was already submitted (PR #X)" |
| confirm_web_change on non-existent toolRunId | DB lookup | Error: "Change preview not found" |
| GitHub token missing or expired | GitHub API 401 | service.ts throws config error → agent tells user to contact admin |
| Branch name collision (rare) | GitHub API 422 | service.ts appends random suffix and retries once |

---

## Data Model Quick Reference

The Web Publisher feature uses the existing `toolRun` table from `db/schema/tools.ts`.

| Field | Type | Usage |
|---|---|---|
| `id` | text (nanoid) | `toolRunId` returned by preview_web_change, passed to confirm_web_change |
| `toolSlug` | text | Always `'web-deploy'` for this feature |
| `userId` | text | The authorized user who initiated the change |
| `status` | enum | `'pending'` after preview, `'completed'` after PR created, `'failed'` on error |
| `input` | jsonb | `{ changeType, targetPath, originalSha?, newContent, prTitle, prDescription, summary }` |
| `output` | jsonb | `{ prUrl, prNumber }` — set on completion |
| `createdAt` | timestamp | Used for history ordering and branch timestamp component |

### Change Type Reference

| `changeType` | `originalSha` | GitHub operation | File must exist? |
|---|---|---|---|
| `copy_edit` | Required (current SHA) | PUT with SHA → updates existing file | Yes |
| `page_clone` | Omitted | PUT without SHA → creates new file | No (new file) |
| `blog_post` | Omitted | PUT without SHA → creates new file | No (new file) |

### Key Files

| File | Purpose |
|---|---|
| `features/deploy/manifest.ts` | Tool id, slug (`web-deploy`), title, icon, category |
| `features/deploy/schema.ts` | Zod schemas for all three tool inputs/outputs |
| `features/deploy/service.ts` | `readWebFile()`, `previewWebChange()`, `confirmWebChange()` — all business logic |
| `features/deploy/agent.ts` | Thin `tool()` wrappers: `read_web_file`, `preview_web_change`, `confirm_web_change` |
| `features/deploy/types.ts` | `ChangeType`, `WebFileResult`, `PreviewResult`, `ConfirmResult` |
| `features/deploy/skill/SKILL.md` | Skill definition with keyword triggers and agent instructions |
| `features/deploy/skill/references/site-structure.md` | Route → file path map (edit to match real site) |
| `features/deploy/skill/references/blog-template.md` | MDX frontmatter schema and blog post format |
| `features/deploy/skill/references/style-guide.md` | Brand voice, tone, naming rules |
| `features/deploy/components/deploy-tool-page.tsx` | /tools/web-deploy history page component |
| `app/api/deploy/history/route.ts` | GET handler: returns toolRun rows for web-deploy |
