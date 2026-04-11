"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, LoaderCircleIcon, LogOutIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

type InviteClaimCardProps = {
  token: string;
  appHref?: string;
};

export function InviteClaimCard({ token, appHref = "/" }: InviteClaimCardProps) {
  const router = useRouter();
  const [state, setState] = useState<"claiming" | "accepted" | "error">("claiming");
  const [message, setMessage] = useState("Claiming your invite now.");

  useEffect(() => {
    let active = true;

    const claimInvite = async () => {
      try {
        const res = await fetch(`/api/invite/${token}/claim`, { method: "POST" });
        const body = await res.json().catch(() => null);

        if (!active) return;

        if (!res.ok) {
          setState("error");
          setMessage(body?.error ?? "We could not claim this invite.");
          return;
        }

        setState("accepted");
        setMessage(body?.alreadyAccepted ? "This invite was already linked to your account." : "Your invite is active and ready to use.");
      } catch {
        if (!active) return;
        setState("error");
        setMessage("We could not reach the invite service. Please try again.");
      }
    };

    void claimInvite();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <Card className="border-black/5 bg-white/85 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:border-border dark:bg-card/85 dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
      <CardHeader className="space-y-3">
        <Badge variant="outline" className="w-fit gap-1.5">
          {state === "claiming" ? <LoaderCircleIcon className="size-3.5 animate-spin" /> : <CheckCircle2Icon className="size-3.5" />}
          {state === "claiming" ? "Claiming invite" : state === "accepted" ? "Invite ready" : "Claim failed"}
        </Badge>
        <div className="space-y-1">
          <CardTitle>{state === "claiming" ? "Finishing your access" : state === "accepted" ? "Invite accepted" : "We hit a snag"}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {state === "claiming" ? "Please keep this page open while we finish linking your invite." : null}
        {state === "accepted" ? "You can head back into the app now. If this invite included approval or starting credits, those changes have already been applied." : null}
        {state === "error" ? "If the problem keeps happening, ask an admin to resend the invite or confirm that you signed in with the invited email address." : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        {state === "accepted" ? (
          <Button asChild>
            <Link href={appHref}>Open Vaja</Link>
          </Button>
        ) : null}
        {state === "error" ? (
          <Button onClick={() => router.refresh()}>Try again</Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

type InviteSwitchAccountCardProps = {
  invitedEmail: string;
  currentEmail: string;
  signInHref: string;
};

export function InviteSwitchAccountCard({
  invitedEmail,
  currentEmail,
  signInHref,
}: InviteSwitchAccountCardProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSwitchAccount = async () => {
    setIsSigningOut(true);
    setError(null);

    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => router.push(signInHref),
        },
      });
    } catch {
      setError("We could not sign you out automatically. Please sign out and try again.");
      setIsSigningOut(false);
    }
  };

  return (
    <Card className="border-amber-300/60 bg-white/85 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:border-amber-400/30 dark:bg-card/85 dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
      <CardHeader className="space-y-3">
        <Badge variant="outline" className="w-fit gap-1.5 border-amber-300 text-amber-700 dark:border-amber-400/50 dark:text-amber-300">
          <TriangleAlertIcon className="size-3.5" />
          Email mismatch
        </Badge>
        <div className="space-y-1">
          <CardTitle>Use the invited email address</CardTitle>
          <CardDescription>
            This invite is for <strong>{invitedEmail}</strong>, but you are signed in as <strong>{currentEmail}</strong>.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Sign out first, then continue with the invited email address so we can safely link the invite to the right account.
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button onClick={handleSwitchAccount} disabled={isSigningOut} className="gap-2">
          <LogOutIcon className="size-4" />
          {isSigningOut ? "Switching..." : "Sign out and continue"}
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
