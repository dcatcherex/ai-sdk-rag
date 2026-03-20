# Sora 2 Pro Storyboard

> Generate videos from storyboard images (up to 25 seconds)

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `sora-2-pro-storyboard` |
| **Endpoint** | `POST https://api.kie.ai/api/v1/jobs/createTask` |
| **Type** | Storyboard-to-Video |
| **Max File Size** | 10MB per image |
| **Supported Formats** | JPEG, PNG, WebP |
| **Duration Options** | 10s, 15s, **25s** |

**Note**: This model supports **longer videos (25s)** and focuses on storyboard-based generation. No prompt required.

## Input Parameters

```typescript
interface Sora2ProStoryboardInput {
  n_frames: "10" | "15" | "25";               // Required - duration in seconds
  image_urls?: string[];                       // Optional - storyboard images
  aspect_ratio?: "portrait" | "landscape";     // Optional - default "landscape"
}
```

## Request Example

```typescript
const request = {
  model: "sora-2-pro-storyboard",
  input: {
    n_frames: "15",
    image_urls: ["https://example.com/storyboard-panel.png"],
    aspect_ratio: "landscape"
  }
};
```

## Full API Call Example

```typescript
async function generateStoryboardVideo(
  options: {
    duration: "10" | "15" | "25";
    imageUrls?: string[];
    aspectRatio?: "portrait" | "landscape";
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
      model: 'sora-2-pro-storyboard',
      input: {
        n_frames: options.duration,
        image_urls: options.imageUrls,
        aspect_ratio: options.aspectRatio ?? 'landscape'
      }
    })
  });

  const { data: { taskId } } = await createResponse.json();

  // 2. Poll for result (longer videos may take more time)
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

    // Storyboard videos can be longer - use appropriate polling interval
    await new Promise(r => setTimeout(r, 5000));
  }
}
```

## Parameter Details

### n_frames (Required)

| Value | Description |
|-------|-------------|
| `"10"` | 10 second video |
| `"15"` | 15 second video (default) |
| `"25"` | 25 second video (**unique to storyboard**) |

**Note**: Values are strings, not numbers.

### image_urls (Optional)

- **Type**: Array of URLs
- **Max size per image**: 10MB
- **Formats**: JPEG, PNG, WebP
- **Note**: Storyboard panels to base the video on

### aspect_ratio

| Value | Description |
|-------|-------------|
| `landscape` | Horizontal video (default) |
| `portrait` | Vertical video |

## Response

On success, `resultJson` contains:

```json
{
  "resultUrls": [
    "https://file.aiquickdraw.com/custom-page/akr/section-images/video.mp4"
  ]
}
```

## Key Differences from Other Sora 2 Models

| Feature | Sora 2 | Sora 2 Pro | Storyboard |
|---------|--------|------------|------------|
| Prompt required | ✅ Yes | ✅ Yes | ❌ No |
| Max duration | 15s | 15s | **25s** |
| Quality control | ❌ No | ✅ Yes | ❌ No |
| Watermark control | ✅ Yes | ✅ Yes | ❌ No |
| Use case | Text/image prompt | High quality | Panel-based narrative |

## Use Cases

### Comic/Manga Animation
```typescript
const request = {
  model: "sora-2-pro-storyboard",
  input: {
    n_frames: "25",
    image_urls: [
      "https://example.com/comic-panel-1.png",
      "https://example.com/comic-panel-2.png"
    ],
    aspect_ratio: "landscape"
  }
};
```

### Marketing Sequence
```typescript
const request = {
  model: "sora-2-pro-storyboard",
  input: {
    n_frames: "15",
    image_urls: ["https://example.com/product-storyboard.png"],
    aspect_ratio: "portrait"
  }
};
```
