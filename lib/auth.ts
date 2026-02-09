import { createElement } from "react";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";

import { db } from "@/lib/db";
import { MagicLinkEmail, ResetPasswordEmail, VerificationEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/email";
import { addCredits, SIGNUP_BONUS_CREDITS } from "@/lib/credits";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const isGoogleConfigured =
  !!googleClientId &&
  !!googleClientSecret &&
  googleClientId !== "..." &&
  googleClientSecret !== "...";
const socialProviders =
  isGoogleConfigured
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      }
    : {};

const appName = "Better Auth";
const logoUrl = process.env.AUTH_EMAIL_LOGO_URL;
const supportEmail = process.env.AUTH_SUPPORT_EMAIL;
const emailTheme = process.env.AUTH_EMAIL_THEME === "dark" ? "dark" : "light";
const authBaseUrl = process.env.BETTER_AUTH_URL;

if (!authBaseUrl) {
  console.warn("[Better Auth] BETTER_AUTH_URL is not set. Verification cookies may not persist.");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  trustedOrigins: authBaseUrl ? [authBaseUrl] : undefined,
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: `Verify your email for ${appName}`,
        text: `Click to verify: ${url}`,
        react: createElement(VerificationEmail, {
          appName,
          actionUrl: url,
          logoUrl,
          supportEmail,
          theme: emailTheme,
        }),
      });
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: `Reset your ${appName} password`,
        text: `Click to reset: ${url}`,
        react: createElement(ResetPasswordEmail, {
          appName,
          actionUrl: url,
          logoUrl,
          supportEmail,
          theme: emailTheme,
        }),
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await addCredits({
            userId: user.id,
            amount: SIGNUP_BONUS_CREDITS,
            type: 'signup_bonus',
            description: `Welcome bonus: ${SIGNUP_BONUS_CREDITS} credits`,
          });
        },
      },
    },
  },
  socialProviders,
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }: { email: string; token: string; url: string }) => {
        void sendEmail({
          to: email,
          subject: `Your ${appName} magic link`,
          text: `Sign in with this link: ${url}`,
          react: createElement(MagicLinkEmail, {
            appName,
            actionUrl: url,
            logoUrl,
            supportEmail,
            theme: emailTheme,
          }),
        });
      },
    }),
  ],
});
