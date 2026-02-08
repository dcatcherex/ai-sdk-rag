/**
 * Document Ingestion Pipeline
 *
 * Processes and ingests documents into the vector store.
 * Supports various file formats and automatic chunking.
 */

import { addDocument, addDocuments } from './vector-store';
import { chunkText } from './embeddings';

export interface IngestionOptions {
  category?: string;
  source?: string;
  metadata?: Record<string, any>;
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Ingest a single text document
 */
export async function ingestTextDocument(
  content: string,
  options: IngestionOptions = {}
): Promise<string> {
  const metadata = {
    category: options.category || 'general',
    source: options.source || 'manual',
    ingestedAt: new Date().toISOString(),
    ...options.metadata,
  };

  return await addDocument(content, {
    metadata,
    chunkSize: options.chunkSize,
    chunkOverlap: options.chunkOverlap,
  });
}

/**
 * Ingest multiple documents in batch
 */
export async function ingestDocuments(
  documents: Array<{ content: string; metadata?: Record<string, any> }>,
  options: IngestionOptions = {}
): Promise<string[]> {
  const docs = documents.map(doc => ({
    content: doc.content,
    metadata: {
      category: options.category || 'general',
      source: options.source || 'manual',
      ingestedAt: new Date().toISOString(),
      ...options.metadata,
      ...doc.metadata,
    },
  }));

  return await addDocuments(docs, {
    chunkSize: options.chunkSize,
    chunkOverlap: options.chunkOverlap,
  });
}

/**
 * Ingest from markdown content
 * Splits by headers for better semantic chunks
 */
export async function ingestMarkdown(
  markdown: string,
  options: IngestionOptions = {}
): Promise<string[]> {
  // Split by headers
  const sections = markdown.split(/^#{1,3}\s+/gm).filter(s => s.trim());

  const documents = sections.map((section, index) => ({
    content: section.trim(),
    metadata: {
      format: 'markdown',
      sectionIndex: index,
      ...options.metadata,
    },
  }));

  return await ingestDocuments(documents, options);
}

/**
 * Ingest from JSON data
 * Useful for structured data like FAQs, product info, etc.
 */
export async function ingestJSON(
  data: Record<string, any>[],
  contentField: string,
  options: IngestionOptions = {}
): Promise<string[]> {
  const documents = data.map((item, index) => ({
    content: typeof item[contentField] === 'string'
      ? item[contentField]
      : JSON.stringify(item[contentField]),
    metadata: {
      format: 'json',
      index,
      ...Object.fromEntries(
        Object.entries(item).filter(([key]) => key !== contentField)
      ),
      ...options.metadata,
    },
  }));

  return await ingestDocuments(documents, options);
}

/**
 * Ingest from URL (fetch and process)
 * Useful for documentation sites, blog posts, etc.
 */
export async function ingestFromURL(
  url: string,
  options: IngestionOptions = {}
): Promise<string> {
  try {
    const response = await fetch(url);
    const content = await response.text();

    // Basic HTML to text conversion (you might want to use a library like cheerio)
    const text = content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return await ingestTextDocument(text, {
      ...options,
      source: url,
      metadata: {
        url,
        fetchedAt: new Date().toISOString(),
        ...options.metadata,
      },
    });
  } catch (error) {
    console.error('Error ingesting from URL:', error);
    throw new Error(`Failed to ingest from URL: ${url}`);
  }
}

/**
 * Example: Ingest documentation
 */
export async function ingestDocumentation(
  docs: Array<{ title: string; content: string; url?: string }>,
  category: string = 'documentation'
): Promise<string[]> {
  return await ingestDocuments(
    docs.map(doc => ({
      content: `# ${doc.title}\n\n${doc.content}`,
      metadata: {
        title: doc.title,
        url: doc.url,
      },
    })),
    { category }
  );
}

/**
 * Example: Ingest FAQ
 */
export async function ingestFAQ(
  faqs: Array<{ question: string; answer: string }>,
  category: string = 'faq'
): Promise<string[]> {
  return await ingestDocuments(
    faqs.map(faq => ({
      content: `Q: ${faq.question}\n\nA: ${faq.answer}`,
      metadata: {
        question: faq.question,
        type: 'faq',
      },
    })),
    { category }
  );
}
