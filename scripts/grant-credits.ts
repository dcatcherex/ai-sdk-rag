/**
 * Grant credits to existing users who signed up before the credit system.
 *
 * Usage:
 *   pnpm tsx scripts/grant-credits.ts                  # grant 100 credits to all users without a balance
 *   pnpm tsx scripts/grant-credits.ts --amount 200     # grant 200 credits
 *   pnpm tsx scripts/grant-credits.ts --email foo@bar  # grant to a specific user
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, sql as rawSql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import * as schema from '../db/schema';

const args = process.argv.slice(2);
const amountFlag = args.indexOf('--amount');
const emailFlag = args.indexOf('--email');
const amount = amountFlag !== -1 ? Number(args[amountFlag + 1]) : 100;
const targetEmail = emailFlag !== -1 ? args[emailFlag + 1] : undefined;

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const db = drizzle({ client: sql, schema });

  // Find users
  const users = targetEmail
    ? await db.select({ id: schema.user.id, email: schema.user.email }).from(schema.user).where(eq(schema.user.email, targetEmail))
    : await db.select({ id: schema.user.id, email: schema.user.email }).from(schema.user);

  console.log(`Found ${users.length} user(s)`);

  for (const u of users) {
    // Ensure credit row exists
    await db
      .insert(schema.userCredit)
      .values({ userId: u.id, balance: 0 })
      .onConflictDoNothing();

    // Check current balance
    const current = await db
      .select({ balance: schema.userCredit.balance })
      .from(schema.userCredit)
      .where(eq(schema.userCredit.userId, u.id))
      .limit(1);

    const currentBalance = current[0]?.balance ?? 0;

    // Only grant if balance is 0
    if (currentBalance > 0) {
      console.log(`  ${u.email}: already has ${currentBalance} credits, skipping`);
      continue;
    }

    // Grant credits
    const updated = await db
      .update(schema.userCredit)
      .set({ balance: rawSql`${schema.userCredit.balance} + ${amount}` })
      .where(eq(schema.userCredit.userId, u.id))
      .returning({ balance: schema.userCredit.balance });

    const newBalance = updated[0]?.balance ?? amount;

    await db.insert(schema.creditTransaction).values({
      id: nanoid(),
      userId: u.id,
      amount,
      balance: newBalance,
      type: 'grant',
      description: `Admin grant: ${amount} credits (existing user migration)`,
    });

    console.log(`  ${u.email}: granted ${amount} credits (balance: ${newBalance})`);
  }

  console.log('Done');
}

main().catch(console.error);
