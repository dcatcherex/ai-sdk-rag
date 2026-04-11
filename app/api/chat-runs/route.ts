import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { chatRunsQuerySchema } from '@/features/chat/audit/schema';
import { getChatRunsOverview } from '@/features/chat/audit/queries';

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = chatRunsQuerySchema.safeParse({
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid query' },
      { status: 400 },
    );
  }

  try {
    const overview = await getChatRunsOverview(session.user.id, parsed.data);
    return NextResponse.json(overview);
  } catch (error) {
    console.error('Chat runs query failed', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat runs' },
      { status: 500 },
    );
  }
}
