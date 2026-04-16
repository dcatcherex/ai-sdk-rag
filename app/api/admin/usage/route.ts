import { DEFAULT_WINDOW_DAYS } from '@/features/admin/usage/config';
import { getAdminUsageSummary } from '@/features/admin/usage/service';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: Request) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) return adminCheck.response;

  const url = new URL(req.url);
  const windowDays = parseWindowDays(url.searchParams.get('windowDays'));
  const data = await getAdminUsageSummary(windowDays);

  return Response.json(data);
}

function parseWindowDays(value: string | null): number {
  if (!value) return DEFAULT_WINDOW_DAYS;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 90 ? Math.floor(parsed) : DEFAULT_WINDOW_DAYS;
}
