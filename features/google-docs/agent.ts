import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import {
  appendGoogleDocSectionInputSchema,
  createGoogleDocFromTemplateInputSchema,
  createGoogleDocInputSchema,
} from './schema';
import {
  runAppendGoogleDocSection,
  runCreateGoogleDoc,
  runCreateGoogleDocFromTemplate,
} from './service';

export function createGoogleDocsAgentTools(
  ctx: Pick<AgentToolContext, 'userId'>,
) {
  const { userId } = ctx;

  return {
    create_google_doc: tool({
      description:
        'Create a Google Doc from markdown content, optionally inside a specific Drive folder.',
      inputSchema: createGoogleDocInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runCreateGoogleDoc(input, userId);
      },
    }),

    create_google_doc_from_template: tool({
      description:
        'Copy a Google Doc template and replace {{placeholder}} tokens with provided values.',
      inputSchema: createGoogleDocFromTemplateInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runCreateGoogleDocFromTemplate(input, userId);
      },
    }),

    append_google_doc_section: tool({
      description:
        'Append a new heading and markdown section to the end of an existing Google Doc.',
      inputSchema: appendGoogleDocSectionInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runAppendGoogleDocSection(input, userId);
      },
    }),
  };
}
