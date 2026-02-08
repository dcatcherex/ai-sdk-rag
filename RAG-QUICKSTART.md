# RAG Quick Start (5 Minutes)

Get your RAG system up and running in 5 minutes.

## Prerequisites

- Neon database already configured ✅
- Vercel AI Gateway configured ✅ (you already have this!)

## Step 1: Enable pgvector (30 seconds)

Run the SQL migration in your Neon console:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Or use Drizzle:
```bash
npx drizzle-kit push
```

**Verify it worked**:
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## Step 2: No Additional API Keys Needed! ✅

Your existing `AI_GATEWAY_API_KEY` already gives you access to embedding models.

**Using**: `voyage/voyage-3-large` (1024 dimensions)
- ⭐ Best for RAG and semantic search
- Optimized for modern LLMs (Claude, GPT-4, Gemini)
- Superior accuracy for retrieval tasks
- Faster search (fewer dimensions)

**Also available** through your AI Gateway:
- OpenAI (text-embedding-3-small, text-embedding-3-large)
- Mistral (mistral-embed, codestral-embed)
- Google (text-multilingual-embed, gemini-embedding-001)
- Cohere (embed-v4.0)

## Step 3: Install Dependencies (30 seconds)

```bash
npm install tsx
```

## Step 4: Test RAG System (2 minutes)

Run the test script to ingest sample data and verify everything works:

```bash
npx tsx --env-file=.env.local scripts/test-rag.ts
```

You should see:
```
🚀 RAG System Test

📊 Current documents: 0

📝 Ingesting sample documents...

✅ Documents ingested successfully!

🔍 Testing semantic search...

Query: "How do I get my money back?"
  1. [87.3% match]
     Yes, we offer a 30-day money-back guarantee. If you're not satisfied...

✅ RAG system is working!
```

## Step 5: Use in Chat (30 seconds)

Start your dev server:
```bash
npm run dev
```

Open the chat and ask:
- "How do I reset my password?"
- "What payment methods do you accept?"
- "How do I cancel my subscription?"

The AI will **automatically search your knowledge base** and answer! 🎉

## What Just Happened?

1. **pgvector enabled**: Your Neon database can now store and search vector embeddings
2. **Sample data ingested**: FAQs and docs were converted to embeddings and stored
3. **RAG tools added**: AI can now call `searchKnowledge()` to find relevant info
4. **It works automatically**: AI decides when to search based on the query

## Architecture Overview

```
User asks question
    ↓
AI receives question
    ↓
AI thinks: "I need to search knowledge base"
    ↓
AI calls searchKnowledge({ query: "user question" })
    ↓
1. Generate embedding for query (OpenAI)
2. Search pgvector with cosine similarity (Neon)
3. Return top 5 most relevant docs
    ↓
AI receives context from knowledge base
    ↓
AI responds with accurate, grounded answer
```

## Next Steps

### Add Your Own Documents

**Option A: Via API**
```bash
curl -X POST http://localhost:3000/api/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "content": "Your document content here...",
    "category": "documentation"
  }'
```

**Option B: Programmatically**
```typescript
import { ingestTextDocument } from '@/lib/document-ingestion';

await ingestTextDocument(
  "Your content here...",
  {
    category: 'docs',
    metadata: { source: 'manual' }
  }
);
```

**Option C: Batch Upload**
```typescript
import { ingestDocuments } from '@/lib/document-ingestion';

await ingestDocuments([
  { content: "Doc 1...", metadata: { title: "Getting Started" } },
  { content: "Doc 2...", metadata: { title: "Advanced" } },
], { category: 'tutorials' });
```

### Common Use Cases

**1. Customer Support**
```typescript
import { ingestFAQ } from '@/lib/document-ingestion';

await ingestFAQ([
  { question: "...", answer: "..." },
  // Add your FAQs
]);
```

**2. Product Documentation**
```typescript
import { ingestDocumentation } from '@/lib/document-ingestion';

await ingestDocumentation([
  { title: "API Guide", content: "...", url: "..." },
  // Add your docs
]);
```

**3. Company Knowledge Base**
```typescript
await ingestTextDocument(policyText, {
  category: 'policies',
  metadata: { department: 'HR', lastUpdated: '2026-01-15' }
});
```

### Search Your Documents

**Via API**:
```bash
curl "http://localhost:3000/api/rag/search?q=your+query&limit=5"
```

