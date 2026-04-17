'use client';

import { createContext, useContext } from 'react';
import type { GuestSession } from '@/features/auth/hooks/use-guest-session';

type GuestSessionContextValue = GuestSession | null;

export const GuestSessionContext = createContext<GuestSessionContextValue>(null);

export function useGuestSessionContext(): GuestSessionContextValue {
  return useContext(GuestSessionContext);
}
