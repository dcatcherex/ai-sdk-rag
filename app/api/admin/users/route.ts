import { eq, sql, desc } from 'drizzle-orm';
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

  const pendingOnly = url.searchParams.get('pending') === 'true';

  const filteredQuery = search
    ? baseQuery.where(
        pendingOnly
          ? sql`(${user.name} ILIKE ${'%' + search + '%'} OR ${user.email} ILIKE ${'%' + search + '%'}) AND ${user.approved} = false`
          : sql`(${user.name} ILIKE ${'%' + search + '%'} OR ${user.email} ILIKE ${'%' + search + '%'})`,
      )
    : pendingOnly
      ? baseQuery.where(eq(user.approved, false))
      : baseQuery;

  const [users, countResult] = await Promise.all([
    filteredQuery.orderBy(desc(user.createdAt)).limit(limit).offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .then((r) => r[0]?.count ?? 0),
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
