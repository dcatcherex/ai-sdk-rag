import { z } from 'zod';

export const cropPriceLookupInputSchema = z.object({
  crop: z
    .enum(['rice', 'cassava', 'sugarcane', 'rubber', 'maize', 'palm_oil', 'durian', 'longan', 'coconut', 'soybean'])
    .describe('Crop to look up. Use the English code: rice, cassava, sugarcane, rubber, maize, palm_oil, durian, longan, coconut, or soybean'),
  province: z
    .string()
    .optional()
    .describe('Thai province name in Thai or English to filter regional prices. Optional.'),
});

export const cropPriceLookupOutputSchema = z.object({
  crop: z.string(),
  thaiName: z.string(),
  unit: z.string(),
  prices: z.array(
    z.object({
      region: z.string(),
      price: z.number().nullable(),
      priceDisplay: z.string(),
      date: z.string(),
    })
  ),
  source: z.enum(['oae', 'dit', 'baac', 'unavailable']),
  sourceLabel: z.string(),
  sourceUrl: z.string(),
  fetchedAt: z.string(),
  note: z.string().optional(),
});

export const marketSummaryInputSchema = z.object({
  crop: z
    .enum(['rice', 'cassava', 'sugarcane', 'rubber', 'maize', 'palm_oil', 'durian', 'longan', 'coconut', 'soybean'])
    .describe('Crop to summarize market conditions for'),
});

export const marketSummaryOutputSchema = z.object({
  crop: z.string(),
  thaiName: z.string(),
  currentPriceSummary: z.string(),
  trend: z.enum(['up', 'down', 'stable', 'unknown']),
  keyFactors: z.array(z.string()),
  sellTiming: z.string(),
  disclaimer: z.string(),
  fetchedAt: z.string(),
});
