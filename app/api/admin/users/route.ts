import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user, userCredit } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';

type SortBy = 'joined' | 'lastActive' | 'runs' | 'creditsUsed' | 'balance';

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;
  const pendingOnly = url.searchParams.get('pending') === 'true';
  const sortBy = (url.searchParams.get('sortBy') ?? 'joined') as SortBy;

  const searchFilter = search
    ? or(
        ilike(user.name, `%${search}%`),
        ilike(user.email, `%${search}%`),
      )
    : undefined;
  const approvalFilter = pendingOnly ? eq(user.approved, false) : undefined;
  const whereClause =
    searchFilter && approvalFilter
      ? and(searchFilter, approvalFilter)
      : searchFilter ?? approvalFilter;

  const sortOrderMap: Record<SortBy, ReturnType<typeof sql>> = {
    joined: sql`${user.createdAt} DESC`,
    lastActive: sql`last_active_at DESC NULLS LAST`,
    runs: sql`total_runs DESC`,
    creditsUsed: sql`credits_used DESC`,
    balance: sql`balance DESC`,
  };

  const baseQuery = db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      approved: user.approved,
      createdAt: user.createdAt,
      balance: sql<number>`COALESCE(${userCredit.balance}, 0)`.as('balance'),
      lastActiveAt: sql<string | null>`(
        SELECT MAX(r.created_at) FROM (
          SELECT created_at FROM chat_run WHERE user_id = ${user.id}
          UNION ALL
          SELECT created_at FROM tool_run WHERE user_id = ${user.id}
          UNION ALL
          SELECT created_at FROM workspace_ai_run WHERE user_id = ${user.id}
        ) r
      )`.as('last_active_at'),
      totalRuns: sql<number>`COALESCE((
        SELECT COUNT(*) FROM (
          SELECT id FROM chat_run WHERE user_id = ${user.id}
          UNION ALL
          SELECT id FROM tool_run WHERE user_id = ${user.id}
          UNION ALL
          SELECT id FROM workspace_ai_run WHERE user_id = ${user.id}
        ) r
      ), 0)`.as('total_runs'),
      creditsUsed: sql<number>`COALESCE((
        SELECT SUM(ABS(amount)) FROM credit_transaction
        WHERE user_id = ${user.id} AND amount < 0
      ), 0)`.as('credits_used'),
    })
    .from(user)
    .leftJoin(userCredit, eq(user.id, userCredit.userId));

  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const countQuery = db.select({ count: sql<number>`count(*)` }).from(user);

  const [users, countResult] = await Promise.all([
    filteredQuery.orderBy(sortOrderMap[sortBy]).limit(limit).offset(offset),
    (whereClause ? countQuery.where(whereClause) : countQuery).then((r) => r[0]?.count ?? 0),
  ]);

  return Response.json({
    users,
    total: Number(countResult),
    page,
    totalPages: Math.ceil(Number(countResult) / limit),
  });
}

export async function PATCH(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const { userId, approved } = await req.json() as { userId: string; approved: boolean };
  if (!userId || typeof approved !== 'boolean') {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  await db.update(user).set({ approved }).where(eq(user.id, userId));
  return Response.json({ ok: true });
}
