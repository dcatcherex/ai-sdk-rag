'use client';

import { useEffect, useState } from 'react';
import type { Preferences } from '../types';

const DEFAULT_PREFS: Preferences = {
  memoryEnabled: true,
  memoryInjectEnabled: true,
  memoryExtractEnabled: true,
  personaDetectionEnabled: true,
  promptEnhancementEnabled: true,
  followUpSuggestionsEnabled: true,
  enabledToolIds: null,
  rerankEnabled: false,
  selectedVoice: null,
};

export function useSettingsPreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [personaInstructions, setPersonaInstructions] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const [prefsRes, personaRes] = await Promise.all([
        fetch('/api/user/preferences'),
        fetch('/api/user/persona-instructions'),
      ]);
      if (prefsRes.ok) setPrefs(await prefsRes.json());
      if (personaRes.ok) setPersonaInstructions(await personaRes.json());
      setIsLoading(false);
    })();
  }, []);

  const updatePref = async (patch: Partial<Preferences>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await fetch('/api/user/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  };

  return { prefs, updatePref, personaInstructions, setPersonaInstructions, isLoading };
}
