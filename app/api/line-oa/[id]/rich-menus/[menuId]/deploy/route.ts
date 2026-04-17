import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { deployRichMenu, setDefaultRichMenu } from '@/features/line-oa/webhook/rich-menu';
import { z } from 'zod';

const deploySchema = z.object({
  setAsDefault: z.boolean().default(false),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; menuId: string }> },
) {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;

  const { menuId } = await params;
  const body = deploySchema.parse(await req.json());

  const { lineMenuId } = await deployRichMenu(menuId, authResult.user.id);

  if (body.setAsDefault) {
    await setDefaultRichMenu(menuId, authResult.user.id);
  }

  return NextResponse.json({ lineMenuId, isDefault: body.setAsDefault });
}
