"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DownloadIcon, PrinterIcon } from "lucide-react";
import { PrintDocumentSection } from "@/components/print/document-section";
import { PrintDocumentShell } from "@/components/print/document-shell";
import { PrintDocumentToolbar } from "@/components/print/document-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type PrintableQuizMode = "worksheet" | "answer-key" | "both";

export type PrintableQuizReference = {
  documentId?: string;
  id: number;
  page?: number | null;
  section?: string;
  source: string;
};

export type PrintableQuizQuestion = {
  answer: string;
  explanation: string;
  id: string;
  options?: string[];
  question: string;
  references?: number[];
  topic: string;
  type: "mcq" | "short_answer" | "true_false";
};

export type PrintableQuizTeacherOptions = {
  compact: boolean;
  showExplanations: boolean;
  showMarkBoxes: boolean;
  showReferences: boolean;
  showTopics: boolean;
};

type PrintableQuizProps = {
  groundingReferences?: PrintableQuizReference[];
  initialMode: PrintableQuizMode;
  instructions?: string;
  messageId?: string;
  questions: PrintableQuizQuestion[];
  teacherOptions?: PrintableQuizTeacherOptions;
  threadId?: string;
  title?: string;
};

const getOptionLabel = (index: number) => String.fromCharCode(65 + index);

const formatReference = (reference: PrintableQuizReference) => {
  const pageLabel = typeof reference.page === "number" ? `p.${reference.page}` : null;
  const sectionLabel = reference.section ? `section: ${reference.section}` : null;
  return [reference.source, pageLabel, sectionLabel].filter(Boolean).join(" · ");
};

