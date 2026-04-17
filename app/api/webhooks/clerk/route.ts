import { headers } from "next/headers";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user as userTable } from "@/db/schema/auth";
import { adminUserInvite } from "@/db/schema/admin";
import { addCredits } from "@/lib/credits";
import { getPlatformSettings } from "@/lib/platform-settings";
import { isAdminEmail } from "@/lib/admin-emails";

// ─────────────────────────────────────────────────────────────────────────────
// Clerk webhook — single source of truth for user lifecycle side effects.
//
// Configure in Clerk dashboard → Webhooks → Add Endpoint:
//   URL:     https://<YOUR_DOMAIN>/api/webhooks/clerk
//   Events:  user.created, user.updated, user.deleted
//   Copy the signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`.
//
// Local dev: expose via ngrok or Clerk's tunnel and use the dev-instance
// signing secret.
//
// NEVER grant signup credits or upsert the `user` table from anywhere else.
// See: docs/clerk-migration-implementation-guide.md §9, §16.
// ─────────────────────────────────────────────────────────────────────────────

type ClerkEmailAddress = { email_address: string };

type ClerkUserData = {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  public_metadata?: Record<string, unknown>;
};

type ClerkEvent =
  | { type: "user.created"; data: ClerkUserData }
  | { type: "user.updated"; data: ClerkUserData }
  | { type: "user.deleted"; data: { id: string; deleted?: boolean } };

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SIGNING_SECRET missing");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const h = await headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  const payload = await req.text();

  let evt: ClerkEvent;
  try {
    evt = new Webhook(secret).verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkEvent;
  } catch (err) {
    console.error("[clerk-webhook] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (evt.type) {
      case "user.created":
        await handleUserCreated(evt.data);
        break;
      case "user.updated":
        await handleUserUpdated(evt.data);
        break;
      case "user.deleted":
        await handleUserDeleted(evt.data);
        break;
    }
  } catch (err) {
    console.error(`[clerk-webhook] handler failed for ${evt.type}`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok");
}

function extractEmail(data: ClerkUserData): string {
  return (data.email_addresses?.[0]?.email_address ?? "").trim().toLowerCase();
}

function extractName(data: ClerkUserData, email: string): string {
  const full = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  return full || data.username || email.split("@")[0] || "User";
}

async function handleUserCreated(data: ClerkUserData) {
  const id = data.id;
  const email = extractEmail(data);
  const name = extractName(data, email);
  const image = data.image_url ?? null;

  const meta = (data.public_metadata ?? {}) as Record<string, unknown>;
  const inviteId = typeof meta.inviteId === "string" ? meta.inviteId : null;
  const fromInvite = !!inviteId;
  const approvedOnAccept = meta.approvedOnAccept === true;
  const initialCreditGrant =
    typeof meta.initialCreditGrant === "number" ? meta.initialCreditGrant : 0;

  const settings = await getPlatformSettings();
  const requireApproval = process.env.REQUIRE_APPROVAL === "true";
  const isAdmin = isAdminEmail(email);
  const approved = isAdmin || !requireApproval || approvedOnAccept || fromInvite;

  // Idempotent upsert — Clerk may retry webhook deliveries.
  // Also skip if email already exists (e.g. migrated from Better Auth).
  const existing = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(userTable).values({
      id,
      email,
      name,
      image,
      approved,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const bonus = fromInvite
      ? initialCreditGrant
      : settings.signupBonusCredits ?? 0;
    if (bonus > 0) {
      await addCredits({
        userId: id,
        amount: bonus,
        type: fromInvite ? "grant" : "signup_bonus",
        description: fromInvite
          ? `Invite grant: ${bonus} credits`
          : `Welcome bonus: ${bonus} credits`,
      });
    }
  }

  if (inviteId) {
    await db
      .update(adminUserInvite)
      .set({
        status: "accepted",
        acceptedUserId: id,
        acceptedAt: new Date(),
        creditGrantedAt: initialCreditGrant > 0 ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(adminUserInvite.id, inviteId));
  }
}

async function handleUserUpdated(data: ClerkUserData) {
  const email = extractEmail(data);
  const name = extractName(data, email);

  await db
    .update(userTable)
    .set({
      email,
      name,
      image: data.image_url ?? null,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, data.id));
}

async function handleUserDeleted(data: { id: string }) {
  if (!data.id) return;
  await db.delete(userTable).where(eq(userTable.id, data.id));
}
