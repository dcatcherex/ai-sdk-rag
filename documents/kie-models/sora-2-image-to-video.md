# Sora 2 Image To Video

> Animate images into videos with text prompts

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `sora-2-image-to-video` |
| **Endpoint** | `POST https://api.kie.ai/api/v1/jobs/createTask` |
| **Type** | Image-to-Video |
| **Max Prompt Length** | 10,000 characters |
| **Max File Size** | 10MB per image |
| **Supported Formats** | JPEG, PNG, WebP |
| **Duration Options** | 10s, 15s |

## Input Parameters

```typescript
interface Sora2ImageToVideoInput {
  prompt: string;                              // Required - motion description
  image_urls: string[];                        // Required - source image URLs
  aspect_ratio?: "portrait" | "landscape";     // Optional - default "landscape"
  n_frames?: "10" | "15";                      // Optional - duration in seconds
  remove_watermark?: boolean;                  // Optional - default true
}
```

## Request Example

```typescript
const request = {
  model: "sora-2-image-to-video",
  input: {
    prompt: "The character starts conducting an orchestra with passionate gestures",
    image_urls: ["https://example.com/conductor-image.jpg"],
    aspect_ratio: "landscape",
    n_frames: "10",
    remove_watermark: true
  }
};
```

## Full API Call Example

```typescript
async function animateImageWithSora2(
  imageUrls: string[],
  prompt: string,
  options?: {
    aspectRatio?: "portrait" | "landscape";
    duration?: "10" | "15";
    removeWatermark?: boolean;
  }
) {
  if (!imageUrls.length) {
    throw new Error('At least one image URL is required');
  }

  // 1. Create task
  const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sora-2-image-to-video',
      input: {
        prompt,
        image_urls: imageUrls,
        aspect_ratio: options?.aspectRatio ?? 'landscape',
        n_frames: options?.duration ?? '10',
        remove_watermark: options?.removeWatermark ?? true
      }
    })
  });

  const { data: { taskId } } = await createResponse.json();

  // 2. Poll for result
  while (true) {
    const statusResponse = await fetch(
      `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
      { headers: { 'Authorization': `Bearer ${process.env.KIE_API_KEY}` } }
    );

    const result = await statusResponse.json();
    const { state, resultJson, failMsg } = result.data;

    if (state === 'success') {
      return JSON.parse(resultJson).resultUrls;
    }
    if (state === 'fail') {
      throw new Error(failMsg);
    }

    // Video generation - use longer polling interval
    await new Promise(r => setTimeout(r, 5000));
  }
}
```

## Parameter Details

### image_urls (Required)

- **Type**: Array of URLs
- **Min**: 1 image
- **Max size per image**: 10MB
- **Formats**: JPEG, PNG, WebP
- **Note**: Must be publicly accessible URLs

### aspect_ratio

| Value | Description |
|-------|-------------|
| `landscape` | Horizontal video (default) |
| `portrait` | Vertical video |

### n_frames

| Value | Description |
|-------|-------------|
| `"10"` | 10 second video (default) |
| `"15"` | 15 second video |

**Note**: Values are strings, not numbers.

### remove_watermark

| Value | Description |
|-------|-------------|
| `true` | Remove watermark (default) |
| `false` | Keep watermark |

## Response

On success, `resultJson` contains:

```json
{
  "resultUrls": [
    "https://file.aiquickdraw.com/custom-page/akr/section-images/video.mp4"
  ]
}
```

## Use Cases

### Character Animation
```typescript
const request = {
  model: "sora-2-image-to-video",
  input: {
    prompt: "The character waves hello and smiles warmly at the camera",
    image_urls: ["https://example.com/character.png"],
    aspect_ratio: "portrait",
    n_frames: "10"
  }
};
```

### Product Showcase
```typescript
const request = {
  model: "sora-2-image-to-video",
  input: {
    prompt: "The product rotates slowly on a pedestal with soft studio lighting",
    image_urls: ["https://example.com/product.jpg"],
    aspect_ratio: "landscape",
    n_frames: "15"
  }
};
```

### Scene Animation
```typescript
const request = {
  model: "sora-2-image-to-video",
  input: {
    prompt: "Clouds drift across the sky and leaves rustle gently in the wind",
    image_urls: ["https://example.com/landscape.jpg"],
    aspect_ratio: "landscape",
    n_frames: "10"
  }
};
```

## Comparison: Sora 2 vs Veo 3.1 Image-to-Video

| Feature | Sora 2 I2V | Veo 3.1 |
|---------|------------|---------|
| Endpoint | Standard `/jobs/createTask` | Special `/veo/generate` |
| Duration control | ✅ 10s/15s | ❌ No |
| Frame control | ❌ Single image | ✅ First + last frames |
| Material mode | ❌ No | ✅ Yes (veo3_fast) |
| Watermark control | ✅ Yes | ❌ No (custom text only) |
| Audio | ❌ No | ✅ Yes |
