import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export const useUserProfile = () => {
  const router = useRouter();
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
      router.push('/sign-in');
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
