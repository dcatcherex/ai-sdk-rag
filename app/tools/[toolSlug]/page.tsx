import { notFound } from 'next/navigation';
import { TOOL_MANIFEST_BY_SLUG } from '@/features/tools/registry/client';
import { TOOL_PAGE_LOADERS } from '@/features/tools/registry/page-loaders';

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

  const loader = TOOL_PAGE_LOADERS[toolSlug];
  if (!loader) notFound();

  const ToolPageComponent = await loader();
  return <ToolPageComponent manifest={manifest} />;
}
