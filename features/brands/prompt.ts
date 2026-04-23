import type { Brand } from './types';

export function buildBrandBlock(b: Brand): string {
  const lines: string[] = [
    `Name: ${b.name}`,
    b.overview ? `Overview: ${b.overview}` : '',
    b.industry ? `Industry: ${b.industry}` : '',
    b.productsServices ? `Products & Services: ${b.productsServices}` : '',
    b.targetAudience ? `Target Audience: ${b.targetAudience}` : '',
    b.usp ? `USP: ${b.usp}` : '',
    b.priceRange ? `Price Range: ${b.priceRange}` : '',
    b.positioningStatement ? `Positioning: ${b.positioningStatement}` : '',
    b.keywords.length ? `Keywords: ${b.keywords.join(', ')}` : '',
    b.platforms.length ? `Platforms: ${b.platforms.join(', ')}` : '',
    b.promotionStyle ? `Promotion Style: ${b.promotionStyle}` : '',
    b.competitors.length ? `Competitors: ${b.competitors.join(' | ')}` : '',
    b.customerPainPoints.length ? `Customer Pain Points: ${b.customerPainPoints.join(' | ')}` : '',
    b.messagingPillars.length ? `Messaging Pillars: ${b.messagingPillars.join(' | ')}` : '',
    b.proofPoints.length ? `Proof Points: ${b.proofPoints.join(' | ')}` : '',
    b.toneOfVoice.length ? `Tone of Voice: ${b.toneOfVoice.join(', ')}` : '',
    b.brandValues.length ? `Brand Values: ${b.brandValues.join(', ')}` : '',
    b.voiceExamples.length ? `Voice Examples: ${b.voiceExamples.join(' | ')}` : '',
    b.forbiddenPhrases.length ? `Forbidden Phrases: ${b.forbiddenPhrases.join(' | ')}` : '',
    b.visualAesthetics.length ? `Visual Style: ${b.visualAesthetics.join(', ')}` : '',
    b.styleReferenceMode ? `Style Reference Mode: ${b.styleReferenceMode}` : '',
    b.styleDescription ? `Style Description: ${b.styleDescription}` : '',
    b.colors.length
      ? `Brand Colors: ${b.colors.filter((c) => c.hex).map((c) => `${c.label} ${c.hex}`).join(', ')}`
      : '',
    b.colorNotes ? `Color Notes: ${b.colorNotes}` : '',
    b.writingDos ? `Writing guidelines (do): ${b.writingDos}` : '',
    b.writingDonts ? `Writing guidelines (don't): ${b.writingDonts}` : '',
    b.exampleHeadlines.length ? `On-brand headline examples: ${b.exampleHeadlines.join(' | ')}` : '',
    b.exampleRejections.length ? `Off-brand headline examples: ${b.exampleRejections.join(' | ')}` : '',
  ].filter(Boolean);

  return `<brand_context>\n${lines.join('\n')}\n</brand_context>`;
}
