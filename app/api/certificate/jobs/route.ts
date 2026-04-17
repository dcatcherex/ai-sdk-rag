import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from "@/lib/auth-server";
import { listCertificateJobs } from '@/lib/certificate-service';

async function getSessionUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const templateId = req.nextUrl.searchParams.get('templateId') ?? undefined;
  const source = req.nextUrl.searchParams.get('source');
  const status = req.nextUrl.searchParams.get('status');
  const limitParam = req.nextUrl.searchParams.get('limit');
  const parsedLimit = limitParam ? Number(limitParam) : 20;
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(50, parsedLimit)) : 20;

  const jobs = await listCertificateJobs(userId, {
    templateId,
    limit,
    source: source === 'manual' || source === 'agent' ? source : undefined,
    status:
      status === 'pending' || status === 'processing' || status === 'completed' || status === 'failed'
        ? status
        : undefined,
  });
  return NextResponse.json({ jobs });
}
