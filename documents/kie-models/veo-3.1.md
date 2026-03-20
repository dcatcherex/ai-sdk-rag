# Veo 3.1 Video Generation

> AI video generation with text-to-video and image-to-video capabilities

## Model Info

| Property | Value |
|----------|-------|
| **Endpoint** | `POST https://api.kie.ai/api/v1/veo/generate` |
| **Model IDs** | `veo3` (Quality), `veo3_fast` (Fast) |
| **Type** | Text-to-Video, Image-to-Video |
| **Output** | Video with audio |
| **Aspect Ratios** | 16:9, 9:16, Auto |

**Note**: This model uses a **different endpoint** than the standard `/jobs/createTask`.

## Generation Modes

| Mode | Description | Images Required |
|------|-------------|-----------------|
| `TEXT_2_VIDEO` | Text-to-video using prompts only | 0 |
| `FIRST_AND_LAST_FRAMES_2_VIDEO` | Image-to-video with frame control | 1-2 |
| `REFERENCE_2_VIDEO` | Material-based video (veo3_fast + 16:9 only) | 1-3 |

## Input Parameters

```typescript
interface Veo31Input {
  prompt: string;                    // Required - video description
  model?: "veo3" | "veo3_fast";      // Optional - default "veo3_fast"
  imageUrls?: string[];              // Optional - for image-to-video (1-3 images)
  generationType?: Veo31GenerationType; // Optional - auto-detected if omitted
  aspect_ratio?: "16:9" | "9:16" | "Auto"; // Optional - default "16:9" (underscore!)
  seeds?: number;                    // Optional - 10000-99999 for reproducibility
  callBackUrl?: string;              // Optional - webhook URL
  enableTranslation?: boolean;       // Optional - default true (translates non-English)
  watermark?: string;                // Optional - custom watermark text
}

type Veo31GenerationType = 
  | "TEXT_2_VIDEO" 
  | "FIRST_AND_LAST_FRAMES_2_VIDEO" 
  | "REFERENCE_2_VIDEO";
```

## Request Examples

### Text-to-Video

```typescript
const request = {
  prompt: "A dog playing in a sunny park, cinematic quality",
  model: "veo3_fast",
  aspect_ratio: "16:9"
};

const response = await fetch('https://api.kie.ai/api/v1/veo/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(request)
});

const { data: { taskId } } = await response.json();
```

### Image-to-Video (Single Frame)

```typescript
const request = {
  prompt: "The person in the image starts walking forward",
  model: "veo3",
  imageUrls: ["https://example.com/start-frame.jpg"],
  generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
  aspect_ratio: "16:9"
};
```

### Image-to-Video (Start + End Frames)

```typescript
const request = {
  prompt: "Smooth transition from day to night scene",
  model: "veo3",
  imageUrls: [
    "https://example.com/day-scene.jpg",   // First frame
    "https://example.com/night-scene.jpg"  // Last frame
  ],
  generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
  aspect_ratio: "16:9"
};
```

### Reference-to-Video (Material Based)

```typescript
// Note: Only supports veo3_fast model and 16:9 aspect ratio
const request = {
  prompt: "Create a video featuring the product from these images",
  model: "veo3_fast",
  imageUrls: [
    "https://example.com/product-1.jpg",
    "https://example.com/product-2.jpg"
  ],
  generationType: "REFERENCE_2_VIDEO",
  aspect_ratio: "16:9"
};
```

## Full API Call with Polling

```typescript
async function generateVeo31Video(
  prompt: string,
  options?: {
    model?: "veo3" | "veo3_fast";
    imageUrls?: string[];
    generationType?: "TEXT_2_VIDEO" | "FIRST_AND_LAST_FRAMES_2_VIDEO" | "REFERENCE_2_VIDEO";
    aspectRatio?: "16:9" | "9:16" | "Auto";
    seeds?: number;
  }
) {
  // 1. Create task
  const createResponse = await fetch('https://api.kie.ai/api/v1/veo/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      model: options?.model ?? 'veo3_fast',
      imageUrls: options?.imageUrls,
      generationType: options?.generationType,
      aspect_ratio: options?.aspectRatio ?? '16:9',
      seeds: options?.seeds
    })
  });

  const createResult = await createResponse.json();
  if (createResult.code !== 200) {
    throw new Error(createResult.msg);
  }

  const taskId = createResult.data.taskId;

  // 2. Poll for result (using Veo-specific record-info endpoint)
  // NOTE: Veo uses /veo/record-info NOT /jobs/recordInfo
  while (true) {
    const statusResponse = await fetch(
      `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`,
      { headers: { 'Authorization': `Bearer ${process.env.KIE_API_KEY}` } }
    );

    const result = await statusResponse.json();
    // successFlag: 0=processing, 1=success, 2=failed, 3=generation failed
    const { successFlag, response } = result.data;

    if (successFlag === 1) {
      // Video URLs are in data.response.resultUrls (already an array)
      return response.resultUrls;
    }
    if (successFlag === 2 || successFlag === 3) {
      throw new Error(result.msg || 'Video generation failed');
    }

    // Video generation takes longer - use 5-10 second intervals
    await new Promise(r => setTimeout(r, 5000));
  }
}
```

