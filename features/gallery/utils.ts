import { availableModels } from '@/lib/ai';
import type { MediaAsset } from './types';

// Only OpenAI gpt-image models confirmed to support mask/inpainting via the AI SDK.
// Other image-gen models (Grok, Gemini) may accept `images` for img2img but silently
// ignore the `mask` parameter — their providers don't implement /images/edits.
export const IMAGE_EDIT_MODELS = availableModels.filter((m) =>
  m.id.startsWith('openai/gpt-image')
);

export const formatRelativeTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60 * 1000) return 'Just now';
  if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 1000))}m ago`;
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 60 * 1000))}h ago`;
  return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))}d ago`;
};

export const fetchMediaAssets = async (type: string, rootAssetId?: string): Promise<MediaAsset[]> => {
  const params = new URLSearchParams();
  if (type !== 'all') params.set('type', type);
  if (rootAssetId) params.set('rootAssetId', rootAssetId);

  const url = params.size > 0 ? `/api/media-assets?${params.toString()}` : '/api/media-assets';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to load media assets');

  const payload = (await response.json()) as { assets: MediaAsset[] };
  return payload.assets;
};

export const getCanvasCoordinates = (
  canvas: HTMLCanvasElement,
  event: React.PointerEvent<HTMLCanvasElement>
) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
};
