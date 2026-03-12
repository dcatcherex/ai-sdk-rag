import { notFound } from 'next/navigation';
import { TOOL_MANIFEST_BY_SLUG } from '@/features/tools/registry/client';

type Props = {
  params: Promise<{ toolSlug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { toolSlug } = await params;
  const manifest = TOOL_MANIFEST_BY_SLUG[toolSlug];
  if (!manifest) return {};
  return { title: manifest.title };
}

export default async function ToolPage({ params }: Props) {
  const { toolSlug } = await params;
  const manifest = TOOL_MANIFEST_BY_SLUG[toolSlug];

  if (!manifest || !manifest.access.enabled) {
    notFound();
  }

  // Dynamically load the tool page component based on slug
  switch (toolSlug) {
    case 'quiz': {
      const { QuizToolPage } = await import('@/features/quiz/components/quiz-tool-page');
      return <QuizToolPage manifest={manifest} />;
    }
    case 'certificate': {
      const { CertificateToolPage } = await import(
        '@/features/certificate/components/certificate-tool-page'
      );
      return <CertificateToolPage manifest={manifest} />;
    }
    default:
      notFound();
  }
}
