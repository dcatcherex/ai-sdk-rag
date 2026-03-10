import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { and, ilike, ne, or } from 'drizzle-orm';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { user as userTable } from '@/db/schema';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ users: [] });

  const users = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email, image: userTable.image })
    .from(userTable)
    .where(
      and(
        ne(userTable.id, session.user.id),
        or(ilike(userTable.name, `%${q}%`), ilike(userTable.email, `%${q}%`)),
      ),
    )
    .limit(10);

  return NextResponse.json({ users });
}
