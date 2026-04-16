'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGenerationPoll } from '@/lib/hooks/use-generation-poll';
import { IMAGE_MODEL_CONFIGS } from '../types';

export type Mode = 'generate' | 'edit';

export function useImageGenerator() {
  const searchParams = useSearchParams();
  const { state, startPoll, checkNow, reset } = useGenerationPoll();

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

  // Resume poll from agent redirect
  const idFromUrl = searchParams.get('id');
  const taskIdFromUrl = searchParams.get('taskId');
  useEffect(() => {
    if (idFromUrl && taskIdFromUrl && state.status === 'idle') {
      startPoll({ taskId: taskIdFromUrl, generationId: idFromUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromUrl, taskIdFromUrl]);

  // When mode changes, pick a sensible default model
  useEffect(() => {
    const compatible = IMAGE_MODEL_CONFIGS.find(m => m.mode === mode || m.mode === 'both');
    if (compatible) {
      setModelId(compatible.id);
      setAspectRatio(compatible.aspectRatios[0] ?? 'auto');
    }
  }, [mode]);

  const modelConfig = IMAGE_MODEL_CONFIGS.find(m => m.id === modelId)!;
  const visibleModels = IMAGE_MODEL_CONFIGS.filter(m => m.mode === mode || m.mode === 'both');

  const handleModelSelect = (id: string) => {
    setModelId(id);
    const cfg = IMAGE_MODEL_CONFIGS.find(m => m.id === id);
    if (cfg && !cfg.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(cfg.aspectRatios[0] ?? 'auto');
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
