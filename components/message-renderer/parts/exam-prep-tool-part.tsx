"use client";

import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
} from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CitationBadge } from "@/components/chat/citation-badge";
import { InteractiveQuiz } from "@/components/chat/interactive-quiz";
import type { QuizFollowUpContext } from "@/features/chat/types";
import type { ExamPrepToolOutput, ToolLikePart } from "../types";
import { shouldRenderExamPrepOutsideToolPanel } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatExamPrepSummary(toolName: string, output: ExamPrepToolOutput): string {
  if (toolName === "generate_practice_quiz") {
    const n = output.quiz?.length ?? 0;
    return `${n} practice question${n === 1 ? "" : "s"} generated`;
  }
  if (toolName === "grade_practice_answer") {
    if (typeof output.score === "number" && typeof output.maxScore === "number") {
      return `Scored ${output.score}/${output.maxScore}${output.verdict ? ` · ${output.verdict}` : ""}`;
    }
    return output.verdict ?? "Answer graded";
  }
  if (toolName === "create_study_plan") {
    const n = output.plan?.length ?? 0;
    return `${n}-day study plan${typeof output.daysRemaining === "number" ? ` · ${output.daysRemaining} day${output.daysRemaining === 1 ? "" : "s"} remaining` : ""}`;
  }
  if (toolName === "analyze_learning_gaps") {
    const n = output.weakAreas?.length ?? 0;
    return `${n} learning gap${n === 1 ? "" : "s"} identified`;
  }
  if (toolName === "generate_flashcards") {
    const n = output.flashcards?.length ?? 0;
    return `${n} flashcard${n === 1 ? "" : "s"} generated`;
  }
  return "Exam prep result";
}

const getSeverityVariant = (severity: "high" | "medium" | "low") =>
  severity === "high" ? ("destructive" as const) : severity === "medium" ? ("secondary" as const) : ("outline" as const);

// ─── Grounding badges ─────────────────────────────────────────────────────────

