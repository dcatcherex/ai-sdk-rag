"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Client auth seam (Clerk-backed).
//
// Re-exports Clerk's client hooks + components, plus a small `authClient`
// compatibility shim so the handful of surviving Better Auth callers keep
// working (see features/chat/hooks/*, features/auth/components/*,
// features/skills/components/skills-list.tsx).
//
// New client code SHOULD import from `@clerk/nextjs` directly or use
// `useCurrentUser()` from this file.
//
// See: docs/clerk-migration-implementation-guide.md §7, §12 (Pattern C).
// ─────────────────────────────────────────────────────────────────────────────

import { useUser, useClerk } from "@clerk/nextjs";

export {
  useUser,
  useAuth,
  useClerk,
  UserButton,
  SignInButton,
  SignUpButton,
  SignOutButton,
  ClerkLoaded,
  ClerkLoading,
} from "@clerk/nextjs";

export function useCurrentUser() {
  const { user, isLoaded, isSignedIn } = useUser();
  return {
    isLoaded,
    isSignedIn,
    user: user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? "",
          name: user.fullName ?? user.username ?? "",
          image: user.imageUrl,
        }
      : null,
  };
}

// ─── Compat shim for legacy Better Auth call sites ──────────────────────────
// Only `useSession()` and `signOut()` are preserved — these are the two
// methods still used in feature code after the sign-in/invite pages were
// removed.

type LegacySessionData =
  | {
      user: { id: string; email: string; name: string; image: string | null };
      session: { userId: string };
    }
  | null;

export const authClient = {
  /**
   * Drop-in replacement for Better Auth's `authClient.useSession()`.
   * Returns `{ data, isPending }` shaped like the old API.
   */
  useSession: (): { data: LegacySessionData; isPending: boolean } => {
    const { user, isLoaded } = useUser();
    const data: LegacySessionData = user
      ? {
          user: {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress ?? "",
            name: user.fullName ?? user.username ?? "",
            image: user.imageUrl ?? null,
          },
          session: { userId: user.id },
        }
      : null;
    return { data, isPending: !isLoaded };
  },

  /**
   * Imperative sign-out for callers in onClick handlers. Uses the global
   * `window.Clerk` instance exposed by ClerkProvider.
   */
  signOut: async (options?: {
    fetchOptions?: { onSuccess?: () => void };
  }): Promise<void> => {
    if (typeof window === "undefined") return;
    const clerk = (window as unknown as { Clerk?: { signOut: () => Promise<void> } }).Clerk;
    if (!clerk) return;
    await clerk.signOut();
    options?.fetchOptions?.onSuccess?.();
  },
};

// Hook variant for components that prefer the Clerk-native API.
export function useAuthClientActions() {
  const { signOut } = useClerk();
  return { signOut };
}
