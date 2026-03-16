/**
 * Thin AI SDK adapter for website builder tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */
import { tool } from 'ai';
import {
  generateWebsiteInputSchema,
  editWebsiteInputSchema,
  publishWebsiteInputSchema,
  getWebsiteStatusInputSchema,
} from './schema';
import {
  runGenerateWebsite,
  runEditWebsite,
  runPublishWebsite,
  runGetWebsiteStatus,
} from './service';

export function createWebsiteBuilderAgentTools(ctx: { userId: string }) {
  const { userId } = ctx;

  return {
    create_website: tool({
      description:
        'Generate a complete website from a business description. Costs 100 credits. Returns a preview URL and website ID. Use this when the user wants to build or create a new website.',
      inputSchema: generateWebsiteInputSchema,
      async execute({ businessDescription, templateSlug, siteName }) {
        const result = await runGenerateWebsite(
          { businessDescription, templateSlug, siteName },
          { userId, source: 'agent' },
        );
        return {
          success: true,
          websiteId: result.websiteId,
          htmlUrl: result.htmlUrl,
          siteName: result.siteData.siteName,
          message: `Website "${result.siteData.siteName}" created successfully! Preview: ${result.htmlUrl}`,
        };
      },
    }),

    edit_website: tool({
      description:
        'Edit an existing website using natural language. Simple text/color edits cost 10 credits, structural changes (add/remove sections) cost 20 credits. Returns updated preview URL.',
      inputSchema: editWebsiteInputSchema,
      async execute({ websiteId, editRequest }) {
        const result = await runEditWebsite(
          { websiteId, editRequest },
          { userId, source: 'agent' },
        );
        return {
          success: true,
          websiteId: result.websiteId,
          htmlUrl: result.htmlUrl,
          message: `Website updated successfully! New preview: ${result.htmlUrl}`,
        };
      },
    }),

    publish_website: tool({
      description:
        'Deploy a website to Cloudflare Pages, making it publicly accessible. Costs 5 credits. Returns the live URL.',
      inputSchema: publishWebsiteInputSchema,
      async execute({ websiteId }) {
        const result = await runPublishWebsite(websiteId, { userId, source: 'agent' });
        return {
          success: true,
          liveUrl: result.liveUrl,
          message: `Website published! Live at: ${result.liveUrl}`,
        };
      },
    }),

    get_website_status: tool({
      description: 'Check the current status and details of a website. Free — no credits deducted.',
      inputSchema: getWebsiteStatusInputSchema,
      async execute({ websiteId }) {
        const record = await runGetWebsiteStatus(websiteId, { userId });
        return {
          id: record.id,
          name: record.name,
          status: record.status,
          htmlUrl: record.renderedHtmlUrl,
          liveUrl: record.liveUrl,
          editCount: record.editCount,
          createdAt: record.createdAt,
        };
      },
    }),
  };
}
