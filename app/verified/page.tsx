"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

const pollIntervalMs = 1200;
const maxAttempts = 10;

export default function VerifiedPage() {
  return (
    <Suspense fallback={<VerifiedPageFallback />}>
      <VerifiedPageContent />
    </Suspense>
  );
}

function VerifiedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";
  const [attempts, setAttempts] = useState(0);
  const [status, setStatus] = useState("Checking your Vaja AI session... | กำลังตรวจสอบการเข้าสู่ระบบ");

  useEffect(() => {
    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const checkSession = async (nextAttempt: number) => {
      const { data } = await authClient.getSession();
      if (!isActive) return;

      if (data?.session) {
        setStatus("Verified. Redirecting you into Vaja AI... | ยืนยันอีเมลแล้ว กำลังพาเข้าแอป");
        router.replace(nextUrl);
        return;
      }

      if (nextAttempt >= maxAttempts) {
        setStatus("Verified, but we couldn't sign you in automatically. Please sign in again.");
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
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [nextUrl, router]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fdf5e6,#f6eee1_45%,#efe6d7_100%)] px-4 py-12 dark:bg-[radial-gradient(circle_at_top,#1c1a2e,#181628_55%,#141220_100%)]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <Card className="border-black/5 bg-white/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:border-border dark:bg-card/80 dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
          <CardHeader>
            <CardTitle className="text-lg">Vaja AI verified your email | ยืนยันอีเมลสำเร็จ</CardTitle>
            <CardDescription>We&apos;re securing your session and preparing your workspace.</CardDescription>
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

function VerifiedPageFallback() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fdf5e6,#f6eee1_45%,#efe6d7_100%)] px-4 py-12 dark:bg-[radial-gradient(circle_at_top,#1c1a2e,#181628_55%,#141220_100%)]">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <Card className="border-black/5 bg-white/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:border-border dark:bg-card/80 dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
          <CardHeader>
            <CardTitle className="text-lg">Preparing Vaja AI | กำลังเตรียมระบบ</CardTitle>
            <CardDescription>Finishing your verification and loading your workspace.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
