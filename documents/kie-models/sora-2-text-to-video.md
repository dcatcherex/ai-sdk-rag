# Sora 2 Text To Video

> Generate videos from text prompts

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `sora-2-text-to-video` |
| **Endpoint** | `POST https://api.kie.ai/api/v1/jobs/createTask` |
| **Type** | Text-to-Video |
| **Max Prompt Length** | 10,000 characters |
| **Duration Options** | 10s, 15s |

## Input Parameters

```typescript
interface Sora2TextToVideoInput {
  prompt: string;                              // Required - video description
  aspect_ratio?: "portrait" | "landscape";     // Optional - default "landscape"
  n_frames?: "10" | "15";                      // Optional - duration in seconds
  remove_watermark?: boolean;                  // Optional - default true
}
```

## Request Example

```typescript
const request = {
  model: "sora-2-text-to-video",
  input: {
    prompt: "A professor enthusiastically giving a lecture in a classroom with colorful chalk diagrams",
    aspect_ratio: "landscape",
    n_frames: "10",
    remove_watermark: true
  }
};
```

## Full API Call Example

```typescript
async function generateSora2Video(
  prompt: string,
  options?: {
    aspectRatio?: "portrait" | "landscape";
    duration?: "10" | "15";
    removeWatermark?: boolean;
  }
) {
  // 1. Create task
  const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sora-2-text-to-video',
      input: {
        prompt,
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

### Cinematic Scene
```typescript
const request = {
  model: "sora-2-text-to-video",
  input: {
    prompt: "Aerial drone shot of a coastal city at golden hour, cinematic quality, smooth camera movement",
    aspect_ratio: "landscape",
    n_frames: "15"
  }
};
```

### Social Media Vertical
```typescript
const request = {
  model: "sora-2-text-to-video",
  input: {
    prompt: "A person walking through a vibrant street market, POV style",
    aspect_ratio: "portrait",
    n_frames: "10"
  }
};
```
