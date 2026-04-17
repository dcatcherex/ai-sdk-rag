'use client';

import { CoinsIcon, LogInIcon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useGuestSessionContext } from '@/features/auth/contexts/guest-session-context';

export function GuestBanner() {
  const guestSession = useGuestSessionContext();

  // null means authenticated user — show nothing
  if (!guestSession) return null;

  const { credits } = guestSession;

  return (
    <div className="flex items-center justify-between gap-3 border-b bg-amber-50/80 dark:bg-amber-950/30 px-4 py-2 text-sm shrink-0">
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
        <CoinsIcon className="size-3.5 shrink-0" />
        <span>
          Guest session —{' '}
          <span className="font-semibold">
            {credits} credit{credits !== 1 ? 's' : ''}
          </span>{' '}
          remaining. Sign up to save your chats and get more credits.
        </span>
      </div>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="h-7 shrink-0 border-amber-300 text-xs text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900"
      >
        <Link href="/sign-in">
          <LogInIcon className="mr-1.5 size-3" />
          Sign in
        </Link>
      </Button>
    </div>
  );
}
