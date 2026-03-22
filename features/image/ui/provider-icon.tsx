'use client';

import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';

/** Maps provider key → models.dev logo slug */
const LOGO_SLUG: Record<string, string> = {
  kie: 'google',
  openai: 'openai',
  qwen: 'qwen',
  xai: 'xai',
  google: 'google',
  suno: 'google',  // Suno has no models.dev logo; fallback to google
  anthropic: 'anthropic',
  mistral: 'mistral',
};

interface Props {
  provider: string;
  className?: string;
}

export function ProviderIcon({ provider, className }: Props) {
  const slug = LOGO_SLUG[provider] ?? provider;
  return <ModelSelectorLogo provider={slug} className={className} />;
}
