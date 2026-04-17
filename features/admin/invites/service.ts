// ─────────────────────────────────────────────────────────────────────────────
// Admin user invites — Clerk-backed.
//
// This service creates/resends/cancels user invitations via Clerk. Our
// `adminUserInvite` table is kept as an **audit log** and status mirror.
//
// Flow:
//   1. Admin calls createAdminUserInvite(...)
//   2. We insert/update the audit row (status="invited")
//   3. We call clerkClient.invitations.createInvitation({
//        emailAddress,
//        redirectUrl,
//        publicMetadata: { inviteId, invitedBy, approvedOnAccept, initialCreditGrant },
//      })  — Clerk sends a branded invite email.
//   4. We store Clerk's invitation ID in adminUserInvite.token (reusing the
//      legacy column for the new ID so no migration is needed).
//   5. When the user signs up, Clerk fires user.created webhook →
//      app/api/webhooks/clerk/route.ts reads publicMetadata.inviteId,
//      grants credits, sets approval, and marks the audit row accepted.
//
// Credits are granted in the webhook, NEVER here.
// See docs/clerk-migration-implementation-guide.md §10.
// ─────────────────────────────────────────────────────────────────────────────

import { desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { adminUserInvite, user } from "@/db/schema";
import { db } from "@/lib/db";
import { clerkClient } from "@/lib/auth-server";

import { createAdminUserInviteSchema, listAdminUserInvitesSchema } from "./schema";
import type {
  AdminUserInviteListResult,
  AdminUserInviteRecord,
  AdminUserInviteStatus,
} from "./types";

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

const getEffectiveInviteStatus = (
  invite: InviteRow,
  now = new Date(),
): AdminUserInviteStatus => {
  if (invite.status === "cancelled" || invite.cancelledAt) return "cancelled";
  if (invite.status === "accepted" || invite.acceptedAt) return "accepted";
  if (invite.expiresAt <= now) return "expired";
  return "invited";
};

const mapInviteRecord = (
  invite: InviteRow,
  usersById?: Map<string, UserSummary>,
): AdminUserInviteRecord => {
  const invitedByUser = invite.invitedByUserId
    ? usersById?.get(invite.invitedByUserId)
    : undefined;
  const acceptedUser = invite.acceptedUserId
    ? usersById?.get(invite.acceptedUserId)
    : undefined;

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
  const uniqueUserIds = Array.from(
    new Set(userIds.filter((id): id is string => Boolean(id))),
  );
  if (!uniqueUserIds.length) {
    return new Map<string, UserSummary>();
  }

  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(inArray(user.id, uniqueUserIds));

  return new Map(rows.map((row) => [row.id, row]));
}

async function mapInviteRecords(invites: InviteRow[]) {
  const usersById = await loadUsersById(
    invites.flatMap((i) => [i.invitedByUserId, i.acceptedUserId]),
  );
  return invites.map((invite) => mapInviteRecord(invite, usersById));
}

function getAppBaseUrl(requestOrigin?: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    requestOrigin;
  if (!base) {
    throw new AdminInviteError("Unable to determine app base URL for invite.", {
      code: "missing_base_url",
      status: 500,
    });
  }
  return base;
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

  const invites = (await mapInviteRecords(rows)).filter((invite) =>
    parsed.status ? invite.status === parsed.status : true,
  );

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

async function createClerkInvitation(opts: {
  auditInviteId: string;
  invitedByUserId: string;
  email: string;
  approvedOnAccept: boolean;
  initialCreditGrant: number;
  redirectUrl: string;
}): Promise<string> {
  const client = await clerkClient();
  const invitation = await client.invitations.createInvitation({
    emailAddress: opts.email,
    redirectUrl: opts.redirectUrl,
    publicMetadata: {
      inviteId: opts.auditInviteId,
      invitedBy: opts.invitedByUserId,
      approvedOnAccept: opts.approvedOnAccept,
      initialCreditGrant: opts.initialCreditGrant,
    },
    notify: true,
    ignoreExisting: false,
  });
  return invitation.id;
}

async function revokeClerkInvitationIfAny(clerkInvitationId: string | null | undefined) {
  if (!clerkInvitationId) return;
  // Legacy audit rows may have app-side tokens (nanoid(32)) stored here.
  // Clerk IDs start with "inv_" — skip anything else.
  if (!clerkInvitationId.startsWith("inv_")) return;
  try {
    const client = await clerkClient();
    await client.invitations.revokeInvitation(clerkInvitationId);
  } catch (err) {
    console.warn("[admin-invite] Failed to revoke Clerk invitation", err);
  }
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
  const expiresAt = new Date(
    now.getTime() + parsed.expiresInDays * 24 * 60 * 60 * 1000,
  );

  // Guard: if this email already corresponds to an active app user, stop.
  const [existingUser] = await db
    .select({ id: user.id, approved: user.approved })
    .from(user)
    .where(sql`lower(${user.email}) = ${normalizedEmail}`)
    .limit(1);

  if (existingUser?.approved) {
    throw new AdminInviteError(
      "This email already belongs to an active user. Ask them to sign in instead.",
      { code: "invite_user_already_active", status: 409 },
    );
  }

  // Find any prior invite for this email — we reuse/update it rather than duplicating.
  const existingRows = await db
    .select()
    .from(adminUserInvite)
    .where(sql`lower(${adminUserInvite.email}) = ${normalizedEmail}`)
    .orderBy(desc(adminUserInvite.createdAt))
    .limit(1);

  const existingInvite = existingRows[0];
  let inviteRow: InviteRow;

  if (existingInvite && getEffectiveInviteStatus(existingInvite, now) === "invited") {
    // Revoke the old Clerk invitation so the new one is the only valid link.
    await revokeClerkInvitationIfAny(existingInvite.token);

    const updatedRows = await db
      .update(adminUserInvite)
      .set({
        email: normalizedEmail,
        name: parsed.name ?? null,
        status: "invited",
        token: "", // filled in after Clerk call below
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
        token: "", // filled in after Clerk call below
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

  // Create the Clerk invitation — Clerk sends the email.
  const redirectUrl = new URL("/", getAppBaseUrl(options.requestOrigin)).toString();
  let clerkInvitationId: string;
  try {
    clerkInvitationId = await createClerkInvitation({
      auditInviteId: inviteRow.id,
      invitedByUserId: options.invitedByUserId,
      email: normalizedEmail,
      approvedOnAccept: parsed.approvedOnAccept,
      initialCreditGrant: parsed.initialCreditGrant,
      redirectUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new AdminInviteError(`Failed to create Clerk invitation: ${message}`, {
      code: "clerk_invitation_failed",
      status: 502,
    });
  }

  // Persist Clerk invitation ID in the token column (reused for that purpose).
  const withTokenRows = await db
    .update(adminUserInvite)
    .set({ token: clerkInvitationId, updatedAt: new Date() })
    .where(eq(adminUserInvite.id, inviteRow.id))
    .returning();

  const [invite] = await mapInviteRecords([withTokenRows[0]!]);
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
    throw new AdminInviteError("Invite not found.", {
      code: "invite_not_found",
      status: 404,
    });
  }
  if (getEffectiveInviteStatus(invite) !== "invited") {
    throw new AdminInviteError("Only active invites can be resent.", {
      code: "invite_not_active",
      status: 400,
    });
  }

  // Revoke the previous Clerk invitation, then create a fresh one.
  await revokeClerkInvitationIfAny(invite.token);

  const now = new Date();
  const redirectUrl = new URL("/", getAppBaseUrl(options.requestOrigin)).toString();
  const clerkInvitationId = await createClerkInvitation({
    auditInviteId: invite.id,
    invitedByUserId: invite.invitedByUserId ?? "",
    email: invite.email,
    approvedOnAccept: invite.approvedOnAccept,
    initialCreditGrant: invite.initialCreditGrant,
    redirectUrl,
  });

  const updatedRows = await db
    .update(adminUserInvite)
    .set({ token: clerkInvitationId, lastSentAt: now, updatedAt: now })
    .where(eq(adminUserInvite.id, invite.id))
    .returning();

  const [updatedInvite] = await mapInviteRecords([updatedRows[0]!]);
  return updatedInvite;
}

export async function cancelAdminUserInvite(
  inviteId: string,
): Promise<AdminUserInviteRecord> {
  const rows = await db
    .select()
    .from(adminUserInvite)
    .where(eq(adminUserInvite.id, inviteId))
    .limit(1);

  const invite = rows[0];
  if (!invite) {
    throw new AdminInviteError("Invite not found.", {
      code: "invite_not_found",
      status: 404,
    });
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

  // Revoke the matching Clerk invitation so the link stops working.
  await revokeClerkInvitationIfAny(invite.token);

  const now = new Date();
  const updatedRows = await db
    .update(adminUserInvite)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
    .where(eq(adminUserInvite.id, invite.id))
    .returning();

  const [mappedInvite] = await mapInviteRecords([updatedRows[0]!]);
  return mappedInvite;
}
