import type { ReactNode } from 'react';

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  leading?: ReactNode;
  icon?: ReactNode;
};

export function PageHeader({ title, description, action, leading, icon }: Props) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-black/5 px-6 py-4 dark:border-border">
      <div className="flex min-w-0 items-center gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? <div className="shrink-0 text-primary">{icon}</div> : null}
            <h2 className="truncate text-lg font-semibold">{title}</h2>
          </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
