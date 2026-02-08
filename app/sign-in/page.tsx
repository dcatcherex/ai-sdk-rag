"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";

const signInCallbackURL = "/";
const verificationCallbackURL = "/verified";
const resetRedirectURL = "/reset-password";

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "Unexpected error. Please try again.";
  }

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "Unexpected error. Please try again.";
};

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpSuccessEmail, setSignUpSuccessEmail] = useState<string | null>(null);
  const [magicEmail, setMagicEmail] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isSignUpLoading, setIsSignUpLoading] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [isVerifyLoading, setIsVerifyLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [inboxPanel, setInboxPanel] = useState<{
    title: string;
    email: string;
    steps: string[];
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const setError = (message: string) => {
    setBanner({ type: "error", message });
    setInboxPanel(null);
  };

  const setSuccess = (message: string) => {
    setBanner({ type: "success", message });
  };

  useEffect(() => {
    const resetStatus = searchParams.get("reset");
    const verified = searchParams.get("verified");

    if (resetStatus === "success") {
      setSuccess("Password updated. Please sign in.");
    }

    if (verified === "true") {
      setSuccess("Email verified. You can sign in now.");
    }
  }, [searchParams]);

  useEffect(() => {
    let isActive = true;

    const checkSession = async () => {
      const { data } = await authClient.getSession();
      if (isActive && data?.session) {
        router.replace("/");
      }
    };

    void checkSession();

    return () => {
      isActive = false;
    };
  }, [router]);

  const handleEmailSignIn = async () => {
    setIsEmailLoading(true);
    setBanner(null);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
        callbackURL: signInCallbackURL,
      });

      if (error) {
        if ("status" in error && error.status === 403) {
          setError("Please verify your email before signing in.");
        } else {
          setError(getErrorMessage(error));
        }
      } else {
        router.push("/");
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleSignUp = async () => {
    setIsSignUpLoading(true);
    setBanner(null);

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
        setSuccess("Account created. Check your inbox to verify your email.");
        setSignUpSuccessEmail(signUpEmail);
        setSignUpName("");
        setSignUpEmail("");
        setSignUpPassword("");
        setInboxPanel({
          title: "Check your inbox",
          email: signUpEmail,
          steps: [
            "Open the verification email.",
            "Click the button to confirm your account.",
            "You’ll be signed in automatically after verification.",
          ],
        });
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsSignUpLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setBanner(null);

    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: signInCallbackURL,
      });
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const handleMagicLink = async () => {
    setIsMagicLoading(true);
    setBanner(null);

    try {
      const { error } = await authClient.signIn.magicLink({
        email: magicEmail,
        callbackURL: signInCallbackURL,
      });

      if (error) {
        setError(getErrorMessage(error));
      } else {
        setSuccess("Magic link sent. Check your email.");
        setInboxPanel({
          title: "Check your inbox",
          email: magicEmail,
          steps: [
            "Open the email we just sent.",
            "Click the magic link to sign in.",
            "If you don’t see it, check spam or promotions.",
          ],
        });
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsMagicLoading(false);
    }
  };

  const handleSendVerification = async (targetEmail: string) => {
    setIsVerifyLoading(true);
    setBanner(null);

    try {
      const { error } = await authClient.sendVerificationEmail({
        email: targetEmail,
        callbackURL: verificationCallbackURL,
      });

      if (error) {
        setError(getErrorMessage(error));
      } else {
        setSuccess("Verification email sent. Check your inbox.");
        setInboxPanel({
          title: "Check your inbox",
          email: targetEmail,
          steps: [
            "Open the verification email.",
            "Click the button to verify your account.",
            "You’ll be signed in automatically after verification.",
          ],
        });
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsVerifyLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setIsResetLoading(true);
    setBanner(null);

    try {
      const { error } = await authClient.requestPasswordReset({
        email: resetEmail,
        redirectTo: resetRedirectURL,
      });

      if (error) {
        setError(getErrorMessage(error));
      } else {
        setSuccess("Password reset email sent. Check your inbox.");
        setInboxPanel({
          title: "Check your inbox",
          email: resetEmail,
          steps: [
            "Open the reset email we sent you.",
            "Follow the link to set a new password.",
            "Use the new password to sign in.",
          ],
        });
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf5e6,_#f6eee1_45%,_#efe6d7_100%)] px-4 py-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
            Better Auth
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-foreground">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with email, Google OAuth, or send a magic link.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {banner ? (
            <Alert
              className="lg:col-span-2"
              variant={banner.type === "error" ? "destructive" : "default"}
            >
              <AlertTitle>{banner.type === "error" ? "Action needed" : "Success"}</AlertTitle>
              <AlertDescription>{banner.message}</AlertDescription>
            </Alert>
          ) : null}
          {inboxPanel ? (
            <Card className="lg:col-span-2 border-black/5 bg-white/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)]">
              <CardHeader>
                <CardTitle className="text-lg">{inboxPanel.title}</CardTitle>
                <CardDescription>
                  We sent an email to <span className="font-semibold text-foreground">{inboxPanel.email}</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <ul className="list-disc space-y-1 pl-5">
                  {inboxPanel.steps.map(step => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
          <Card className="border-black/5 bg-white/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)]">
            <CardHeader>
              <CardTitle className="text-lg">Email & password</CardTitle>
              <CardDescription>Sign in, create an account, or reset a password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Tabs defaultValue="sign-in" className="w-full">
                <TabsList className="w-full" variant="line">
                  <TabsTrigger value="sign-in">Sign in</TabsTrigger>
                  <TabsTrigger value="sign-up">Sign up</TabsTrigger>
                  <TabsTrigger value="reset">Reset</TabsTrigger>
                </TabsList>

                <TabsContent value="sign-in" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Email
                    </label>
                    <Input
                      type="email"
                      placeholder="you@studio.com"
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Password
                    </label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={handleEmailSignIn} disabled={isEmailLoading || !email || !password}>
                      {isEmailLoading ? "Signing in…" : "Sign in"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSendVerification(email)}
                      disabled={isVerifyLoading || !email}
                    >
                      {isVerifyLoading ? "Sending…" : "Resend verification"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="sign-up" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Name
                    </label>
                    <Input
                      type="text"
                      placeholder="Alex Carter"
                      value={signUpName}
                      onChange={event => setSignUpName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Email
                    </label>
                    <Input
                      type="email"
                      placeholder="you@studio.com"
                      value={signUpEmail}
                      onChange={event => setSignUpEmail(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Create a password"
                      value={signUpPassword}
                      onChange={event => setSignUpPassword(event.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleSignUp}
                    disabled={isSignUpLoading || !signUpName || !signUpEmail || !signUpPassword}
                  >
                    {isSignUpLoading ? "Creating…" : "Create account"}
                  </Button>
                  {signUpSuccessEmail ? (
                    <Button
                      variant="outline"
                      onClick={() => handleSendVerification(signUpSuccessEmail)}
                      disabled={isVerifyLoading}
                    >
                      {isVerifyLoading ? "Sending…" : "Resend verification"}
                    </Button>
                  ) : null}
                </TabsContent>

                <TabsContent value="reset" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Email
                    </label>
                    <Input
                      type="email"
                      placeholder="you@studio.com"
                      value={resetEmail}
                      onChange={event => setResetEmail(event.target.value)}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handlePasswordReset}
                    disabled={isResetLoading || !resetEmail}
                  >
                    {isResetLoading ? "Sending…" : "Send reset link"}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Email verification required for sign-in
              </span>
            </CardFooter>
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="border-black/5 bg-white/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)]">
              <CardHeader>
                <CardTitle className="text-lg">Google OAuth</CardTitle>
                <CardDescription>Continue with a verified Google account.</CardDescription>
              </CardHeader>
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
                  Continue with Google
                </Button>
              </CardFooter>
            </Card>

            <Card className="border-black/5 bg-white/80 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)]">
              <CardHeader>
                <CardTitle className="text-lg">Magic link</CardTitle>
                <CardDescription>Send a one-click sign-in link to your inbox.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  type="email"
                  placeholder="you@studio.com"
                  value={magicEmail}
                  onChange={event => setMagicEmail(event.target.value)}
                />
              </CardContent>
              <CardFooter>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleMagicLink}
                  disabled={isMagicLoading || !magicEmail}
                >
                  {isMagicLoading ? "Sending…" : "Send magic link"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
