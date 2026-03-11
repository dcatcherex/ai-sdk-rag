"use client";

import { useEffect, useMemo, useState } from "react";
import { CitationBadge } from "@/components/chat/citation-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { QuizFollowUpContext } from "@/features/chat/types";
import { cn } from "@/lib/utils";

type GroundingReference = {
  documentId?: string;
  id: number;
  page?: number | null;
  section?: string;
  source: string;
};

type QuizQuestion = {
  answer: string;
  explanation: string;
  id: string;
  options?: string[];
  question: string;
  references?: number[];
  topic: string;
  type: "mcq" | "short_answer" | "true_false";
};

type InteractiveQuizProps = {
  groundingReferences?: GroundingReference[];
  instructions?: string;
  messageId: string;
  onQuizStateChange?: (context: QuizFollowUpContext) => void;
  questions: QuizQuestion[];
};

type RevealState = Record<string, boolean>;
type ChoiceState = Record<string, string>;
type ShortAnswerState = Record<string, string>;

type ResolvedReference = {
  documentId?: string;
  id: number;
  page?: number | null;
  section?: string;
  source: string;
};

const formatQuestionTypeLabel = (type: QuizQuestion["type"]) => {
  if (type === "mcq") {
    return "Multiple choice";
  }

  if (type === "short_answer") {
    return "Short answer";
  }

  return "True / false";
};

const normalizeAnswer = (value: string) => value.trim().toLowerCase();

const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

const resolveReferences = (
  referenceIds: number[] | undefined,
  groundingReferences: GroundingReference[] | undefined,
): ResolvedReference[] => {
  if (!referenceIds || referenceIds.length === 0 || !groundingReferences || groundingReferences.length === 0) {
    return [];
  }

  return referenceIds
    .map((referenceId) => groundingReferences.find((reference) => reference.id === referenceId))
    .filter((reference): reference is ResolvedReference => Boolean(reference));
};