**Programmatically**:
```typescript
import { searchDocuments } from '@/lib/vector-store';

const results = await searchDocuments('your query', { limit: 5 });
results.forEach(doc => {
  console.log(`${(doc.similarity * 100).toFixed(1)}%: ${doc.content}`);
});
```

## Understanding Key Concepts

### 1. Vector Embeddings
- Converts text → array of numbers (e.g., [0.123, -0.456, ...])
- Similar text = similar vectors
- "reset password" and "forgotten password" have similar embeddings

### 2. Semantic Search
- Traditional: exact keyword matching
- Semantic: meaning-based matching
- "car" matches "automobile", "vehicle", "auto"

### 3. Cosine Similarity
- Measures how similar two vectors are
- 0.9-1.0 = very similar
- 0.7-0.9 = similar
- <0.7 = somewhat related

### 4. RAG-Powered Tool
- AI can call this tool automatically
- Tool searches vector database
- Returns relevant context to AI
- AI uses context to answer accurately

## Troubleshooting

**"Extension 'vector' does not exist"**
```sql
-- Run this in Neon console
CREATE EXTENSION IF NOT EXISTS vector;
```

**"Invalid API key"**
```env
# Check .env has correct AI Gateway key
AI_GATEWAY_API_KEY=your_key_here
```

**"No results found"**
```typescript
// Lower similarity threshold
const results = await searchDocuments(query, {
  minSimilarity: 0.5  // Lower = more permissive
});
```

**"Search is slow"**
```sql
-- Verify HNSW index exists
SELECT * FROM pg_indexes WHERE tablename = 'document_chunk';
```

## Performance Tips

1. **Batch insert documents** - More efficient than one at a time
2. **Use metadata filtering** - Narrow search space
3. **Adjust chunk size** - Smaller = faster, larger = more context
4. **Monitor similarity scores** - Adjust thresholds based on results

## Cost Estimation

**Vercel AI Gateway** (includes embeddings):
- Usage tracked through your AI Gateway dashboard
- OpenAI embeddings: $0.02 per 1M tokens (~$0.01 for 1000 docs)
- Voyage embeddings: Similar pricing
- Very affordable!

**Neon Storage**:
- Vectors are small (~6KB each)
- 10,000 docs ≈ 60MB
- Negligible cost

## FAQ

**Q: Does this work offline?**
A: No, embeddings require API calls through AI Gateway

**Q: Can I use a different embedding model?**
A: Yes! Edit `lib/embeddings.ts` to change the model. Available through AI Gateway:
- `'voyage/voyage-3-large'` - Best for Claude (1024 dims)
- `'openai/text-embedding-3-small'` - Default (1536 dims)
- `'openai/text-embedding-3-large'` - Highest accuracy (3072 dims)
- `'mistral/mistral-embed'` - Alternative option
- `'cohere/embed-v4.0'` - Another option

**Q: How many documents can I store?**
A: Neon + pgvector scales to millions. Start with thousands and see.

**Q: Will this make my chat slower?**
A: Minimal impact. Vector search adds ~50-100ms per query.

**Q: Can I search multiple languages?**
A: Yes! Embeddings work across languages. Use multilingual models.

**Q: How do I delete old documents?**
A: Use `deleteDocument(id)` from `lib/vector-store.ts`

## Complete Example

```typescript
// 1. Ingest documents
import { ingestFAQ } from '@/lib/document-ingestion';

await ingestFAQ([
  {
    question: 'What is RAG?',
    answer: 'RAG (Retrieval-Augmented Generation) combines AI with knowledge base search...'
  }
]);

// 2. Search
import { searchDocuments } from '@/lib/vector-store';

const results = await searchDocuments('explain RAG', { limit: 3 });
console.log(results[0].content); // "RAG (Retrieval-Augmented Generation)..."

// 3. Use in chat - automatic!
// Just ask: "What is RAG?"
// AI will search and respond with accurate info
```

## Resources

- **Setup Guide**: `RAG-SETUP-GUIDE.md` (detailed technical docs)
- **Examples**: `RAG-EXAMPLES.md` (10+ real-world use cases)
- **pgvector Docs**: https://github.com/pgvector/pgvector
- **Neon Docs**: https://neon.tech/docs/extensions/pgvector

## What's Next?

1. ✅ RAG system is running
2. Add your own documents
3. Test search quality
4. Adjust chunking/metadata if needed
5. Deploy to production

**You're ready to build knowledge-grounded AI apps!** 🚀
