/**
 * Web Publisher service — canonical business logic.
 * All GitHub API operations and deploy persistence live here.
 * Agent adapter (agent.ts) and API routes call these functions.
 */

import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toolRun } from '@/db/schema/tools'
import { user } from '@/db/schema/auth'
import { isAdminEmail } from '@/lib/admin'
import type { ReadWebFileInput, PreviewWebChangeInput, ConfirmWebChangeInput } from './schema'
import type { DeployPreviewData, DeployResultData, DeployRunOutput } from './types'

// ── Authorization ─────────────────────────────────────────────────────────────

function isDeployAllowed(email: string): boolean {
  if (isAdminEmail(email)) return true
  return (process.env.DEPLOY_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
    .includes(email)
}

async function getUserEmail(userId: string): Promise<string> {
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  if (!rows[0]) throw new Error('User not found')
  return rows[0].email
}

async function assertDeployAccess(userId: string): Promise<void> {
  const email = await getUserEmail(userId)
  if (!isDeployAllowed(email)) {
    throw new Error(
      'Deploy access denied. Ask an admin to add your email to DEPLOY_ALLOWED_EMAILS.',
    )
  }
}

// ── GitHub API ────────────────────────────────────────────────────────────────

function getRepoConfig() {
  const owner = process.env.GITHUB_OWNER
  const repo = process.env.GITHUB_REPO
  const token = process.env.GITHUB_TOKEN
  const base = process.env.GITHUB_DEFAULT_BRANCH ?? 'main'
  if (!owner || !repo || !token) {
    throw new Error('GITHUB_OWNER, GITHUB_REPO, and GITHUB_TOKEN must be set in environment.')
  }
  return { owner, repo, token, base, repoPath: `/repos/${owner}/${repo}` }
}

async function githubRequest(path: string, options?: RequestInit): Promise<Response> {
  const { token } = getRepoConfig()
  return fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
}

export async function readGitHubFile(
  filePath: string,
): Promise<{ content: string; sha: string } | null> {
  const { repoPath, base } = getRepoConfig()
  const res = await githubRequest(`${repoPath}/contents/${filePath}?ref=${base}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub API error ${res.status} reading ${filePath}`)
  const data = (await res.json()) as { content: string; sha: string; type: string }
  if (data.type !== 'file') throw new Error(`${filePath} is a directory, not a file`)
  const content = Buffer.from(data.content, 'base64').toString('utf-8')
  return { content, sha: data.sha }
}

async function getBaseBranchSha(): Promise<string> {
  const { repoPath, base } = getRepoConfig()
  const res = await githubRequest(`${repoPath}/git/ref/heads/${base}`)
  if (!res.ok) throw new Error(`Failed to get branch SHA for ${base}: ${res.status}`)
  const data = (await res.json()) as { object: { sha: string } }
  return data.object.sha
}

async function createBranch(branchName: string, fromSha: string): Promise<void> {
  const { repoPath } = getRepoConfig()
  const res = await githubRequest(`${repoPath}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: fromSha }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create branch ${branchName}: ${res.status} ${err}`)
  }
}

async function commitFile(
  branchName: string,
  filePath: string,
  content: string,
  message: string,
  sha?: string,
): Promise<void> {
  const { repoPath } = getRepoConfig()
  const encoded = Buffer.from(content).toString('base64')
  const body: Record<string, unknown> = { message, content: encoded, branch: branchName }
  if (sha) body.sha = sha
  const res = await githubRequest(`${repoPath}/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to commit ${filePath}: ${res.status} ${err}`)
  }
}

async function createPullRequest(
  branchName: string,
  title: string,
  body: string,
): Promise<{ url: string; number: number }> {
  const { repoPath, base } = getRepoConfig()
  const res = await githubRequest(`${repoPath}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, body, head: branchName, base }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create PR: ${res.status} ${err}`)
  }
  const data = (await res.json()) as { html_url: string; number: number }
  return { url: data.html_url, number: data.number }
}

// ── Public run functions ──────────────────────────────────────────────────────

export async function runReadWebFile(
  input: ReadWebFileInput,
  ctx: { userId: string },
) {
  await assertDeployAccess(ctx.userId)
  const file = await readGitHubFile(input.path)
  if (!file) {
    return { exists: false as const, content: null, sha: null, path: input.path }
  }
  return { exists: true as const, content: file.content, sha: file.sha, path: input.path }
}

export async function runPreviewWebChange(
  input: PreviewWebChangeInput,
  ctx: { userId: string; threadId?: string },
): Promise<{ toolRunId: string; preview: DeployPreviewData }> {
  await assertDeployAccess(ctx.userId)

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14)
  const branchName = `web-deploy/${input.changeType}/${timestamp}`

  // For edits, fetch the current content so the diff is available in history
  let originalContent: string | null = null
  if (input.originalSha) {
    const existing = await readGitHubFile(input.targetPath)
    if (existing) originalContent = existing.content
  }

  const preview: DeployPreviewData = {
    changeType: input.changeType,
    targetPath: input.targetPath,
    originalContent,
    originalSha: input.originalSha ?? null,
    newContent: input.newContent,
    summary: input.summary,
    prTitle: input.prTitle,
    prDescription: input.prDescription,
    branchName,
  }

  const id = crypto.randomUUID()
  await db.insert(toolRun).values({
    id,
    toolSlug: 'web-deploy',
    userId: ctx.userId,
    threadId: ctx.threadId ?? null,
    source: 'agent',
    inputJson: input as Record<string, unknown>,
    outputJson: { status: 'preview', ...preview } as Record<string, unknown>,
    status: 'pending',
  })

  return { toolRunId: id, preview }
}

export async function runConfirmWebChange(
  input: ConfirmWebChangeInput,
  ctx: { userId: string },
): Promise<DeployResultData> {
  await assertDeployAccess(ctx.userId)

  const rows = await db
    .select()
    .from(toolRun)
    .where(and(eq(toolRun.id, input.toolRunId), eq(toolRun.userId, ctx.userId)))
    .limit(1)

  if (!rows[0]) throw new Error('Deploy preview not found or does not belong to you')
  if (rows[0].status !== 'pending') {
    throw new Error(`Deploy already processed (status: ${rows[0].status})`)
  }

  const preview = rows[0].outputJson as DeployRunOutput & DeployPreviewData

  // Create branch → commit file → open PR
  const mainSha = await getBaseBranchSha()
  await createBranch(preview.branchName, mainSha)
  await commitFile(
    preview.branchName,
    preview.targetPath,
    preview.newContent,
    preview.prTitle,
    preview.originalSha ?? undefined,
  )
  const pr = await createPullRequest(preview.branchName, preview.prTitle, preview.prDescription)

  const result: DeployResultData = {
    prUrl: pr.url,
    prNumber: pr.number,
    branchName: preview.branchName,
  }

  await db
    .update(toolRun)
    .set({
      status: 'completed',
      outputJson: { ...preview, status: 'completed', ...result } as Record<string, unknown>,
      completedAt: new Date(),
    })
    .where(eq(toolRun.id, input.toolRunId))

  return result
}

// ── History ───────────────────────────────────────────────────────────────────

export async function getDeployHistory(userId: string) {
  return db
    .select()
    .from(toolRun)
    .where(and(eq(toolRun.userId, userId), eq(toolRun.toolSlug, 'web-deploy')))
    .orderBy(desc(toolRun.createdAt))
    .limit(50)
}
