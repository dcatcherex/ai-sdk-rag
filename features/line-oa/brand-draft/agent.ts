import { tool } from 'ai';
import {
  addLineBrandStyleReferenceInputSchema,
  getLineBrandDraftInputSchema,
  removeLineBrandStyleReferenceInputSchema,
  saveLineBrandDraftFieldInputSchema,
} from './schema';
import {
  runAddLineBrandStyleReference,
  runGetLineBrandDraft,
  runRemoveLineBrandStyleReference,
  runSaveLineBrandDraftField,
} from './service';

export function createLineBrandDraftAgentTools(ctx: { lineUserId: string; channelId: string }) {
  const draftCtx = {
    lineUserId: ctx.lineUserId,
    channelId: ctx.channelId,
  };

  return {
    get_line_brand_draft: tool({
      description:
        'Retrieve the temporary LINE brand draft for an unlinked LINE user. Use this only when canonical brand context is unavailable.',
      inputSchema: getLineBrandDraftInputSchema,
      async execute(input) {
        return { success: true, ...(await runGetLineBrandDraft(input, draftCtx)) };
      },
    }),
    save_line_brand_draft_field: tool({
      description:
        'Save a single field into the temporary LINE brand draft. Call this immediately after the user provides the value.',
      inputSchema: saveLineBrandDraftFieldInputSchema,
      async execute(input) {
        return { success: true, ...(await runSaveLineBrandDraftField(input, draftCtx)) };
      },
    }),
    add_line_brand_style_reference: tool({
      description:
        'Add a confirmed https:// image URL to the temporary LINE brand draft style-reference collection.',
      inputSchema: addLineBrandStyleReferenceInputSchema,
      async execute(input) {
        return { success: true, ...(await runAddLineBrandStyleReference(input, draftCtx)) };
      },
    }),
    remove_line_brand_style_reference: tool({
      description: 'Remove a specific style-reference URL from the temporary LINE brand draft.',
      inputSchema: removeLineBrandStyleReferenceInputSchema,
      async execute(input) {
        return { success: true, ...(await runRemoveLineBrandStyleReference(input, draftCtx)) };
      },
    }),
  };
}
