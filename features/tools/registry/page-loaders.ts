/**
 * Registry-driven page loader map.
 *
 * Maps tool slug → async function that returns the tool's page component.
 * The dynamic import keeps each tool's component out of the shared bundle.
 *
 * To add a new tool page:
 *   1. Create features/<tool>/components/<tool>-tool-page.tsx
 *   2. Add one entry here: slug → loader function
 *   That's it — app/tools/[toolSlug]/page.tsx picks it up automatically.
 */

import type { FC } from 'react';
import type { ToolManifest } from './types';

export type ToolPageProps = { manifest: ToolManifest };
export type ToolPageLoader = () => Promise<FC<ToolPageProps>>;

export const TOOL_PAGE_LOADERS: Record<string, ToolPageLoader> = {
  quiz: async () => {
    const { QuizToolPage } = await import('@/features/quiz/components/quiz-tool-page');
    return QuizToolPage;
  },
  certificate: async () => {
    const { CertificateToolPage } = await import(
      '@/features/certificate/components/certificate-tool-page'
    );
    return CertificateToolPage;
  },
  'content-marketing': async () => {
    const { ContentMarketingToolPage } = await import(
      '@/features/content-marketing/components/content-marketing-tool-page'
    );
    return ContentMarketingToolPage;
  },
  'website-builder': async () => {
    const { WebsiteBuilderToolPage } = await import(
      '@/features/website-builder/components/website-builder-tool-page'
    );
    return WebsiteBuilderToolPage;
  },
  'exam-builder': async () => {
    const { ExamBuilderToolPage } = await import(
      '@/features/exam-builder/components/exam-builder-tool-page'
    );
    return ExamBuilderToolPage;
  },
  audio: async () => {
    const { AudioToolPage } = await import('@/features/audio/components/audio-tool-page');
    return AudioToolPage;
  },
  speech: async () => {
    const { SpeechToolPage } = await import('@/features/speech/components/speech-tool-page');
    return SpeechToolPage;
  },
  video: async () => {
    const { VideoToolPage } = await import('@/features/video/components/video-tool-page');
    return VideoToolPage;
  },
  image: async () => {
    const { ImageToolPage } = await import('@/features/image/components/image-tool-page');
    return ImageToolPage;
  },
  'long-form': async () => {
    const { LongFormToolPage } = await import(
      '@/features/long-form/components/long-form-tool-page'
    );
    return LongFormToolPage;
  },
  repurposing: async () => {
    const { RepurposingToolPage } = await import(
      '@/features/repurposing/components/repurposing-tool-page'
    );
    return RepurposingToolPage;
  },
  analytics: async () => {
    const { AnalyticsToolPage } = await import(
      '@/features/analytics/components/analytics-tool-page'
    );
    return AnalyticsToolPage;
  },
  'google-sheets': async () => {
    const { GoogleSheetsToolPage } = await import(
      '@/features/google-sheets/components/google-sheets-tool-page'
    );
    return GoogleSheetsToolPage;
  },
  'google-docs': async () => {
    const { GoogleDocsToolPage } = await import(
      '@/features/google-docs/components/google-docs-tool-page'
    );
    return GoogleDocsToolPage;
  },
  'google-drive': async () => {
    const { GoogleDriveToolPage } = await import(
      '@/features/google-drive/components/google-drive-tool-page'
    );
    return GoogleDriveToolPage;
  },
  'google-slides': async () => {
    const { GoogleSlidesToolPage } = await import(
      '@/features/google-slides/components/google-slides-tool-page'
    );
    return GoogleSlidesToolPage;
  },
  'web-deploy': async () => {
    const { DeployToolPage } = await import(
      '@/features/deploy/components/deploy-tool-page'
    );
    return DeployToolPage;
  },
  'brand-profile': async () => {
    const { BrandProfileToolPage } = await import(
      '@/features/brand-profile/components/brand-profile-tool-page'
    );
    return BrandProfileToolPage;
  },
  'brand-photos': async () => {
    const { BrandPhotosToolPage } = await import(
      '@/features/brand-photos/components/brand-photos-tool-page'
    );
    return BrandPhotosToolPage;
  },
};
