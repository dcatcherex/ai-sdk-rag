import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMediaAssets } from '../utils';
import type { MediaAsset } from '../types';

export const useImageEditor = () => {
  const queryClient = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-image-1.5');
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rootAssetId = selectedAsset?.rootAssetId ?? selectedAsset?.id;

  const { data: versionHistory = [] } = useQuery<MediaAsset[]>({
    queryKey: ['media-assets', 'history', rootAssetId],
    enabled: Boolean(editorOpen && rootAssetId),
    queryFn: async () => {
      if (!rootAssetId) return [];
      const assets = await fetchMediaAssets('image', rootAssetId);
      return assets.sort((a, b) => (a.version ?? 1) - (b.version ?? 1));
    },
  });

  const selectedVersion = useMemo(() => {
    if (!selectedVersionId) return selectedAsset;
    return versionHistory.find((a) => a.id === selectedVersionId) ?? selectedAsset;
  }, [selectedAsset, selectedVersionId, versionHistory]);

  const openEditor = (asset: MediaAsset) => {
    setSelectedAsset(asset);
    setSelectedVersionId(asset.id);
    setSubmitError(null);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setSelectedAsset(null);
    setSelectedVersionId(null);
    setSubmitError(null);
  };

  const submitEdit = async (text: string, buildMaskDataUrl: () => string | undefined, clearMask: () => void) => {
    if (!selectedVersion || !selectedAsset) return;
    if (!text.trim()) {
      setSubmitError('Please describe the edit.');
      throw new Error('empty prompt');
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const maskDataUrl = buildMaskDataUrl();
      const response = await fetch('/api/images/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: selectedAsset.threadId,
          sourceAssetId: selectedVersion.id,
          prompt: text.trim(),
          maskDataUrl,
          model: selectedModel,
        }),
      });

      const payload = (await response.json()) as { error?: string; asset?: MediaAsset };
      if (!response.ok) throw new Error(payload.error ?? 'Failed to edit image');

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['media-assets'] }),
        queryClient.invalidateQueries({ queryKey: ['threads'] }),
        queryClient.invalidateQueries({ queryKey: ['threads', selectedAsset.threadId, 'messages'] }),
        queryClient.invalidateQueries({ queryKey: ['media-assets', 'history', rootAssetId] }),
      ]);

      clearMask();

      if (payload.asset?.id) setSelectedVersionId(payload.asset.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Edit failed';
      setSubmitError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    editorOpen,
    versionsOpen,
    setVersionsOpen,
    selectedAsset,
    selectedVersion,
    selectedVersionId,
    setSelectedVersionId,
    versionHistory,
    selectedModel,
    setSelectedModel,
    modelSelectorOpen,
    setModelSelectorOpen,
    isSubmitting,
    submitError,
    openEditor,
    closeEditor,
    submitEdit,
  };
};
