import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { agent } from "./agents";

// ── Image Model Config (admin-managed) ────────────────────────────────────────

/**
 * Per-model admin configuration for image generation models.
 * The model registry (KIE_IMAGE_MODELS) is the source of truth for what exists;
 * this table controls what's enabled, which is the default, and pre-set defaults.
 */
export const imageModelConfig = pgTable("image_model_config", {
  id: text("id").primaryKey(),                           // matches KIE_IMAGE_MODELS id
  enabled: boolean("enabled").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  defaultAspectRatio: text("default_aspect_ratio"),
  defaultQuality: text("default_quality"),               // 'medium' | 'high'
  defaultResolution: text("default_resolution"),          // '1K' | '2K' | '4K'
  defaultEnablePro: boolean("default_enable_pro").notNull().default(false),
  defaultGoogleSearch: boolean("default_google_search").notNull().default(false),
  adminNotes: text("admin_notes"),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("image_model_config_enabled_idx").on(table.enabled),
]);

// ── Platform Settings (admin-managed, singleton row id=1) ─────────────────────

export const platformSettings = pgTable("platform_settings", {
  id: integer("id").primaryKey().default(1),
  guestAccessEnabled: boolean("guest_access_enabled").notNull().default(false),
  guestStartingCredits: integer("guest_starting_credits").notNull().default(20),
  guestSessionTtlDays: integer("guest_session_ttl_days").notNull().default(7),
  signupBonusCredits: integer("signup_bonus_credits").notNull().default(100),
  requireEmailVerification: boolean("require_email_verification").notNull().default(true),
  guestStarterAgentId: text("guest_starter_agent_id").references(() => agent.id, { onDelete: "set null" }),
  newUserStarterTemplateId: text("new_user_starter_template_id").references(() => agent.id, { onDelete: "set null" }),
  // null = all models available; set to restrict platform-wide model access
  adminEnabledModelIds: text("admin_enabled_model_ids").array(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const adminUserInvite = pgTable(
  "admin_user_invite",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    status: text("status").default("invited").notNull(),
    token: text("token").notNull().unique(),
    invitedByUserId: text("invited_by_user_id").references(() => user.id, { onDelete: "set null" }),
    approvedOnAccept: boolean("approved_on_accept").default(true).notNull(),
    initialCreditGrant: integer("initial_credit_grant").default(0).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    acceptedUserId: text("accepted_user_id").references(() => user.id, { onDelete: "set null" }),
    cancelledAt: timestamp("cancelled_at"),
    lastSentAt: timestamp("last_sent_at"),
    creditGrantedAt: timestamp("credit_granted_at"),
    clerkInvitationId: text("clerk_invitation_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("admin_user_invite_email_idx").on(table.email),
    index("admin_user_invite_status_idx").on(table.status),
    index("admin_user_invite_token_idx").on(table.token),
    index("admin_user_invite_invitedBy_idx").on(table.invitedByUserId),
    index("admin_user_invite_expiresAt_idx").on(table.expiresAt),
    index("admin_user_invite_acceptedUser_idx").on(table.acceptedUserId),
  ],
);
