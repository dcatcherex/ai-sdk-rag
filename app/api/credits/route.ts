import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserBalance } from '@/lib/credits';
import { db } from '@/lib/db';
import { creditTransaction } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const balance = await getUserBalance(session.user.id);

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
    .where(eq(creditTransaction.userId, session.user.id))
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
