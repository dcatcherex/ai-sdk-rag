import { z } from 'zod';
import { requireUser } from "@/lib/auth-server";
import { updateModelScore } from '@/lib/model-scores';

const voteSchema = z.object({
  modelId: z.string().min(1),
  previousReaction: z.enum(['thumbs_up', 'thumbs_down']).nullable(),
  newReaction: z.enum(['thumbs_up', 'thumbs_down']).nullable(),
  persona: z.string().default('general_assistant'),
});

export async function POST(req: Request) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { modelId, previousReaction, newReaction, persona } = voteSchema.parse(
      await req.json()
    );

    await updateModelScore({
      userId: authResult.user.id,
      modelId,
      persona,
      previousReaction,
      newReaction,
    });

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 400 });
  }
}
