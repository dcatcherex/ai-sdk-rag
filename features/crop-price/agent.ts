import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { cropPriceLookupInputSchema, marketSummaryInputSchema } from './schema';
import { runCropPriceLookup, runMarketSummary } from './service';

export function createCropPriceAgentTools(_ctx: Pick<AgentToolContext, 'userId'>) {
  return {
    lookup_crop_price: tool({
      description:
        'Look up current Thai farm-gate prices for a specific crop from official sources (OAE, DIT). Use when a farmer asks about ราคา, current price, or whether a price they were offered is fair.',
      inputSchema: cropPriceLookupInputSchema,
      async execute(input) {
        const result = await runCropPriceLookup(input);
        return { success: true, ...result };
      },
    }),
    get_market_summary: tool({
      description:
        'Get a market overview for a Thai crop: current price snapshot, key price-driving factors, and sell-timing guidance. Use when a farmer asks about market conditions, when to sell, or whether now is a good time.',
      inputSchema: marketSummaryInputSchema,
      async execute(input) {
        const result = await runMarketSummary(input);
        return { success: true, ...result };
      },
    }),
  };
}