export function InteractiveQuiz({ groundingReferences, instructions, messageId, onQuizStateChange, questions }: InteractiveQuizProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedChoices, setSelectedChoices] = useState<ChoiceState>({});
  const [shortAnswers, setShortAnswers] = useState<ShortAnswerState>({});
  const [revealedQuestions, setRevealedQuestions] = useState<RevealState>({});

  const currentQuestion = questions[currentQuestionIndex];

  const revealedCount = useMemo(
    () => questions.filter((question) => revealedQuestions[question.id]).length,
    [questions, revealedQuestions],
  );

  const scoredCount = useMemo(
    () => questions.filter((question) => question.type !== "short_answer" && revealedQuestions[question.id]).length,
    [questions, revealedQuestions],
  );

  const correctCount = useMemo(
    () => questions.filter((question) => {
      if (question.type === "short_answer" || !revealedQuestions[question.id]) {
        return false;
      }

      return normalizeAnswer(selectedChoices[question.id] ?? "") === normalizeAnswer(question.answer);
    }).length,
    [questions, revealedQuestions, selectedChoices],
  );

  const quizContext = useMemo<QuizFollowUpContext>(() => ({
    messageId,
    questionCount: questions.length,
    answeredCount: questions.filter((question) => revealedQuestions[question.id]).length,
    objectiveAnsweredCount: questions.filter((question) => question.type !== "short_answer" && revealedQuestions[question.id]).length,
    correctCount: questions.filter((question) => {
      if (question.type === "short_answer" || !revealedQuestions[question.id]) {
        return false;
      }

      return normalizeAnswer(selectedChoices[question.id] ?? "") === normalizeAnswer(question.answer);
    }).length,
    completed: questions.length > 0 && questions.every((question) => revealedQuestions[question.id]),
    attempts: questions.map((question) => {
      const userAnswer = question.type === "short_answer"
        ? (shortAnswers[question.id] ?? "")
        : (selectedChoices[question.id] ?? "");

      return {
        questionId: question.id,
        question: question.question,
        topic: question.topic,
        type: question.type,
        userAnswer,
        correctAnswer: question.answer,
        isCorrect: question.type === "short_answer"
          ? null
          : revealedQuestions[question.id]
            ? normalizeAnswer(userAnswer) === normalizeAnswer(question.answer)
            : null,
        wasRevealed: !!revealedQuestions[question.id],
      };
    }),
  }), [messageId, questions, revealedQuestions, selectedChoices, shortAnswers]);

  useEffect(() => {
    if (!onQuizStateChange) {
      return;
    }

    onQuizStateChange(quizContext);
  }, [onQuizStateChange, quizContext]);

  if (questions.length === 0 || !currentQuestion) {
    return null;
  }

  const currentSelection = selectedChoices[currentQuestion.id] ?? "";
  const currentShortAnswer = shortAnswers[currentQuestion.id] ?? "";
  const isRevealed = !!revealedQuestions[currentQuestion.id];
  const isObjectiveQuestion = currentQuestion.type !== "short_answer";
  const isCurrentCorrect = isObjectiveQuestion
    ? normalizeAnswer(currentSelection) === normalizeAnswer(currentQuestion.answer)
    : false;
  const progressValue = questions.length > 0 ? (revealedCount / questions.length) * 100 : 0;
  const resolvedReferences = resolveReferences(currentQuestion.references, groundingReferences);

  return (
    <div className="space-y-4">
      <Card className="gap-4 border bg-background/70 py-4 shadow-none">
        <CardHeader className="px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Interactive practice quiz</CardTitle>
              <CardDescription>
                {revealedCount}/{questions.length} answered
                {scoredCount > 0 ? ` · ${correctCount}/${scoredCount} correct` : ""}
              </CardDescription>
            </div>
            <Badge variant="secondary">
              Question {currentQuestionIndex + 1} of {questions.length}
            </Badge>
          </div>
          <Progress value={progressValue} />
          {instructions ? (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {instructions}
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="px-4">
          <div className="flex flex-wrap gap-2">
            {questions.map((question, index) => {
              const questionAnswered = !!revealedQuestions[question.id];
              const questionCorrect = question.type !== "short_answer"
                && questionAnswered
                && normalizeAnswer(selectedChoices[question.id] ?? "") === normalizeAnswer(question.answer);

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    currentQuestionIndex === index
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background hover:bg-accent",
                  )}
                >
                  <span>Q{index + 1}</span>
                  {questionAnswered ? (
                    <span className={cn("size-2 rounded-full", questionCorrect ? "bg-emerald-500" : "bg-amber-500")} />
                  ) : null}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4 border bg-background/70 py-4 shadow-none">
        <CardHeader className="px-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Q{currentQuestionIndex + 1}</Badge>
            <Badge variant="outline">{formatQuestionTypeLabel(currentQuestion.type)}</Badge>
            <Badge variant="outline">{currentQuestion.topic}</Badge>
          </div>
          <CardTitle className="text-lg leading-relaxed">{currentQuestion.question}</CardTitle>
          {resolvedReferences.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {resolvedReferences.map((reference) => (
                <CitationBadge
                  key={`${reference.id}-${reference.source}-${reference.page ?? "na"}`}
                  documentId={reference.documentId}
                  file={reference.source}
                  page={reference.page ?? 0}
                  section={reference.section}
                />
              ))}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-4 px-4">
          {currentQuestion.options && currentQuestion.options.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {currentQuestion.options.map((option, optionIndex) => {
                const isSelected = currentSelection === option;
                const isCorrectOption = normalizeAnswer(option) === normalizeAnswer(currentQuestion.answer);
                const isWrongSelection = isRevealed && isSelected && !isCorrectOption;

                return (
                  <Button
                    key={`${currentQuestion.id}-option-${optionIndex}`}
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-auto items-start justify-start whitespace-normal px-3 py-3 text-left",
                      isSelected && !isRevealed ? "border-primary bg-primary/10" : "",
                      isRevealed && isCorrectOption ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "",
                      isWrongSelection ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "",
                    )}
                    onClick={() => setSelectedChoices((current) => ({ ...current, [currentQuestion.id]: option }))}
                    disabled={isRevealed}
                  >
                    <span className="mr-2 font-medium text-muted-foreground">{getOptionLabel(optionIndex)}.</span>
                    <span>{option}</span>
                  </Button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Your answer</p>
              <Textarea
                value={currentShortAnswer}
                onChange={(event) => setShortAnswers((current) => ({
                  ...current,
                  [currentQuestion.id]: event.target.value,
                }))}
                placeholder="Type your answer here"
                disabled={isRevealed}
                className="min-h-28"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {isObjectiveQuestion ? (
              <Button
                type="button"
                onClick={() => setRevealedQuestions((current) => ({ ...current, [currentQuestion.id]: true }))}
                disabled={!currentSelection || isRevealed}
              >
                Check answer
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setRevealedQuestions((current) => ({ ...current, [currentQuestion.id]: true }))}
                disabled={isRevealed}
              >
                Reveal answer
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentQuestionIndex((current) => Math.max(0, current - 1))}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentQuestionIndex((current) => Math.min(questions.length - 1, current + 1))}
              disabled={currentQuestionIndex === questions.length - 1}
            >
              Next
            </Button>
          </div>

          {isRevealed ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className={cn(
                "rounded-lg border p-4",
                isObjectiveQuestion
                  ? isCurrentCorrect
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-amber-500/40 bg-amber-500/5"
                  : "border-blue-500/30 bg-blue-500/5",
              )}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {isObjectiveQuestion ? (isCurrentCorrect ? "Correct" : "Not quite") : "Your response"}
                </p>
                <div className="mt-2 space-y-2 text-sm leading-relaxed">
                  {isObjectiveQuestion ? (
                    <p>{currentSelection}</p>
                  ) : (
                    <p>{currentShortAnswer || "No answer entered."}</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {isObjectiveQuestion ? "Correct answer" : "Model answer"}
                </p>
                <div className="mt-2 space-y-3 text-sm leading-relaxed">
                  <p>{currentQuestion.answer}</p>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Explanation
                    </p>
                    <p className="mt-1">{currentQuestion.explanation}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
