import { z } from 'zod';
import { addCredits } from '@/lib/credits';
import { requireAdmin } from '@/lib/admin';

const grantSchema = z.object({
  userId: z.string().min(1),
  amount: z.number().int().positive(),
  description: z.string().optional(),
});

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const body = grantSchema.parse(await req.json());

  const result = await addCredits({
    userId: body.userId,
    amount: body.amount,
    type: 'grant',
    description: body.description ?? `Granted by admin (${adminCheck.session.user.email})`,
  });

  return Response.json({ balance: result.balance });
}
