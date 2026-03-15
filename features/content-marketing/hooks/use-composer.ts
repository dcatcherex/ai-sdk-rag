'use client';

import { useState, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SocialPlatform, GenerateCaptionsResult } from '../types';

export type UploadedMedia = {
  r2Key: string;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
};

export function useComposer() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [topic, setTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(['instagram']);
  const [tone, setTone] = useState('engaging');
  const [generatedOverrides, setGeneratedOverrides] = useState<GenerateCaptionsResult['overrides']>({});
  const [activePlatformPreview, setActivePlatformPreview] = useState<SocialPlatform>('instagram');
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tools/content-marketing/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, platforms: selectedPlatforms, tone }),
      });
      if (!res.ok) throw new Error('Generation failed');
      return res.json() as Promise<GenerateCaptionsResult>;
    },
    onSuccess: (data) => {
      setCaption(data.base);
      setGeneratedOverrides(data.overrides ?? {});
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (schedule: boolean) => {
      const res = await fetch('/api/tools/content-marketing/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          platforms: selectedPlatforms,
          platformOverrides: generatedOverrides,
          media: uploadedMedia,
          scheduledAt: schedule && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      setCaption('');
      setTopic('');
      setGeneratedOverrides({});
      setUploadedMedia([]);
      setScheduledAt('');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/tools/content-marketing/upload-media', { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      return res.json() as Promise<UploadedMedia>;
    },
    onSuccess: (media) => setUploadedMedia((prev) => [...prev, media]),
  });

  const togglePlatform = (platform: SocialPlatform) =>
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );

  const removeMedia = (r2Key: string) =>
    setUploadedMedia((prev) => prev.filter((x) => x.r2Key !== r2Key));

  const activeCaptionForPreview = generatedOverrides[activePlatformPreview]?.caption ?? caption;

  const minDatetime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  }, []);

  const canSchedule = !!scheduledAt && !!caption.trim() && selectedPlatforms.length > 0;

  return {
    fileInputRef,
    topic, setTopic,
    caption, setCaption,
    selectedPlatforms, setSelectedPlatforms,
    tone, setTone,
    generatedOverrides,
    activePlatformPreview, setActivePlatformPreview,
    uploadedMedia,
    scheduledAt, setScheduledAt,
    generateMutation,
    saveMutation,
    uploadMutation,
    togglePlatform,
    removeMedia,
    activeCaptionForPreview,
    minDatetime,
    canSchedule,
  };
}
