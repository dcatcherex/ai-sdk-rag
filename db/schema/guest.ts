import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Guest session — created when an unauthenticated user first visits.
 * Credits are deducted here instead of userCredit.
 * Anti-abuse: one session per IP per TTL window (enforced in the API route).
 */
export const guestSession = pgTable(
  "guest_session",
  {
    id: text("id").primaryKey(),                         // nanoid — stored as cookie
    ipHash: text("ip_hash").notNull(),                   // SHA-256(ip + secret)
    credits: integer("credits").notNull().default(0),
    totalGranted: integer("total_granted").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("guest_session_ip_hash_idx").on(table.ipHash),
    index("guest_session_expires_at_idx").on(table.expiresAt),
  ],
);
