'use client';

import type { ToolManifest } from '@/features/tools/registry/types';

type Props = {
  manifest: ToolManifest;
};

export function CertificateToolPage({ manifest }: Props) {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{manifest.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{manifest.description}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Certificate tool UI coming soon. Use the chat to generate certificates via the AI agent, or
        use the certificate templates page.
      </p>
    </div>
  );
}
