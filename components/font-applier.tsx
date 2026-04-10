'use client';

import { useFontPreferences } from '@/features/settings/hooks/use-font-preferences';

export function FontApplier() {
  useFontPreferences();
  return null;
}
