'use client';

import { LongFormToolPage } from '@/features/long-form/components/long-form-tool-page';
import { longFormManifest } from '@/features/long-form/manifest';

export function HubLongformTab() {
  return <LongFormToolPage manifest={longFormManifest} />;
}
