# Nano Banana Pro

> Advanced image generation with reference image support

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `nano-banana-pro` |
| **Type** | Text-to-Image / Image-to-Image |
| **Max Prompt Length** | 20,000 characters |
| **Max Reference Images** | 8 |
| **Max File Size** | 30MB per image |
| **Supported Formats** | JPEG, PNG, WebP |

## Input Parameters

```typescript
interface NanoBananaProInput {
  prompt: string;              // Required - text description
  image_input?: string[];      // Optional - reference image URLs (max 8)
  aspect_ratio?: AspectRatio;  // Optional - default "1:1"
  resolution?: Resolution;     // Optional - default "1K"
  output_format?: "png" | "jpg"; // Optional - default "png"
}

type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9" | "auto";
type Resolution = "1K" | "2K" | "4K";
```

## Request Example

```typescript
const request = {
  model: "nano-banana-pro",
  input: {
    prompt: "A futuristic cityscape with flying cars and neon lights",
    image_input: [], // Optional: add reference image URLs
    aspect_ratio: "16:9",
    resolution: "2K",
    output_format: "png"
  }
};
```

## With Reference Images

```typescript
const request = {
  model: "nano-banana-pro",
  input: {
    prompt: "Transform this into a cyberpunk style artwork",
    image_input: [
      "https://example.com/reference1.jpg",
      "https://example.com/reference2.jpg"
    ],
    aspect_ratio: "1:1",
    resolution: "4K",
    output_format: "png"
  }
};
```

## Full API Call Example

```typescript
async function generateWithNanoBananaPro(
  prompt: string,
  options?: {
    imageInput?: string[];
    aspectRatio?: string;
    resolution?: string;
    outputFormat?: string;
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
      model: 'nano-banana-pro',
      input: {
        prompt,
        image_input: options?.imageInput ?? [],
        aspect_ratio: options?.aspectRatio ?? '1:1',
        resolution: options?.resolution ?? '1K',
        output_format: options?.outputFormat ?? 'png'
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

    await new Promise(r => setTimeout(r, 3000));
  }
}
```

## Parameter Details

### aspect_ratio

| Value | Description |
|-------|-------------|
| `1:1` | Square (default) |
| `2:3` | Portrait |
| `3:2` | Landscape |
| `3:4` | Portrait |
| `4:3` | Landscape |
| `4:5` | Portrait (Instagram) |
| `5:4` | Landscape |
| `9:16` | Vertical (Stories/Reels) |
| `16:9` | Widescreen |
| `21:9` | Ultra-wide |
| `auto` | Auto-detect |

### resolution

| Value | Description |
|-------|-------------|
| `1K` | Standard quality (default) |
| `2K` | High quality |
| `4K` | Ultra-high quality |

## Response

On success, `resultJson` contains:

```json
{
  "resultUrls": [
    "https://static.aiquickdraw.com/tools/example/generated_image.png"
  ]
}
```
