type FollowUpChipsProps = {
  suggestions: string[];
  onSuggestionClick: (suggestion: string) => void;
};

export const FollowUpChips = ({ suggestions, onSuggestionClick }: FollowUpChipsProps) => (
  <div className="mt-3 flex flex-wrap gap-2">
    {suggestions.map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onSuggestionClick(s)}
        className="rounded-full border border-zinc-200 dark:border-border bg-zinc-50 dark:bg-muted/60 px-3 py-1 text-[12px] text-zinc-600 dark:text-foreground/80 hover:bg-zinc-100 dark:hover:bg-secondary/60 hover:border-zinc-300 dark:hover:border-border transition-colors text-left"
      >
        {s}
      </button>
    ))}
  </div>
);
