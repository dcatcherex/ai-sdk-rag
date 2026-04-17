import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { chatRunsQuerySchema } from '@/features/chat/audit/schema';
import { getChatRunsOverview } from '@/features/chat/audit/queries';

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
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
    const overview = await getChatRunsOverview(authResult.user.id, parsed.data);
    return NextResponse.json(overview);
  } catch (error) {
    console.error('Chat runs query failed', error);
    return NextResponse.json(
      { error: 'Failed to fetch chat runs' },
      { status: 500 },
    );
  }
}
