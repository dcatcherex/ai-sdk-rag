'use client';

import { useEffect, useState } from 'react';

export type GuestSession = {
  id: string;
  credits: number;
  expiresAt: string;
};

type GuestSessionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; session: GuestSession }
  | { status: 'disabled' }
  | { status: 'error'; message: string };

export function useGuestSession(enabled: boolean): GuestSessionState {
  // Start as 'disabled' when not needed — avoids a spurious idle→disabled transition
  const [state, setState] = useState<GuestSessionState>(
    enabled ? { status: 'idle' } : { status: 'disabled' },
  );

  useEffect(() => {
    // Nothing to do for authenticated users
    if (!enabled) {
      setState({ status: 'disabled' });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    fetch('/api/guest/init', { method: 'POST' })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 403) {
          setState({ status: 'disabled' });
          return;
        }
        if (!res.ok) {
          const text = await res.text();
          setState({ status: 'error', message: text });
          return;
        }
        const data = (await res.json()) as GuestSession;
        setState({ status: 'ready', session: data });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
        }
      });

    return () => { cancelled = true; };
  }, [enabled]);

  // When `enabled` just flipped to true the effect hasn't run yet, so state is
  // still 'disabled' from the previous render.  Returning 'idle' here prevents
  // AppAccessGuard's redirect effect from firing prematurely.
  if (enabled && state.status === 'disabled') {
    return { status: 'idle' };
  }

  return state;
}
