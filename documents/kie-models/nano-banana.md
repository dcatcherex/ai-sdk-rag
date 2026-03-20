# Nano Banana

> Simple text-to-image generation

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `google/nano-banana` |
| **Type** | Text-to-Image |
| **Max Prompt Length** | 20,000 characters |
| **Reference Images** | Not supported |

## Input Parameters

```typescript
interface NanoBananaInput {
  prompt: string;                    // Required - text description
  output_format?: "png" | "jpeg";    // Optional - default "png"
  image_size?: AspectRatio;          // Optional - default "1:1"
}

type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9" | "auto";
```

## Request Example

```typescript
const request = {
  model: "google/nano-banana",
  input: {
    prompt: "A surreal painting of a giant banana floating in space, stars and galaxies in the background",
    output_format: "png",
    image_size: "1:1"
  }
};
```

## Full API Call Example

```typescript
async function generateWithNanoBanana(
  prompt: string,
  options?: {
    outputFormat?: "png" | "jpeg";
    imageSize?: string;
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
      model: 'google/nano-banana',
      input: {
        prompt,
        output_format: options?.outputFormat ?? 'png',
        image_size: options?.imageSize ?? '1:1'
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

### image_size

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

### output_format

| Value | Description |
|-------|-------------|
| `png` | Lossless (default) |
| `jpeg` | Compressed |

## Response

On success, `resultJson` contains:

```json
{
  "resultUrls": [
    "https://file.aiquickdraw.com/custom-page/akr/section-images/generated.png"
  ]
}
```

## Comparison with Nano Banana Pro

| Feature | Nano Banana | Nano Banana Pro |
|---------|-------------|-----------------|
| Reference images | ❌ No | ✅ Yes (up to 8) |
| Resolution control | ❌ No | ✅ Yes (1K/2K/4K) |
| Use case | Simple text-to-image | Advanced with references |
