import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getDocumentStats } from '@/lib/vector-store';

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
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
