'use client';

import { PLATFORMS } from '../constants';
import type { SocialPlatform } from '../types';

export function PlatformBadge({ platform }: { platform: SocialPlatform }) {
  const p = PLATFORMS.find((x) => x.id === platform);
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${p?.color ?? 'bg-zinc-500'}`}>
      {p?.label ?? platform}
    </span>
  );
}
