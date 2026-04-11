import type { ReactNode } from "react";

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export type EmailTheme = "light" | "dark";

type EmailTemplateProps = {
  appName: string;
  actionUrl: string;
  logoUrl?: string;
  supportEmail?: string;
  theme?: EmailTheme;
};

type AdminInviteEmailProps = {
  appName: string;
  actionUrl: string;
  expiresAtLabel: string;
  inviterName?: string;
  inviteeName?: string;
  logoUrl?: string;
  supportEmail?: string;
  theme?: EmailTheme;
};

const themeClasses = (theme: EmailTheme) => {
  if (theme === "dark") {
    return {
      body: "bg-slate-950 text-slate-100",
      card: "bg-slate-900 border border-slate-800",
      eyebrow: "text-slate-400",
      text: "text-slate-100",
      muted: "text-slate-400",
      button: "bg-white text-slate-900",
      link: "text-slate-200",
      divider: "border-slate-800",
    };
  }

  return {
    body: "bg-slate-50 text-slate-900",
    card: "bg-white border border-slate-200",
    eyebrow: "text-slate-500",
    text: "text-slate-800",
    muted: "text-slate-500",
    button: "bg-slate-900 text-white",
    link: "text-slate-900",
    divider: "border-slate-200",
  };
};

const EmailLayout = ({
  appName,
  logoUrl,
  supportEmail,
  theme = "light",
  preview,
  children,
}: {
  appName: string;
  logoUrl?: string;
  supportEmail?: string;
  theme?: EmailTheme;
  preview: string;
  children: ReactNode;
}) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Tailwind>
      <Body className={`mx-auto font-sans ${themeClasses(theme).body}`}>
        <Container className={`mx-auto my-10 rounded-3xl px-8 py-10 shadow-[0_30px_80px_-60px_rgba(15,23,42,0.6)] ${themeClasses(theme).card}`}>
          <Section className="mb-6 flex items-center gap-3">
            {logoUrl ? (
              <Img src={logoUrl} alt={`${appName} logo`} className="h-10 w-10 rounded-xl" />
            ) : null}
            <Text className={`text-xs font-semibold uppercase tracking-[0.32em] ${themeClasses(theme).eyebrow}`}>
              {appName}
            </Text>
          </Section>
          {children}
          <Hr className={`my-6 ${themeClasses(theme).divider}`} />
          <Text className={`text-xs ${themeClasses(theme).muted}`}>
            Need help?
            {supportEmail ? (
              <>
                {" "}
                <Link href={`mailto:${supportEmail}`} className={themeClasses(theme).link}>
                  {supportEmail}
                </Link>
              </>
            ) : (
              " Reply to this email."
            )}
          </Text>
          <Text className={`text-xs ${themeClasses(theme).muted}`}>
            © {new Date().getFullYear()} {appName}. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export const VerificationEmail = ({
  appName,
  actionUrl,
  logoUrl,
  supportEmail,
  theme = "light",
}: EmailTemplateProps) => (
  <EmailLayout
    appName={appName}
    logoUrl={logoUrl}
    supportEmail={supportEmail}
    theme={theme}
    preview={`Verify your email for ${appName}`}
  >
    <Heading className={`text-2xl font-semibold ${themeClasses(theme).text}`}>Verify your email</Heading>
    <Text className={`text-sm leading-relaxed ${themeClasses(theme).muted}`}>
      Thanks for signing up! Confirm your email to start using {appName}.
    </Text>
    <Button
      href={actionUrl}
      className={`mt-4 inline-flex rounded-full px-6 py-3 text-sm font-semibold ${themeClasses(theme).button}`}
    >
      Verify email
    </Button>
    <Text className={`mt-6 text-xs ${themeClasses(theme).muted}`}>
      If the button does not work, paste this link into your browser:
    </Text>
    <Link href={actionUrl} className={`text-xs ${themeClasses(theme).link}`}>
      {actionUrl}
    </Link>
  </EmailLayout>
);

