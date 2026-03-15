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
};
