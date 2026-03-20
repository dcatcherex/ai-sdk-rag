# Nano Banana Edit

> Image editing with text prompts

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `google/nano-banana-edit` |
| **Type** | Image Editing |
| **Max Prompt Length** | 20,000 characters |
| **Required Images** | 1-10 source images |
| **Max File Size** | 10MB per image |
| **Supported Formats** | JPEG, PNG, WebP |

## Input Parameters

```typescript
interface NanoBananaEditInput {
  prompt: string;                    // Required - editing instructions
  image_urls: string[];              // Required - source images to edit (1-10)
  output_format?: "png" | "jpeg";    // Optional - default "png"
  image_size?: AspectRatio;          // Optional - default "1:1"
}

type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9" | "auto";
```

## Request Example

```typescript
const request = {
  model: "google/nano-banana-edit",
  input: {
    prompt: "Turn this photo into a character figure with a display box behind it",
    image_urls: [
      "https://example.com/source-image.png"
    ],
    output_format: "png",
    image_size: "1:1"
  }
};
```

## Full API Call Example

```typescript
async function editWithNanoBananaEdit(
  prompt: string,
  imageUrls: string[],
  options?: {
    outputFormat?: "png" | "jpeg";
    imageSize?: string;
  }
) {
  if (!imageUrls.length || imageUrls.length > 10) {
    throw new Error('image_urls must contain 1-10 images');
  }

  // 1. Create task
  const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/nano-banana-edit',
      input: {
        prompt,
        image_urls: imageUrls,
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

## Use Cases

### Style Transfer
```typescript
const request = {
  model: "google/nano-banana-edit",
  input: {
    prompt: "Convert this photo to anime style with vibrant colors",
    image_urls: ["https://example.com/photo.jpg"],
    image_size: "auto"
  }
};
```

### Object Transformation
```typescript
const request = {
  model: "google/nano-banana-edit",
  input: {
    prompt: "Turn the person into a 3D character figure standing on a display base",
    image_urls: ["https://example.com/person.jpg"],
    image_size: "1:1"
  }
};
```

### Background Change
```typescript
const request = {
  model: "google/nano-banana-edit",
  input: {
    prompt: "Change the background to a futuristic cyberpunk city at night",
    image_urls: ["https://example.com/subject.png"],
    image_size: "16:9"
  }
};
```

## Parameter Details

### image_urls (Required)

- **Minimum**: 1 image
- **Maximum**: 10 images
- **Max size per image**: 10MB
- **Formats**: JPEG, PNG, WebP
- **Note**: Must be publicly accessible URLs

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
| `auto` | Auto-detect from source |

## Response

On success, `resultJson` contains:

```json
{
  "resultUrls": [
    "https://file.aiquickdraw.com/custom-page/akr/section-images/edited.webp"
  ]
}
```

## Key Differences from Other Models

| Feature | Nano Banana | Nano Banana Pro | Nano Banana Edit |
|---------|-------------|-----------------|------------------|
| Source images | ❌ None | ⚪ Optional ref | ✅ Required |
| Primary use | Generation | Generation | Editing |
| Max images | 0 | 8 | 10 |
| Max file size | N/A | 30MB | 10MB |
