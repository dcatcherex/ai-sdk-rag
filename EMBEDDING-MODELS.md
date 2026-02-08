# Embedding Models via AI Gateway

You have access to multiple embedding models through your Vercel AI Gateway. No additional API keys needed!

## Available Models

### OpenAI (Default)

**text-embedding-3-small** ⭐ Current default
- **Dimensions**: 1536
- **Best for**: General purpose, cost-effective
- **Cost**: $0.02 per 1M tokens (~$0.01 per 1000 docs)
- **Model ID**: `'openai/text-embedding-3-small'`

**text-embedding-3-large**
- **Dimensions**: 3072
- **Best for**: Maximum accuracy, complex queries
- **Cost**: $0.13 per 1M tokens
- **Model ID**: `'openai/text-embedding-3-large'`

### Voyage AI (Recommended for Claude)

**voyage-3-large** ⭐ Best for your setup
- **Dimensions**: 1024
- **Best for**: Claude/Anthropic applications, general purpose
- **Why recommended**: Optimized specifically for Claude models
- **Model ID**: `'voyage/voyage-3-large'`

**voyage-code-3**
- **Dimensions**: 1024
- **Best for**: Code search and documentation
- **Model ID**: `'voyage/voyage-code-3'`

### Mistral

**mistral-embed**
- **Dimensions**: 1024
- **Best for**: General purpose, alternative to OpenAI
- **Model ID**: `'mistral/mistral-embed'`

**codestral-embed**
- **Dimensions**: 1024
- **Best for**: Code-related tasks
- **Model ID**: `'mistral/codestral-embed'`

### Google

**text-multilingual-embed**
- **Dimensions**: 768
- **Best for**: Multi-language applications
- **Model ID**: `'google/text-multilingual-embed'`

**gemini-embedding-001**
- **Dimensions**: 768
- **Best for**: Google ecosystem integration
- **Model ID**: `'google/gemini-embedding-001'`

**text-embedding-005**
- **Dimensions**: 768
- **Best for**: Latest Google embeddings
- **Model ID**: `'google/text-embedding-005'`

### Cohere

**embed-v4.0**
- **Dimensions**: 1024
- **Best for**: Enterprise applications
- **Model ID**: `'cohere/embed-v4.0'`

## How to Choose

### For Your Claude-based App → **voyage/voyage-3-large** ⭐

Since you're using Gemini but the RAG system is model-agnostic, Voyage is optimized for semantic search with modern LLMs.

### For Code Search → **voyage/voyage-code-3** or **mistral/codestral-embed**

### For Multi-language → **google/text-multilingual-embed**

### For Cost Optimization → **openai/text-embedding-3-small** (current default)

### For Maximum Accuracy → **openai/text-embedding-3-large**

## How to Switch Models

### Option 1: Edit the Config (Permanent)

Edit `lib/embeddings.ts`:

```typescript
// Change this line
const EMBEDDING_MODEL = 'voyage/voyage-3-large';
```

### Option 2: Per-Request Override

```typescript
import { generateEmbedding } from '@/lib/embeddings';

// Use Voyage for this specific embedding
const embedding = await generateEmbedding(text, {
  model: 'voyage/voyage-3-large'
});
```

## Important: Dimension Changes

If you switch to a model with different dimensions, update your migration:

**Current** (OpenAI text-embedding-3-small):
```sql
embedding vector(1536)
```

**For Voyage/Mistral/Cohere** (1024 dimensions):
```sql
embedding vector(1024)
```

**For Google models** (768 dimensions):
```sql
embedding vector(768)
```

**For OpenAI text-embedding-3-large** (3072 dimensions):
```sql
embedding vector(3072)
```

## Testing Different Models

```typescript
import { generateEmbedding, cosineSimilarity } from '@/lib/embeddings';

// Compare models
const text1 = 'machine learning';
const text2 = 'artificial intelligence';

// Test OpenAI
const emb1OpenAI = await generateEmbedding(text1, {
  model: 'openai/text-embedding-3-small'
});
const emb2OpenAI = await generateEmbedding(text2, {
  model: 'openai/text-embedding-3-small'
});
console.log('OpenAI similarity:', cosineSimilarity(emb1OpenAI, emb2OpenAI));

// Test Voyage
const emb1Voyage = await generateEmbedding(text1, {
  model: 'voyage/voyage-3-large'
});
const emb2Voyage = await generateEmbedding(text2, {
  model: 'voyage/voyage-3-large'
});
console.log('Voyage similarity:', cosineSimilarity(emb1Voyage, emb2Voyage));
```

## Performance Comparison

| Model | Dimensions | Speed | Accuracy | Cost |
|-------|-----------|-------|----------|------|
| openai/text-embedding-3-small | 1536 | Fast | Good | $ |
| openai/text-embedding-3-large | 3072 | Slower | Excellent | $$$ |
| voyage/voyage-3-large | 1024 | Fast | Excellent | $$ |
| mistral/mistral-embed | 1024 | Fast | Good | $ |
| google/text-multilingual | 768 | Very Fast | Good | $ |

## Recommendation for Your Project

Given that you're using:
- Gemini 2.5 Flash for chat
- Neon PostgreSQL for data
- Vercel AI Gateway

**I recommend**: `voyage/voyage-3-large`

**Why**:
1. ✅ Optimized for modern LLMs (works great with any model)
2. ✅ Smaller dimensions (1024) = faster search, less storage
3. ✅ Excellent accuracy for semantic search
4. ✅ Good balance of cost and performance
5. ✅ Already available through your AI Gateway

**To switch**:

1. Edit `lib/embeddings.ts`:
```typescript
const EMBEDDING_MODEL = 'voyage/voyage-3-large'; // 1024 dimensions
```

2. Update migration `db/migrations/0001_enable_pgvector.sql`:
```sql
-- Change vector(1536) to vector(1024)
embedding vector(1024)
```

3. Run migration:
```bash
npx drizzle-kit push
```

That's it! No new API keys, no new packages.

## View Available Models

Check what's currently available in your AI Gateway:

```bash
# All embedding models
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | contains("embed")) | .id]'

# Just OpenAI
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("openai/")) | select(.id | contains("embed")) | .id]'

# Just Voyage
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("voyage/")) | .id]'
```

## Cost Estimation

Based on 10,000 documents (avg 1000 chars each):

| Model | Cost per 1M tokens | ~Cost for 10K docs |
|-------|-------------------|-------------------|
| openai/text-embedding-3-small | $0.02 | ~$0.10 |
| openai/text-embedding-3-large | $0.13 | ~$0.65 |
| voyage/voyage-3-large | ~$0.12 | ~$0.60 |
| Others | Varies | ~$0.10-0.30 |

All very affordable! Storage cost in Neon is negligible.
