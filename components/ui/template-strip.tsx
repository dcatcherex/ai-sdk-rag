'use client';

export interface TemplateItem {
  id: string;
  title: string;
  tag?: string;
  /** CSS gradient string, e.g. "linear-gradient(135deg, #f59e0b, #ef4444)" */
  gradient: string;
  /** Optional preview image URL — shown instead of gradient when provided */
  image?: string;
}

interface Props {
  templates: TemplateItem[];
  onSelect: (id: string) => void;
  label?: string;
}

export function TemplateStrip({ templates, onSelect, label = 'Try a template' }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
      <div
        className="flex gap-2 overflow-x-auto pb-0.5"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        {templates.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className="flex-none w-[118px] rounded-xl overflow-hidden border border-border hover:border-primary/60 hover:shadow-md transition-all group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.image} alt={t.title} className="h-14 w-full object-cover" />
            ) : (
              <div className="h-14" style={{ background: t.gradient }} />
            )}
            <div className="px-2.5 py-1.5 bg-background group-hover:bg-muted/40 transition-colors">
              <p className="text-xs font-medium truncate leading-tight">{t.title}</p>
              {t.tag && (
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.tag}</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
