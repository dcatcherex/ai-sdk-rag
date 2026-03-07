import { useCallback, useEffect, useState } from 'react';
import { availableModels } from '@/lib/ai';

const STORAGE_KEY = 'compare-preset-v1';

const isImageModel = (modelId: string) => {
  const caps = availableModels.find((m) => m.id === modelId)?.capabilities ?? [];
  return caps.some((c) => c === 'image gen');
};

export type ComparePresetMode = 'text' | 'image' | null;

export const useComparePreset = () => {
  const [presetIds, setPresetIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPresetIds(JSON.parse(stored) as string[]);
      }
    } catch {
      // ignore
    }
  }, []);

  const presetMode: ComparePresetMode =
    presetIds.length === 0
      ? null
      : isImageModel(presetIds[0]!)
        ? 'image'
        : 'text';

  const toggleModel = useCallback((modelId: string) => {
    setPresetIds((prev) => {
      let next: string[];

      if (prev.includes(modelId)) {
        next = prev.filter((id) => id !== modelId);
      } else if (prev.length >= 4) {
        return prev;
      } else if (prev.length > 0) {
        // Enforce same type — silently ignore cross-type selection
        const newIsImage = isImageModel(modelId);
        const existingIsImage = isImageModel(prev[0]!);
        if (newIsImage !== existingIsImage) return prev;
        next = [...prev, modelId];
      } else {
        next = [modelId];
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearPreset = useCallback(() => {
    setPresetIds([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { presetIds, presetMode, toggleModel, clearPreset };
};
