/**
 * RAG-Powered Tool
 *
 * This is a tool that the AI can call to search your knowledge base.
 * It retrieves relevant documents from the vector store and returns them as context.
 *
 * The AI will automatically use this tool when it needs information from your documents.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { searchDocuments, searchDocumentsWithFilter, searchDocumentsByIds } from './vector-store';

/**
 * Knowledge base search tool
 *
 * Example usage in AI response:
 * User: "What are the company policies on remote work?"
 * AI: [Calls searchKnowledge tool with query="remote work policies"]
 * Tool returns: Relevant policy documents
 * AI: "Based on the company policies, remote work is allowed..."
 */
export const searchKnowledgeTool = tool({
  description: 'Search the knowledge base for relevant information. Use this when you need to find specific information, documentation, or answers to questions based on stored documents.',
  inputSchema: z.object({
    query: z.string().min(1).describe('The search query or question to find relevant information'),
    limit: z.number().optional().describe('Maximum number of results to return (default: 5)'),
    category: z.string().optional().describe('Filter by document category if specified'),
  }),
  execute: async ({ query, limit = 5, category }) => {
    // Validate query
    if (!query || query.trim().length === 0) {
      return {
        success: false,
        message: 'Search query cannot be empty',
        results: [],
      };
    }

    try {
      let results;

      // If category filter is provided, use filtered search
      if (category) {
        results = await searchDocumentsWithFilter(
          query,
          { category },
          { limit }
        );
      } else {
        results = await searchDocuments(query, { limit });
      }

      // Format results for the AI
      if (results.length === 0) {
        return {
          success: true,
          message: 'No relevant documents found in the knowledge base.',
          results: [],
        };
      }

      return {
        success: true,
        message: `Found ${results.length} relevant document(s)`,
        results: results.map((doc, index) => ({
          index: index + 1,
          content: doc.content,
          relevance: `${(doc.similarity * 100).toFixed(1)}%`,
          source: doc.metadata.source || 'Unknown',
          ...doc.metadata,
        })),
      };
    } catch (error) {
      console.error('Knowledge search error:', error);
      return {
        success: false,
        message: 'Failed to search knowledge base',
        error: error instanceof Error ? error.message : 'Unknown error',
        results: [],
      };
    }
  },
});

/**
 * Document retrieval tool (for more specific document fetching)
 */
export const retrieveDocumentTool = tool({
  description: 'Retrieve specific document chunks by semantic similarity. Use this for detailed information retrieval.',
  inputSchema: z.object({
    query: z.string().min(1).describe('Detailed question or topic to find information about'),
    minRelevance: z.number().optional().describe('Minimum relevance threshold 0-1 (default: 0.7)'),
  }),
  execute: async ({ query, minRelevance = 0.7 }) => {
    try {
      const results = await searchDocuments(query, {
        limit: 10,
        minSimilarity: minRelevance,
      });

      if (results.length === 0) {
        return {
          success: true,
          message: 'No documents meet the relevance threshold.',
          context: '',
        };
      }

      // Combine all results into a context string
      const context = results
        .map((doc, i) => {
          const source = doc.metadata.source || 'Document';
          return `[${i + 1}] ${source} (${(doc.similarity * 100).toFixed(1)}% relevant):\n${doc.content}`;
        })
        .join('\n\n---\n\n');

      return {
        success: true,
        message: `Retrieved ${results.length} relevant document chunks`,
        context,
        sources: results.map(r => r.metadata.source || 'Unknown'),
      };
    } catch (error) {
      console.error('Document retrieval error:', error);
      return {
        success: false,
        message: 'Failed to retrieve documents',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: '',
      };
    }
  },
});

/**
 * Export all RAG tools
 */
export const ragTools = {
  searchKnowledge: searchKnowledgeTool,
  retrieveDocument: retrieveDocumentTool,
};

/**
 * Create RAG tools scoped to specific document IDs.
 * Used for grounded chat where the user selects specific documents.
 */
export function createScopedRagTools(documentIds: string[]) {
  return {
    searchKnowledge: tool({
      description:
        'Search the selected knowledge base documents for relevant information. Use this when you need to find specific information from the user-selected documents.',
      inputSchema: z.object({
        query: z.string().min(1).describe('The search query or question to find relevant information'),
        limit: z.number().optional().describe('Maximum number of results to return (default: 5)'),
      }),
      execute: async ({ query, limit = 5 }) => {
        if (!query || query.trim().length === 0) {
          return { success: false, message: 'Search query cannot be empty', results: [] };
        }

        try {
          const results = await searchDocumentsByIds(query, documentIds, { limit });

          if (results.length === 0) {
            return {
              success: true,
              message: 'No relevant information found in the selected documents.',
              results: [],
            };
          }

          return {
            success: true,
            message: `Found ${results.length} relevant result(s) from selected documents`,
            results: results.map((doc, index) => ({
              index: index + 1,
              content: doc.content,
              relevance: `${(doc.similarity * 100).toFixed(1)}%`,
              source: doc.metadata.source || 'Unknown',
              ...doc.metadata,
            })),
          };
        } catch (error) {
          console.error('Scoped knowledge search error:', error);
          return {
            success: false,
            message: 'Failed to search selected documents',
            error: error instanceof Error ? error.message : 'Unknown error',
            results: [],
          };
        }
      },
    }),

    retrieveDocument: tool({
      description:
        'Retrieve detailed information from the selected documents by semantic similarity.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Detailed question or topic to find information about'),
        minRelevance: z.number().optional().describe('Minimum relevance threshold 0-1 (default: 0.7)'),
      }),
      execute: async ({ query, minRelevance = 0.7 }) => {
        try {
          const results = await searchDocumentsByIds(query, documentIds, {
            limit: 10,
            minSimilarity: minRelevance,
          });

          if (results.length === 0) {
            return {
              success: true,
              message: 'No documents meet the relevance threshold.',
              context: '',
            };
          }

          const context = results
            .map((doc, i) => {
              const source = doc.metadata.source || 'Document';
              return `[${i + 1}] ${source} (${(doc.similarity * 100).toFixed(1)}% relevant):\n${doc.content}`;
            })
            .join('\n\n---\n\n');

          return {
            success: true,
            message: `Retrieved ${results.length} relevant document chunks`,
            context,
            sources: results.map((r) => r.metadata.source || 'Unknown'),
          };
        } catch (error) {
          console.error('Scoped document retrieval error:', error);
          return {
            success: false,
            message: 'Failed to retrieve documents',
            error: error instanceof Error ? error.message : 'Unknown error',
            context: '',
          };
        }
      },
    }),
  };
}
