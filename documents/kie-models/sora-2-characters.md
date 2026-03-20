# Sora 2 Characters

> Create reusable character definitions for consistent video generation

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `sora-2-characters` |
| **Endpoint** | `POST https://api.kie.ai/api/v1/jobs/createTask` |
| **Type** | Character Creation Utility |
| **Output** | `character_id` (not video URL) |

**Note**: This model returns a `character_id` in `resultObject`, not `resultUrls`. Use the character_id with other Sora models.

## Input Parameters

```typescript
interface Sora2CharactersInput {
  /** Character description - stable traits (max 5000 chars) */
  character_prompt?: string;
  /** Content boundaries/restrictions (max 5000 chars) */
  safety_instruction?: string;
}
```

## Request Example

```typescript
const request = {
  model: "sora-2-characters",
  input: {
    character_prompt: "A cheerful barista with curly red hair, wearing a green apron, warm friendly smile",
    safety_instruction: "No violence, keep content PG-13, avoid controversial topics"
  }
};
```

## Full API Call Example

```typescript
async function createCharacter(
  characterPrompt: string,
  safetyInstruction?: string
) {
  // 1. Create task
  const createResponse = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sora-2-characters',
      input: {
        character_prompt: characterPrompt,
        safety_instruction: safetyInstruction
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
      // Note: Returns resultObject, not resultUrls
      const parsed = JSON.parse(resultJson);
      return parsed.resultObject.character_id;
    }
    if (state === 'fail') {
      throw new Error(failMsg);
    }

    await new Promise(r => setTimeout(r, 3000));
  }
}
```

## Parameter Details

### character_prompt (Optional)

- **Type**: String
- **Max length**: 5000 characters
- **Purpose**: Define stable visual traits of the character

**Best Practices**:
- State stable traits: "cheerful barista, green apron, warm smile"
- Avoid camera directions or scene descriptions
- Avoid contradictions
- No celebrity likeness

### safety_instruction (Optional)

- **Type**: String
- **Max length**: 5000 characters
- **Purpose**: Define content boundaries

**Examples**:
- "No violence, politics, or alcohol; PG-13 max"
- "Family-friendly content only"
- "No controversial topics"

## Response

On success, `resultJson` contains `resultObject` (not `resultUrls`):

```json
{
  "resultObject": {
    "character_id": "example_123456789"
  }
}
```

## Key Difference from Other Models

| Aspect | Video Models | Characters Model |
|--------|--------------|------------------|
| Output field | `resultUrls` | `resultObject` |
| Output type | Video URLs array | `{ character_id: string }` |
| Purpose | Generate content | Create reusable character |

## Use Case

```typescript
// 1. Create a character
const characterId = await createCharacter(
  "A wise elderly wizard with a long white beard, wearing purple robes with silver stars",
  "Fantasy content only, no modern elements"
);

console.log("Character created:", characterId);
// Use this character_id in other Sora video generation requests
```

## Parsing Helper

```typescript
interface Sora2CharactersResult {
  resultObject: {
    character_id: string;
  };
}

function parseCharacterResult(resultJson: string): string {
  const parsed: Sora2CharactersResult = JSON.parse(resultJson);
  return parsed.resultObject.character_id;
}
```
