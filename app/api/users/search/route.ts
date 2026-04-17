import { NextResponse } from 'next/server';
import { and, ilike, ne, or } from 'drizzle-orm';

import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { user as userTable } from '@/db/schema';

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ users: [] });

  const users = await db
    .select({ id: userTable.id, name: userTable.name, email: userTable.email, image: userTable.image })
    .from(userTable)
    .where(
      and(
        ne(userTable.id, authResult.user.id),
        or(ilike(userTable.name, `%${q}%`), ilike(userTable.email, `%${q}%`)),
      ),
    )
    .limit(10);

  return NextResponse.json({ users });
}
