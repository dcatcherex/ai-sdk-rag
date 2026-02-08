import { NextResponse } from 'next/server';
import { getDocumentStats } from '@/lib/vector-store';

export async function GET() {
  try {
    const stats = await getDocumentStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Document stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get document stats' },
      { status: 500 }
    );
  }
}
