'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useGenerationPoll } from '@/lib/hooks/use-generation-poll';
import { IMAGE_MODEL_CONFIGS } from '../types';
import type { ActiveImageModel } from '@/app/api/image/models/route';

export type Mode = 'generate' | 'edit';

export function useImageGenerator() {
  const searchParams = useSearchParams();
  const { state, startPoll, checkNow, reset } = useGenerationPoll();

  // Fetch admin-configured enabled models (falls back to full list on error)
  const { data: activeModels } = useQuery<ActiveImageModel[]>({
    queryKey: ['image-models-active'],
    queryFn: async () => {
      const res = await fetch('/api/image/models');
      if (!res.ok) return IMAGE_MODEL_CONFIGS as ActiveImageModel[];
      const json = await res.json() as { models: ActiveImageModel[] };
      return json.models;
    },
    staleTime: 30_000,
    placeholderData: IMAGE_MODEL_CONFIGS as ActiveImageModel[],
  });

  const modelConfigs = activeModels ?? (IMAGE_MODEL_CONFIGS as ActiveImageModel[]);

  const [mode, setMode] = useState<Mode>('generate');
  const [modelId, setModelId] = useState('nano-banana-2');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('auto');
  const [quality, setQuality] = useState<'medium' | 'high'>('medium');
  const [enablePro, setEnablePro] = useState(false);
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [imageCount, setImageCount] = useState(1);
  const [googleSearch, setGoogleSearch] = useState(false);
  const [seed, setSeed] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // Track whether the user has manually changed the model
  const userChangedModel = useRef(false);

  // Once active models load, apply the admin-configured default (if user hasn't manually picked)
  useEffect(() => {
    if (!activeModels || userChangedModel.current) return;
    const defaultModel = activeModels.find(m => m.isDefault && (m.mode === mode || m.mode === 'both'));
    if (defaultModel) {
      setModelId(defaultModel.id);
      if (defaultModel.defaultAspectRatio) setAspectRatio(defaultModel.defaultAspectRatio);
      if (defaultModel.defaultQuality) setQuality(defaultModel.defaultQuality);
      if (defaultModel.defaultResolution) setResolution(defaultModel.defaultResolution);
      if (defaultModel.defaultEnablePro) setEnablePro(defaultModel.defaultEnablePro);
      if (defaultModel.defaultGoogleSearch) setGoogleSearch(defaultModel.defaultGoogleSearch);
    }
  }, [activeModels, mode]);

  // Resume poll from agent redirect
  const idFromUrl = searchParams.get('id');
  const taskIdFromUrl = searchParams.get('taskId');
  useEffect(() => {
    if (idFromUrl && taskIdFromUrl && state.status === 'idle') {
      startPoll({ taskId: taskIdFromUrl, generationId: idFromUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromUrl, taskIdFromUrl]);

  // When mode changes, pick a sensible default model from the active list
  useEffect(() => {
    if (userChangedModel.current) return;
    const defaultForMode = modelConfigs.find(m => m.isDefault && (m.mode === mode || m.mode === 'both'))
      ?? modelConfigs.find(m => m.mode === mode || m.mode === 'both');
    if (defaultForMode) {
      setModelId(defaultForMode.id);
      setAspectRatio(defaultForMode.defaultAspectRatio ?? defaultForMode.aspectRatios[0] ?? 'auto');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const modelConfig = modelConfigs.find(m => m.id === modelId) ?? modelConfigs[0];
  const visibleModels = modelConfigs.filter(m => m.mode === mode || m.mode === 'both');

  const handleModelSelect = (id: string) => {
    userChangedModel.current = true;
    setModelId(id);
    const cfg = modelConfigs.find(m => m.id === id);
    if (cfg) {
      if (!cfg.aspectRatios.includes(aspectRatio)) {
        setAspectRatio(cfg.defaultAspectRatio ?? cfg.aspectRatios[0] ?? 'auto');
      }
      // Apply per-model admin defaults when switching
      if (cfg.defaultQuality) setQuality(cfg.defaultQuality);
      if (cfg.defaultResolution) setResolution(cfg.defaultResolution);
      setEnablePro(cfg.defaultEnablePro ?? false);
      setGoogleSearch(cfg.defaultGoogleSearch ?? false);
    }
  };

  const canGenerate = prompt.trim().length > 0 && (!modelConfig?.requiresImages || imageUrls.length > 0);
  const isPolling = state.status === 'polling' || state.status === 'delayed';

  const handleGenerate = async () => {
    if (!canGenerate) return;
    reset();

    const body: Record<string, unknown> = {
      prompt,
      modelId,
      aspectRatio,
      imageCount,
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      promptTitle: prompt.substring(0, 50),
    };
    if (modelConfig?.hasQuality) body.quality = quality;
    if (modelConfig?.hasEnablePro) body.enablePro = enablePro;
    if (modelConfig?.hasResolution) body.resolution = resolution;
    if (modelConfig?.hasGoogleSearch) body.googleSearch = googleSearch;
    if (modelConfig?.hasSeed && seed) body.seed = parseInt(seed);

    const res = await fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      alert(data.error ?? 'Request failed');
      return;
    }

    const { taskId, generationId } = await res.json();
    await startPoll({ taskId, generationId, modelId, promptTitle: prompt.substring(0, 50) });
  };

  return {
    mode, setMode,
    prompt, setPrompt,
    aspectRatio, setAspectRatio,
    quality, setQuality,
    enablePro, setEnablePro,
    resolution, setResolution,
    imageCount, setImageCount,
    googleSearch, setGoogleSearch,
    seed, setSeed,
    imageUrls, setImageUrls,
    modelConfig,
    visibleModels,
    canGenerate,
    isPolling,
    handleModelSelect,
    handleGenerate,
    checkNow,
    pollState: state,
    resetPoll: reset,
  };
}
