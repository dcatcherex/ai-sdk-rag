# Web Publisher — Developer & AI Coder Guide

This guide covers the architecture, key files, extension patterns, and maintenance notes for the Web Publisher feature — a chat-to-deploy pipeline that lets authorized colleagues edit website copy, clone pages, and publish blog posts via Vaja AI chat, with automatic GitHub PR creation.

Read this before modifying any deploy tool, service function, authorization check, or GitHub API call.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Directory Map](#2-directory-map)
3. [Database Schema Reference](#3-database-schema-reference)
4. [Authorization System](#4-authorization-system)
5. [GitHub API Layer](#5-github-api-layer)
6. [The Three Tools](#6-the-three-tools)
7. [Skill System](#7-skill-system)
8. [The Three Change Types](#8-the-three-change-types)
9. [Adding a New Change Type](#9-adding-a-new-change-type)
10. [Common Mistakes & Gotchas](#10-common-mistakes--gotchas)
11. [Environment Variables](#11-environment-variables)
12. [Adding a New Authorized User](#12-adding-a-new-authorized-user)
13. [Extending the Tool (Future Ideas)](#13-extending-the-tool-future-ideas)
14. [Migration Workflow](#14-migration-workflow)

---

## 1. Architecture Overview

### Chat-to-Deploy Pipeline

```
Chat message (authorized user)
    │
    ▼
app/api/chat/route.ts — buildToolSet() loads web_deploy tools
    │  (assertDeployAccess() called inside each tool execute)
    │
    ▼
AI agent (with web-publisher skill active)
    │
    ├── read_web_file()        → GitHub Contents API GET
    │                            returns: { exists, content, sha, path }
    │
    ├── preview_web_change()   → DB: insert toolRun (status: 'pending')
    │                            returns: { toolRunId, preview: DeployPreviewData }
    │                            ← agent MUST show summary and wait for user confirmation
    │
    └── confirm_web_change()   → GitHub: getBaseBranchSha → createBranch → commitFile → createPullRequest
                                 DB: update toolRun (status: 'completed', outputJson += prUrl + prNumber)
                                 returns: { prUrl, prNumber, branchName }
```

### Tool Page (Sidebar History)

```
/tools/web-deploy → app/(main)/tools/[toolSlug]/page.tsx
    │
    ▼
features/tools/registry/page-loaders.ts → DeployToolPage
    │
    ▼
features/deploy/components/deploy-tool-page.tsx
    │  (client component — fetches history on mount)
    │
    ▼
GET /api/deploy/history → getDeployHistory(userId)
    └── db.select().from(toolRun).where(
            and(eq(toolRun.userId, userId), eq(toolRun.toolSlug, 'web-deploy'))
        ).orderBy(desc(toolRun.createdAt))
```

---

## 2. Directory Map

```
features/deploy/
├── types.ts                  ← ChangeType, DeployPreviewData, DeployResultData,
│                                DeployRunOutput, DeployHistoryItem
├── schema.ts                 ← Zod: readWebFileInputSchema,
│                                previewWebChangeInputSchema,
│                                confirmWebChangeInputSchema
├── service.ts                ← All business logic:
│                                GitHub API (readGitHubFile, getBaseBranchSha,
│                                  createBranch, commitFile, createPullRequest)
│                                DB persistence (insert/update toolRun)
│                                Authorization (isDeployAllowed, assertDeployAccess)
│                                Public run functions: runReadWebFile,
│                                  runPreviewWebChange, runConfirmWebChange
├── agent.ts                  ← createWebDeployAgentTools()
│                                thin tool() wrappers calling runXxx() from service.ts
├── manifest.ts               ← webDeployManifest
│                                (id: 'web_deploy', slug: 'web-deploy',
│                                 category: 'developer', access.roles: ['admin'])
├── skill/
│   ├── SKILL.md              ← Agent instructions (import via Skills UI or GitHub)
│   └── references/
│       ├── site-structure.md ← Editable: page inventory + file paths relative to repo root
│       ├── blog-template.md  ← Editable: MDX frontmatter format + structure rules
│       └── style-guide.md    ← Editable: brand voice, do/don't, length guidelines
└── components/
    └── deploy-tool-page.tsx  ← History pane (client component)
                                 fetches GET /api/deploy/history
                                 shows: changeType, targetPath, status, prUrl, diff summary

app/api/deploy/
└── history/route.ts          ← GET: returns user's deploy toolRuns
                                 auth required, userId scoped
```

**Key pattern — file ownership:**
```
service.ts    ← all GitHub API calls, all DB writes, all auth checks
agent.ts      ← only tool() wrappers — no logic here
```

Never add GitHub API calls or DB writes to `agent.ts`. Never import `service.ts` in client components.

---

## 3. Database Schema Reference

The Web Publisher feature uses the **existing `toolRun` table** from `db/schema/tools.ts`. No new tables and no migrations are required.

### toolRun Columns Used

| Column | Value for deploy runs |
|---|---|
| `toolSlug` | `'web-deploy'` |
| `source` | `'agent'` |
| `status` | `'pending'` → `'completed'` (or `'failed'`) |
| `inputJson` | The `PreviewWebChangeInput` payload |
| `outputJson` | `DeployRunOutput` — contains full preview data; adds PR info on completion |
| `completedAt` | Set when PR is created successfully |

### DeployRunOutput Shape

```typescript
// Status: 'preview' — written by preview_web_change (toolRun.status = 'pending')
type DeployRunOutputPending = {
  status: 'preview';
  changeType: ChangeType;
  targetPath: string;
  originalContent: string | null;  // null for new files (blog_post, page_clone)
  originalSha: string | null;      // null for new files — required by GitHub for updates
  newContent: string;
  summary: string;                 // human-readable description shown to user pre-confirm
  prTitle: string;
  prDescription: string;
  branchName: string;              // 'web-deploy/{changeType}/{timestamp}'
};

// Status: 'completed' — written by confirm_web_change (toolRun.status = 'completed')
type DeployRunOutputCompleted = DeployRunOutputPending & {
  status: 'completed';
  prUrl: string;
  prNumber: number;
};
```

### DeployHistoryItem Shape

```typescript
// Returned by GET /api/deploy/history — assembled in the API route from toolRun rows
type DeployHistoryItem = {
  id: string;
  changeType: ChangeType;
  targetPath: string;
  summary: string;
  status: 'pending' | 'completed' | 'failed';
  prUrl: string | null;
  prNumber: number | null;
  createdAt: string;
  completedAt: string | null;
};
```

---

## 4. Authorization System

### Two-Level Authorization Check

```typescript
// lib/admin.ts — already exists in the codebase
export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(s => s.trim());
  return adminEmails.includes(email);
}

// features/deploy/service.ts
export function isDeployAllowed(email: string): boolean {
  // Admins always have access
  if (isAdminEmail(email)) return true;
  // Check the deploy-specific allowlist
  const allowed = (process.env.DEPLOY_ALLOWED_EMAILS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return allowed.includes(email);
}

export async function assertDeployAccess(userId: string): Promise<void> {
  const [userRow] = await db.select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!userRow || !isDeployAllowed(userRow.email)) {
    throw new Error('Access denied: your account is not authorized to publish web changes.');
  }
}
```

**Key pattern — authorization:**
```typescript
// Always the first line in every public run function in service.ts
export async function runReadWebFile(ctx: DeployContext, input: ReadWebFileInput) {
  await assertDeployAccess(ctx.userId);   // ← first, before any other work
  // ...
}
```

This applies to all three run functions: `runReadWebFile`, `runPreviewWebChange`, `runConfirmWebChange`.

### Manifest Access Hint

`webDeployManifest` sets `access: { roles: ['admin'] }` as a display hint so the sidebar and agent builder UI can show a lock icon. This is a UI convention only. **Authorization is always enforced in `service.ts` — never rely on the manifest alone.**

---

## 5. GitHub API Layer

All GitHub operations live in `service.ts` and use native `fetch`. No Octokit dependency. Every call reads `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO` from environment variables.

### The Five Operations

**1. `readGitHubFile(path: string)`**

```typescript
// GET /repos/{owner}/{repo}/contents/{path}?ref={baseBranch}
// Returns decoded content (base64 → utf-8 string) and the file's current SHA
async function readGitHubFile(path: string): Promise<{ exists: boolean; content: string; sha: string } | { exists: false }> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${baseBranch}`,
    { headers: githubHeaders() }
  );
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const data = await res.json();
  return {
    exists: true,
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
  };
}
```

**2. `getBaseBranchSha()`**

```typescript
// GET /repos/{owner}/{repo}/git/ref/heads/{baseBranch}
// Returns the current tip SHA of the base branch (needed to create a new branch)
```

**3. `createBranch(name: string, sha: string)`**

```typescript
// POST /repos/{owner}/{repo}/git/refs
// Body: { ref: 'refs/heads/{name}', sha }
// Throws 422 if branch already exists
```

**4. `commitFile(branch: string, path: string, content: string, message: string, sha?: string)`**

```typescript
// PUT /repos/{owner}/{repo}/contents/{path}
// Body: { message, content: base64(content), branch, sha? }
// sha is REQUIRED when updating an existing file — omit only for new files
```

**5. `createPullRequest(branch: string, title: string, body: string)`**

```typescript
// POST /repos/{owner}/{repo}/pulls
// Body: { title, body, head: branch, base: baseBranch }
// Returns: { html_url, number }
```

### Branch Naming

```typescript
// Pattern: web-deploy/{changeType}/{YYYYMMDDHHmmss}
// Examples:
//   web-deploy/copy_edit/20260416143022
//   web-deploy/blog_post/20260416151500
//   web-deploy/page_clone/20260416163045

function generateBranchName(changeType: ChangeType): string {
  const ts = new Date().toISOString().replace(/[-T:Z.]/g, '').slice(0, 14);
  return `web-deploy/${changeType}/${ts}`;
}
```

The timestamp is generated inside `runPreviewWebChange` and stored in `outputJson.branchName`. `runConfirmWebChange` reads it back — it never generates a new branch name.

### SHA Flow

```
read_web_file
    └── returns sha (e.g. "abc123")
            │
preview_web_change (copy_edit)
    └── stores sha in outputJson.originalSha
            │
confirm_web_change
    └── reads originalSha from toolRun.outputJson
    └── passes sha to commitFile() → GitHub accepts the update
```

For `blog_post` and `page_clone` (new files), `originalSha` is `null` and `commitFile` is called without it.

---

## 6. The Three Tools

### `read_web_file`

**Purpose:** Fetch the current content of a file from the GitHub repo so the agent can read it before making changes.

**Input schema:**
```typescript
const readWebFileInputSchema = z.object({
  path: z.string().describe('File path relative to repo root. E.g. "src/app/about/page.tsx"'),
});
```

**Returns:**
```typescript
// File found
{ exists: true; content: string; sha: string; path: string }
// File not found
{ exists: false; path: string }
```

**When to call:**
- Before `copy_edit`: to see current content and get the SHA needed to update the file
- Before `page_clone`: to read the source page as a template
- NOT needed for `blog_post` — the file does not yet exist

**Key pattern:**
```typescript
// agent.ts
read_web_file: tool({
  description: 'Read the current content of a file in the website repository. Call before editing existing pages to get current content and SHA.',
  inputSchema: readWebFileInputSchema,
  execute: async (input, { userId }) => {
    return runReadWebFile({ userId }, input);
  },
}),
```

---

### `preview_web_change`

**Purpose:** Stage a proposed change. Persists to DB as a pending toolRun and returns a preview the agent shows to the user for confirmation.

**Input schema:**
```typescript
const previewWebChangeInputSchema = z.object({
  changeType: z.enum(['copy_edit', 'page_clone', 'blog_post']),
  targetPath: z.string().describe('Destination file path relative to repo root'),
  originalSha: z.string().optional().describe('SHA from read_web_file. Required for copy_edit.'),
  newContent: z.string().describe('Full file content to write'),
  prTitle: z.string().describe('Pull request title'),
  prDescription: z.string().describe('Pull request body with change description'),
  summary: z.string().describe('One-paragraph human-readable summary of what will change'),
});
```

**Returns:**
```typescript
{ toolRunId: string; preview: DeployPreviewData }
```

**Behavior:**
- For `copy_edit`: re-fetches the file via `readGitHubFile` to populate `originalContent` in `outputJson` (enables diff display in history)
- Generates `branchName` from current timestamp
- Inserts a `toolRun` row with `status: 'pending'`
- Does NOT touch GitHub — no branch, no commit, no PR

**Critical:** The agent description in `agent.ts` must say: **"After calling this tool, show the summary to the user and ask for explicit confirmation before proceeding. Do NOT call `confirm_web_change` until the user says yes."**

---

### `confirm_web_change`

**Purpose:** Execute the staged change — create a GitHub branch, commit the file, open a PR.

**Input schema:**
```typescript
const confirmWebChangeInputSchema = z.object({
  toolRunId: z.string().describe('The toolRunId returned by preview_web_change'),
});
```

**Returns:**
```typescript
{ prUrl: string; prNumber: number; branchName: string }
```

**Execution sequence:**
```
1. Load toolRun from DB (WHERE id = toolRunId AND userId = ctx.userId)
2. Validate: toolRun.status === 'pending' — reject if already completed or failed
3. Parse outputJson → DeployRunOutputPending
4. getBaseBranchSha() → sha
5. createBranch(outputJson.branchName, sha)
6. commitFile(branch, targetPath, newContent, prTitle, originalSha?)
7. createPullRequest(branch, prTitle, prDescription)
8. db.update(toolRun).set({ status: 'completed', outputJson: { ...outputJson, status: 'completed', prUrl, prNumber }, completedAt: new Date() })
9. return { prUrl, prNumber, branchName }
```

If any GitHub step throws, the toolRun is updated to `status: 'failed'` with the error message stored in `outputJson.error`.

---

## 7. Skill System

### The Web Publisher Skill

The skill at `features/deploy/skill/SKILL.md` is the agent's operating manual — it tells the AI when and how to use the three tools.

**It is not auto-loaded.** To activate it:
1. Go to the Skills page in Vaja AI
2. Create a new skill (paste SKILL.md content) or import from a GitHub URL
3. Attach the skill to a deploy agent
4. Ensure the agent's `enabledTools` includes `web_deploy`

### Skill Reference Files

The three files under `skill/references/` are injected as skill resources when the skill activates (up to 2 files per skill, matched by relevance to the user message):

| File | Purpose | Who edits it |
|---|---|---|
| `site-structure.md` | Page inventory: page names → file paths relative to repo root | Content team |
| `blog-template.md` | MDX frontmatter format, required fields, structure rules | Developer |
| `style-guide.md` | Brand voice, do/don't examples, length guidelines | Content team |

These files contain content guidance, not platform code. They are safe to edit without touching TypeScript.

**Key pattern — skill resource update:**
```
User says: "We renamed /services to /solutions"
    → Edit features/deploy/skill/references/site-structure.md
    → Update the skill in the Skills UI (or re-import from GitHub)
    → No code changes required
```

### SKILL.md Frontmatter

```yaml
---
name: web-publisher
description: >
  Activate when the user wants to edit website copy, clone a page, or publish a blog post.
  Provides tools to read files from the GitHub repo, preview changes, and create pull requests
  after explicit user confirmation.
---
```

---

## 8. The Three Change Types

### `copy_edit` — Edit Existing Page Copy

**Flow:**
```
1. Agent calls read_web_file({ path }) → gets content + sha
2. Agent generates new content with targeted edits
3. Agent calls preview_web_change({ changeType: 'copy_edit', targetPath: path,
       originalSha: sha, newContent, prTitle, prDescription, summary })
4. Agent shows summary to user → waits for "yes" / "confirm"
5. User confirms → agent calls confirm_web_change({ toolRunId })
6. PR created → agent shares prUrl
```

**Notes:**
- `originalSha` is mandatory — GitHub returns 422 if omitted when updating a file
- `originalContent` is stored in `outputJson` so the history pane can render a diff
- The targetPath is the same path returned by `read_web_file`

---

### `page_clone` — Clone an Existing Page as a New Page

**Flow:**
```
1. Agent calls read_web_file({ path: sourcePath }) → gets template content + sha
2. Agent generates new page content adapting layout to the new subject
   (removes page-specific imports if needed, updates metadata, rewrites sections)
3. Agent calls preview_web_change({ changeType: 'page_clone', targetPath: newPath,
       newContent, prTitle, prDescription, summary })
   ← NO originalSha (new file, not updating)
4. Agent shows summary → waits for confirmation
5. confirm_web_change → PR created
```

**Notes:**
- `targetPath` is the destination path (does not exist yet)
- `originalSha` is omitted — `commitFile` creates a new file
- The source SHA from `read_web_file` is used only for reading — it is not passed to preview

---

### `blog_post` — Publish a New Blog Post

**Flow:**
```
1. No read_web_file call needed (new file)
2. Agent generates full MDX following blog-template.md reference
3. Agent suggests a slug to the user → waits for confirmation or adjustment
4. Agent calls preview_web_change({ changeType: 'blog_post',
       targetPath: 'content/blog/{confirmed-slug}.mdx',
       newContent, prTitle, prDescription, summary })
5. Agent shows summary → waits for confirmation
6. confirm_web_change → PR created
```

**Notes:**
- `targetPath` is always under `content/blog/{slug}.mdx` (or the path defined in `site-structure.md`)
- `originalSha` is omitted — new file
- Agent should ask the user to confirm the slug before calling `preview_web_change`
- `blog-template.md` contains the required frontmatter fields (title, date, author, tags, excerpt, coverImage)

---

## 9. Adding a New Change Type

Follow these steps to add a new change type (e.g. `navigation_edit`):

### Step 1 — Add to ChangeType union

```typescript
// features/deploy/types.ts
export type ChangeType = 'copy_edit' | 'page_clone' | 'blog_post' | 'navigation_edit';
```

### Step 2 — Add to schema enum

```typescript
// features/deploy/schema.ts
export const previewWebChangeInputSchema = z.object({
  changeType: z.enum(['copy_edit', 'page_clone', 'blog_post', 'navigation_edit']),
  // ... rest of fields unchanged
});
```

### Step 3 — Update SKILL.md

Add a section explaining when and how the agent should use the new type. Include: when to call `read_web_file`, what `targetPath` to use, whether `originalSha` is required, and any domain-specific rules.

### Step 4 — Update or add a reference file

If the new type needs domain knowledge (e.g. `navigation-structure.md` listing the nav tree), add it to `features/deploy/skill/references/` and update the skill in the Skills UI.

### Step 5 — No service.ts changes required

The flow is fully generic: `read → generate → preview → confirm`. The `changeType` field is stored in `outputJson` for display in history but does not branch the execution logic.

---

## 10. Common Mistakes & Gotchas

### 1. Calling `confirm_web_change` Without User Confirmation

The agent may skip the confirmation step if the instruction is weak. Strengthen `SKILL.md`:

```markdown
<!-- SKILL.md -->
IMPORTANT: After calling preview_web_change, you MUST:
1. Show the user the summary field from the response
2. Explicitly ask: "Shall I go ahead and create the pull request?"
3. Wait for an affirmative reply
4. Only then call confirm_web_change

NEVER call confirm_web_change in the same turn as preview_web_change.
```

### 2. Missing `originalSha` on `copy_edit`

The GitHub Contents API returns HTTP 422 if you PUT an existing file without providing its current SHA. The SHA comes from `read_web_file` → `sha` field. Always pass it to `preview_web_change` as `originalSha` for `copy_edit` runs.

### 3. Using Absolute or OS-Specific Paths

The GitHub Contents API requires paths relative to the repository root, always with forward slashes. Never use leading slashes, absolute paths, or backslashes.

```typescript
// Wrong
path: '/src/app/about/page.tsx'
path: 'src\\app\\about\\page.tsx'

// Correct
path: 'src/app/about/page.tsx'
```

### 4. Branch Name Collision

Two rapid calls to `preview_web_change` in the same second produce the same branch name. The `createBranch` call in `confirm_web_change` will receive a GitHub 422 in this case. The error propagates as a tool result the agent can explain to the user ("A conflict occurred — please try again in a moment."). This is rare in practice because the two calls must land in the same second.

### 5. Editing a File That Has Moved

If `site-structure.md` lists a path that no longer exists in the repo, `read_web_file` returns `{ exists: false }`. The agent should report this and ask the user for the correct path. Update `site-structure.md` afterward to prevent recurrence — no code change needed.

### 6. Large Files (Over 1 MB)

The GitHub Contents API does not return `content` for files over 1 MB. `readGitHubFile` will receive an empty `content` field. Add a size guard:

```typescript
if (data.size > 1_000_000) {
  throw new Error(`File is ${data.size} bytes — too large for the Contents API (1 MB limit). Use the Git Data API for this file.`);
}
```

For large files, switch to the Git Data API (`/repos/{owner}/{repo}/git/blobs/{sha}`).

### 7. Insufficient `GITHUB_TOKEN` Scope

A read-only token (`contents: read`) fails at `createBranch` with HTTP 403. Required scopes:

- Classic PAT: `repo` (full repo access)
- Fine-grained PAT: `Contents: read and write` + `Pull requests: read and write`

### 8. Double-Confirm Guard

`confirm_web_change` checks `toolRun.status !== 'pending'` before proceeding. If the same `toolRunId` is submitted twice (e.g. user says "yes" twice), the second call returns an error message. This is intentional — PRs are not idempotent and a second create would fail at GitHub anyway.

```typescript
// service.ts
if (toolRunRow.status !== 'pending') {
  throw new Error(`This change has already been ${toolRunRow.status}. No action taken.`);
}
```

---

## 11. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | PAT with `repo` scope, or fine-grained PAT with Contents: write + Pull requests: write |
| `GITHUB_OWNER` | Yes | GitHub username or organization name (e.g. `acme-corp`) |
| `GITHUB_REPO` | Yes | Repository name without owner prefix (e.g. `company-website`) |
| `GITHUB_DEFAULT_BRANCH` | No | Base branch for PRs. Default: `main`. Change if your base branch is `master` or `develop` |
| `DEPLOY_ALLOWED_EMAILS` | No | Comma-separated editor emails (e.g. `alice@co.com,bob@co.com`). Admins from `ADMIN_EMAILS` always have access regardless of this value |

All five variables are read at runtime in `service.ts`. The feature fails fast with a descriptive error if `GITHUB_TOKEN`, `GITHUB_OWNER`, or `GITHUB_REPO` are missing.

---

## 12. Adding a New Authorized User

There are two options — neither requires a code change:

**Option A — Editor access only (recommended)**

Add their email to `DEPLOY_ALLOWED_EMAILS` in your environment and redeploy:

```bash
# .env.local (dev) or Vercel dashboard (production)
DEPLOY_ALLOWED_EMAILS=alice@co.com,bob@co.com,neweditor@co.com
```

**Option B — Full admin access**

Add their email to `ADMIN_EMAILS`. This also grants access to the admin dashboard and all other admin-gated features:

```bash
ADMIN_EMAILS=owner@co.com,neweditor@co.com
```

Use Option B only if the person genuinely needs admin access across the platform.

---

## 13. Extending the Tool (Future Ideas)

**Multi-file PR**

`preview_web_change` could accept an array of file changes instead of a single file. The schema change would add `files: z.array(fileChangeSchema)` and `service.ts` would call `commitFile` in a loop after creating the branch. The confirm flow stays the same.

**Revert PR**

A `revert_web_change` tool that reads a completed `toolRun` and creates a PR restoring `originalContent` at `targetPath`. It would use `originalContent` + `originalSha` (current file SHA after the original PR was merged) to create a revert commit. The `toolRunId` of the original run is the only input needed.

**LINE OA Approval**

When Phase 3 LINE approval flows land, the `preview_web_change` step can push a LINE Flex Message to the requester's linked account with **Confirm** and **Cancel** quick-reply buttons. The postback handler resolves it the same way approval requests work today — no chat reply needed.

**Scheduled Publishing**

Add a `publishAt: z.string().datetime().optional()` field to `previewWebChangeInputSchema`. Store it in `outputJson`. A cron job queries `toolRun` rows where `status = 'pending'` and `publishAt <= NOW()` and calls `runConfirmWebChange` for each. The agent mentions the scheduled time in the summary.

---

## 14. Migration Workflow

### No Migration Required

The Web Publisher feature uses the existing `toolRun` table from `db/schema/tools.ts`. No schema changes and no SQL migrations are needed to deploy this feature.

Verify the table exists:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'tool_run'
ORDER BY ordinal_position;
```

Expected columns: `id`, `user_id`, `tool_slug`, `source`, `status`, `input_json`, `output_json`, `created_at`, `completed_at`.

### If You Add New Columns

If a future extension requires new columns on `toolRun` (e.g. `publish_at`):

1. Update `db/schema/tools.ts` with the new column definition
2. Write a raw SQL migration file (do not use `drizzle-kit generate` — it conflicts with existing tables)

```bash
# db/migrations/0040_tool_run_publish_at.sql
ALTER TABLE tool_run ADD COLUMN publish_at TIMESTAMPTZ;
```

3. Apply with the standard migration script:

```bash
node --env-file=.env.local -e "
const postgres = require('postgres');
const fs = require('fs');
const sql = postgres(process.env.DATABASE_URL);
const migration = fs.readFileSync('./db/migrations/0040_tool_run_publish_at.sql', 'utf8');
sql.unsafe(migration)
  .then(() => { console.log('Applied'); sql.end(); })
  .catch(e => { console.error(e.message); sql.end(); });
"
```

4. Run `pnpm exec tsc --noEmit` to verify no type errors

### Naming Convention

```
db/migrations/
  0001_initial.sql
  0039_line_channel_analytics.sql
  0040_<next_feature>.sql          ← always use next sequential number
```
