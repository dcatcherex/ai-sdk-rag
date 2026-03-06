"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

const pollIntervalMs = 1200;
const maxAttempts = 10;

export default function VerifiedPage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState("Checking your session…");

  useEffect(() => {
    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkSession = async (nextAttempt: number) => {
      const { data } = await authClient.getSession();
      if (!isActive) {
        return;
      }

      if (data?.session) {
        setStatus("Verified! Redirecting you now…");
        router.replace("/");
        return;
      }

      if (nextAttempt >= maxAttempts) {
        setStatus("Verified, but we couldn't sign you in automatically. Please sign in.");
        return;
      }

      setAttempts(nextAttempt);
      timeoutId = setTimeout(() => {
        void checkSession(nextAttempt + 1);
      }, pollIntervalMs);
    };

    void checkSession(1);

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fdf5e6,#f6eee1_45%,#efe6d7_100%)] dark:bg-[radial-gradient(circle_at_top,#1a1b2e,#111827_55%,#0f172a_100%)] px-4 py-12">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <Card className="border-black/5 dark:border-white/10 bg-white/80 dark:bg-zinc-900/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
          <CardHeader>
            <CardTitle className="text-lg">Verified — redirecting</CardTitle>
            <CardDescription>We’re securing your session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{status}</p>
            <p>
              Attempt {attempts}/{maxAttempts}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
