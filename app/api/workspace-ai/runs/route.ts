import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { workspaceAiRunsQuerySchema } from '@/features/workspace-ai/schema';
import { getWorkspaceAiRunsOverview } from '@/features/workspace-ai/queries';

export async function GET(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const { searchParams } = new URL(req.url);
  const parsed = workspaceAiRunsQuerySchema.safeParse({
    limit: searchParams.get('limit') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid query' },
      { status: 400 },
    );
  }

  try {
    const overview = await getWorkspaceAiRunsOverview(authResult.user.id, parsed.data);
    return NextResponse.json(overview);
  } catch (error) {
    console.error('Workspace AI runs query failed', error);
    return NextResponse.json(
      { error: 'Failed to fetch workspace AI runs' },
      { status: 500 },
    );
  }
}
