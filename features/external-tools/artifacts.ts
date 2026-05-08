import type { ProviderArtifact } from './types';
import type { ToolExecutionResult } from '@/features/tools/registry/types';

type ArtifactRef = NonNullable<ToolExecutionResult['artifacts']>[number];

// Map a provider artifact to the Vaja ToolExecutionResult artifact shape.
// Provider artifacts with unknown formats fall back to 'link'.
export function mapProviderArtifact(a: ProviderArtifact): ArtifactRef {
  const type = resolveArtifactType(a.format);
  return {
    type,
    label: a.label ?? a.kind,
    url: a.url,
  };
}

export function mapProviderArtifacts(artifacts: ProviderArtifact[] | undefined): ArtifactRef[] {
  if (!artifacts || artifacts.length === 0) return [];
  return artifacts.map(mapProviderArtifact);
}

function resolveArtifactType(format: string): ArtifactRef['type'] {
  const f = format.toLowerCase();
  if (f === 'pdf') return 'pdf';
  if (f === 'html') return 'html';
  if (f === 'json') return 'json';
  return 'link';
}
