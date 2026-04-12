"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const resetRedirectURL = "/reset-password";

type View = "sign-in" | "sign-up" | "reset" | "magic" | "inbox";

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "Something went wrong. Please try again.";
  if ("message" in error && typeof error.message === "string") return error.message;
  return "Something went wrong. Please try again.";
};

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/";
  const prefilledEmail = searchParams.get("email") || "";
  const verificationCallbackURL = `/verified?next=${encodeURIComponent(nextUrl)}`;

  const [view, setView] = useState<View>("sign-in");
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState(prefilledEmail);
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpSuccessEmail, setSignUpSuccessEmail] = useState<string | null>(null);
  const [magicEmail, setMagicEmail] = useState(prefilledEmail);
  const [resetEmail, setResetEmail] = useState(prefilledEmail);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isSignUpLoading, setIsSignUpLoading] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [isVerifyLoading, setIsVerifyLoading] = useState(false);
  const [inboxEmail, setInboxEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const setError = (msg: string) => {
    setErrorMsg(msg);
    setSuccessMsg(null);
  };
  const setSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
  };
  const clearMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const goTo = (v: View) => {
    setView(v);
    clearMessages();
  };

  useEffect(() => {
    const resetStatus = searchParams.get("reset");
    const verified = searchParams.get("verified");
    if (resetStatus === "success") setSuccess("Password updated. Sign in to continue.");
    if (verified === "true") setSuccess("Email verified. You can sign in now.");
  }, [searchParams]);

  useEffect(() => {
    setEmail(prefilledEmail);
    setSignUpEmail(prefilledEmail);
    setMagicEmail(prefilledEmail);
    setResetEmail(prefilledEmail);
  }, [prefilledEmail]);

  useEffect(() => {
    let isActive = true;
    const checkSession = async () => {
      const { data } = await authClient.getSession();
      if (isActive && data?.session) router.replace(nextUrl);
    };
    void checkSession();
    return () => {
      isActive = false;
    };
  }, [nextUrl, router]);

  const handleEmailSignIn = async () => {
    setIsEmailLoading(true);
    clearMessages();
    try {
      const { error } = await authClient.signIn.email({ email, password, callbackURL: nextUrl });
      if (error) {
        if ("status" in error && error.status === 403) {
          setError("Please verify your email before signing in.");
        } else {
          setError(getErrorMessage(error));
        }
      } else {
        router.push(nextUrl);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleSignUp = async () => {
    setIsSignUpLoading(true);
    clearMessages();
    try {
      const { error } = await authClient.signUp.email({
        name: signUpName,
        email: signUpEmail,
        password: signUpPassword,
        callbackURL: verificationCallbackURL,
      });
      if (error) {
        setError(getErrorMessage(error));
      } else {
        setSignUpSuccessEmail(signUpEmail);
        setInboxEmail(signUpEmail);
        setSignUpName("");
        setSignUpEmail("");
        setSignUpPassword("");
        goTo("inbox");
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSignUpLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearMessages();
    try {
      await authClient.signIn.social({ provider: "google", callbackURL: nextUrl });
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const handleMagicLink = async () => {
    setIsMagicLoading(true);
    clearMessages();
    try {
      const { error } = await authClient.signIn.magicLink({ email: magicEmail, callbackURL: nextUrl });
      if (error) {
        setError(getErrorMessage(error));
      } else {
        setInboxEmail(magicEmail);
        goTo("inbox");
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsMagicLoading(false);
    }
  };

  const handleSendVerification = async (targetEmail: string) => {
    setIsVerifyLoading(true);
    clearMessages();
    try {
      const { error } = await authClient.sendVerificationEmail({ email: targetEmail, callbackURL: verificationCallbackURL });
      if (error) {
        setError(getErrorMessage(error));
      } else {
        setInboxEmail(targetEmail);
        goTo("inbox");
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsVerifyLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setIsResetLoading(true);
    clearMessages();
    try {
      const { error } = await authClient.requestPasswordReset({ email: resetEmail, redirectTo: resetRedirectURL });
      if (error) {
        setError(getErrorMessage(error));
      } else {
        setInboxEmail(resetEmail);
        goTo("inbox");
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsResetLoading(false);
    }
  };

  const viewTitle: Record<View, string> = {
    "sign-in": "Sign in | เข้าสู่ระบบ",
    "sign-up": "Create account | สร้างบัญชี",
    reset: "Reset password | รีเซ็ตรหัสผ่าน",
    magic: "Magic link | ลิงก์เข้าสู่ระบบ",
    inbox: "Check your inbox | ตรวจอีเมล",
  };

  const viewSubtitle: Record<View, string> = {
    "sign-in": "เข้าสู่ Vaja AI เพื่อเริ่มคุยงานและใช้งาน LINE-first AI coworker ของคุณ",
    "sign-up": "สร้างบัญชี Vaja AI เพื่อเริ่มใช้งานผู้ช่วย AI สำหรับงานของคุณ",
    reset: "We’ll send a secure reset link to your email",
    magic: "Sign in to Vaja AI without a password",
    inbox: "เราได้ส่งลิงก์เข้าสู่ระบบหรือยืนยันอีเมลให้แล้ว",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fdf5e6,_#f6eee1_45%,_#efe6d7_100%)] px-4 dark:bg-[radial-gradient(circle_at_top,_#1c1a2e,_#181628_55%,_#141220_100%)]">
      <div className="w-full max-w-sm">
        <div className="space-y-5 rounded-2xl border border-black/5 bg-white/80 px-8 py-8 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur dark:border-border dark:bg-card/80 dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
          <div className="space-y-0.5 pb-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-muted-foreground">
              Vaja AI
            </p>
            <h1 className="text-xl font-semibold text-foreground">{viewTitle[view]}</h1>
            <p className="text-sm text-muted-foreground">{viewSubtitle[view]}</p>
          </div>

          {errorMsg ? (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorMsg}
            </p>
          ) : null}
          {successMsg ? (
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              {successMsg}
            </p>
          ) : null}

          {view === "inbox" ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                เราส่งลิงก์ไปที่ <span className="font-medium text-foreground">{inboxEmail}</span>
                {" "}แล้ว เปิดอีเมลเพื่อไปต่อได้เลย
              </p>
              {signUpSuccessEmail ? (
                <Button
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => handleSendVerification(signUpSuccessEmail)}
                  disabled={isVerifyLoading}
                >
                  {isVerifyLoading ? "Sending..." : "Resend verification email | ส่งอีกครั้ง"}
                </Button>
              ) : null}
              <button
                onClick={() => goTo("sign-in")}
                className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Back to sign in | กลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          ) : null}

          {view === "sign-in" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="name@business.co.th"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSignIn()}
                />
                <Input
                  type="password"
                  placeholder="Password | รหัสผ่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleEmailSignIn()}
                />
              </div>
              <Button className="w-full" onClick={handleEmailSignIn} disabled={isEmailLoading || !email || !password}>
                {isEmailLoading ? "Signing in..." : "Sign in | เข้าสู่ระบบ"}
              </Button>

              <Divider label="or" />

              <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
                <GoogleIcon />
                Continue with Google | ใช้ Google
              </Button>

              <Divider label="or" />

              <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => goTo("magic")}>
                Sign in with magic link | ใช้ลิงก์อีเมล
              </Button>

              <div className="flex justify-between pt-1 text-xs text-muted-foreground">
                <button onClick={() => goTo("sign-up")} className="transition-colors hover:text-foreground">
                  Create account | สร้างบัญชี
                </button>
                <button onClick={() => goTo("reset")} className="transition-colors hover:text-foreground">
                  Forgot password? | ลืมรหัสผ่าน
                </button>
              </div>
            </div>
          ) : null}

          {view === "sign-up" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Input type="text" placeholder="Your name | ชื่อของคุณ" value={signUpName} onChange={(e) => setSignUpName(e.target.value)} />
                <Input type="email" placeholder="name@business.co.th" value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} />
                <Input
                  type="password"
                  placeholder="Create a password | ตั้งรหัสผ่าน"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSignUp}
                disabled={isSignUpLoading || !signUpName || !signUpEmail || !signUpPassword}
              >
                {isSignUpLoading ? "Creating..." : "Create account | สร้างบัญชี"}
              </Button>

              <Divider label="or" />

              <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
                <GoogleIcon />
                Continue with Google | ใช้ Google
              </Button>

              <p className="pt-1 text-center text-xs text-muted-foreground">
                Already have an account? | มีบัญชีอยู่แล้ว?{" "}
                <button onClick={() => goTo("sign-in")} className="text-foreground hover:underline">
                  Sign in
                </button>
              </p>
            </div>
          ) : null}

          {view === "reset" ? (
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="name@business.co.th"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordReset()}
              />
              <Button className="w-full" onClick={handlePasswordReset} disabled={isResetLoading || !resetEmail}>
                {isResetLoading ? "Sending..." : "Send reset link | ส่งลิงก์รีเซ็ต"}
              </Button>
              <button
                onClick={() => goTo("sign-in")}
                className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Back to sign in | กลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          ) : null}

          {view === "magic" ? (
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="name@business.co.th"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
              />
              <Button className="w-full" onClick={handleMagicLink} disabled={isMagicLoading || !magicEmail}>
                {isMagicLoading ? "Sending..." : "Send magic link | ส่งลิงก์เข้าสู่ระบบ"}
              </Button>
              <button
                onClick={() => goTo("sign-in")}
                className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Use password instead | ใช้รหัสผ่านแทน
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
