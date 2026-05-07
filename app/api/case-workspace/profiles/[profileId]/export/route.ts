import { requireUser } from '@/lib/auth-server';
import { exportCaseWorkspace } from '@/features/case-workspace/service';
import { exportCaseWorkspaceInputSchema } from '@/features/case-workspace/schema';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { profileId } = await params;
  const { searchParams } = new URL(req.url);
  const parsed = exportCaseWorkspaceInputSchema.safeParse({
    profileId,
    format: searchParams.get('format') ?? 'csv',
  });

  if (!parsed.success) {
    return Response.json({ error: 'Bad Request', issues: parsed.error.issues }, { status: 400 });
  }

  const exported = await exportCaseWorkspace(parsed.data.profileId, parsed.data.format, {
    userId: auth.user.id,
  });

  const responseBody = typeof exported.body === 'string'
    ? exported.body
    : Buffer.from(exported.body);

  return new Response(responseBody, {
    status: 200,
    headers: {
      'Content-Type': exported.contentType,
      'Content-Disposition': `attachment; filename="${exported.fileName}"`,
    },
  });
}