function WorksheetQuestion({
  compact,
  index,
  question,
  showMarkBoxes,
  showTopics,
}: {
  compact: boolean;
  index: number;
  question: PrintableQuizQuestion;
  showMarkBoxes: boolean;
  showTopics: boolean;
}) {
  return (
    <div className={cn(
      "break-inside-avoid rounded-xl border border-border bg-background shadow-sm print:rounded-none print:border-black/20 print:shadow-none",
      compact ? "p-4" : "p-5",
    )}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="print:border print:border-black/20 print:bg-transparent print:text-black">
          Question {index + 1}
        </Badge>
          {showTopics ? (
            <Badge variant="outline" className="print:border-black/20 print:text-black">
              {question.topic}
            </Badge>
          ) : null}
          <Badge variant="outline" className="print:border-black/20 print:text-black">
            {question.type === "mcq" ? "Multiple choice" : question.type === "short_answer" ? "Short answer" : "True / false"}
          </Badge>
        </div>
        {showMarkBoxes ? (
          <div className="rounded-md border px-3 py-1 text-xs font-medium text-muted-foreground print:border-black/30 print:text-black">
            Mark: ____ / 1
          </div>
        ) : null}
      </div>

      <p className={cn("leading-relaxed text-foreground", compact ? "text-sm" : "text-base")}>{question.question}</p>

      {question.type === "mcq" && question.options?.length ? (
        <div className={cn("mt-4", compact ? "space-y-1.5" : "space-y-2")}>
          {question.options.map((option, optionIndex) => (
            <div key={`${question.id}-${option}`} className={cn("flex items-start gap-3 leading-relaxed", compact ? "text-[13px]" : "text-sm")}>
              <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full border border-black/40 text-[11px] font-medium">
                {getOptionLabel(optionIndex)}
              </span>
              <span className="flex-1">{option}</span>
            </div>
          ))}
        </div>
      ) : null}

      {question.type === "true_false" ? (
        <div className={cn("mt-4 flex gap-6", compact ? "text-[13px]" : "text-sm")}>
          <span className="inline-flex items-center gap-2"><span className="size-4 rounded-full border border-black/40" />True</span>
          <span className="inline-flex items-center gap-2"><span className="size-4 rounded-full border border-black/40" />False</span>
        </div>
      ) : null}

      {question.type === "short_answer" ? (
        <div className={cn("mt-5", compact ? "space-y-2" : "space-y-3")}>
          {Array.from({ length: compact ? 3 : 5 }).map((_, lineIndex) => (
            <div key={`${question.id}-line-${lineIndex}`} className="h-6 border-b border-dashed border-black/30" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AnswerKeyQuestion({
  compact,
  index,
  question,
  groundingReferences,
  showExplanations,
  showMarkBoxes,
  showReferences,
  showTopics,
}: {
  compact: boolean;
  groundingReferences: PrintableQuizReference[];
  index: number;
  question: PrintableQuizQuestion;
  showExplanations: boolean;
  showMarkBoxes: boolean;
  showReferences: boolean;
  showTopics: boolean;
}) {
  const references = useMemo(
    () => (question.references ?? [])
      .map((referenceId) => groundingReferences.find((reference) => reference.id === referenceId))
      .filter((reference): reference is PrintableQuizReference => Boolean(reference)),
    [groundingReferences, question.references],
  );

  return (
    <div className={cn(
      "break-inside-avoid rounded-xl border border-border bg-background shadow-sm print:rounded-none print:border-black/20 print:shadow-none",
      compact ? "p-4" : "p-5",
    )}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="print:border print:border-black/20 print:bg-transparent print:text-black">
          Answer {index + 1}
        </Badge>
          {showTopics ? (
            <Badge variant="outline" className="print:border-black/20 print:text-black">
              {question.topic}
            </Badge>
          ) : null}
        </div>
        {showMarkBoxes ? (
          <div className="rounded-md border px-3 py-1 text-xs font-medium text-muted-foreground print:border-black/30 print:text-black">
            Awarded: ____ / 1
          </div>
        ) : null}
      </div>

      <p className={cn("leading-relaxed text-foreground", compact ? "text-sm" : "text-base")}>{question.question}</p>

      <div className={cn("mt-4", compact ? "space-y-2" : "space-y-3")}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black/70">
            Correct answer
          </p>
          <p className={cn("mt-1 leading-relaxed", compact ? "text-[13px]" : "text-sm")}>{question.answer}</p>
        </div>

        {showExplanations ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black/70">
              Explanation
            </p>
            <p className={cn("mt-1 leading-relaxed whitespace-pre-wrap", compact ? "text-[13px]" : "text-sm")}>{question.explanation}</p>
          </div>
        ) : null}

        {showReferences && references.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground print:text-black/70">
              References
            </p>
            <ul className={cn("mt-1 space-y-1 leading-relaxed", compact ? "text-[13px]" : "text-sm")}>
              {references.map((reference) => (
                <li key={`${question.id}-${reference.id}`}>{formatReference(reference)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PrintableQuiz({
  groundingReferences = [],
  initialMode,
  instructions,
  messageId,
  questions,
  teacherOptions,
  threadId,
  title,
}: PrintableQuizProps) {
  const [mode, setMode] = useState<PrintableQuizMode>(initialMode);
  const [options, setOptions] = useState<PrintableQuizTeacherOptions>(teacherOptions ?? {
    compact: false,
    showExplanations: true,
    showMarkBoxes: true,
    showReferences: true,
    showTopics: true,
  });

  const pageTitle = title ?? "Printable practice quiz";
  const showWorksheet = mode === "worksheet" || mode === "both";
  const showAnswerKey = mode === "answer-key" || mode === "both";
  const queryString = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set("mode", mode);
    searchParams.set("compact", String(options.compact));
    searchParams.set("showExplanations", String(options.showExplanations));
    searchParams.set("showMarkBoxes", String(options.showMarkBoxes));
    searchParams.set("showReferences", String(options.showReferences));
    searchParams.set("showTopics", String(options.showTopics));
    return searchParams.toString();
  }, [mode, options.compact, options.showExplanations, options.showMarkBoxes, options.showReferences, options.showTopics]);
  const pdfHref = threadId && messageId
    ? `/api/quiz/print/${threadId}/${messageId}/pdf?${queryString}`
    : null;
  const toolbarDescription = `${questions.length} question${questions.length === 1 ? "" : "s"} ready for printing`;

  const syncUrl = (nextMode: PrintableQuizMode, nextOptions: PrintableQuizTeacherOptions) => {
    if (typeof window === "undefined") {
      return;
    }

    const searchParams = new URLSearchParams();
    searchParams.set("mode", nextMode);
    searchParams.set("compact", String(nextOptions.compact));
    searchParams.set("showExplanations", String(nextOptions.showExplanations));
    searchParams.set("showMarkBoxes", String(nextOptions.showMarkBoxes));
    searchParams.set("showReferences", String(nextOptions.showReferences));
    searchParams.set("showTopics", String(nextOptions.showTopics));
    window.history.replaceState({}, "", `${window.location.pathname}?${searchParams.toString()}`);
  };

  const handleModeChange = (nextMode: PrintableQuizMode) => {
    setMode(nextMode);
    syncUrl(nextMode, options);
  };

  const handleOptionChange = (key: keyof PrintableQuizTeacherOptions, checked: boolean) => {
    const nextOptions = {
      ...options,
      [key]: checked,
    };

    setOptions(nextOptions);
    syncUrl(mode, nextOptions);
  };

  return (
    <PrintDocumentShell
      toolbar={(
        <PrintDocumentToolbar
          title={pageTitle}
          description={toolbarDescription}
          actions={(
            <>
              {pdfHref ? (
                <Button asChild type="button" variant="outline">
                  <Link href={pdfHref} target="_blank">
                    <DownloadIcon className="size-4" />
                    Export PDF
                  </Link>
                </Button>
              ) : null}
              <Button type="button" onClick={() => window.print()}>
                <PrinterIcon className="size-4" />
                Print
              </Button>
            </>
          )}
        >
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={mode === "worksheet" ? "default" : "outline"} onClick={() => handleModeChange("worksheet")}>
              Worksheet
            </Button>
            <Button type="button" variant={mode === "answer-key" ? "default" : "outline"} onClick={() => handleModeChange("answer-key")}>
              Answer key
            </Button>
            <Button type="button" variant={mode === "both" ? "default" : "outline"} onClick={() => handleModeChange("both")}>
              Both
            </Button>
          </div>
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <p className="text-sm font-medium">Teacher formatting</p>
              <p className="text-xs text-muted-foreground">Control what appears in print and PDF output.</p>
            </div>
            <Label htmlFor="quiz-compact">
              <Checkbox id="quiz-compact" checked={options.compact} onCheckedChange={(checked) => handleOptionChange("compact", checked === true)} />
              Compact layout
            </Label>
            <Label htmlFor="quiz-mark-boxes">
              <Checkbox id="quiz-mark-boxes" checked={options.showMarkBoxes} onCheckedChange={(checked) => handleOptionChange("showMarkBoxes", checked === true)} />
              Show mark boxes
            </Label>
            <Label htmlFor="quiz-topics">
              <Checkbox id="quiz-topics" checked={options.showTopics} onCheckedChange={(checked) => handleOptionChange("showTopics", checked === true)} />
              Show topics
            </Label>
            <Label htmlFor="quiz-explanations">
              <Checkbox id="quiz-explanations" checked={options.showExplanations} onCheckedChange={(checked) => handleOptionChange("showExplanations", checked === true)} />
              Show explanations
            </Label>
            <Label htmlFor="quiz-references">
              <Checkbox id="quiz-references" checked={options.showReferences} onCheckedChange={(checked) => handleOptionChange("showReferences", checked === true)} />
              Show references
            </Label>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">A4-friendly</Badge>
            <Badge variant="outline">Worksheet</Badge>
            <Badge variant="outline">Answer key</Badge>
            {options.compact ? <Badge variant="outline">Compact</Badge> : null}
          </div>
        </PrintDocumentToolbar>
      )}
    >
      {showWorksheet ? (
        <PrintDocumentSection
          title={pageTitle}
          description={(
            <>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground print:text-black/70">
                <span>Name: ____________________</span>
                <span>Date: ____________________</span>
                <span>Score: ______ / {questions.length}</span>
              </div>
              {instructions ? <p>{instructions}</p> : null}
            </>
          )}
          className={cn(mode === "both" && "print:break-after-page")}
        >
          <div className={cn("grid", options.compact ? "gap-3" : "gap-4")}>
            {questions.map((question, index) => (
              <WorksheetQuestion
                key={question.id}
                compact={options.compact}
                index={index}
                question={question}
                showMarkBoxes={options.showMarkBoxes}
                showTopics={options.showTopics}
              />
            ))}
          </div>
        </PrintDocumentSection>
      ) : null}

      {showAnswerKey ? (
        <PrintDocumentSection
          title="Answer key"
          description="Use this section for marking, reviewing explanations, or discussing the quiz after completion."
        >
          <div className={cn("grid", options.compact ? "gap-3" : "gap-4")}>
            {questions.map((question, index) => (
              <AnswerKeyQuestion
                key={`${question.id}-answer`}
                compact={options.compact}
                groundingReferences={groundingReferences}
                index={index}
                question={question}
                showExplanations={options.showExplanations}
                showMarkBoxes={options.showMarkBoxes}
                showReferences={options.showReferences}
                showTopics={options.showTopics}
              />
            ))}
          </div>
        </PrintDocumentSection>
      ) : null}
    </PrintDocumentShell>
  );
}
