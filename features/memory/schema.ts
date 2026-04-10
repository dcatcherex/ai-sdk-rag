import { z } from "zod";

export const createBrandMemorySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160, "Title is too long"),
  category: z.string().trim().max(80, "Category is too long").optional().nullable(),
  content: z.string().trim().min(1, "Content is required").max(4000, "Content is too long"),
});

export const updateBrandMemorySchema = createBrandMemorySchema.extend({
  id: z.string().optional(),
});

export const brandMemoryActionSchema = z.object({
  note: z.string().trim().max(500, "Note is too long").optional().nullable(),
});

export type CreateBrandMemoryInput = z.infer<typeof createBrandMemorySchema>;
export type UpdateBrandMemoryInput = z.infer<typeof updateBrandMemorySchema>;
