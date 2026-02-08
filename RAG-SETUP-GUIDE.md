# RAG Implementation Guide

Complete Retrieval-Augmented Generation (RAG) system using Neon PostgreSQL with pgvector.

## Overview

This RAG implementation provides:
- ✅ Vector embeddings storage in your existing Neon database
- ✅ Semantic search with cosine similarity
- ✅ Automatic document chunking for large texts
- ✅ RAG-powered AI tools that intelligently search your knowledge base
- ✅ Document ingestion pipeline with multiple formats
- ✅ HTTP APIs for ingestion and search

## Architecture

```
┌─────────────────┐
│   User Query    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   AI Model      │ ◄─── Can call searchKnowledge tool
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Generate        │
│ Embedding       │ (OpenAI text-embedding-3-small)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vector Search   │
│ (pgvector)      │ (Cosine similarity in Neon)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Top K Results   │ ◄─── Relevant document chunks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AI Response     │ (Context-aware answer)
└─────────────────┘
```

## Setup Steps

### 1. Enable pgvector in Neon

Run the migration to enable pgvector extension:

```bash
# Apply the migration
npm run drizzle-kit push
```

Or manually run the SQL in Neon console:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Embeddings via AI Gateway ✅

You're already set up! Your `AI_GATEWAY_API_KEY` provides access to multiple embedding models:

**Available models**:
- `openai/text-embedding-3-small` (1536 dims) - Default, cost-effective
- `voyage/voyage-3-large` (1024 dims) - **Recommended for Claude apps**
- `openai/text-embedding-3-large` (3072 dims) - Highest accuracy
- `mistral/mistral-embed` - Alternative option
- `cohere/embed-v4.0` - Another option

**To switch to Voyage AI** (recommended for Claude):
1. Edit `lib/embeddings.ts`: Change `EMBEDDING_MODEL` to `'voyage/voyage-3-large'`
2. Update migration: Change `vector(1536)` to `vector(1024)`
3. That's it! No new API keys needed.

### 3. Test Vector Search

```bash
# Search API endpoint
curl "http://localhost:3000/api/rag/search?q=your+query&limit=5"
```

## Understanding the Components

### 1. **Neon Database with pgvector** ✅

**What**: PostgreSQL extension that adds vector data type and similarity search

**Why Neon**:
- You're already using it
- Native PostgreSQL extension (pgvector)
- Serverless, scales automatically
- No separate vector database needed

**How it works**:
```sql
-- Vector column stores 1536-dimensional embeddings
embedding vector(1536)

-- Fast similarity search using HNSW index
CREATE INDEX ON document_chunk USING hnsw (embedding vector_cosine_ops);

-- Query finds similar vectors
SELECT * FROM document_chunk
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

### 2. **RAG-Powered Tool** 🔧

**What**: A tool the AI can call to search your knowledge base

**How it works**:
```typescript
// The AI automatically decides to use this tool
export const searchKnowledgeTool = tool({
  description: 'Search the knowledge base for relevant information',
  parameters: z.object({
    query: z.string(),
    limit: z.number().optional(),
  }),
  execute: async ({ query, limit = 5 }) => {
    // 1. Generate embedding for query
    const embedding = await generateEmbedding(query);

    // 2. Search vector database
    const results = await searchDocuments(query, { limit });

    // 3. Return relevant documents to AI
    return {
      results: results.map(doc => ({
        content: doc.content,
        relevance: doc.similarity,
      })),
    };
  },
});
```

**Example conversation**:
```
User: "What's our refund policy?"

AI thinks: "I need to search the knowledge base for refund policy"
AI calls: searchKnowledge({ query: "refund policy" })
Tool returns: [
  { content: "Refunds are available within 30 days...", relevance: 0.89 },
  { content: "To request a refund, contact...", relevance: 0.82 }
]

AI responds: "According to our policy, refunds are available within 30 days.
              To request one, you can contact..."
