import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/job-store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const job = getJob(runId);

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(job.result);
}
