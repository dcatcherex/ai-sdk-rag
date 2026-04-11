import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { workspaceTextAssistRequestSchema } from '@/features/workspace-ai/schema';
import { runWorkspaceTextAssist } from '@/features/workspace-ai/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = workspaceTextAssistRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  try {
    const result = await runWorkspaceTextAssist(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Workspace AI text assist failed', error);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}
