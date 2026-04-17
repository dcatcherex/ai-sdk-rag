import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/auth-server";
import { getDocumentStats } from '@/lib/vector-store';

export async function GET() {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const userId = authResult.user.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getDocumentStats(userId);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Document stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get document stats' },
      { status: 500 }
    );
  }
}
