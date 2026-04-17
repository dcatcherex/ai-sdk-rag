import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { getWorkspaceContext } from '@/features/platform-agent/service';

/**
 * GET /api/platform-agent/context
 * Returns a workspace snapshot for injection into the platform agent system prompt.
 * Called at runtime — not by end users directly.
 */
export async function GET() {
  const authResult = await requireUser();
  if (!authResult.ok) return authResult.response;
  const ctx = await getWorkspaceContext(authResult.user.id);
  return NextResponse.json(ctx);
}
