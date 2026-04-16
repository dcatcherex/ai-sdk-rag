import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { CheckCircle2Icon, Clock3Icon, MailIcon, ShieldCheckIcon, TriangleAlertIcon, XCircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { account, user as userTable } from "@/db/schema";
import { generateServerMagicLink } from "@/lib/server/magic-link";
import { getAdminUserInviteByToken } from "@/features/admin/invites/service";

import { InviteClaimCard, InviteSwitchAccountCard } from "./invite-claim-client";

type PageProps = {
  params: Promise<{ token: string }>;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const formatDateTime = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(value)
    : "Not available";

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const invite = await getAdminUserInviteByToken(token);

  if (!invite) {
    return (
      <InviteShell>
        <StatusCard
          badge="Invite not found"
          title="This invite link is not valid"
          description="Ask your admin to resend the invite if you still need access."
          icon={<TriangleAlertIcon className="size-4" />}
        />
      </InviteShell>
    );
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const inviteHref = `/invite/${token}`;

  if (!session?.user) {
    // Check if this is a passwordless auto-created account (no credential entry)
    const [invitedUser] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(sql`lower(${userTable.email}) = ${invite.email.trim().toLowerCase()}`)
      .limit(1);

    if (invitedUser) {
      const [credAccount] = await db
        .select({ id: account.id })
        .from(account)
        .where(and(eq(account.userId, invitedUser.id), eq(account.providerId, "credential")))
        .limit(1);

      if (!credAccount) {
        // Auto-login via magic link — no email sent, token is granted here server-side
        const magicLinkUrl = await generateServerMagicLink(invite.email, inviteHref);
        redirect(magicLinkUrl);
      }
    }

    // Existing account with password, or no account yet — go to sign-in / register
    const signInHref = `/sign-in?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(inviteHref)}`;
    redirect(signInHref);
  }

  const emailMatches = normalizeEmail(session.user.email) === normalizeEmail(invite.email);

  return (
    <InviteShell>
      <div className="space-y-6">
        <header className="space-y-3">
          <Badge variant="outline" className="w-fit gap-1.5">
            <MailIcon className="size-3.5" />
            Admin invite
          </Badge>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {invite.name ? `Welcome, ${invite.name}` : "You have been invited"}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              This access flow keeps the invite tied to <strong>{invite.email}</strong> and uses your existing Vaja sign-in methods.
            </p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            {!emailMatches ? (
              <InviteSwitchAccountCard
                invitedEmail={invite.email}
                currentEmail={session.user.email}
                signInHref={`/sign-in?email=${encodeURIComponent(invite.email)}&next=${encodeURIComponent(inviteHref)}`}
              />
            ) : invite.status === "cancelled" ? (
              <StatusCard
                badge="Invite cancelled"
                title="This invite has been cancelled"
                description="Ask your admin to send a fresh invite if you still need access."
                icon={<XCircleIcon className="size-4" />}
              />
            ) : invite.status === "expired" ? (
              <StatusCard
                badge="Invite expired"
                title="This invite has expired"
                description="Invite links stay active for a limited time. Ask your admin for a new invite."
                icon={<Clock3Icon className="size-4" />}
              />
            ) : invite.status === "accepted" && invite.acceptedUserId && invite.acceptedUserId !== session.user.id ? (
              <StatusCard
                badge="Already claimed"
                title="This invite is already linked to another account"
                description="If this seems wrong, ask an admin to review the invite history and send a replacement."
                icon={<TriangleAlertIcon className="size-4" />}
              />
            ) : invite.status === "accepted" ? (
              <StatusCard
                badge="Invite ready"
                title="Your invite is already active"
                description="This invite has already been accepted for your account. You can head back into Vaja at any time."
                icon={<CheckCircle2Icon className="size-4" />}
                footer={<Link className="text-sm font-medium text-primary hover:underline" href="/">Open Vaja</Link>}
              />
            ) : (
              <InviteClaimCard token={token} />
            )}
          </div>

          <Card className="border-black/5 bg-white/85 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:border-border dark:bg-card/85 dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
            <CardHeader>
              <CardTitle>Invite details</CardTitle>
              <CardDescription>Quick summary of what this invite will do when it is accepted.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <DetailRow
                label="Invited email"
                value={invite.email}
              />
              <DetailRow
                label="Approval"
                value={invite.approvedOnAccept ? "Auto-approve on accept" : "Approval stays pending"}
              />
              <DetailRow
                label="Starting credits"
                value={`${invite.initialCreditGrant} credits`}
              />
              <DetailRow
                label="Expires"
                value={formatDateTime(invite.expiresAt)}
              />
              <DetailRow
                label="Current status"
                value={invite.status}
              />
              {invite.acceptedAt ? (
                <DetailRow
                  label="Accepted"
                  value={formatDateTime(invite.acceptedAt)}
                />
              ) : null}
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/40 p-4 text-xs text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                  <ShieldCheckIcon className="size-4" />
                  Security note
                </div>
                This invite can only be claimed after you authenticate with the invited email address.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fdf5e6,_#f6eee1_45%,_#efe6d7_100%)] px-4 py-10 dark:bg-[radial-gradient(circle_at_top,_#1c1a2e,_#181628_55%,_#141220_100%)]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        {children}
      </div>
    </div>
  );
}

function StatusCard({
  badge,
  title,
  description,
  icon,
  footer,
}: {
  badge: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="border-black/5 bg-white/85 shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] dark:border-border dark:bg-card/85 dark:shadow-[0_20px_45px_-30px_rgba(0,0,0,0.6)]">
      <CardHeader className="space-y-3">
        <Badge variant="outline" className="w-fit gap-1.5">
          {icon}
          {badge}
        </Badge>
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      {footer ? <CardContent>{footer}</CardContent> : null}
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[16rem] text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
