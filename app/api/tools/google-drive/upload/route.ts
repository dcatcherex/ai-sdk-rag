import { requireUser } from "@/lib/auth-server";
import { uploadFileToDriveInputSchema } from '@/features/google-drive/schema';
import { uploadFileToDriveAction } from '@/features/google-drive/service';

export async function POST(req: Request) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = await req.json();
  const result = uploadFileToDriveInputSchema.safeParse(body);
  if (!result.success) return new Response('Bad Request', { status: 400 });

  const data = await uploadFileToDriveAction(result.data, authResult.user.id);
  return Response.json(data);
}
