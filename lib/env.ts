import { z } from 'zod';

const envSchema = z.object({
  AI_GATEWAY_API_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
