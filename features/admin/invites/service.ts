import { createElement } from "react";

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { account, adminUserInvite, creditTransaction, user, userCredit, verification } from "@/db/schema";
import { addCredits, SIGNUP_BONUS_CREDITS } from "@/lib/credits";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { AdminInviteEmail } from "@/lib/email-templates";

import { createAdminUserInviteSchema, listAdminUserInvitesSchema } from "./schema";
import type {
  AdminUserInviteListResult,
  AdminUserInviteRecord,
  AdminUserInviteStatus,
  ClaimAdminInviteResult,
} from "./types";

const APP_NAME = "Vaja AI";
const DEFAULT_EXPIRY_DAYS = 7;
const DEFAULT_INVITE_LIMIT = 20;

type InviteRow = typeof adminUserInvite.$inferSelect;
type UserSummary = { id: string; name: string; email: string };

export class AdminInviteError extends Error {
  code: string;
  status: number;

  constructor(message: string, options: { code: string; status: number }) {
    super(message);
    this.code = options.code;
    this.status = options.status;
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getEffectiveInviteStatus = (invite: InviteRow, now = new Date()): AdminUserInviteStatus => {
  if (invite.status === "cancelled" || invite.cancelledAt) return "cancelled";
  if (invite.status === "accepted" || invite.acceptedAt) return "accepted";
  if (invite.expiresAt <= now) return "expired";
  return "invited";
};

const mapInviteRecord = (invite: InviteRow, usersById?: Map<string, UserSummary>): AdminUserInviteRecord => {
  const invitedByUser = invite.invitedByUserId ? usersById?.get(invite.invitedByUserId) : undefined;
  const acceptedUser = invite.acceptedUserId ? usersById?.get(invite.acceptedUserId) : undefined;

  return {
    id: invite.id,
    email: invite.email,
    name: invite.name,
    status: getEffectiveInviteStatus(invite),
    token: invite.token,
    invitedByUserId: invite.invitedByUserId,
    invitedByUserName: invitedByUser?.name ?? null,
    invitedByUserEmail: invitedByUser?.email ?? null,
    approvedOnAccept: invite.approvedOnAccept,
    initialCreditGrant: invite.initialCreditGrant,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
    acceptedUserId: invite.acceptedUserId,
    acceptedUserName: acceptedUser?.name ?? null,
    acceptedUserEmail: acceptedUser?.email ?? null,
    cancelledAt: invite.cancelledAt,
    lastSentAt: invite.lastSentAt,
    creditGrantedAt: invite.creditGrantedAt,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
  };
};

async function loadUsersById(userIds: Array<string | null | undefined>) {
  const uniqueUserIds = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (!uniqueUserIds.length) {
    return new Map<string, UserSummary>();
  }

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(inArray(user.id, uniqueUserIds));

  return new Map(rows.map((row) => [row.id, row]));
}

async function mapInviteRecords(invites: InviteRow[]) {
  const usersById = await loadUsersById(
    invites.flatMap((invite) => [invite.invitedByUserId, invite.acceptedUserId]),
  );

  return invites.map((invite) => mapInviteRecord(invite, usersById));
}

const inviteUrlFor = (baseUrl: string, token: string) => new URL(`/invite/${token}`, baseUrl).toString();

const getBaseUrl = (requestOrigin?: string) => {
  const baseUrl = process.env.BETTER_AUTH_URL ?? requestOrigin;
  if (!baseUrl) {
    throw new AdminInviteError("Unable to determine app base URL for invite email.", {
      code: "missing_base_url",
      status: 500,
    });
  }
  return baseUrl;
};

async function sendAdminInviteEmail(options: {
  invite: AdminUserInviteRecord;
  baseUrl: string;
  inviterName?: string | null;
}) {
  const inviteUrl = inviteUrlFor(options.baseUrl, options.invite.token);

  await sendEmail({
    to: options.invite.email,
    subject: `You're invited to ${APP_NAME}`,
    text: [
      `You've been invited to ${APP_NAME}.`,
      `Accept your invite: ${inviteUrl}`,
      `This invite expires on ${options.invite.expiresAt.toLocaleString("en-US")}.`,
    ].join("\n"),
    react: createElement(AdminInviteEmail, {
      appName: APP_NAME,
      actionUrl: inviteUrl,
      expiresAtLabel: options.invite.expiresAt.toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      inviterName: options.inviterName ?? undefined,
      inviteeName: options.invite.name ?? undefined,
    }),
  });
}

export async function getAdminUserInvites(input?: {
  search?: string;
  status?: AdminUserInviteStatus;
  page?: number;
  limit?: number;
}): Promise<AdminUserInviteListResult> {
  const parsed = listAdminUserInvitesSchema.parse({
    search: input?.search,
    status: input?.status,
    page: input?.page,
    limit: input?.limit ?? DEFAULT_INVITE_LIMIT,
  });

  const whereClause = parsed.search
    ? or(
        ilike(adminUserInvite.email, `%${parsed.search}%`),
        ilike(adminUserInvite.name, `%${parsed.search}%`),
      )
    : undefined;

  let query = db.select().from(adminUserInvite).$dynamic();

  if (whereClause) {
    query = query.where(whereClause);
  }

  const rows = await query.orderBy(desc(adminUserInvite.createdAt));

  const invites = (await mapInviteRecords(rows))
    .filter((invite) => (parsed.status ? invite.status === parsed.status : true));

  const total = invites.length;
  const offset = (parsed.page - 1) * parsed.limit;
  const pagedInvites = invites.slice(offset, offset + parsed.limit);

  return {
    invites: pagedInvites,
    total,
    page: parsed.page,
    totalPages: Math.max(1, Math.ceil(total / parsed.limit)),
  };
}

export async function getAdminUserInviteByToken(token: string): Promise<AdminUserInviteRecord | null> {
  const rows = await db
    .select()
    .from(adminUserInvite)
    .where(eq(adminUserInvite.token, token))
    .limit(1);

  const invite = rows[0];
  if (!invite) return null;

  const [mappedInvite] = await mapInviteRecords([invite]);
  return mappedInvite ?? null;
}

export async function createAdminUserInvite(options: {
  invitedByUserId: string;
  inviterName?: string | null;
  requestOrigin?: string;
  email: string;
  name?: string;
  approvedOnAccept?: boolean;
  initialCreditGrant?: number;
  expiresInDays?: number;
}): Promise<AdminUserInviteRecord> {
  const parsed = createAdminUserInviteSchema.parse({
    email: options.email,
    name: options.name,
    approvedOnAccept: options.approvedOnAccept,
    initialCreditGrant: options.initialCreditGrant,
    expiresInDays: options.expiresInDays ?? DEFAULT_EXPIRY_DAYS,
  });

  const normalizedEmail = normalizeEmail(parsed.email);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + parsed.expiresInDays * 24 * 60 * 60 * 1000);
  const token = nanoid(32);

  const [existingUser] = await db
    .select({
      id: user.id,
      approved: user.approved,
      emailVerified: user.emailVerified,
    })
    .from(user)
    .where(sql`lower(${user.email}) = ${normalizedEmail}`)
    .limit(1);

  if (existingUser?.approved) {
    throw new AdminInviteError("This email already belongs to an active user. Ask them to sign in instead of sending a new invite.", {
      code: "invite_user_already_active",
      status: 409,
    });
  }

  const existingRows = await db
    .select()
    .from(adminUserInvite)
    .where(sql`lower(${adminUserInvite.email}) = ${normalizedEmail}`)
    .orderBy(desc(adminUserInvite.createdAt))
    .limit(1);

  const existingInvite = existingRows[0];
  let inviteRow: InviteRow;

  if (existingInvite && getEffectiveInviteStatus(existingInvite, now) === "invited") {
    const updatedRows = await db
      .update(adminUserInvite)
      .set({
        email: normalizedEmail,
        name: parsed.name ?? null,
        status: "invited",
        token,
        invitedByUserId: options.invitedByUserId,
        approvedOnAccept: parsed.approvedOnAccept,
        initialCreditGrant: parsed.initialCreditGrant,
        expiresAt,
        cancelledAt: null,
        acceptedAt: null,
        acceptedUserId: null,
        lastSentAt: now,
        creditGrantedAt: null,
        updatedAt: now,
      })
      .where(eq(adminUserInvite.id, existingInvite.id))
      .returning();

    inviteRow = updatedRows[0]!;
  } else {
    const insertedRows = await db
      .insert(adminUserInvite)
      .values({
        id: nanoid(),
        email: normalizedEmail,
        name: parsed.name ?? null,
        status: "invited",
        token,
        invitedByUserId: options.invitedByUserId,
        approvedOnAccept: parsed.approvedOnAccept,
        initialCreditGrant: parsed.initialCreditGrant,
        expiresAt,
        lastSentAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    inviteRow = insertedRows[0]!;
  }

  const [invite] = await mapInviteRecords([inviteRow]);

  // Auto-create a passwordless account if none exists for the invited email.
  // The user will be signed in automatically via magic link when they click the invite.
  if (!existingUser) {
    const newUserId = nanoid();
    await db.insert(user).values({
      id: newUserId,
      name: parsed.name ?? normalizedEmail.split("@")[0],
      email: normalizedEmail,
      emailVerified: true,
      approved: true,
      createdAt: now,
      updatedAt: now,
    });
    await addCredits({
      userId: newUserId,
      amount: SIGNUP_BONUS_CREDITS,
      type: "signup_bonus",
      description: `Welcome bonus: ${SIGNUP_BONUS_CREDITS} credits`,
    });
  }

  await sendAdminInviteEmail({
    invite,
    baseUrl: getBaseUrl(options.requestOrigin),
    inviterName: options.inviterName,
  });

  return invite;
}

export async function resendAdminUserInvite(options: {
  inviteId: string;
  requestOrigin?: string;
  inviterName?: string | null;
}): Promise<AdminUserInviteRecord> {
  const rows = await db
    .select()
    .from(adminUserInvite)
    .where(eq(adminUserInvite.id, options.inviteId))
    .limit(1);

  const invite = rows[0];
  if (!invite) {
    throw new AdminInviteError("Invite not found.", { code: "invite_not_found", status: 404 });
  }

  if (getEffectiveInviteStatus(invite) !== "invited") {
    throw new AdminInviteError("Only active invites can be resent.", {
      code: "invite_not_active",
      status: 400,
    });
  }

  const now = new Date();
  const updatedRows = await db
    .update(adminUserInvite)
    .set({
      lastSentAt: now,
      updatedAt: now,
    })
    .where(eq(adminUserInvite.id, invite.id))
    .returning();

  const [updatedInvite] = await mapInviteRecords([updatedRows[0]!]);

  await sendAdminInviteEmail({
    invite: updatedInvite,
    baseUrl: getBaseUrl(options.requestOrigin),
    inviterName: options.inviterName,
  });

  return updatedInvite;
}

export async function cancelAdminUserInvite(inviteId: string): Promise<AdminUserInviteRecord> {
  const rows = await db
    .select()
    .from(adminUserInvite)
    .where(eq(adminUserInvite.id, inviteId))
    .limit(1);

  const invite = rows[0];
  if (!invite) {
    throw new AdminInviteError("Invite not found.", { code: "invite_not_found", status: 404 });
  }

  const effectiveStatus = getEffectiveInviteStatus(invite);
  if (effectiveStatus === "accepted") {
    throw new AdminInviteError("Accepted invites cannot be cancelled.", {
      code: "invite_already_accepted",
      status: 400,
    });
  }

  if (effectiveStatus === "cancelled") {
    const [mappedInvite] = await mapInviteRecords([invite]);
    return mappedInvite;
  }

  const now = new Date();
  const updatedRows = await db
    .update(adminUserInvite)
    .set({
      status: "cancelled",
      cancelledAt: now,
      updatedAt: now,
    })
    .where(eq(adminUserInvite.id, invite.id))
    .returning();

  const [mappedInvite] = await mapInviteRecords([updatedRows[0]!]);
  return mappedInvite;
}

export async function claimAdminUserInvite(options: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<ClaimAdminInviteResult> {
  const normalizedEmail = normalizeEmail(options.userEmail);
  const now = new Date();

  // Step 1: Read and validate
  const inviteRows = await db
    .select()
    .from(adminUserInvite)
    .where(eq(adminUserInvite.token, options.token))
    .limit(1);

  const invite = inviteRows[0];
  if (!invite) {
    throw new AdminInviteError("Invite not found.", { code: "invite_not_found", status: 404 });
  }

  const effectiveStatus = getEffectiveInviteStatus(invite, now);
  if (effectiveStatus === "cancelled") {
    throw new AdminInviteError("This invite has been cancelled.", { code: "invite_cancelled", status: 410 });
  }
  if (effectiveStatus === "expired") {
    throw new AdminInviteError("This invite has expired.", { code: "invite_expired", status: 410 });
  }
  if (normalizeEmail(invite.email) !== normalizedEmail) {
    throw new AdminInviteError("You must sign in with the invited email address.", {
      code: "invite_email_mismatch",
      status: 403,
    });
  }
  if (effectiveStatus === "accepted") {
    if (invite.acceptedUserId && invite.acceptedUserId !== options.userId) {
      throw new AdminInviteError("This invite has already been claimed by another account.", {
        code: "invite_claimed_by_other_user",
        status: 409,
      });
    }
    return { invite: (await mapInviteRecords([invite]))[0]!, alreadyAccepted: true, needsPasswordSetup: false };
  }

  // Step 2: Atomic status transition — only one concurrent request wins
  const claimedRows = await db
    .update(adminUserInvite)
    .set({ status: "accepted", acceptedAt: now, acceptedUserId: options.userId, updatedAt: now })
    .where(and(eq(adminUserInvite.id, invite.id), eq(adminUserInvite.status, "invited")))
    .returning();

  if (claimedRows.length === 0) {
    // Lost the race — re-read to give an accurate error
    const [current] = await db
      .select()
      .from(adminUserInvite)
      .where(eq(adminUserInvite.id, invite.id))
      .limit(1);
    if (current?.acceptedUserId === options.userId) {
      return { invite: (await mapInviteRecords([current]))[0]!, alreadyAccepted: true, needsPasswordSetup: false };
    }
    throw new AdminInviteError("This invite has already been claimed by another account.", {
      code: "invite_claimed_by_other_user",
      status: 409,
    });
  }

  // Step 3: Approve user if configured (runs only for the winning request)
  if (invite.approvedOnAccept) {
    await db.update(user).set({ approved: true, updatedAt: now }).where(eq(user.id, options.userId));
  }

  // Step 4: Grant starting credits
  let creditGrantedAt = invite.creditGrantedAt;
  if (invite.initialCreditGrant > 0 && !invite.creditGrantedAt) {
    await db.insert(userCredit).values({ userId: options.userId, balance: 0 }).onConflictDoNothing();

    const updatedBalances = await db
      .update(userCredit)
      .set({ balance: sql`${userCredit.balance} + ${invite.initialCreditGrant}`, updatedAt: now })
      .where(eq(userCredit.userId, options.userId))
      .returning({ balance: userCredit.balance });

    await db.insert(creditTransaction).values({
      id: nanoid(),
      userId: options.userId,
      amount: invite.initialCreditGrant,
      balance: updatedBalances[0]?.balance ?? invite.initialCreditGrant,
      type: "grant",
      description: "Admin invite acceptance bonus",
      createdAt: now,
    });

    creditGrantedAt = now;
    await db
      .update(adminUserInvite)
      .set({ creditGrantedAt: now, updatedAt: now })
      .where(eq(adminUserInvite.id, invite.id));
  }

  // Check if user needs to set a password (auto-created accounts have no credential account)
  const [credentialAccount] = await db
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, options.userId), eq(account.providerId, "credential")))
    .limit(1);

  return {
    invite: (await mapInviteRecords([{ ...claimedRows[0]!, creditGrantedAt }]))[0]!,
    alreadyAccepted: false,
    needsPasswordSetup: !credentialAccount,
  };
}
