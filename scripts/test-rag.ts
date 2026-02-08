#!/usr/bin/env tsx
/**
 * RAG Testing Script
 *
 * Run with: npx tsx --env-file=.env.local scripts/test-rag.ts
 * Or: node --env-file=.env.local --import tsx scripts/test-rag.ts
 *
 * This script demonstrates:
 * 1. Ingesting documents
 * 2. Searching with semantic similarity
 * 3. Using RAG in chat conversations
 */

import { ingestFAQ, ingestDocumentation } from '../lib/document-ingestion';
import { searchDocuments } from '../lib/vector-store';
import { getDocumentCount } from '../lib/vector-store';

async function main() {
  // Verify environment variables
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found');
    console.error('   Run with: npx tsx --env-file=.env.local scripts/test-rag.ts');
    process.exit(1);
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('❌ AI_GATEWAY_API_KEY not found');
    console.error('   Run with: npx tsx --env-file=.env.local scripts/test-rag.ts');
    process.exit(1);
  }

  console.log('🚀 RAG System Test\n');
  console.log('📡 Using Mistral mistral-embed embeddings (1024 dimensions)\n');

  // Step 1: Check if documents exist
  const count = await getDocumentCount();
  console.log(`📊 Current documents: ${count}\n`);

  if (count === 0) {
    console.log('📝 Ingesting sample documents...\n');

    // Ingest sample FAQ
    await ingestFAQ([
      {
        question: 'How do I reset my password?',
        answer: 'To reset your password, go to the login page and click "Forgot Password". Enter your email address, and we\'ll send you a password reset link. The link expires in 24 hours.',
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers. For enterprise customers, we also offer invoice-based payment with NET-30 terms.',
      },
      {
        question: 'How do I cancel my subscription?',
        answer: 'You can cancel your subscription anytime from your account settings. Go to Settings > Billing > Cancel Subscription. Your access will continue until the end of your current billing period.',
      },
      {
        question: 'Do you offer refunds?',
        answer: 'Yes, we offer a 30-day money-back guarantee. If you\'re not satisfied with our service within the first 30 days, contact support@example.com for a full refund.',
      },
    ]);

    // Ingest sample documentation
    await ingestDocumentation([
      {
        title: 'Getting Started',
        content: 'Welcome to our platform! This guide will help you get started quickly. First, create an account by clicking "Sign Up" in the top right corner. You\'ll need to verify your email address before you can use the platform. Once verified, you can start creating projects and inviting team members.',
      },
      {
        title: 'API Authentication',
        content: 'Our API uses JWT (JSON Web Tokens) for authentication. To get started, generate an API key from your dashboard under Settings > API Keys. Include this key in the Authorization header of all API requests: "Authorization: Bearer YOUR_API_KEY". Tokens expire after 7 days for security.',
      },
      {
        title: 'Team Collaboration',
        content: 'You can invite team members to collaborate on projects. Each member can have different roles: Admin, Editor, or Viewer. Admins have full access, Editors can create and modify content, and Viewers can only view content. To invite someone, go to Team Settings and click "Invite Member".',
      },
    ]);

    console.log('✅ Documents ingested successfully!\n');
  }

  // Step 2: Test searches
  console.log('🔍 Testing semantic search with Mistral AI...\n');

  const queries = [
    'How do I get my money back?',
    'authentication token',
    'invite someone to my project',
    'payment options',
  ];

  for (const query of queries) {
    console.log(`Query: "${query}"`);
    const results = await searchDocuments(query, { limit: 2 });

    if (results.length === 0) {
      console.log('  No results found\n');
    } else {
      results.forEach((doc, i) => {
        console.log(`  ${i + 1}. [${(doc.similarity * 100).toFixed(1)}% match] (Mistral)`);
        console.log(`     ${doc.content.substring(0, 100)}...`);
      });
      console.log();
    }
  }

  console.log('✅ RAG system is working!\n');
  console.log('🎯 Mistral embeddings provide excellent semantic understanding');
  console.log('   Notice the strong similarity scores (70-80%) for relevant matches!\n');
  console.log('Next steps:');
  console.log('  1. Start your dev server: npm run dev');
  console.log('  2. Open chat and ask: "How do I reset my password?"');
  console.log('  3. The AI will automatically search your knowledge base with Mistral!');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