export const ResetPasswordEmail = ({
  appName,
  actionUrl,
  logoUrl,
  supportEmail,
  theme = "light",
}: EmailTemplateProps) => (
  <EmailLayout
    appName={appName}
    logoUrl={logoUrl}
    supportEmail={supportEmail}
    theme={theme}
    preview={`Reset your ${appName} password`}
  >
    <Heading className={`text-2xl font-semibold ${themeClasses(theme).text}`}>Reset your password</Heading>
    <Text className={`text-sm leading-relaxed ${themeClasses(theme).muted}`}>
      We received a request to reset your password. Use the button below to continue.
    </Text>
    <Button
      href={actionUrl}
      className={`mt-4 inline-flex rounded-full px-6 py-3 text-sm font-semibold ${themeClasses(theme).button}`}
    >
      Reset password
    </Button>
    <Text className={`mt-6 text-xs ${themeClasses(theme).muted}`}>
      If you did not request this, you can ignore this email.
    </Text>
    <Link href={actionUrl} className={`text-xs ${themeClasses(theme).link}`}>
      {actionUrl}
    </Link>
  </EmailLayout>
);

export const MagicLinkEmail = ({
  appName,
  actionUrl,
  logoUrl,
  supportEmail,
  theme = "light",
}: EmailTemplateProps) => (
  <EmailLayout
    appName={appName}
    logoUrl={logoUrl}
    supportEmail={supportEmail}
    theme={theme}
    preview={`Your ${appName} magic link`}
  >
    <Heading className={`text-2xl font-semibold ${themeClasses(theme).text}`}>Your magic link</Heading>
    <Text className={`text-sm leading-relaxed ${themeClasses(theme).muted}`}>
      Use this link to sign in to {appName}. It expires shortly for your security.
    </Text>
    <Button
      href={actionUrl}
      className={`mt-4 inline-flex rounded-full px-6 py-3 text-sm font-semibold ${themeClasses(theme).button}`}
    >
      Sign in
    </Button>
    <Text className={`mt-6 text-xs ${themeClasses(theme).muted}`}>
      If the button does not work, paste this link into your browser:
    </Text>
    <Link href={actionUrl} className={`text-xs ${themeClasses(theme).link}`}>
      {actionUrl}
    </Link>
  </EmailLayout>
);

export const AdminInviteEmail = ({
  appName,
  actionUrl,
  expiresAtLabel,
  inviterName,
  inviteeName,
  logoUrl,
  supportEmail,
  theme = "light",
}: AdminInviteEmailProps) => (
  <EmailLayout
    appName={appName}
    logoUrl={logoUrl}
    supportEmail={supportEmail}
    theme={theme}
    preview={`You're invited to ${appName}`}
  >
    <Heading className={`text-2xl font-semibold ${themeClasses(theme).text}`}>You&apos;re invited</Heading>
    <Text className={`text-sm leading-relaxed ${themeClasses(theme).muted}`}>
      {inviteeName ? `Hi ${inviteeName},` : "Hi there,"} you&apos;ve been invited to join {appName}
      {inviterName ? ` by ${inviterName}` : ""}.
    </Text>
    <Text className={`text-sm leading-relaxed ${themeClasses(theme).muted}`}>
      Accept the invite with your existing auth method. The invite stays tied to this email address and expires on {expiresAtLabel}.
    </Text>
    <Button
      href={actionUrl}
      className={`mt-4 inline-flex rounded-full px-6 py-3 text-sm font-semibold ${themeClasses(theme).button}`}
    >
      Accept invite
    </Button>
    <Text className={`mt-6 text-xs ${themeClasses(theme).muted}`}>
      If the button does not work, paste this link into your browser:
    </Text>
    <Link href={actionUrl} className={`text-xs ${themeClasses(theme).link}`}>
      {actionUrl}
    </Link>
  </EmailLayout>
);
