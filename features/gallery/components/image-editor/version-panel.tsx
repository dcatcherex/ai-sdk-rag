import type { MediaAsset } from '../../types';

type Props = {
  versionHistory: MediaAsset[];
  selectedVersionId: string | null;
  onSelectVersion: (id: string) => void;
};

export const VersionPanel = ({ versionHistory, selectedVersionId, onSelectVersion }: Props) => {
  return (
    <div className="w-44 shrink-0 overflow-y-auto border-l border-black/5 dark:border-white/10 p-3">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Versions
      </p>
      <div className="space-y-3">
        {versionHistory.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No versions yet.</p>
        ) : (
          versionHistory.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelectVersion(v.id)}
              className={`w-full overflow-hidden rounded-xl border text-left transition ${
                selectedVersionId === v.id
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-black/5 dark:border-white/10 hover:border-primary/50'
              }`}
            >
              <div className="aspect-square overflow-hidden bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.thumbnailUrl ?? v.url}
                  alt={`v${v.version ?? 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="px-2 py-1.5">
                <p className="line-clamp-2 text-[10px] text-muted-foreground">
                  {v.editPrompt ?? `Version ${v.version ?? 1}`}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
