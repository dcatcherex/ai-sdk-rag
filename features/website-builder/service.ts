import { nanoid } from 'nanoid';
import {
  runGenerateWebsite,
  runEditWebsite,
  runPublishWebsite,
  runGetWebsiteStatus,
  listUserWebsites,
  deleteWebsite,
} from '@/lib/website-service';
import { runExternalTool, toToolExecutionResult } from '@/features/external-tools';
import { toWebsiteBuilderProviderOptions } from '@/features/external-tools/web-publisher/web-bridge';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import type { SiteDataJson, SiteActionSource } from './types';

// Re-export raw run functions — used by agent adapter and API utility routes.
export { runGenerateWebsite, runEditWebsite, runPublishWebsite, runGetWebsiteStatus, listUserWebsites, deleteWebsite };

type ServiceContext = { userId: string; source?: SiteActionSource };
type GenerateInput = { businessDescription: string; templateSlug: 'portfolio' | 'service-landing' | 'consulting' | 'personal'; siteName: string };
type EditInput = { websiteId: string; editRequest: string };

export async function websiteGenerateAction(
  input: GenerateInput,
  ctx: ServiceContext,
): Promise<ToolExecutionResult<{ websiteId: string; htmlUrl: string; siteData: SiteDataJson }>> {
  if (process.env.WEB_PUBLISHER_URL) {
    const opts = toWebsiteBuilderProviderOptions('generate', input as Record<string, unknown>, ctx.userId);
    const result = await runExternalTool(opts);
    return toToolExecutionResult('website_builder', result);
  }
  const result = await runGenerateWebsite(input, ctx);
  return {
    tool: 'website_builder',
    runId: nanoid(),
    title: `Website generated: ${input.siteName}`,
    summary: `Your website has been generated using the ${input.templateSlug} template.`,
    data: result,
    artifacts: [{ type: 'link', label: 'Preview HTML', url: result.htmlUrl }],
    createdAt: new Date().toISOString(),
  };
}

export async function websiteEditAction(
  input: EditInput,
  ctx: ServiceContext,
): Promise<ToolExecutionResult<{ websiteId: string; htmlUrl: string }>> {
  if (process.env.WEB_PUBLISHER_URL) {
    const opts = toWebsiteBuilderProviderOptions('edit', input as Record<string, unknown>, ctx.userId);
    const result = await runExternalTool(opts);
    return toToolExecutionResult('website_builder', result);
  }
  const result = await runEditWebsite(input, ctx);
  return {
    tool: 'website_builder',
    runId: nanoid(),
    title: 'Website updated',
    summary: `Changes applied: ${input.editRequest}`,
    data: { websiteId: result.websiteId, htmlUrl: result.htmlUrl },
    artifacts: [{ type: 'link', label: 'Preview HTML', url: result.htmlUrl }],
    createdAt: new Date().toISOString(),
  };
}
