import { headers } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatMessage, chatThread } from '@/db/schema';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { threadId } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json'; // json or markdown

    // Get thread details
    const thread = await db
      .select()
      .from(chatThread)
      .where(and(eq(chatThread.id, threadId), eq(chatThread.userId, session.user.id)))
      .limit(1);

    if (thread.length === 0) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Get all messages
    const messages = await db
      .select()
      .from(chatMessage)
      .where(eq(chatMessage.threadId, threadId))
      .orderBy(chatMessage.position);

    const threadData = thread[0];

    if (format === 'markdown') {
      // Export as Markdown
      let markdown = `# ${threadData?.title}\n\n`;
      markdown += `**Created**: ${threadData?.createdAt.toISOString()}\n`;
      markdown += `**Updated**: ${threadData?.updatedAt.toISOString()}\n\n`;
      markdown += `---\n\n`;

      for (const message of messages) {
        const role = message.role === 'user' ? '**You**' : '**Assistant**';
        markdown += `### ${role}\n\n`;

        // Extract text from parts
        const parts = message.parts as any[];
        for (const part of parts) {
          if (part.type === 'text') {
            markdown += `${part.text}\n\n`;
          } else if (part.type?.startsWith('tool-')) {
            markdown += `*[Tool: ${part.toolName || part.type}]*\n\n`;
          }
        }

        if (message.reaction) {
          const emoji = message.reaction === 'thumbs_up' ? '👍' : '👎';
          markdown += `*Reaction: ${emoji}*\n\n`;
        }

        markdown += `---\n\n`;
      }

      return new Response(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="${threadData?.title.replace(/[^a-z0-9]/gi, '_')}.md"`,
        },
      });
    } else {
      // Export as JSON
      const exportData = {
        thread: {
          id: threadData?.id,
          title: threadData?.title,
          createdAt: threadData?.createdAt,
          updatedAt: threadData?.updatedAt,
        },
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          parts: msg.parts,
          reaction: msg.reaction,
          createdAt: msg.createdAt,
        })),
        exportedAt: new Date().toISOString(),
      };

      return new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${threadData?.title.replace(/[^a-z0-9]/gi, '_')}.json"`,
        },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
