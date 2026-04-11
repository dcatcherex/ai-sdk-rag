import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user, userCredit } from '@/db/schema';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const search = url.searchParams.get('search') ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;
  const pendingOnly = url.searchParams.get('pending') === 'true';

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

  const baseQuery = db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      approved: user.approved,
      createdAt: user.createdAt,
      balance: sql<number>`COALESCE(${userCredit.balance}, 0)`.as('balance'),
    })
    .from(user)
    .leftJoin(userCredit, eq(user.id, userCredit.userId));

  const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(user);

  const [users, countResult] = await Promise.all([
    filteredQuery.orderBy(desc(user.createdAt)).limit(limit).offset(offset),
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
