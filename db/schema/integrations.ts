import { relations, sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const connectedAccount = pgTable("connected_account", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // 'google'
  providerAccountId: text("provider_account_id").notNull(),
  email: text("email"),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  scopes: jsonb("scopes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
}, (table) => [
  index("connected_account_userId_idx").on(table.userId),
  index("connected_account_provider_idx").on(table.provider),
  uniqueIndex("connected_account_user_provider_providerAccount_idx")
    .on(table.userId, table.provider, table.providerAccountId),
]);

export const connectedAccountRelations = relations(connectedAccount, ({ one }) => ({
  user: one(user, { fields: [connectedAccount.userId], references: [user.id] }),
}));
