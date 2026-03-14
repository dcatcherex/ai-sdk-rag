'use client';

import { useState } from 'react';
import { useGalleryAssets } from '@/features/gallery/hooks/use-gallery-assets';
import { useImageEditor } from '@/features/gallery/hooks/use-image-editor';
import { GalleryGrid } from '@/features/gallery/components/gallery-grid';
import { ImageEditor } from '@/features/gallery/components/image-editor/image-editor';
import type { MediaAsset } from '@/features/gallery/types';

export default function GalleryPage() {
  const [filter, setFilter] = useState<'all' | 'image'>('image');
  const [activeVersions, setActiveVersions] = useState<Record<string, string>>({});
  const setActiveVersion = (rootId: string, assetId: string) =>
    setActiveVersions((prev) => ({ ...prev, [rootId]: assetId }));

  const { assetGroups, isLoading, error } = useGalleryAssets(filter);
  const editorState = useImageEditor();
  const { editorOpen, selectedAsset, openEditor, closeEditor } = editorState;

  const handleOpenEditor = (asset: MediaAsset) => {
    const rootId = asset.rootAssetId ?? asset.id;
    if (!activeVersions[rootId]) setActiveVersion(rootId, asset.id);
    openEditor(asset);
  };

  const activeGalleryVersionId = selectedAsset
    ? (activeVersions[selectedAsset.rootAssetId ?? selectedAsset.id] ?? null)
    : null;

  if (editorOpen && selectedAsset) {
    return (
      <ImageEditor
        asset={selectedAsset}
        onClose={closeEditor}
        editorState={editorState}
        activeGalleryVersionId={activeGalleryVersionId}
        onSetActiveVersion={setActiveVersion}
      />
    );
  }

  return (
    <GalleryGrid
      assetGroups={assetGroups}
      activeVersions={activeVersions}
      isLoading={isLoading}
      error={error as Error | null}
      filter={filter}
      onFilterChange={setFilter}
      onEdit={handleOpenEditor}
    />
  );
}
