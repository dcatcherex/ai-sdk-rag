"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, RotateCwIcon } from "lucide-react";
import { CitationBadge } from "@/components/chat/citation-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type GroundingReference = {
  documentId?: string;
  id: number;
  page?: number | null;
  section?: string;
  source: string;
};

type Flashcard = {
  back: string;
  front: string;
  id: string;
  references?: number[];
  topic: string;
};

type FlashcardStatus = "known" | "review";

type InteractiveFlashcardsProps = {
  deckTitle?: string;
  flashcards: Flashcard[];
  groundingReferences?: GroundingReference[];
  studyTip?: string;
};

type ResolvedReference = {
  documentId?: string;
  id: number;
  page?: number | null;
  section?: string;
  source: string;
};

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

export function InteractiveFlashcards({
  deckTitle,
  flashcards,
  groundingReferences,
  studyTip,
}: InteractiveFlashcardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [statuses, setStatuses] = useState<Record<string, FlashcardStatus | undefined>>({});

  const currentCard = flashcards[currentIndex];
  const isFlipped = currentCard ? !!flippedCards[currentCard.id] : false;

  const reviewedCount = useMemo(
    () => flashcards.filter((card) => Boolean(statuses[card.id])).length,
    [flashcards, statuses],
  );

  const knownCount = useMemo(
    () => flashcards.filter((card) => statuses[card.id] === "known").length,
    [flashcards, statuses],
  );

  const reviewLaterCount = useMemo(
    () => flashcards.filter((card) => statuses[card.id] === "review").length,
    [flashcards, statuses],
  );

  if (flashcards.length === 0 || !currentCard) {
    return null;
  }

  const references = resolveReferences(currentCard.references, groundingReferences);
  const progressValue = (reviewedCount / flashcards.length) * 100;

  const setCardStatus = (status: FlashcardStatus) => {
    setStatuses((previous) => ({
      ...previous,
      [currentCard.id]: status,
    }));
  };

  const toggleFlip = () => {
    setFlippedCards((previous) => ({
      ...previous,
      [currentCard.id]: !previous[currentCard.id],
    }));
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    setCurrentIndex((previous) => (previous === 0 ? flashcards.length - 1 : previous - 1));
  };

  const goToNext = () => {
    setCurrentIndex((previous) => (previous === flashcards.length - 1 ? 0 : previous + 1));
  };

  return (
    <div className="space-y-4">
      <Card className="gap-4 border bg-background/70 py-4">
        <CardHeader className="gap-3 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{flashcards.length} cards</Badge>
            <Badge variant="outline">{reviewedCount} reviewed</Badge>
            <Badge variant="outline">{knownCount} known</Badge>
            <Badge variant="outline">{reviewLaterCount} review later</Badge>
          </div>
          {deckTitle ? <CardTitle className="text-base">{deckTitle}</CardTitle> : null}
          {studyTip ? <CardDescription>{studyTip}</CardDescription> : null}
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Study progress</span>
              <span>{reviewedCount}/{flashcards.length}</span>
            </div>
            <Progress value={progressValue} />
          </div>

          <div className="flex flex-wrap gap-2">
            {flashcards.map((card, index) => {
              const status = statuses[card.id];
              const isActive = index === currentIndex;

              return (
                <Button
                  key={card.id}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className={cn(
                    "justify-start",
                    status === "known" && !isActive && "border-emerald-500/40 text-emerald-700",
                    status === "review" && !isActive && "border-amber-500/40 text-amber-700",
                  )}
                  onClick={() => goToIndex(index)}
                >
                  Card {index + 1}
                  {status === "known" ? <CheckIcon className="size-3.5" /> : null}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-4 border bg-background/70 py-4">
        <CardHeader className="gap-3 px-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Card {currentIndex + 1}</Badge>
            <Badge variant="outline">{currentCard.topic}</Badge>
            <Badge variant={isFlipped ? "secondary" : "outline"}>{isFlipped ? "Back" : "Front"}</Badge>
            {statuses[currentCard.id] ? (
              <Badge variant={statuses[currentCard.id] === "known" ? "secondary" : "outline"}>
                {statuses[currentCard.id] === "known" ? "Known" : "Review later"}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4">
          <button
            type="button"
            className="w-full rounded-xl border bg-muted/30 p-5 text-left transition-colors hover:bg-muted/50"
            onClick={toggleFlip}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {isFlipped ? "Back" : "Front"}
                </p>
                <span className="text-xs text-muted-foreground">Click to flip</span>
              </div>
              <div className="min-h-28 text-base leading-relaxed whitespace-pre-wrap">
                {isFlipped ? currentCard.back : currentCard.front}
              </div>
            </div>
          </button>

          {isFlipped && references.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {references.map((reference) => (
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

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={goToPrevious}>
              <ChevronLeftIcon className="size-4" />
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={toggleFlip}>
              <RotateCwIcon className="size-4" />
              Flip card
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={goToNext}>
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCardStatus("known")}>
              Mark known
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCardStatus("review")}>
              Review later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
