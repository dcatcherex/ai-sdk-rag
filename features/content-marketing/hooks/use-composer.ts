'use client';

import { useState, useMemo, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SocialPlatform, GenerateCaptionsResult, SocialPostRecord } from '../types';
import type { GuardrailCheckResult } from '@/features/brand-guardrails/types';

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
  const [editingPostId, setEditingPostId] = useState<string | null>(null);

  // ── New: brand + campaign context ────────────────────────────────────────────
  const [brandId, setBrandId] = useState<string>('');
  const [campaignId, setCampaignId] = useState<string>('');
  const [guardrailResult, setGuardrailResult] = useState<GuardrailCheckResult | null>(null);
  const [showGuardrails, setShowGuardrails] = useState(false);

  const resetForm = () => {
    setEditingPostId(null);
    setCaption('');
    setTopic('');
    setGeneratedOverrides({});
    setUploadedMedia([]);
    setScheduledAt('');
    setGuardrailResult(null);
    setShowGuardrails(false);
  };

  const loadPost = (post: SocialPostRecord) => {
    setEditingPostId(post.id);
    setCaption(post.caption);
    setSelectedPlatforms(post.platforms);
    setGeneratedOverrides(post.platformOverrides);
    setUploadedMedia(post.media as UploadedMedia[]);
    setScheduledAt(
      post.scheduledAt
        ? new Date(post.scheduledAt).toISOString().slice(0, 16)
        : '',
    );
    setTopic('');
    setBrandId(post.brandId ?? '');
    setCampaignId(post.campaignId ?? '');
    setGuardrailResult(null);
    setShowGuardrails(false);
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/tools/content-marketing/generate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          platforms: selectedPlatforms,
          tone,
          ...(brandId ? { brandId } : {}),
        }),
      });
      if (!res.ok) throw new Error('Generation failed');
      return res.json() as Promise<GenerateCaptionsResult>;
    },
    onSuccess: (data) => {
      setCaption(data.base);
      setGeneratedOverrides(data.overrides ?? {});
      // Auto-run guardrail check if brand is set
      if (brandId && data.base) {
        guardrailMutation.mutate(data.base);
      }
    },
  });

  const guardrailMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!brandId) return null;
      const res = await fetch('/api/tools/content-marketing/guardrail-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, content }),
      });
      if (!res.ok) return null;
      return res.json() as Promise<GuardrailCheckResult>;
    },
    onSuccess: (data) => {
      if (data) {
        setGuardrailResult(data);
        if (data.violations.length > 0) setShowGuardrails(true);
      }
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
          ...(brandId ? { brandId } : {}),
          ...(campaignId ? { campaignId } : {}),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-entries'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingPostId) throw new Error('No post being edited');
      const res = await fetch(`/api/tools/content-marketing/posts/${editingPostId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          platforms: selectedPlatforms,
          ...(Object.keys(generatedOverrides).length > 0 ? { platformOverrides: generatedOverrides } : {}),
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          status: scheduledAt ? 'scheduled' : 'draft',
          ...(campaignId ? { campaignId } : {}),
        }),
      });
      if (!res.ok) throw new Error('Update failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-entries'] });
      resetForm();
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

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const togglePlatform = (platform: SocialPlatform) =>
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );

  const removeMedia = (r2Key: string) =>
    setUploadedMedia((prev) => prev.filter((x) => x.r2Key !== r2Key));

  const runGuardrailCheck = () => {
    if (brandId && caption.trim()) {
      guardrailMutation.mutate(caption);
    }
  };

  const activeCaptionForPreview = generatedOverrides[activePlatformPreview]?.caption ?? caption;

  const minDatetime = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  }, []);

  const canSchedule = !!scheduledAt && !!caption.trim() && selectedPlatforms.length > 0;

  const hasBlockingViolation =
    guardrailResult?.violations.some((v) => v.severity === 'block') ?? false;

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
    editingPostId,
    // Brand + campaign
    brandId, setBrandId,
    campaignId, setCampaignId,
    // Guardrails
    guardrailResult, setGuardrailResult, showGuardrails, setShowGuardrails,
    guardrailMutation,
    runGuardrailCheck,
    hasBlockingViolation,
    // Mutations
    generateMutation,
    saveMutation,
    updateMutation,
    uploadMutation,
    // Helpers
    togglePlatform,
    removeMedia,
    loadPost,
    cancelEdit: resetForm,
    activeCaptionForPreview,
    minDatetime,
    canSchedule,
  };
}
