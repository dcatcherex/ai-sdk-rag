'use client';

export default function ToolPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <p className="text-sm text-muted-foreground">Something went wrong loading this tool.</p>
      <button
        onClick={reset}
        className="text-sm underline underline-offset-4 hover:text-foreground"
      >
        Try again
      </button>
    </div>
  );
}
