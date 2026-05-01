import { z } from 'zod';

import { publishUserToolVersion } from '@/features/user-tools/service';
import { requireUser } from '@/lib/auth-server';

const publishSchema = z.object({
  version: z.number().int().min(1),
});

type Params = { params: Promise<{ toolId: string }> };

export async function POST(req: Request, { params }: Params) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const body = publishSchema.parse(await req.json());
  const { toolId } = await params;
  await publishUserToolVersion(toolId, body.version, authResult.user.id);
  return Response.json({ success: true });
}
