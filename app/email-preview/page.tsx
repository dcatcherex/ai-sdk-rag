import { MagicLinkEmail, ResetPasswordEmail, VerificationEmail } from "@/lib/email-templates";

type EmailPreviewPageProps = {
  searchParams?: {
    type?: string;
    theme?: string;
  };
};

const appName = "Vaja AI";
const logoUrl = process.env.AUTH_EMAIL_LOGO_URL;
const supportEmail = process.env.AUTH_SUPPORT_EMAIL;

const getTheme = (theme?: string) => (theme === "dark" ? "dark" : "light");

export default function EmailPreviewPage({ searchParams }: EmailPreviewPageProps) {
  const type = searchParams?.type ?? "verification";
  const theme = getTheme(searchParams?.theme);
  const actionUrl = "https://example.com/action";

  if (type === "reset") {
    return (
      <ResetPasswordEmail
        appName={appName}
        actionUrl={actionUrl}
        logoUrl={logoUrl}
        supportEmail={supportEmail}
        theme={theme}
      />
    );
  }

  if (type === "magic") {
    return (
      <MagicLinkEmail
        appName={appName}
        actionUrl={actionUrl}
        logoUrl={logoUrl}
        supportEmail={supportEmail}
        theme={theme}
      />
    );
  }

  return (
    <VerificationEmail
      appName={appName}
      actionUrl={actionUrl}
      logoUrl={logoUrl}
      supportEmail={supportEmail}
      theme={theme}
    />
  );
}
