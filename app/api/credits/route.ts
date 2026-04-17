import { headers } from 'next/headers';
import { requireUser } from "@/lib/auth-server";
import { getUserBalance } from '@/lib/credits';
import { db } from '@/lib/db';
import { creditTransaction } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const balance = await getUserBalance(authResult.user.id);

  const recentTransactions = await db
    .select({
      id: creditTransaction.id,
      amount: creditTransaction.amount,
      balance: creditTransaction.balance,
      type: creditTransaction.type,
      description: creditTransaction.description,
      createdAt: creditTransaction.createdAt,
    })
    .from(creditTransaction)
    .where(eq(creditTransaction.userId, authResult.user.id))
    .orderBy(desc(creditTransaction.createdAt))
    .limit(20);

  return Response.json(
    { balance, transactions: recentTransactions },
    {
      headers: {
        'Cache-Control': 'private, s-maxage=30, stale-while-revalidate=60',
      },
    }
  );
}
