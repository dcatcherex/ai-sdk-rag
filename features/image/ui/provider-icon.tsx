'use client';

import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import type { ImageProvider } from '../types';

/** Maps ImageProvider → models.dev logo slug */
const LOGO_SLUG: Record<ImageProvider, string> = {
  kie: 'google',   // Nano Banana runs on Gemini
  openai: 'openai',
  qwen: 'qwen',
  xai: 'xai',
};

interface Props {
  provider: ImageProvider;
  className?: string;
}

export function ProviderIcon({ provider, className }: Props) {
  return <ModelSelectorLogo provider={LOGO_SLUG[provider]} className={className} />;
}