## Parameter Details

### model

| Value | Description | Best For |
|-------|-------------|----------|
| `veo3` | Veo 3.1 Quality - highest fidelity | Final production |
| `veo3_fast` | Veo 3.1 Fast - cost-efficient | Drafts, iteration |

### generationType

| Value | Images | Description |
|-------|--------|-------------|
| `TEXT_2_VIDEO` | 0 | Pure text-to-video |
| `FIRST_AND_LAST_FRAMES_2_VIDEO` | 1-2 | Control start/end frames |
| `REFERENCE_2_VIDEO` | 1-3 | Material-based (veo3_fast + 16:9 only) |

### aspect_ratio

> **Note**: The API uses underscore format `aspect_ratio`, not camelCase `aspectRatio`.

| Value | Description | 1080P Support |
|-------|-------------|---------------|
| `16:9` | Landscape (default) | ✅ Yes |
| `9:16` | Portrait/vertical | ❌ No |
| `Auto` | Match input image | Depends on result |

### seeds

- **Range**: 10000-99999
- **Purpose**: Same seed = similar output (reproducibility)
- **Default**: Auto-assigned if omitted

## Response

### Create Task Response

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "veo_task_abcdef123456"
  }
}
```

### Query Task Response — `/veo/record-info` (on success)

> **IMPORTANT**: Veo uses `/api/v1/veo/record-info` NOT `/api/v1/jobs/recordInfo`.
> The response uses `successFlag` (not `state`) and video URLs are nested in `data.response.resultUrls`.

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "bd1fc7df3b506351af0943841d15d22f",
    "paramJson": "{...}",
    "response": {
      "taskId": "bd1fc7df3b506351af0943841d15d22f",
      "resolution": "720p",
      "originUrls": null,
      "resultUrls": ["https://tempfile.aiquickdraw.com/v/example.mp4"],
      "hasAudioList": [true],
      "seeds": [56896]
    },
    "successFlag": 1,
    "fallbackFlag": false,
    "completeTime": 1770382106000,
    "createTime": 1770382017000,
    "errorCode": null,
    "errorMessage": null
  }
}
```

### successFlag Values

| Value | Description |
|-------|-------------|
| `0` | Processing — task is still running |
| `1` | Success — video URLs available in `data.response.resultUrls` |
| `2` | Failed — task creation or processing failed |
| `3` | Generation Failed — task created but video generation failed |

## Callback Payload

When using `callBackUrl`, the POST payload includes:

```typescript
interface Veo31Callback {
  code: number;
  msg: string;
  data: {
    taskId: string;
    info: {
      resultUrls: string;    // JSON string of video URLs
      originUrls: string;    // Original URLs (when aspect != 16:9)
      resolution: string;    // e.g., "1080p"
    };
    fallbackFlag: boolean;   // Deprecated
  };
}
```

## Key Differences from Image Models

| Aspect | Veo 3.1 | Standard Image Models |
|--------|---------|----------------------|
| Generate endpoint | `/api/v1/veo/generate` | `/api/v1/jobs/createTask` |
| **Status endpoint** | **`/api/v1/veo/record-info`** | **`/api/v1/jobs/recordInfo`** |
| Request structure | Flat (no `input` wrapper) | Nested in `input` object |
| Status field | `successFlag` (0/1/2/3) | `state` (success/fail) |
| Result location | `data.response.resultUrls` (array) | `data.resultJson` (JSON string) |
| Aspect ratio param | `aspect_ratio` (underscore) | Varies by model |
| Polling interval | 5-10 seconds (video slower) | 2-3 seconds |
| Output | Video with audio | Static image |
| Multi-language | Built-in translation | Prompt only |

## Pricing Note

Veo 3.1 via KIE is **25% of Google's direct API pricing**. See https://kie.ai/billing for details.
