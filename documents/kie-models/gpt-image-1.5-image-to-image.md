# GPT Image 1.5 Image To Image

> Image transformation with text prompts

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `gpt-image/1.5-image-to-image` |
| **Type** | Image-to-Image |
| **Max Prompt Length** | 3,000 characters |
| **Required Images** | 1+ source images |
| **Max File Size** | 10MB per image |
| **Supported Formats** | JPEG, PNG, WebP |
| **Quality Modes** | medium, high |

## Input Parameters

```typescript
interface GptImage15ImageToImageInput {
  input_urls: string[];                    // Required - source image URLs
  prompt: string;                          // Required - transformation instructions
  aspect_ratio: "1:1" | "2:3" | "3:2";     // Required - limited options
  quality: "medium" | "high";              // Required - generation quality
}
```

## Request Example

```typescript
const request = {
  model: "gpt-image/1.5-image-to-image",
  input: {
    input_urls: ["https://example.com/source-image.jpg"],
    prompt: "Change her clothing to an elegant blue evening gown. Preserve face, identity, and pose.",
    aspect_ratio: "3:2",
    quality: "medium"
  }
};
```

## Full API Call Example

```typescript
async function transformWithGptImage15(
  inputUrls: string[],
  prompt: string,
  options: {
    aspectRatio: "1:1" | "2:3" | "3:2";
    quality: "medium" | "high";
  }
) {
  if (!inputUrls.length) {
    throw new Error('At least one input image URL is required');
  }

  // 1. Create task
  const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-image/1.5-image-to-image',
      input: {
        input_urls: inputUrls,
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

### input_urls (Required)

- **Type**: Array of URLs
- **Min**: 1 image
- **Max size per image**: 10MB
- **Formats**: JPEG, PNG, WebP
- **Note**: Must be publicly accessible URLs

### aspect_ratio (Required)

| Value | Description |
|-------|-------------|
| `1:1` | Square |
| `2:3` | Portrait |
| `3:2` | Landscape |

**Note**: Limited aspect ratio options compared to other models.

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
    "https://static.aiquickdraw.com/tools/example/transformed.webp"
  ]
}
```

## Use Cases

### Clothing Change
```typescript
const request = {
  model: "gpt-image/1.5-image-to-image",
  input: {
    input_urls: ["https://example.com/person.jpg"],
    prompt: "Change clothing to a red formal dress. Preserve face, pose, and background exactly.",
    aspect_ratio: "2:3",
    quality: "high"
  }
};
```

### Style Preservation Transform
```typescript
const request = {
  model: "gpt-image/1.5-image-to-image",
  input: {
    input_urls: ["https://example.com/portrait.jpg"],
    prompt: "Add professional studio lighting. Keep all other elements identical.",
    aspect_ratio: "1:1",
    quality: "medium"
  }
};
```

### Scene Modification
```typescript
const request = {
  model: "gpt-image/1.5-image-to-image",
  input: {
    input_urls: ["https://example.com/outdoor.jpg"],
    prompt: "Change the season to winter with snow. Preserve subject and composition.",
    aspect_ratio: "3:2",
    quality: "high"
  }
};
```

## Comparison: GPT Image 1.5 I2I vs Nano Banana Edit

| Feature | GPT Image 1.5 I2I | Nano Banana Edit |
|---------|-------------------|------------------|
| Model ID | `gpt-image/1.5-image-to-image` | `google/nano-banana-edit` |
| Max prompt | 3,000 chars | 20,000 chars |
| Max images | No explicit limit | 10 images |
| Max file size | 10MB | 10MB |
| Aspect ratios | 3 options | 11 options |
| Quality control | ✅ Yes | ❌ No |
| Best for | Identity-preserving edits | Creative transformations |