function GroundingBadges({
  referenceIds,
  groundingReferences,
}: {
  referenceIds?: number[];
  groundingReferences: NonNullable<ExamPrepToolOutput["groundingReferences"]>;
}) {
  if (!referenceIds?.length || !groundingReferences.length) return null;

  const resolved = referenceIds
    .map((id) => groundingReferences.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  if (!resolved.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {resolved.map((ref) => (
        <CitationBadge
          key={`${ref.id}-${ref.source}-${ref.page ?? "na"}`}
          documentId={ref.documentId}
          file={ref.source}
          page={ref.page ?? 0}
          section={ref.section}
        />
      ))}
    </div>
  );
}

// ─── Body renderers ───────────────────────────────────────────────────────────

function ExamPrepQuizBody({
  output,
  messageId,
  onQuizStateChange,
}: {
  output: ExamPrepToolOutput;
  messageId: string;
  onQuizStateChange?: (context: QuizFollowUpContext) => void;
}) {
  return (
    <InteractiveQuiz
      messageId={messageId}
      questions={output.quiz ?? []}
      instructions={output.instructions}
      groundingReferences={output.groundingReferences ?? []}
      onQuizStateChange={onQuizStateChange}
    />
  );
}

function ExamPrepGradeBody({ output }: { output: ExamPrepToolOutput }) {
  const score = typeof output.score === "number" ? output.score : 0;
  const maxScore = typeof output.maxScore === "number" ? output.maxScore : 10;
  const scorePercent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const groundingReferences = output.groundingReferences ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-background/70 p-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Score</p>
            <p className="text-2xl font-semibold">{score}/{maxScore}</p>
          </div>
          {output.verdict ? <Badge variant="secondary" className="text-sm">{output.verdict}</Badge> : null}
        </div>
        <Progress value={scorePercent} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(
          [
            { key: "strengths", label: "Strengths", bg: "bg-emerald-500/5", items: output.strengths },
            { key: "missingPoints", label: "Missing points", bg: "bg-amber-500/5", items: output.missingPoints },
            { key: "improvements", label: "Improvements", bg: "bg-blue-500/5", items: output.improvements },
          ] as const
        ).map(({ key, label, bg, items }) => (
          <div key={key} className={`rounded-lg border ${bg} p-4 space-y-2`}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            {items && items.length > 0 ? (
              <ul className="space-y-1 text-sm leading-relaxed">
                {items.map((item) => (
                  <li key={item.text} className="space-y-1">
                    <div>- {item.text}</div>
                    <GroundingBadges referenceIds={item.references} groundingReferences={groundingReferences} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No {label.toLowerCase()} listed.</p>
            )}
          </div>
        ))}
      </div>

      {output.modelAnswer ? (
        <div className="rounded-lg border bg-background/70 p-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Model answer</p>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{output.modelAnswer}</div>
        </div>
      ) : null}
    </div>
  );
}

function ExamPrepStudyPlanBody({ output }: { output: ExamPrepToolOutput }) {
  const groundingReferences = output.groundingReferences ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {typeof output.daysRemaining === "number" ? (
          <Badge variant="secondary">{output.daysRemaining} days remaining</Badge>
        ) : null}
        {(output.priorityTopics ?? []).map((topic) => (
          <Badge key={topic} variant="outline">{topic}</Badge>
        ))}
      </div>

      <div className="space-y-3">
        {(output.plan ?? []).map((day) => (
          <div key={`${day.day}-${day.focus}`} className="rounded-lg border bg-background/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{day.day}</p>
                <p className="text-sm text-muted-foreground">{day.focus}</p>
              </div>
              <Badge variant="secondary">{day.estimatedHours}h</Badge>
            </div>
            <ul className="space-y-1 text-sm leading-relaxed">
              {day.tasks.map((task) => (
                <li key={`${day.day}-${task.text}`} className="space-y-1">
                  <div>- {task.text}</div>
                  <GroundingBadges referenceIds={task.references} groundingReferences={groundingReferences} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExamPrepLearningGapsBody({ output }: { output: ExamPrepToolOutput }) {
  const groundingReferences = output.groundingReferences ?? [];
  const weakAreas = output.weakAreas ?? [];
  const misconceptions = output.misconceptions ?? [];
  const recommendedActions = output.recommendedActions ?? [];
  const nextStudyFocus = output.nextStudyFocus ?? [];

  return (
    <div className="space-y-4">
      {output.overallAssessment ? (
        <div className="rounded-lg border bg-background/70 p-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall assessment</p>
          <p className="text-sm leading-relaxed">{output.overallAssessment}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Weak areas</p>
        {weakAreas.length > 0 ? (
          weakAreas.map((item) => (
            <div key={`${item.topic}-${item.issue}`} className="rounded-lg border bg-background/70 p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getSeverityVariant(item.severity)}>{item.severity}</Badge>
                <Badge variant="outline">{item.topic}</Badge>
              </div>
              <p className="text-sm leading-relaxed">{item.issue}</p>
              <GroundingBadges referenceIds={item.references} groundingReferences={groundingReferences} />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No weak areas identified.</p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-amber-500/5 p-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Misconceptions</p>
          {misconceptions.length > 0 ? (
            <ul className="space-y-2 text-sm leading-relaxed">
              {misconceptions.map((item) => (
                <li key={item.text} className="space-y-1">
                  <div>- {item.text}</div>
                  <GroundingBadges referenceIds={item.references} groundingReferences={groundingReferences} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No misconceptions listed.</p>
          )}
        </div>
        <div className="rounded-lg border bg-emerald-500/5 p-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recommended actions</p>
          {recommendedActions.length > 0 ? (
            <ul className="space-y-2 text-sm leading-relaxed">
              {recommendedActions.map((item) => (
                <li key={item.text} className="space-y-1">
                  <div>- {item.text}</div>
                  <GroundingBadges referenceIds={item.references} groundingReferences={groundingReferences} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No recommended actions listed.</p>
          )}
        </div>
      </div>

      {nextStudyFocus.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {nextStudyFocus.map((topic) => (
            <Badge key={topic} variant="outline">{topic}</Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExamPrepFlashcardsBody({ output }: { output: ExamPrepToolOutput }) {
  const groundingReferences = output.groundingReferences ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-background/70 p-4 space-y-2">
        {output.deckTitle ? <p className="text-base font-semibold">{output.deckTitle}</p> : null}
        {output.studyTip ? <p className="text-sm text-muted-foreground">{output.studyTip}</p> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(output.flashcards ?? []).map((card, i) => (
          <div key={card.id} className="rounded-lg border bg-background/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Card {i + 1}</Badge>
              <Badge variant="outline">{card.topic}</Badge>
            </div>
            <div className="space-y-3">
              <div className="rounded-md border bg-blue-500/5 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Front</p>
                <p className="mt-1 text-sm leading-relaxed">{card.front}</p>
              </div>
              <div className="rounded-md border bg-emerald-500/5 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Back</p>
                <p className="mt-1 text-sm leading-relaxed">{card.back}</p>
              </div>
            </div>
            <GroundingBadges referenceIds={card.references} groundingReferences={groundingReferences} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Body dispatcher ──────────────────────────────────────────────────────────

function ExamPrepBody({
  toolName,
  output,
  messageId,
  onQuizStateChange,
}: {
  toolName: string;
  output: ExamPrepToolOutput;
  messageId: string;
  onQuizStateChange?: (context: QuizFollowUpContext) => void;
}) {
  if (toolName === "generate_practice_quiz")
    return <ExamPrepQuizBody output={output} messageId={messageId} onQuizStateChange={onQuizStateChange} />;
  if (toolName === "grade_practice_answer") return <ExamPrepGradeBody output={output} />;
  if (toolName === "create_study_plan") return <ExamPrepStudyPlanBody output={output} />;
  if (toolName === "analyze_learning_gaps") return <ExamPrepLearningGapsBody output={output} />;
  if (toolName === "generate_flashcards") return <ExamPrepFlashcardsBody output={output} />;
  return null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

type ExamPrepToolPartProps = {
  toolPart: ToolLikePart;
  toolName: string;
  output: ExamPrepToolOutput;
  messageId: string;
  partKey: string;
  onQuizStateChange?: (context: QuizFollowUpContext) => void;
};

export function ExamPrepToolPart({
  toolPart,
  toolName,
  output,
  messageId,
  partKey,
  onQuizStateChange,
}: ExamPrepToolPartProps) {
  const sources = output.sources ?? [];
  const summary = formatExamPrepSummary(toolName, output);
  const groundingBadge = (
    <Badge variant={output.groundedFromKnowledgeBase ? "secondary" : "outline"}>
      {output.groundedFromKnowledgeBase ? "Grounded from Knowledge Base" : "Model-generated"}
    </Badge>
  );

  const SourcesList = sources.length > 0 ? (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((src) => (
          <Badge key={src} variant="outline" className="max-w-full truncate">{src}</Badge>
        ))}
      </div>
    </div>
  ) : null;

  if (shouldRenderExamPrepOutsideToolPanel(toolName)) {
    return (
      <div key={partKey} className="space-y-3">
        <Tool>
          <ToolHeader type="dynamic-tool" state={toolPart.state as never} toolName={toolName} title="Tool details" />
          <ToolContent>
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-3">
              <ToolInput input={toolPart.input} />
              {SourcesList}
            </div>
          </ToolContent>
        </Tool>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{summary}</p>
            {groundingBadge}
          </div>
          <ExamPrepBody
            toolName={toolName}
            output={output}
            messageId={messageId}
            onQuizStateChange={onQuizStateChange}
          />
        </div>
      </div>
    );
  }

  return (
    <Tool key={partKey} defaultOpen>
      <ToolHeader type="dynamic-tool" state={toolPart.state as never} toolName={toolName} />
      <ToolContent>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{summary}</p>
            {groundingBadge}
          </div>
          <ExamPrepBody
            toolName={toolName}
            output={output}
            messageId={messageId}
            onQuizStateChange={onQuizStateChange}
          />
          <ToolInput input={toolPart.input} />
          {SourcesList}
        </div>
      </ToolContent>
    </Tool>
  );
}
