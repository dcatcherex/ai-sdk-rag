import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { availableModels } from '@/lib/ai';

const AUTO_MODEL = {
  id: 'auto',
  name: 'Auto routing',
  provider: 'google' as const,
  description: 'Chooses the best model for each prompt',
} as const;

export const useModelSelector = () => {
  const [selectedModel, setSelectedModel] = useState('auto');
  const [enabledModelIds, setEnabledModelIds] = useState<string[]>(
    () => availableModels.map((model) => model.id)
  );
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [enabledModelsOpen, setEnabledModelsOpen] = useState(false);

  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const enabledModelIdsRef = useRef(enabledModelIds);
  enabledModelIdsRef.current = enabledModelIds;

  const enabledModels = useMemo(
    () => availableModels.filter((model) => enabledModelIds.includes(model.id)),
    [enabledModelIds]
  );

  const selectorModels = useMemo(
    () => [AUTO_MODEL, ...enabledModels],
    [enabledModels]
  );

  const currentModel = useMemo(() => {
    if (selectedModel === 'auto') {
      return AUTO_MODEL;
    }
    return enabledModels.find((model) => model.id === selectedModel)
      ?? enabledModels[0]
      ?? availableModels[0];
  }, [selectedModel, enabledModels]);

  const handleToggleModel = useCallback((modelId: string) => {
    setEnabledModelIds((prev) => {
      const isEnabled = prev.includes(modelId);
      let next = isEnabled ? prev.filter((id) => id !== modelId) : [...prev, modelId];
      if (next.length === 0) {
        return prev;
      }
      next = availableModels
        .filter((model) => next.includes(model.id))
        .map((model) => model.id);
      return next;
    });
  }, []);

  // Load persisted enabled models
  useEffect(() => {
    const stored = localStorage.getItem('chat-enabled-models');
    if (!stored) {
      return;
    }
    try {
      const parsed = JSON.parse(stored) as string[];
      const valid = parsed.filter((modelId) =>
        availableModels.some((model) => model.id === modelId)
      );
      if (valid.length > 0) {
        setEnabledModelIds(valid);
      }
    } catch {
      return;
    }
  }, []);

  // Persist enabled models
  useEffect(() => {
    localStorage.setItem('chat-enabled-models', JSON.stringify(enabledModelIds));
  }, [enabledModelIds]);

  // Reset selected model if it's no longer enabled
  useEffect(() => {
    if (selectedModel === 'auto' || enabledModels.length === 0) {
      return;
    }
    if (!enabledModels.some((model) => model.id === selectedModel)) {
      setSelectedModel(enabledModels[0].id);
    }
  }, [enabledModels, selectedModel]);

  return {
    selectedModel,
    setSelectedModel,
    selectedModelRef,
    enabledModelIds,
    enabledModelIdsRef,
    enabledModels,
    selectorModels,
    currentModel,
    modelSelectorOpen,
    setModelSelectorOpen,
    enabledModelsOpen,
    setEnabledModelsOpen,
    handleToggleModel,
  };
};
