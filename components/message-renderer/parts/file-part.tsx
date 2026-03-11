"use client";

import type { MediaAsset } from "@/features/gallery/types";
import { ShareIcon, CopyIcon, DownloadIcon } from "lucide-react";
import Image from "next/image";
import type { FilePart } from "../types";

type FilePartRendererProps = {
  part: FilePart;
  messageId: string;
  threadId?: string;
  onImageClick?: (asset: MediaAsset) => void;
};

export function FilePartRenderer({ part, messageId, threadId, onImageClick }: FilePartRendererProps) {
  if (part.mediaType.startsWith("image/")) {
    return (
      <ImagePartRenderer
        part={part}
        messageId={messageId}
        threadId={threadId}
        onImageClick={onImageClick}
      />
    );
  }

  return (
    <a
      href={part.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-foreground hover:bg-muted"
    >
      <span className="font-medium">📎 {part.filename ?? "Download file"}</span>
      <span className="text-muted-foreground text-xs">{part.mediaType}</span>
    </a>
  );
}

// ─── Image renderer ───────────────────────────────────────────────────────────

function ImagePartRenderer({ part, messageId, threadId, onImageClick }: FilePartRendererProps) {
  const isDataUrl = part.url.startsWith("data:");
  const hasDimensions = typeof part.width === "number" && typeof part.height === "number";
  const previewUrl = !isDataUrl && part.thumbnailUrl ? part.thumbnailUrl : part.url;
  const canEdit = Boolean(onImageClick && !isDataUrl);

  const handleEditClick = async () => {
    if (!onImageClick) return;

    if (part.assetId) {
      onImageClick({
        id: part.assetId,
        type: "image",
        url: part.url,
        thumbnailUrl: part.thumbnailUrl ?? null,
        width: part.width ?? null,
        height: part.height ?? null,
        mimeType: part.mediaType,
        threadId: threadId ?? "",
        messageId,
        parentAssetId: part.parentAssetId ?? null,
        rootAssetId: part.rootAssetId ?? part.assetId,
        version: part.version ?? 1,
        editPrompt: part.editPrompt ?? null,
        createdAtMs: Date.now(),
      });
      return;
    }

    if (messageId) {
      try {
        const res = await fetch(`/api/media-assets?messageId=${encodeURIComponent(messageId)}`);
        if (res.ok) {
          const data = (await res.json()) as { assets: MediaAsset[] };
          const match = data.assets.find(
            (a) => a.url === part.url || a.thumbnailUrl === part.thumbnailUrl,
          );
          if (match) onImageClick(match);
        }
      } catch {
        /* fall through */
      }
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.share({ url: part.url });
    } catch {
      await navigator.clipboard.writeText(part.url);
    }
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(part.url);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    } catch {
      await navigator.clipboard.writeText(part.url);
    }
  };

  const imgElement =
    hasDimensions && !isDataUrl ? (
      <Image
        src={previewUrl}
        alt={part.filename ?? "Generated image"}
        width={part.width}
        height={part.height}
        sizes="(max-width: 768px) 100vw, 640px"
        className="h-auto w-full rounded-md"
      />
    ) : (
      <img
        src={previewUrl}
        alt={part.filename ?? "Generated image"}
        className="h-auto w-full rounded-md"
      />
    );

  return (
    <div
      className={`group/img relative overflow-hidden rounded-lg border bg-muted/50 p-2 ${canEdit ? "cursor-pointer" : ""}`}
      onClick={canEdit ? handleEditClick : undefined}
    >
      {imgElement}
      <div
        className="absolute bottom-3 right-3 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover/img:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            type="button"
            title="Share"
            onClick={handleShare}
            className="flex size-8 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background transition-colors"
          >
            <ShareIcon className="size-3.5 text-foreground" />
          </button>
        )}
        <button
          type="button"
          title="Copy image"
          onClick={handleCopy}
          className="flex size-8 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background transition-colors"
        >
          <CopyIcon className="size-3.5 text-foreground" />
        </button>
        <a
          href={part.url}
          download={part.filename ?? "image.webp"}
          title="Download"
          className="flex size-8 items-center justify-center rounded-full bg-background/90 shadow hover:bg-background transition-colors"
        >
          <DownloadIcon className="size-3.5 text-foreground" />
        </a>
      </div>
    </div>
  );
}
