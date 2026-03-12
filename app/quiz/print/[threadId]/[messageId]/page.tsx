import { notFound, redirect } from "next/navigation";
import { PrintableQuiz } from "@/components/chat/printable-quiz";
import { getQuizPrintDataForUser, getQuizPrintSessionUserId, parseMode, parseTeacherOptions } from "@/lib/quiz-print";

type QuizPrintPageProps = {
  params: Promise<{
    messageId: string;
    threadId: string;
  }>;
  searchParams?: Promise<{
    compact?: string | string[];
    mode?: string | string[];
    showExplanations?: string | string[];
    showMarkBoxes?: string | string[];
    showReferences?: string | string[];
    showTopics?: string | string[];
  }>;
};

export default async function QuizPrintPage({ params, searchParams }: QuizPrintPageProps) {
  const userId = await getQuizPrintSessionUserId();

  if (!userId) {
    redirect("/sign-in");
  }

  const [{ threadId, messageId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({ mode: undefined }),
  ]);

  const mode = parseMode(resolvedSearchParams.mode);
  const teacherOptions = parseTeacherOptions(resolvedSearchParams);

  const quizData = await getQuizPrintDataForUser(userId, threadId, messageId);

  if (!quizData) {
    notFound();
  }

  return (
    <PrintableQuiz
      initialMode={mode}
      teacherOptions={teacherOptions}
      threadId={threadId}
      messageId={quizData.messageId}
      title={quizData.title}
      instructions={quizData.instructions}
      questions={quizData.questions}
      groundingReferences={quizData.groundingReferences}
    />
  );
}
