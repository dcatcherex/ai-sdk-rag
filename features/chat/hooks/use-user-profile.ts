import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/auth-client';

export const useUserProfile = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: sessionData } = authClient.useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const userProfile = useMemo(() => {
    const name = sessionData?.user?.name?.trim();
    const email = sessionData?.user?.email?.trim();
    const displayName = name || email || 'Account';
    const initials = displayName
      .split(' ')
      .filter((word) => word.length > 0)
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    return {
      displayName,
      email: email ?? '',
      initials: initials || 'U',
      image: sessionData?.user?.image ?? '',
    };
  }, [sessionData?.user?.email, sessionData?.user?.image, sessionData?.user?.name]);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      // Navigate to root and let AppAccessGuard decide: guest session if enabled,
      // or redirect to sign-in if guest access is off.
      router.push('/');
    } finally {
      setIsSigningOut(false);
    }
  }, [isSigningOut, router]);

  return {
    sessionData,
    userProfile,
    isSigningOut,
    handleSignOut,
  };
};
