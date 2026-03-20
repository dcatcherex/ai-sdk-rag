# Sora Watermark Remover

> Remove watermarks from Sora 2 videos

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `sora-watermark-remover` |
| **Endpoint** | `POST https://api.kie.ai/api/v1/jobs/createTask` |
| **Type** | Video Utility |
| **Input** | Sora 2 video URL (sora.chatgpt.com) |
| **Output** | Watermark-free video |

**Note**: Only works with Sora 2 videos from OpenAI (URLs starting with `sora.chatgpt.com`).

## Input Parameters

```typescript
interface SoraWatermarkRemoverInput {
  /** Sora 2 video URL from OpenAI (max 500 chars) */
  video_url: string;
}
```

## Request Example

```typescript
const request = {
  model: "sora-watermark-remover",
  input: {
    video_url: "https://sora.chatgpt.com/p/s_68e83bd7eee88191be79d2ba7158516f"
  }
};
```

## Full API Call Example

```typescript
async function removeWatermark(videoUrl: string) {
  // Validate URL
  if (!videoUrl.includes('sora.chatgpt.com')) {
    throw new Error('Only Sora 2 videos from sora.chatgpt.com are supported');
  }

  // 1. Create task
  const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sora-watermark-remover',
      input: {
        video_url: videoUrl
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

### video_url (Required)

- **Type**: String
- **Max length**: 500 characters
- **Format**: Must be a Sora 2 video URL from OpenAI
- **Pattern**: `https://sora.chatgpt.com/p/s_*`

**Important**: Only publicly accessible Sora 2 video URLs are supported.

## Response

On success, `resultJson` contains:

```json
{
  "resultUrls": [
    "https://file.aiquickdraw.com/custom-page/akr/section-images/video.mp4"
  ]
}
```

## Use Case

```typescript
// Remove watermark from a Sora 2 video you created
const cleanVideoUrls = await removeWatermark(
  "https://sora.chatgpt.com/p/s_68e83bd7eee88191be79d2ba7158516f"
);

console.log("Watermark-free video:", cleanVideoUrls[0]);
```
