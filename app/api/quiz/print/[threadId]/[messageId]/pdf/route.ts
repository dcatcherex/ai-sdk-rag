import { NextRequest } from "next/server";
import { exportPdfDocument } from "@/lib/export/service";
import { buildAbsoluteExportUrlWithSearch } from "@/lib/export/url";
import { buildPdfFilename } from "@/lib/export/filename";
import { generateQuizPdf } from "@/lib/quiz-pdf";
import { getQuizPrintDataForUser, getQuizPrintSessionUserId, parseMode, parseTeacherOptions } from "@/lib/quiz-print";

export const runtime = "nodejs";

type QuizPrintPdfRouteContext = {
  params: Promise<{
    messageId: string;
    threadId: string;
  }>;
};

export async function GET(request: NextRequest, { params }: QuizPrintPdfRouteContext) {
  try {
    const userId = await getQuizPrintSessionUserId();

    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId, messageId } = await params;
    const { searchParams } = new URL(request.url);

    const mode = parseMode(searchParams.get("mode") ?? undefined);
    const teacherOptions = parseTeacherOptions({
      compact: searchParams.get("compact") ?? undefined,
      showExplanations: searchParams.get("showExplanations") ?? undefined,
      showMarkBoxes: searchParams.get("showMarkBoxes") ?? undefined,
      showReferences: searchParams.get("showReferences") ?? undefined,
      showTopics: searchParams.get("showTopics") ?? undefined,
    });

    const quizData = await getQuizPrintDataForUser(userId, threadId, messageId);

    if (!quizData) {
      return Response.json({ error: "Quiz not found" }, { status: 404 });
    }

    const filename = buildPdfFilename(quizData.title, mode);
    const printPageUrl = buildAbsoluteExportUrlWithSearch(
      request,
      `/quiz/print/${threadId}/${messageId}`,
      searchParams,
    );
    const forwardedHeaders: Record<string, string> = {};
    const cookieHeader = request.headers.get("cookie");

    if (cookieHeader) {
      forwardedHeaders.cookie = cookieHeader;
    }

    const exportResult = await exportPdfDocument({
      documentKind: "quiz",
      filename,
      htmlSource: {
        headers: forwardedHeaders,
        pageFormat: "A4",
        preferCssPageSize: true,
        printBackground: true,
        url: printPageUrl,
      },
      fallback: async () => generateQuizPdf(quizData, mode, teacherOptions),
    });
    const body = new Uint8Array(exportResult.buffer);

    return new Response(body, {
      headers: {
        "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
        "Content-Type": exportResult.contentType,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export quiz PDF";
    return Response.json({ error: message }, { status: 500 });
  }
}
