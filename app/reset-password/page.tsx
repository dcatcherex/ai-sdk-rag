"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "Unexpected error. Please try again.";
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Unexpected error. Please try again.";
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => searchParams.get("token"), [searchParams]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleReset = async () => {
    if (!token) {
      setFeedback("Missing reset token.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFeedback(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    try {
      const { error } = await authClient.resetPassword({
        token,
        newPassword,
      });

      if (error) {
        setFeedback(getErrorMessage(error));
      } else {
        setFeedback("Password updated. You can now sign in.");
        router.push("/sign-in?reset=success");
      }
    } catch (error) {
      setFeedback(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fdf5e6,#f6eee1_45%,#efe6d7_100%)] px-4 py-12 dark:bg-[radial-gradient(circle_at_top,#1c1a2e,#181628_55%,#141220_100%)]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <Card className="border-black/5 bg-white/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:border-border dark:bg-card/80 dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
          <CardHeader>
            <CardTitle className="text-lg">Reset password</CardTitle>
            <CardDescription>Create a new password for your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                New password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Create a new password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
              />
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Confirm password
              </label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
              />
            </div>
            <Button onClick={handleReset} disabled={isLoading || !newPassword || !confirmPassword || !token}>
              {isLoading ? "Updating..." : "Update password"}
            </Button>
            {feedback ? <p className="text-xs text-muted-foreground">{feedback}</p> : null}
            {!token ? (
              <p className="text-xs text-muted-foreground">
                This page requires a valid reset token from your email.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
