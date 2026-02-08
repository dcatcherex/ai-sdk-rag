// app/api/chat/tools.ts
import { z } from 'zod';
import { tool, type ToolSet, type InferUITools } from 'ai';
import { ragTools } from './rag-tool';

export const baseTools = {
  weather: tool({
    description: 'Get the weather in a location (fahrenheit)',
    inputSchema: z.object({
      location: z.string().describe('The location to get the weather for'),
    }),
    async execute({ location }) {
      const temperature = Math.round(Math.random() * (90 - 32) + 32);
      return { location, temperature };
    },
  }),
  convertFahrenheitToCelsius: tool({
    description: 'Convert a temperature in fahrenheit to celsius',
    inputSchema: z.object({
      temperature: z.number().describe('The temperature in fahrenheit to convert'),
    }),
    async execute({ temperature }) {
      const celsius = Math.round((temperature - 32) * (5 / 9));
      return { celsius };
    },
  }),
} satisfies ToolSet;

export const tools = {
  ...baseTools,
  // RAG Tools - AI can search your knowledge base
  ...ragTools,
} satisfies ToolSet;

export type ChatTools = InferUITools<typeof tools>;