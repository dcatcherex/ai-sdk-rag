import { z } from 'zod'

export const readWebFileInputSchema = z.object({
  path: z
    .string()
    .describe(
      'File path relative to repo root. e.g. "app/page.tsx" or "content/blog/my-post.mdx". Use forward slashes.',
    ),
})

export const previewWebChangeInputSchema = z.object({
  changeType: z
    .enum(['copy_edit', 'page_clone', 'blog_post'])
    .describe(
      'copy_edit: modifying existing file content. page_clone: new page based on existing layout. blog_post: new blog post MDX file.',
    ),
  targetPath: z
    .string()
    .describe(
      'Target file path relative to repo root. For blog posts use content/blog/{slug}.mdx. For page clones use app/{route}/page.tsx.',
    ),
  originalSha: z
    .string()
    .optional()
    .describe(
      'GitHub blob SHA of the file being edited. Required for copy_edit. Omit for page_clone and blog_post (new files).',
    ),
  newContent: z.string().describe('Full new file content to write. Must be complete and valid.'),
  prTitle: z.string().max(120).describe('Pull request title. Be specific, e.g. "Update homepage hero copy"'),
  prDescription: z
    .string()
    .describe(
      'Pull request description. Explain what changed and why. Will be visible in GitHub.',
    ),
  summary: z
    .string()
    .max(200)
    .describe('One-sentence summary shown in the deploy history log.'),
})

export const confirmWebChangeInputSchema = z.object({
  toolRunId: z
    .string()
    .describe('The toolRunId returned by preview_web_change. Do not guess — use the exact ID.'),
})

export type ReadWebFileInput = z.infer<typeof readWebFileInputSchema>
export type PreviewWebChangeInput = z.infer<typeof previewWebChangeInputSchema>
export type ConfirmWebChangeInput = z.infer<typeof confirmWebChangeInputSchema>
