import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PrintDocumentShellProps = {
  children: ReactNode;
  toolbar?: ReactNode;
  className?: string;
};

export function PrintDocumentShell({ children, toolbar, className }: PrintDocumentShellProps) {
  return (
    <div className="min-h-screen bg-muted/30 text-foreground print:bg-white">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 16mm;
          }

          html, body {
            background: white !important;
          }
        }
      `}</style>

      <div className={cn("mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 print:max-w-none print:px-0 print:py-0", className)}>
        {toolbar}
        {children}
      </div>
    </div>
  );
}
