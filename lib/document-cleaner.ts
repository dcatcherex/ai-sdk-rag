/**
 * Document Cleaner & Optimizer
 *
 * Uses an LLM to clean, restructure, and optimize documents
 * for efficient LLM-powered search and retrieval.
 */

import { generateText } from 'ai';

const CLEAN_MODEL = 'google/gemini-2.5-flash-lite';

const CLEANING_SYSTEM = `You are a knowledge base document optimizer. Transform raw documents into clean, dense, LLM-search-optimized text.

INPUT: A raw document that may contain noise (preface, table of contents, acknowledgements, bibliography, copyright notices, legal boilerplate, repetitive disclaimers, foreword, index pages).

OUTPUT: A JSON object with this exact shape:
{
  "cleanedContent": "<the fully cleaned and restructured document text>",
  "changeSummary": "<2-3 sentence plain English summary of what was removed and restructured>",
  "removedSections": ["<section label>"],
  "structuralChanges": ["<change description>"]
}

REMOVE:
- Table of contents (numbered section title lists with no body text)
- Preface, foreword sections containing only motivational/context text with no facts
- Acknowledgements and dedication sections
- Bibliography, references, citations lists (keep inline citations in body text)
- Copyright notices, legal boilerplate, license texts
- Publisher info, ISBN, edition notices
- Repetitive headers/footers
- Blank filler sections

RESTRUCTURE FOR LLM SEARCH:
1. Add "## Section Title" headers if missing or inconsistent
2. Convert implicit steps ("First do X. Then do Y.") into explicit bullet points
3. Resolve pronoun references — replace "it", "this", "the above", "the former" with the explicit noun
4. Expand abbreviations on first use: "Application Programming Interface (API)", then "API" after
5. Normalize terminology — if a concept has two names, pick the more specific one and use it consistently
6. Add a "## Summary" block at the very top (3-5 sentences): purpose, scope, key takeaways
7. Group scattered related concepts into the same section

KEEP INTACT:
- All factual content: data, numbers, dates, procedures, definitions, specifications
- All tables and structured data
- All code samples and technical syntax
- The author's own conclusions and recommendations

Return ONLY the JSON object. Do not wrap in markdown code fences.`;

export interface CleanResult {
  cleanedContent: string;
  changeSummary: string;
  removedSections: string[];
  structuralChanges: string[];
}

export async function cleanDocument(content: string): Promise<CleanResult> {
  const { text } = await generateText({
    model: CLEAN_MODEL,
    system: CLEANING_SYSTEM,
    prompt: content,
  });

  // Strip markdown fences if the model wraps in them
  let raw = text.trim().replace(/^```json?\n?|```$/g, '').trim();

  try {
    const parsed = JSON.parse(raw);
    return {
      cleanedContent: parsed.cleanedContent || content,
      changeSummary: parsed.changeSummary || '',
      removedSections: Array.isArray(parsed.removedSections) ? parsed.removedSections : [],
      structuralChanges: Array.isArray(parsed.structuralChanges) ? parsed.structuralChanges : [],
    };
  } catch {
    throw new Error('Failed to parse cleaning response from AI');
  }
}
