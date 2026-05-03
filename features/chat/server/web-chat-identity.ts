import { parseGuestCookie, getGuestSessionById } from '@/lib/guest-access';

export type ResolvedWebChatIdentity = {
  isGuest: boolean;
  effectiveUserId: string;
  guestSessionId: string | null;
  guestBalance: number;
};

export async function resolveWebChatIdentity(input: {
  sessionUser: { id: string } | null;
  cookieHeader: string | null;
}): Promise<ResolvedWebChatIdentity> {
  const { sessionUser, cookieHeader } = input;

  if (sessionUser) {
    return {
      isGuest: false,
      effectiveUserId: sessionUser.id,
      guestSessionId: null,
      guestBalance: 0,
    };
  }

  const guestId = parseGuestCookie(cookieHeader);
  if (!guestId) {
    throw new Error('Unauthorized');
  }

  const guestSession = await getGuestSessionById(guestId);
  if (!guestSession) {
    throw new Error('Unauthorized');
  }

  return {
    isGuest: true,
    effectiveUserId: '',
    guestSessionId: guestSession.id,
    guestBalance: guestSession.credits,
  };
}
