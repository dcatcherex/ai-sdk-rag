import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { uploadFileToDriveInputSchema } from '@/features/google-drive/schema';
import { uploadFileToDriveAction } from '@/features/google-drive/service';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const result = uploadFileToDriveInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await uploadFileToDriveAction(result.data, session.user.id);
  return Response.json(data);
}
