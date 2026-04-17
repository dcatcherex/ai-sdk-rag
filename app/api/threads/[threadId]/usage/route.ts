import { eq, desc, sum } from 'drizzle-orm';
import { requireUser } from "@/lib/auth-server";
import { db } from '@/lib/db';
import { tokenUsage } from '@/db/schema';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const authResult = await requireUser();
    if (!authResult.ok) return authResult.response;
    const { threadId } = await params;

    // Get all token usage records for this thread
    const usageRecords = await db
      .select()
      .from(tokenUsage)
      .where(eq(tokenUsage.threadId, threadId))
      .orderBy(desc(tokenUsage.createdAt));

    // Calculate totals
    const totals = usageRecords.reduce(
      (acc, record) => ({
        promptTokens: acc.promptTokens + record.promptTokens,
        completionTokens: acc.completionTokens + record.completionTokens,
        totalTokens: acc.totalTokens + record.totalTokens,
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );

    return Response.json({
      records: usageRecords,
      totals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
