import { z } from 'zod';
import type {
  RichMessageSchemaDefinition,
  RichMessageSchemaFieldDefinition,
} from '@/features/rich-messages/types';

function buildFieldSchema(field: RichMessageSchemaFieldDefinition) {
  let schema: z.ZodType<unknown>;

  switch (field.type) {
    case 'number':
      schema = z.coerce.number();
      break;
    case 'boolean':
      schema = z.coerce.boolean();
      break;
    case 'string':
    default:
      schema = z.string().min(1);
      break;
  }

  return field.required ? schema : schema.optional();
}

export function buildRichMessageDataSchema(definition: RichMessageSchemaDefinition) {
  const shape: Record<string, z.ZodType<unknown>> = {};

  for (const field of definition.fields) {
    shape[field.key] = buildFieldSchema(field);
  }

  return z.object(shape);
}
