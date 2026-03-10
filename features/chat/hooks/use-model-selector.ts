import { useEffect, useMemo, useRef, useState } from 'react';
import { availableModels } from '@/lib/ai';
import { useEnabledModels } from '@/features/models/hooks/use-enabled-models';

const AUTO_MODEL = {
  id: 'auto',
  name: 'Auto',
  provider: 'google' as const,
  description: 'Chooses the best model for each prompt',
} as const;

export const useModelSelector = () => {
  const [selectedModel, setSelectedModel] = useState('auto');
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [enabledModelsOpen, setEnabledModelsOpen] = useState(false);

  const { enabledModelIds, enabledModels, toggleModel: handleToggleModel } = useEnabledModels();

  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const enabledModelIdsRef = useRef(enabledModelIds);
  enabledModelIdsRef.current = enabledModelIds;

  const selectorModels = useMemo(
    () => [AUTO_MODEL, ...enabledModels],
    [enabledModels]
  );

  const currentModel = useMemo(() => {
    if (selectedModel === 'auto') return AUTO_MODEL;
    return (
      enabledModels.find((model) => model.id === selectedModel) ??
      enabledModels[0] ??
      availableModels[0]
    );
  }, [selectedModel, enabledModels]);

  // Reset selected model if it's no longer enabled
  useEffect(() => {
    if (selectedModel === 'auto' || enabledModels.length === 0) return;
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
