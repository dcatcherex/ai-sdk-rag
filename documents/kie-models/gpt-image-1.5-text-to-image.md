# GPT Image 1.5 Text To Image

> Photorealistic text-to-image generation

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `gpt-image/1.5-text-to-image` |
| **Type** | Text-to-Image |
| **Max Prompt Length** | 3,000 characters |
| **Reference Images** | Not supported |
| **Quality Modes** | medium, high |

## Input Parameters

```typescript
interface GptImage15TextToImageInput {
  prompt: string;                          // Required - text description
  aspect_ratio: "1:1" | "2:3" | "3:2";     // Required - limited options
  quality: "medium" | "high";              // Required - generation quality
}
```

## Request Example

```typescript
const request = {
  model: "gpt-image/1.5-text-to-image",
  input: {
    prompt: "A futuristic cityscape at sunset with flying vehicles",
    aspect_ratio: "16:9",
    quality: "high"
  }
};
```

## Full API Call Example

```typescript
async function generateWithGptImage15(
  prompt: string,
  options: {
    aspectRatio: "1:1" | "2:3" | "3:2";
    quality: "medium" | "high";
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
      model: 'gpt-image/1.5-text-to-image',
      input: {
        prompt,
        aspect_ratio: options.aspectRatio,
        quality: options.quality
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

### aspect_ratio (Required)

| Value | Description |
|-------|-------------|
| `1:1` | Square |
| `2:3` | Portrait |
| `3:2` | Landscape |

**Note**: Unlike other models, this model has limited aspect ratio options.

### quality (Required)

| Value | Description |
|-------|-------------|
| `medium` | Balanced speed/quality |
| `high` | Slower, more detailed |

## Response

On success, `resultJson` contains:

```json
{
  "resultUrls": [
    "https://static.aiquickdraw.com/tools/example/generated.webp"
  ]
}
```

## Use Cases

### Photorealistic Photography
```typescript
const request = {
  model: "gpt-image/1.5-text-to-image",
  input: {
    prompt: "Create a photorealistic candid photograph of an elderly sailor on a fishing boat with weathered skin and sun texture",
    aspect_ratio: "3:2",
    quality: "high"
  }
};
```

### Portrait Generation
```typescript
const request = {
  model: "gpt-image/1.5-text-to-image",
  input: {
    prompt: "Professional headshot of a business executive in modern office setting",
    aspect_ratio: "2:3",
    quality: "high"
  }
};
```

## Comparison with Other Models

| Feature | GPT Image 1.5 T2I | Nano Banana | Nano Banana Pro |
|---------|-------------------|-------------|-----------------|
| Max prompt | 3,000 chars | 20,000 chars | 20,000 chars |
| Aspect ratios | 3 options | 11 options | 11 options |
| Quality control | ✅ Yes | ❌ No | ❌ No |
| Resolution control | ❌ No | ❌ No | ✅ Yes |
| Reference images | ❌ No | ❌ No | ✅ Yes |
| Best for | Photorealism | Creative | Advanced |
