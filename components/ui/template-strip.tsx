'use client';

const CARD_HEIGHT = 82; // px — fixed height for all cards

function parseRatio(ar?: string): number {
  if (!ar || ar === 'auto' || ar === 'Auto') return 1;
  const parts = ar.split(':');
  const w = parseFloat(parts[0] ?? '1');
  const h = parseFloat(parts[1] ?? '1');
  if (!w || !h) return 1;
  return w / h;
}

export interface TemplateItem {
  id: string;
  title: string;
  tag?: string;
  /** CSS gradient string — shown when no image is provided */
  gradient: string;
  /** Optional preview image URL — shown instead of gradient when set */
  image?: string;
  /** Aspect ratio string e.g. "16:9", "9:16", "1:1" — determines card width */
  aspectRatio?: string;
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
      <div
        className="flex gap-2 overflow-x-auto pb-0.5 items-end"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      >
        {templates.map(t => {
          const ratio = parseRatio(t.aspectRatio);
          // Clamp width: min 56px (very tall), max 200px (very wide)
          const cardW = Math.min(Math.max(Math.round(CARD_HEIGHT * ratio), 56), 200);

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className="group relative flex-none rounded-xl overflow-hidden border border-border hover:border-primary/60 hover:shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ width: cardW, height: CARD_HEIGHT }}
            >
              {/* Background: image or gradient */}
              {t.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.image}
                  alt={t.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0" style={{ background: t.gradient }} />
              )}

              {/* Hover overlay — title + tag slide up */}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="px-2 pb-2">
                  <p className="text-[11px] font-semibold text-white leading-tight truncate">
                    {t.title}
                  </p>
                  {t.tag && (
                    <p className="text-[10px] text-white/70 leading-tight truncate mt-0.5">
                      {t.tag}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
