"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRoundIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
const MIN_PASSWORD_LENGTH = 8;

export default function SetupPasswordPage() {
  return (
    <Suspense>
      <SetupPasswordContent />
    </Suspense>
  );
}

function SetupPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteAccepted = searchParams.get("invite") === "accepted";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(typeof body?.message === "string" ? body.message : "Failed to set password. Please sign in again and try once more.");
        return;
      }

      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf5e6,_#f6eee1_45%,_#efe6d7_100%)] px-4 py-12 dark:bg-[radial-gradient(circle_at_top,_#1c1a2e,_#181628_55%,_#141220_100%)]">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <Card className="border-black/5 bg-white/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur dark:border-border dark:bg-card/80 dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
          <CardHeader className="space-y-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <KeyRoundIcon className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle>Set your password</CardTitle>
              <CardDescription>
                Create a password for this account so future sign-ins can use email and password too.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {inviteAccepted ? (
              <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                Your invite is active. Add a password now if you want a backup sign-in method alongside magic links.
              </p>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                New password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Confirm password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}

            <Button className="w-full" onClick={handleSubmit} disabled={isLoading || !password || !confirm}>
              {isLoading ? "Setting password..." : "Set password"}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              You can also skip this and use{" "}
              <button
                className="text-foreground underline underline-offset-2 hover:no-underline"
                onClick={() => router.push("/")}
              >
                magic link sign-in
              </button>{" "}
              each time.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
