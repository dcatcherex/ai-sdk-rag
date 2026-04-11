import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

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
