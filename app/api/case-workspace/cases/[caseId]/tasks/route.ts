import { requireUser } from '@/lib/auth-server';
import { createTask, listTasks, updateTask } from '@/features/case-workspace/service';
import { createTaskInputSchema, updateTaskInputSchema } from '@/features/case-workspace/schema';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { caseId } = await params;
  const tasks = await listTasks(caseId, { userId: auth.user.id });
  return Response.json({ tasks });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = createTaskInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Bad Request', issues: parsed.error.issues }, { status: 400 });
  }

  const { caseId } = await params;
  const task = await createTask(caseId, parsed.data, { userId: auth.user.id });
  return Response.json({ task }, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const taskId = typeof body?.taskId === 'string' ? body.taskId : null;
  const parsed = updateTaskInputSchema.safeParse(body?.patch ?? body);

  if (!taskId || !parsed.success) {
    return Response.json(
      {
        error: 'Bad Request',
        issues: parsed.success ? ['taskId is required'] : parsed.error.issues,
      },
      { status: 400 },
    );
  }

  const { caseId } = await params;
  const task = await updateTask(taskId, parsed.data, { userId: auth.user.id });
  if (!task || task.caseId !== caseId) {
    return Response.json({ error: 'Not Found' }, { status: 404 });
  }

  return Response.json({ task });
}
