import Image from 'next/image';
import type { MediaAsset } from '../../types';

type Props = {
  versionHistory: MediaAsset[];
  selectedVersionId: string | null;
  activeGalleryVersionId?: string | null;
  onSelectVersion: (id: string) => void;
  onSetActiveVersion?: (id: string) => void;
};

export const VersionPanel = ({
  versionHistory,
  selectedVersionId,
  activeGalleryVersionId,
  onSelectVersion,
  onSetActiveVersion,
}: Props) => {
  const handleSelect = (id: string) => {
    onSelectVersion(id);
    onSetActiveVersion?.(id);
  };

  return (
    <div className="w-44 shrink-0 overflow-y-auto border-l border-black/5 dark:border-border p-3">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Versions
      </p>
      <div className="space-y-3">
        {versionHistory.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">No versions yet.</p>
        ) : (
          versionHistory.map((v) => {
            const isGalleryPreview = activeGalleryVersionId === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelect(v.id)}
                className={`w-full overflow-hidden rounded-xl border text-left transition ${
                  selectedVersionId === v.id
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-black/5 dark:border-border hover:border-primary/50'
                }`}
              >
                <div className="relative aspect-square overflow-hidden bg-muted/30">
                  <Image
                    src={v.thumbnailUrl ?? v.url}
                    alt={`v${v.version ?? 1}`}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  {isGalleryPreview && (
                    <div className="absolute bottom-1 right-1 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-semibold text-primary-foreground">
                      preview
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <p className="line-clamp-2 text-[10px] text-muted-foreground">
                    {v.editPrompt ?? `Version ${v.version ?? 1}`}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
