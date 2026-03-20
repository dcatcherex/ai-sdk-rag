# Gemini 3 Pro

> Advanced multimodal chat model with Google Search and structured outputs

## Model Info

| Property | Value |
|----------|-------|
| **Model ID** | `gemini-3-pro` |
| **Type** | Chat Completions |
| **Streaming** | Supported |
| **Multimodal** | Images, video, audio, documents |
| **Reasoning** | Optional thinking process |
| **Function Calling** | Supported |
| **Google Search** | Built-in tool |
| **Structured Output** | JSON Schema validation |

## Input Parameters

```typescript
interface Gemini3ProInput {
  messages: Message[];                      // Required - conversation history
  stream?: boolean;                         // Optional - default: true
  include_thoughts?: boolean;               // Optional - default: true
  reasoning_effort?: "low" | "high";        // Optional - default: "high"
  tools?: Tool[];                           // Optional - function or search
  response_format?: ResponseFormat;         // Optional - structured output (excludes custom tools)
}

interface Message {
  role: "developer" | "system" | "user" | "assistant" | "tool";
  content: ContentItem[];
}

type ContentItem =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: object;
  };
}

interface ResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: object;
  };
}
```

## Request Example

```typescript
const request = {
  model: "gemini-3-pro",
  input: {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What is in this image?" },
          {
            type: "image_url",
            image_url: {
              url: "https://file.aiquickdraw.com/custom-page/akr/section-images/1759055072437dqlsclj2.png"
            }
          }
        ]
      }
    ],
    stream: true,
    include_thoughts: true,
    reasoning_effort: "high",
    tools: [
      {
        type: "function",
        function: {
          name: "googleSearch"
        }
      }
    ]
  }
};
```

## Full API Call Example

```typescript
async function chatWithGemini3Pro(
  messages: Message[],
  options?: {
    stream?: boolean;
    includeThoughts?: boolean;
    reasoningEffort?: "low" | "high";
    tools?: Tool[];
    responseFormat?: ResponseFormat;
  }
) {
  // Note: response_format cannot be used with custom tools
  const response = await fetch('https://api.kie.ai/gemini-3-pro/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages,
      stream: options?.stream ?? true,
      include_thoughts: options?.includeThoughts ?? true,
      reasoning_effort: options?.reasoningEffort ?? 'high',
      tools: options?.tools,
      response_format: options?.responseFormat
    })
  });

  if (!options?.stream) {
    const result = await response.json();
    return result.choices[0].message.content;
  }

  // Handle streaming response
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let fullReasoning = '';

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim() !== '');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;

        if (delta?.content) fullContent += delta.content;
        if (delta?.reasoning_content) fullReasoning += delta.reasoning_content;
      }
    }
  }

  return { content: fullContent, reasoning: fullReasoning };
}
```

## Parameter Details

### messages

Array of message objects defining the conversation history.

| Role | Description |
|------|-------------|
| `developer` | Instructions for the model to follow |
| `system` | Legacy system messages (use `developer` for newer models) |
| `user` | End user messages and prompts |
| `assistant` | Model responses |
| `tool` | Tool/function call results |

**Media Files**: All media (images, video, audio, PDFs) use the same format:
```typescript
{ type: "image_url", image_url: { url: "..." } }
```

### stream

| Value | Description |
|-------|-------------|
| `true` | Stream partial message deltas (default) |
| `false` | Return complete response at once |

### include_thoughts

| Value | Description |
|-------|-------------|
| `true` | Include model's reasoning process (default) |
| `false` | Skip thinking process for faster responses |

### reasoning_effort

| Value | Description |
|-------|-------------|
| `low` | Minimal reasoning, fastest response |
| `high` | Thorough reasoning, best for complex problems (default) |

### tools

Array of function definitions or built-in tools. **Mutually exclusive** with `response_format`.

| Tool | Description |
|------|-------------|
| `googleSearch` | Built-in Google Search for real-time information |
| Custom functions | Define your own functions with parameters |

**Example (Google Search):**
```typescript
[{ type: "function", function: { name: "googleSearch" } }]
```

**Example (Custom Function):**
```typescript
[{
  type: "function",
  function: {
    name: "get_weather",
    description: "Get weather for a location",
    parameters: {
      type: "object",
      properties: { location: { type: "string" } },
      required: ["location"]
    }
  }
}]
```

### response_format

Enables structured JSON output using JSON Schema. **Cannot be used with custom tools** (use either Google Search OR custom tools OR response_format).

```typescript
{
  type: "json_schema",
  json_schema: {
    name: "structured_output",
    strict: true,
    schema: {
      type: "object",
      properties: {
        answer: { type: "string" },
        confidence: { type: "number" }
      },
      required: ["answer"]
    }
  }
}
```

## Response

On success, streaming response chunks contain:

```typescript
interface StreamChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: "gemini-3-pro";
  choices: {
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
      reasoning_content?: string;
    };
    finish_reason?: "stop" | null;
  }[];
  credits_consumed?: number;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details: {
      text_tokens: number;
      reasoning_tokens: number;
      audio_tokens: number;
    };
  };
}
```

Final chunk: `data: [DONE]`

## Comparison with Gemini 3 Flash

| Feature | Gemini 3 Pro | Gemini 3 Flash |
|---------|--------------|----------------|
| Speed | More thorough | Faster |
| Multimodal | Yes | Yes |
| Streaming | Yes | Yes |
| Reasoning | Yes | Yes |
| Function Calling | Yes | Yes |
| Google Search | Built-in | No |
| JSON Schema Output | Structured outputs | No |
| Best for | Complex analysis with search | Quick responses |