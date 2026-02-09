import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { creditTransaction, user } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const type = url.searchParams.get('type');
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '30')));
  const offset = (page - 1) * limit;

  let query = db
    .select({
      id: creditTransaction.id,
      userId: creditTransaction.userId,
      userName: user.name,
      userEmail: user.email,
      amount: creditTransaction.amount,
      balance: creditTransaction.balance,
      type: creditTransaction.type,
      description: creditTransaction.description,
      createdAt: creditTransaction.createdAt,
    })
    .from(creditTransaction)
    .leftJoin(user, eq(creditTransaction.userId, user.id))
    .orderBy(desc(creditTransaction.createdAt))
    .limit(limit)
    .offset(offset)
    .$dynamic();

  if (userId) {
    query = query.where(eq(creditTransaction.userId, userId));
  }
  if (type) {
    query = query.where(eq(creditTransaction.type, type));
  }

  const transactions = await query;

  return Response.json({ transactions });
}
