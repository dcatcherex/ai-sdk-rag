import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deployRichMenu, setDefaultRichMenu } from '@/features/line-oa/webhook/rich-menu';
import { z } from 'zod';

const deploySchema = z.object({
  setAsDefault: z.boolean().default(false),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; menuId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { menuId } = await params;
  const body = deploySchema.parse(await req.json());

  const { lineMenuId } = await deployRichMenu(menuId, session.user.id);

  if (body.setAsDefault) {
    await setDefaultRichMenu(menuId, session.user.id);
  }

  return NextResponse.json({ lineMenuId, isDefault: body.setAsDefault });
}
