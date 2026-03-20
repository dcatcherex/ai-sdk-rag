# Sora 2 Pro Image To Video

> High-quality image animation with quality control

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `sora-2-pro-image-to-video` |
| **Endpoint** | `POST https://api.kie.ai/api/v1/jobs/createTask` |
| **Type** | Image-to-Video |
| **Max Prompt Length** | 10,000 characters |
| **Max File Size** | 10MB per image |
| **Supported Formats** | JPEG, PNG, WebP |
| **Duration Options** | 10s, 15s |
| **Quality Options** | standard, high |

## Input Parameters

```typescript
interface Sora2ProImageToVideoInput {
  prompt: string;                              // Required - motion description
  image_urls: string[];                        // Required - source image URLs
  aspect_ratio?: "portrait" | "landscape";     // Optional - default "landscape"
  n_frames?: "10" | "15";                      // Optional - duration in seconds
  size?: "standard" | "high";                  // Optional - quality level, default "standard"
  remove_watermark?: boolean;                  // Optional - default true
}
```

## Request Example

```typescript
const request = {
  model: "sora-2-pro-image-to-video",
  input: {
    prompt: "The character waves and smiles warmly at the camera",
    image_urls: ["https://example.com/character.jpg"],
    aspect_ratio: "landscape",
    n_frames: "10",
    size: "high",
    remove_watermark: true
  }
};
```

## Full API Call Example

```typescript
async function animateSora2Pro(
  imageUrls: string[],
  prompt: string,
  options?: {
    aspectRatio?: "portrait" | "landscape";
    duration?: "10" | "15";
    quality?: "standard" | "high";
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
      model: 'sora-2-pro-image-to-video',
      input: {
        prompt,
        image_urls: imageUrls,
        aspect_ratio: options?.aspectRatio ?? 'landscape',
        n_frames: options?.duration ?? '10',
        size: options?.quality ?? 'standard',
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

### size (Quality)

| Value | Description |
|-------|-------------|
| `standard` | Standard quality (default) |
| `high` | High quality, more detailed |

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

## Response

On success, `resultJson` contains:

```json
{
  "resultUrls": [
    "https://file.aiquickdraw.com/custom-page/akr/section-images/video.mp4"
  ]
}
```

## Comparison: Sora 2 vs Sora 2 Pro (Image-to-Video)

| Feature | Sora 2 I2V | Sora 2 Pro I2V |
|---------|------------|----------------|
| Model ID | `sora-2-image-to-video` | `sora-2-pro-image-to-video` |
| Quality control | ❌ No | ✅ Yes (standard/high) |
| Duration | 10s, 15s | 10s, 15s |
| Best for | Quick animation | Production quality |
