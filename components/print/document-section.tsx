import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PrintDocumentSectionProps = {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
};

export function PrintDocumentSection({ children, className, description, title }: PrintDocumentSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight print:text-[20pt]">{title}</h2>
        {description ? (
          <div className="text-sm leading-relaxed text-muted-foreground print:text-black/80">{description}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
