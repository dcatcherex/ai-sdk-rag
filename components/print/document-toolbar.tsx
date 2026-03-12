import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PrintDocumentToolbarProps = {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  title: ReactNode;
};

export function PrintDocumentToolbar({ actions, children, description, title }: PrintDocumentToolbarProps) {
  return (
    <Card className="print:hidden">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </CardHeader>
      {children ? <CardContent className="space-y-4">{children}</CardContent> : null}
    </Card>
  );
}
