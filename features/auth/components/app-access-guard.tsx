'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2Icon, LogOutIcon, ShieldAlertIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authClient } from '@/lib/auth-client';
import { UnauthorizedError, useUserStatus } from '@/features/auth/hooks/use-user-status';

type AppAccessGuardProps = {
  children: ReactNode;
};

function CenteredMessage({
  title,
  description,
  action,
  loading = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#f2f0fa,#e8e4f5_55%,#dddaf0_100%)] px-4 dark:bg-[radial-gradient(circle_at_top,#1c1a2e,#181628_55%,#141220_100%)]">
      <Card className="w-full max-w-lg border-black/5 bg-white/85 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:border-border dark:bg-card/85 dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <ShieldAlertIcon className="size-4" />}
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {action ? <CardContent>{action}</CardContent> : null}
      </Card>
    </div>
  );
}

export function AppAccessGuard({ children }: AppAccessGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { data: sessionData } = authClient.useSession();
  const { data, isLoading, error, refetch, isRefetching } = useUserStatus();

  const signInHref = useMemo(() => {
    const nextPath = pathname || '/';
    return `/sign-in?next=${encodeURIComponent(nextPath)}`;
  }, [pathname]);

  useEffect(() => {
    if (error instanceof UnauthorizedError) {
      router.replace(signInHref);
    }
  }, [error, router, signInHref]);

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    try {
      await authClient.signOut();
      router.replace(signInHref);
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <CenteredMessage
        title="Preparing Vaja AI"
        description="Checking your account and loading your workspace."
        loading
      />
    );
  }

  if (error instanceof UnauthorizedError) {
    return (
      <CenteredMessage
        title="Redirecting to sign in"
        description="Your session has ended or you need to sign in before using Vaja AI."
        loading
      />
    );
  }

  if (error) {
    return (
      <CenteredMessage
        title="We couldn't load your account"
        description="Please retry before starting the user test."
        action={(
          <Button onClick={() => void refetch()} disabled={isRefetching}>
            {isRefetching ? 'Retrying...' : 'Retry'}
          </Button>
        )}
      />
    );
  }

  if (!data?.approved) {
    return (
      <CenteredMessage
        title="Your account is waiting for approval"
        description={`Vaja AI is almost ready. ${sessionData?.user?.email ?? data?.email ?? 'Your account'} still needs admin approval before chat and workspace features are enabled.`}
        action={(
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void refetch()} disabled={isRefetching}>
              {isRefetching ? 'Refreshing...' : 'Check again'}
            </Button>
            <Button onClick={() => void handleSignOut()} disabled={isSigningOut}>
              <LogOutIcon className="mr-2 size-4" />
              {isSigningOut ? 'Signing out...' : 'Sign out'}
            </Button>
          </div>
        )}
      />
    );
  }

  return <>{children}</>;
}
