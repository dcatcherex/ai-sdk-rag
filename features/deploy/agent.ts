/**
 * Thin AI SDK adapter for the Web Publisher tool.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai'
import type { AgentToolContext } from '@/features/tools/registry/types'
import {
  readWebFileInputSchema,
  previewWebChangeInputSchema,
  confirmWebChangeInputSchema,
} from './schema'
import { runReadWebFile, runPreviewWebChange, runConfirmWebChange } from './service'

export function createWebDeployAgentTools(
  ctx: Pick<AgentToolContext, 'userId' | 'threadId'>,
) {
  return {
    read_web_file: tool({
      description:
        'Read the current content of a file in the website repository. ' +
        'Call this before copy_edit (to see what to change) or page_clone (to use as template). ' +
        'Returns the file content and SHA needed for editing.',
      inputSchema: readWebFileInputSchema,
      async execute(input) {
        return runReadWebFile(input, { userId: ctx.userId })
      },
    }),

    preview_web_change: tool({
      description:
        'Propose a website change: edit existing copy, clone a page with new content, or write a new blog post. ' +
        'This stores the proposed change and returns a toolRunId. ' +
        'IMPORTANT: After calling this, show the summary to the user and ask for explicit confirmation before proceeding. ' +
        'Do NOT call confirm_web_change automatically.',
      inputSchema: previewWebChangeInputSchema,
      async execute(input) {
        return runPreviewWebChange(input, { userId: ctx.userId, threadId: ctx.threadId })
      },
    }),

    confirm_web_change: tool({
      description:
        'Create a GitHub pull request for a previously previewed change. ' +
        'Only call this AFTER the user has explicitly confirmed (said yes, approved, or confirmed). ' +
        'Uses the toolRunId from preview_web_change. Returns the PR URL.',
      inputSchema: confirmWebChangeInputSchema,
      async execute(input) {
        return runConfirmWebChange(input, { userId: ctx.userId })
      },
    }),
  }
}
