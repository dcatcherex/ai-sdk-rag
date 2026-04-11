import { z } from "zod";

export const adminInviteStatusSchema = z.enum(["invited", "accepted", "expired", "cancelled"]);

export const createAdminUserInviteSchema = z.object({
  email: z.email(),
  name: z.string().trim().max(120).optional().transform((value) => value?.trim() || undefined),
  approvedOnAccept: z.boolean().default(true),
  initialCreditGrant: z.int().min(0).max(1_000_000).default(0),
  expiresInDays: z.int().min(1).max(30).default(7),
});

export const listAdminUserInvitesSchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: adminInviteStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