```

### 3. **pgvector vs Other Options**

| Feature | pgvector (Neon) | Pinecone | Chroma |
|---------|----------------|----------|---------|
| **Setup** | Already have it | New service | New service |
| **Cost** | Included in Neon | Separate cost | Free tier |
| **Latency** | Low (same DB) | Network call | Network/local |
| **Scalability** | Good | Excellent | Good |
| **SQL Integration** | ✅ Native | ❌ No | ❌ No |
| **Metadata Filtering** | ✅ Full SQL | Limited | Limited |

**Recommendation**: Start with pgvector since you have Neon. Migrate to Pinecone only if:
- You need 100M+ vectors
- You need <10ms search latency
- Vector workload dominates your database

### 4. **Document Ingestion Pipeline**

**Purpose**: Convert documents → chunks → embeddings → stored vectors

**Flow**:
```
Document (PDF, MD, JSON, etc.)
    ↓
Split into chunks (1000 chars with 200 overlap)
    ↓
Generate embeddings (batch for efficiency)
    ↓
Store in pgvector with metadata
    ↓
Ready for semantic search
```

**Example**:
```typescript
// Ingest a documentation page
await ingestTextDocument(
  "Our product supports OAuth 2.0 authentication...",
  {
    category: 'documentation',
    source: 'auth-guide',
    metadata: { version: '2.0', section: 'authentication' }
  }
);

// Later: AI can find this when user asks about OAuth
```

## Usage Examples

### Adding Documents

**Via API**:
```bash
# Single document
curl -X POST http://localhost:3000/api/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "content": "Your document content here...",
    "category": "documentation",
    "metadata": { "source": "user-guide" }
  }'

# Batch documents
curl -X POST http://localhost:3000/api/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type": "batch",
    "documents": [
      { "content": "Doc 1...", "metadata": { "title": "Getting Started" } },
      { "content": "Doc 2...", "metadata": { "title": "Advanced Topics" } }
    ],
    "category": "tutorials"
  }'

# From URL
curl -X POST http://localhost:3000/api/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url",
    "url": "https://example.com/docs/api",
    "category": "external-docs"
  }'
```

**Programmatically**:
```typescript
import { ingestTextDocument, ingestFAQ, ingestDocumentation } from '@/lib/document-ingestion';

// Ingest FAQ
await ingestFAQ([
  {
    question: "How do I reset my password?",
    answer: "Click 'Forgot Password' on the login page..."
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept credit cards, PayPal, and bank transfers..."
  }
]);

// Ingest documentation
await ingestDocumentation([
  {
    title: "API Authentication",
    content: "Our API uses JWT tokens. To authenticate...",
    url: "https://docs.example.com/auth"
  }
], 'api-docs');
```

### Using in AI Chat

**Update your chat API** to include RAG tools:

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { google } from '@ai-sdk/openai';
import { ragTools } from '@/lib/rag-tool';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: google('gemini-2.5-flash'),
    messages,
    tools: {
      // Add RAG tools
      ...ragTools,

      // Your existing tools
      // ...
    },
  });

  return result.toDataStreamResponse();
}
```

The AI will now automatically search your knowledge base when needed!

### Searching Documents

**Via API**:
```bash
# Basic search
curl "http://localhost:3000/api/rag/search?q=authentication&limit=5"

# With category filter
curl "http://localhost:3000/api/rag/search?q=oauth&category=documentation&limit=10"

# With minimum similarity threshold
curl "http://localhost:3000/api/rag/search?q=payment&minSimilarity=0.8"
```

**Programmatically**:
```typescript
import { searchDocuments, searchDocumentsWithFilter } from '@/lib/vector-store';

// Basic search
const results = await searchDocuments('how to reset password', { limit: 5 });

// With filtering
const docs = await searchDocumentsWithFilter(
  'API authentication',
  { category: 'documentation' },
  { limit: 10, minSimilarity: 0.7 }
);

// Results include similarity scores
results.forEach(doc => {
  console.log(`${(doc.similarity * 100).toFixed(1)}% match: ${doc.content}`);
});
```

