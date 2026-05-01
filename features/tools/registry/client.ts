/**
 * Client-safe tool registry.
 * Only imports manifests — NO service.ts or agent.ts imports.
 * Safe to use in sidebar, settings UI, and client components.
 */

import type { ToolManifest } from './types';
import { quizManifest } from '@/features/quiz/manifest';
import { certificateManifest } from '@/features/certificate/manifest';
import { contentMarketingManifest } from '@/features/content-marketing/manifest';
import { websiteBuilderManifest } from '@/features/website-builder/manifest';
import { examBuilderManifest } from '@/features/exam-builder/manifest';
import { audioManifest } from '@/features/audio/manifest';
import { speechManifest } from '@/features/speech/manifest';
import { videoManifest } from '@/features/video/manifest';
import { imageManifest } from '@/features/image/manifest';
import { longFormManifest } from '@/features/long-form/manifest';
import { repurposingManifest } from '@/features/repurposing/manifest';
import { brandGuardrailsManifest } from '@/features/brand-guardrails/manifest';
import { analyticsManifest } from '@/features/analytics/manifest';
import { distributionManifest } from '@/features/distribution/manifest';
import { recordKeeperManifest } from '@/features/record-keeper/manifest';
import { googleSheetsManifest } from '@/features/google-sheets/manifest';
import { googleDocsManifest } from '@/features/google-docs/manifest';
import { googleDriveManifest } from '@/features/google-drive/manifest';
import { googleSlidesManifest } from '@/features/google-slides/manifest';
import { webDeployManifest } from '@/features/deploy/manifest';
import { platformAgentManifest } from '@/features/platform-agent/manifest';
import { brandPhotosManifest } from '@/features/brand-photos/manifest';
import { domainProfilesManifest } from '@/features/domain-profiles/manifest';

/** All registered tool manifests */
export const TOOL_MANIFESTS: ToolManifest[] = [
  quizManifest,
  certificateManifest,
  contentMarketingManifest,
  websiteBuilderManifest,
  examBuilderManifest,
  audioManifest,
  speechManifest,
  videoManifest,
  imageManifest,
  longFormManifest,
  repurposingManifest,
  brandGuardrailsManifest,
  analyticsManifest,
  distributionManifest,
  recordKeeperManifest,
  googleSheetsManifest,
  googleDocsManifest,
  googleDriveManifest,
  googleSlidesManifest,
  webDeployManifest,
  platformAgentManifest,
  brandPhotosManifest,
  domainProfilesManifest,
];

/** Map from tool id → manifest */
export const TOOL_MANIFEST_BY_ID = Object.fromEntries(
  TOOL_MANIFESTS.map((m) => [m.id, m]),
) as Record<string, ToolManifest>;

/** Map from slug → manifest */
export const TOOL_MANIFEST_BY_SLUG = Object.fromEntries(
  TOOL_MANIFESTS.map((m) => [m.slug, m]),
) as Record<string, ToolManifest>;

/** All enabled manifests */
export function getEnabledManifests(): ToolManifest[] {
  return TOOL_MANIFESTS.filter((m) => m.access.enabled);
}

/** Manifests for tools that support the sidebar page */
export function getSidebarManifests(): ToolManifest[] {
  return TOOL_MANIFESTS.filter((m) => m.access.enabled && m.supportsSidebar);
}

/** Manifests for tools that the agent can use */
export function getAgentManifests(): ToolManifest[] {
  return TOOL_MANIFESTS.filter((m) => m.access.enabled && m.supportsAgent);
}

/** Sidebar page href for a tool slug */
export function getToolPageHref(slug: string): string {
  return `/tools/${slug}`;
}
