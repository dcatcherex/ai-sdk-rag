# Text To Dialogue V3 API Documentation

> Generate multi-speaker dialogue using the ElevenLabs Text To Dialogue V3 model

## Overview

This document describes how to use the Text To Dialogue V3 model for generating multi-speaker conversations with emotion support. The process consists of two steps:
1. Create a generation task
2. Query task status and results

## Authentication

All API requests require a Bearer Token in the request header:

```
Authorization: Bearer YOUR_API_KEY
```

Get API Key:
1. Visit [API Key Management Page](https://kie.ai/api-key) to get your API Key
2. Add to request header: `Authorization: Bearer YOUR_API_KEY`

---

## 1. Create Generation Task

### API Information
- **URL**: `POST https://api.kie.ai/api/v1/jobs/createTask`
- **Content-Type**: `application/json`

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| model | string | Yes | Model name: `elevenlabs/text-to-dialogue-v3` |
| input | object | Yes | Input parameters object |
| callBackUrl | string | No | Callback URL for task completion notifications |

### input Object Parameters

#### dialogue
- **Type**: `array(object)`
- **Required**: Yes
- **Description**: Array of dialogue objects. Each object contains text content and voice selection. Total text length of all dialogues cannot exceed 5000 characters.
- **Object structure**:
  - `text` (string, required): Dialogue text content, max 5000 characters. Supports emotion tags like `[excitedly]`, `[whispering]`, `[sadly]`, `[curiously]`, `[laughing]`.
  - `voice` (string, required): Voice character ID. See voice list below.

#### stability
- **Type**: `number`
- **Required**: No
- **Description**: Determines how stable the voice is and the randomness between each generation.
- **Range**: 0 - 1 (step: 0.5)
- **Default Value**: `0.5`

#### language_code
- **Type**: `string`
- **Required**: No
- **Description**: Language code for speech generation.
- **Options**: `auto` | `af` | `ar` | `hy` | `as` | `az` | `be` | `bn` | `bs` | `bg` | `ca` | `ceb` | `ny` | `hr` | `cs` | `da` | `nl` | `en` | `et` | `fil` | `fi` | `fr` | `gl` | `ka` | `de` | `el` | `gu` | `ha` | `he` | `hi` | `hu` | `is` | `id` | `ga` | `it` | `ja` | `jv` | `kn` | `kk` | `ky` | `ko` | `lv` | `ln` | `lt` | `lb` | `mk` | `ms` | `ml` | `zh` | `mr` | `ne` | `no` | `ps` | `fa` | `pl` | `pt` | `pa` | `ro` | `ru` | `sr` | `sd` | `sk` | `sl` | `so` | `es` | `sw` | `sv` | `ta` | `te` | `th` | `tr` | `uk` | `ur` | `vi` | `cy`
- **Default Value**: `"auto"`

### Available Voices

The same voice IDs from the text-to-speech-multilingual-v2 model are available. Popular named voices include:
- `Rachel`, `Aria`, `Roger`, `Sarah`, `Laura`, `Charlie`, `George`, `Callum`, `River`, `Liam`, `Charlotte`, `Alice`, `Matilda`, `Will`, `Jessica`, `Eric`, `Chris`, `Brian`, `Daniel`, `Lily`, `Bill`

For character voices with descriptions, use voice IDs like:
- `TX3LPaxmHKxFdv7VOQHJ` — Liam (Energetic, Social Media Creator)
- `cgSgspJ2msm6clMCkdW9` — Jessica (Playful, Bright, Warm)
- `BIvP0GN1cAtSRTxNHnWS` — Ellen (Serious, Direct and Confident)
- See `elevenlabs-text-to-speech-multilingual-v2.md` for the full voice list.

### Request Example

```json
{
  "model": "elevenlabs/text-to-dialogue-v3",
  "input": {
    "stability": 0.5,
    "language_code": "th",
    "dialogue": [
      {
        "text": "[excitedly] Hey Jessica! Have you tried the new ElevenLabs V3?",
        "voice": "TX3LPaxmHKxFdv7VOQHJ"
      },
      {
        "text": "[curiously] Yeah, just got it! The emotion is so amazing. I can actually do whispers now— [whispering] like this!",
        "voice": "cgSgspJ2msm6clMCkdW9"
      }
    ]
  }
}
```

### Response Example

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "281e5b0*********************f39b9"
  }
}
```

### Response Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| code | integer | Response status code, 200 indicates success |
| msg | string | Response message |
| data.taskId | string | Task ID for querying task status |

---

## 2. Query Task Status

### API Information
- **URL**: `GET https://api.kie.ai/api/v1/jobs/recordInfo`
- **Parameter**: `taskId` (passed via URL parameter)

### Request Example
```
GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=281e5b0*********************f39b9
```

### Response Example

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "281e5b0*********************f39b9",
    "model": "elevenlabs/text-to-dialogue-v3",
    "state": "success",
    "param": "{\"model\":\"elevenlabs/text-to-dialogue-v3\",\"input\":{\"stability\":0.5,\"language_code\":\"auto\",\"dialogue\":[...]}}",
    "resultJson": "{\"resultUrls\":[\"https://static.aiquickdraw.com/tools/example/1768561916679_6ZlcUrY0.MP3\"]}",
    "failCode": null,
    "failMsg": null,
    "costTime": 8,
    "completeTime": 1755599644000,
    "createTime": 1755599634000
  }
}
```

### Response Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| code | integer | Response status code, 200 indicates success |
| msg | string | Response message |
| data.taskId | string | Task ID |
| data.model | string | Model name used |
| data.state | string | Task status: `waiting` / `queuing` / `generating` / `success` / `fail` |
| data.param | string | Task parameters (JSON string) |
| data.resultJson | string | Result JSON: `{resultUrls: ["<audio_url>"]}` when successful |
| data.failCode | string | Failure code (when task fails) |
| data.failMsg | string | Failure message (when task fails) |
| data.costTime | integer | Task duration in milliseconds |
| data.completeTime | integer | Completion timestamp |
| data.createTime | integer | Creation timestamp |

---

## Output Format

The `resultJson` field contains a JSON string with:
```json
{
  "resultUrls": [
    "https://static.aiquickdraw.com/tools/example/1768561916679_6ZlcUrY0.MP3"
  ]
}
```

The output is an MP3 audio file containing the generated multi-speaker dialogue.

---

## Usage Flow

1. **Create Task**: Call `POST https://api.kie.ai/api/v1/jobs/createTask` with the dialogue array
2. **Get Task ID**: Extract `taskId` from the response
3. **Wait for Results**: 
   - If you provided a `callBackUrl`, wait for the callback notification
   - If no `callBackUrl`, poll status by calling `GET https://api.kie.ai/api/v1/jobs/recordInfo`
4. **Get Results**: When `state` is `success`, parse `resultJson` to get audio URLs from `resultUrls`

## Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Request successful |
| 400 | Invalid request parameters |
| 401 | Authentication failed, please check API Key |
| 402 | Insufficient account balance |
| 404 | Resource not found |
| 422 | Parameter validation failed |
| 429 | Request rate limit exceeded |
| 500 | Internal server error |