## Best Practices

### 1. Chunk Size
- **Small chunks (500-1000 chars)**: Better precision, more specific results
- **Large chunks (2000-4000 chars)**: More context, better for complex queries
- **Default**: 1000 chars with 200 overlap is a good balance

### 2. Metadata
Always include metadata for filtering and debugging:
```typescript
{
  category: 'documentation',      // Filter by type
  source: 'user-guide-v2.0',     // Track origin
  lastUpdated: '2026-01-15',     // Freshness
  author: 'docs-team',           // Attribution
  version: '2.0'                 // Version tracking
}
```

### 3. Similarity Thresholds
- `0.9+`: Very high relevance (almost exact match)
- `0.7-0.9`: High relevance (good match)
- `0.5-0.7`: Medium relevance (related content)
- `<0.5`: Low relevance (may not be useful)

### 4. Query Optimization
**Good queries** (specific, descriptive):
- ❌ "auth"
- ✅ "how to implement OAuth 2.0 authentication"

**Use metadata filtering**:
```typescript
// Instead of searching everything
searchDocuments('API endpoint');

// Filter by category
searchDocumentsWithFilter('API endpoint', { category: 'api-reference' });
```

## Monitoring & Debugging

### Check Document Count
```typescript
import { getDocumentCount } from '@/lib/vector-store';
const count = await getDocumentCount();
console.log(`Total documents: ${count}`);
```

### Test Embeddings
```typescript
import { generateEmbedding, cosineSimilarity } from '@/lib/embeddings';

const emb1 = await generateEmbedding('machine learning');
const emb2 = await generateEmbedding('artificial intelligence');
const similarity = cosineSimilarity(emb1, emb2);
console.log(`Similarity: ${(similarity * 100).toFixed(1)}%`); // ~85%
```

### View Search Results
```bash
# Check what documents are being returned
curl "http://localhost:3000/api/rag/search?q=test&limit=3" | jq
```

## Switching to Voyage AI (Recommended for Claude)

Voyage AI embeddings are optimized for Claude and provide better results.

**Easy switch via AI Gateway** (no new API keys!):

1. Update `lib/embeddings.ts`:
```typescript
// Change this line
const EMBEDDING_MODEL = 'voyage/voyage-3-large'; // 1024 dimensions
```

2. Update migration for 1024 dimensions:
```sql
-- Change from vector(1536) to vector(1024)
embedding vector(1024)
```

3. Re-run migration:
```bash
npx drizzle-kit push
```

That's it! Your existing `AI_GATEWAY_API_KEY` handles everything.

## Next Steps

1. **Enable pgvector**: Run the migration
2. **Ingest some documents**: Use the ingestion API or functions
3. **Add RAG tools to chat**: Update your chat API route
4. **Test it**: Ask questions that require knowledge base lookup

## Troubleshooting

**"Extension 'vector' does not exist"**
- Solution: Run the migration or manually enable in Neon console

**"Embedding generation failed"**
- Check AI_GATEWAY_API_KEY is set in `.env`
- Verify AI Gateway has credits/quota

**"No results found"**
- Check if documents are ingested: `getDocumentCount()`
- Lower minSimilarity threshold
- Try more specific queries

**"Slow search performance"**
- Ensure HNSW index is created
- Consider reducing `limit` parameter
- Check Neon connection pooling

## Cost Estimation

**OpenAI Embeddings** (text-embedding-3-small):
- $0.02 per 1M tokens
- ~1000 docs (1000 chars each) = ~$0.01

**Neon Storage**:
- Vector storage: ~4KB per 1536-dim embedding
- 10,000 docs ≈ 40MB ≈ negligible cost

**Voyage AI** (better for Claude):
- $0.12 per 1M tokens
- More expensive but better quality

## Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Neon pgvector Guide](https://neon.tech/docs/extensions/pgvector)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Voyage AI Embeddings](https://docs.voyageai.com/)
