# RAG Examples & Use Cases

Complete examples showing how to use RAG in different scenarios.

## Example 1: Customer Support Bot

The AI automatically searches your knowledge base when users ask questions.

**User**: "How do I reset my password?"

**Behind the scenes**:
1. AI recognizes this needs knowledge base search
2. Calls `searchKnowledge({ query: "reset password" })`
3. Retrieves relevant docs with similarity scores
4. Responds with accurate information

**AI Response**: "To reset your password, go to the login page and click 'Forgot Password'..."

### Setup:

```typescript
// Ingest your support docs
import { ingestFAQ } from '@/lib/document-ingestion';

await ingestFAQ([
  {
    question: 'How do I reset my password?',
    answer: 'To reset your password, go to the login page...',
  },
  // Add more FAQs
]);
```

## Example 2: Product Documentation Assistant

Help users find information in your documentation.

**User**: "How do I use OAuth with your API?"

**AI**: [Searches docs automatically]
"Our API uses OAuth 2.0 for authentication. Here's how to set it up..."

### Setup:

```typescript
import { ingestDocumentation } from '@/lib/document-ingestion';

await ingestDocumentation([
  {
    title: 'OAuth Integration',
    content: `# OAuth 2.0 Integration

    Our API supports OAuth 2.0 for secure authentication...`,
    url: 'https://docs.example.com/oauth',
  },
]);
```

## Example 3: Internal Knowledge Base

Build a company-wide knowledge assistant.

```typescript
// Ingest company policies
await ingestTextDocument(
  `Remote Work Policy

  Employees may work remotely up to 3 days per week...`,
  {
    category: 'policies',
    metadata: {
      department: 'HR',
      lastUpdated: '2026-01-15',
    }
  }
);

// Ingest project documentation
await ingestTextDocument(
  `Project Phoenix Implementation Guide

  This guide covers the architecture and implementation...`,
  {
    category: 'engineering',
    metadata: {
      project: 'phoenix',
      version: '2.0',
    }
  }
);
```

**User**: "What's our remote work policy?"
**AI**: [Searches company policies] "Employees may work remotely up to 3 days per week..."

## Example 4: E-commerce Product Search

Help customers find products semantically.

```typescript
import { ingestJSON } from '@/lib/document-ingestion';

// Ingest product catalog
const products = [
  {
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium noise-canceling headphones with 30-hour battery life',
    price: 199.99,
    category: 'electronics',
  },
  {
    name: 'Ergonomic Office Chair',
    description: 'Adjustable mesh chair with lumbar support for all-day comfort',
    price: 349.99,
    category: 'furniture',
  },
];

await ingestJSON(products, 'description', {
  category: 'products',
});
```

**User**: "I need something for my back pain while working"
**AI**: [Searches products] "I recommend the Ergonomic Office Chair with lumbar support..."

## Example 5: Research Assistant

Search through research papers and articles.

```typescript
// Ingest research papers
for (const paper of papers) {
  await ingestTextDocument(
    `${paper.title}\n\nAbstract: ${paper.abstract}\n\n${paper.content}`,
    {
      category: 'research',
      metadata: {
        authors: paper.authors,
        year: paper.year,
        doi: paper.doi,
        citations: paper.citations,
      }
    }
  );
}
```

**User**: "What recent research exists on transformer architectures?"
**AI**: [Searches papers] "Based on recent research, transformers have evolved..."

## Example 6: Code Documentation Search

Help developers find code examples and API usage.

```typescript
import { ingestMarkdown } from '@/lib/document-ingestion';

// Ingest code docs (splits by headers automatically)
await ingestMarkdown(`
# Authentication

## Basic Auth
\`\`\`typescript
const auth = new BasicAuth(apiKey);
\`\`\`

## OAuth 2.0
\`\`\`typescript
const oauth = new OAuth({
  clientId: 'xxx',
  clientSecret: 'yyy',
});
\`\`\`

# Data Fetching

## Using fetch
\`\`\`typescript
const data = await fetch('/api/users');
\`\`\`
`, {
  category: 'api-docs',
});
```

**User**: "How do I authenticate with your API?"
**AI**: [Finds relevant code] "Here's how to authenticate..."

## Example 7: Legal Document Q&A

Search through contracts and legal documents.

```typescript
await ingestTextDocument(contractText, {
  category: 'legal',
  metadata: {
    documentType: 'contract',
    parties: ['Company A', 'Company B'],
    effectiveDate: '2026-01-01',
    version: '3.0',
  }
});
```

**User**: "What are the termination clauses in the contract?"
**AI**: [Searches contract] "According to Section 12.3..."

## Example 8: Multi-language Support

RAG works across languages with embeddings.

```typescript
// English documentation
await ingestTextDocument(englishDocs, {
  category: 'docs',
  metadata: { language: 'en' }
});

// Spanish documentation
await ingestTextDocument(spanishDocs, {
  category: 'docs',
  metadata: { language: 'es' }
});
```

**User (in Spanish)**: "¿Cómo reinicio mi contraseña?"
**AI**: [Searches Spanish docs] "Para reiniciar tu contraseña..."

## Example 9: Time-based Filtering

Search with temporal relevance.

```typescript
// Filter by date in metadata
const recentDocs = await searchDocumentsWithFilter(
  'product updates',
  {
    category: 'changelog',
    // Could add date filtering in the query
  },
  { limit: 10 }
);

// Filter results programmatically
const last30Days = recentDocs.filter(doc => {
  const docDate = new Date(doc.metadata.date);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return docDate >= thirtyDaysAgo;
});
```

## Example 10: Hybrid Search (Semantic + Metadata)

Combine semantic search with precise filtering.

```typescript
// Search within specific category and version
const results = await searchDocumentsWithFilter(
  'API rate limits',
  {
    category: 'api-docs',
    version: '2.0',
  },
  { limit: 5, minSimilarity: 0.7 }
);
```

## Advanced: Custom RAG Pipeline

Build a custom RAG flow with reranking and filtering.

```typescript
import { searchDocuments } from '@/lib/vector-store';
import { cosineSimilarity, generateEmbedding } from '@/lib/embeddings';

async function advancedRAG(query: string) {
  // Step 1: Get more candidates
  const candidates = await searchDocuments(query, {
    limit: 20,
    minSimilarity: 0.5,
  });

  // Step 2: Rerank by custom logic
  const queryEmbedding = await generateEmbedding(query);

  const reranked = candidates
    .map(doc => ({
      ...doc,
      // Custom scoring: combine similarity with recency
      score: doc.similarity * 0.7 +
             (getRecencyScore(doc.metadata.date) * 0.3),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Step 3: Format for AI
  const context = reranked
    .map((doc, i) => `[${i + 1}] ${doc.content}`)
    .join('\n\n');

  return {
    context,
    sources: reranked.map(d => d.metadata),
  };
}

function getRecencyScore(dateStr: string): number {
  const docDate = new Date(dateStr);
  const now = new Date();
  const daysDiff = (now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, 1 - daysDiff / 365); // Decay over 1 year
}
```

## Testing Your RAG System

### 1. Quick Test via API

```bash
# Ingest test document
curl -X POST http://localhost:3000/api/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "content": "Our product features include real-time collaboration, version control, and automated backups. We support up to 100 team members on the enterprise plan.",
    "category": "product-info"
  }'

# Search
curl "http://localhost:3000/api/rag/search?q=team+collaboration&limit=3"
```

### 2. Test in Chat

Start your dev server and ask:
- "What features does your product have?"
- "How many team members can I add?"

The AI will automatically search your knowledge base!

### 3. Measure Performance

```typescript
import { searchDocuments } from '@/lib/vector-store';

// Test query latency
console.time('search');
const results = await searchDocuments('test query', { limit: 5 });
console.timeEnd('search'); // Should be < 100ms

// Test relevance
results.forEach(doc => {
  console.log(`Similarity: ${(doc.similarity * 100).toFixed(1)}%`);
  console.log(`Content: ${doc.content.substring(0, 100)}...`);
});
```

## Best Practices from Examples

### 1. Rich Metadata
Always include searchable metadata:
```typescript
{
  category: 'documentation',
  source: 'user-guide',
  version: '2.0',
  lastUpdated: '2026-01-15',
  author: 'docs-team',
  tags: ['getting-started', 'authentication'],
}
```

### 2. Semantic Chunking
For long documents, split by semantic boundaries:
```typescript
// Good: Split by headers
await ingestMarkdown(longDoc);

// Good: Split by paragraphs with overlap
await ingestTextDocument(longDoc, {
  chunkSize: 1000,
  chunkOverlap: 200,
});

// Bad: Split at arbitrary character counts without overlap
```

### 3. Category Organization
Group related content:
```typescript
await ingestTextDocument(content, {
  category: 'api-docs',  // Not just 'docs'
  metadata: {
    subcategory: 'authentication',
    version: 'v2',
  }
});
```

### 4. Source Attribution
Always track sources for transparency:
```typescript
await ingestTextDocument(content, {
  metadata: {
    source: 'Official Documentation',
    url: 'https://docs.example.com/auth',
    lastReviewed: '2026-01-15',
  }
});
```

## Troubleshooting Common Issues

### Issue: No relevant results

**Solution**: Check your query and thresholds
```typescript
// Too strict
const results = await searchDocuments(query, { minSimilarity: 0.9 });

// Better
const results = await searchDocuments(query, { minSimilarity: 0.7 });
```

### Issue: Wrong documents returned

**Solution**: Use category filtering
```typescript
// Instead of searching everything
const results = await searchDocuments('pricing');

// Filter by category
const results = await searchDocumentsWithFilter('pricing', {
  category: 'product-info'
});
```

### Issue: Search too slow

**Solution**: Optimize your queries
```typescript
// Slow: Retrieve too many
const results = await searchDocuments(query, { limit: 50 });

// Fast: Retrieve only what you need
const results = await searchDocuments(query, { limit: 5 });
```

## Next Steps

1. **Run the test script**: `npx tsx scripts/test-rag.ts`
2. **Ingest your own documents**: Use the ingestion API or functions
3. **Test in chat**: Ask questions that require knowledge lookup
4. **Monitor performance**: Check similarity scores and latency
5. **Iterate**: Improve chunking and metadata based on results
