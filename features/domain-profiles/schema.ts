import { z } from "zod";

const looseRecordSchema = z.record(z.string(), z.unknown());

export const createDomainProfileInputSchema = z.object({
  domain: z
    .string()
    .min(1)
    .max(100)
    .describe("Domain or profession label such as agriculture, education, clinic, sales, creator, or project."),
  name: z
    .string()
    .min(1)
    .max(200)
    .describe("Profile name such as Somchai Farm, Grade 8 Science, Community Clinic, or SME Pipeline."),
  description: z
    .string()
    .max(1000)
    .optional()
    .describe("Optional short description of the profile."),
  locale: z
    .string()
    .max(20)
    .optional()
    .describe("Locale code such as th-TH or en-US."),
  status: z
    .enum(["active", "archived"])
    .optional()
    .describe("Profile lifecycle status."),
  brandId: z
    .string()
    .optional()
    .describe("Optional workspace or brand ID when the profile belongs to that context."),
  data: looseRecordSchema
    .optional()
    .describe("Domain-specific structured fields such as province, mainCrop, grade, specialty, or audience."),
});

export const updateDomainProfileInputSchema = z.object({
  profileId: z.string().describe("ID of the profile to update."),
  domain: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("Updated domain label if needed."),
  name: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Updated profile name."),
  description: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .describe("Updated description, or null to clear it."),
  locale: z
    .string()
    .max(20)
    .optional()
    .describe("Updated locale code."),
  status: z
    .enum(["active", "archived"])
    .optional()
    .describe("Updated profile status."),
  brandId: z
    .string()
    .nullable()
    .optional()
    .describe("Updated brand/workspace ID, or null to clear it."),
  data: looseRecordSchema
    .optional()
    .describe("Replacement structured profile data."),
});

export const createDomainEntityInputSchema = z.object({
  profileId: z.string().describe("Profile ID that will own this entity."),
  entityType: z
    .string()
    .min(1)
    .max(100)
    .describe("Entity type such as plot, crop_cycle, class, student, patient, client, or deal."),
  name: z
    .string()
    .min(1)
    .max(200)
    .describe("Entity name."),
  description: z
    .string()
    .max(1000)
    .optional()
    .describe("Optional short description of the entity."),
  status: z
    .enum(["active", "archived"])
    .optional()
    .describe("Entity lifecycle status."),
  data: looseRecordSchema
    .optional()
    .describe("Domain-specific entity fields such as area, crop, grade, schedule, visit type, or stage."),
});

export const updateDomainEntityInputSchema = z.object({
  entityId: z.string().describe("ID of the entity to update."),
  entityType: z
    .string()
    .min(1)
    .max(100)
    .optional()
    .describe("Updated entity type."),
  name: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Updated entity name."),
  description: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .describe("Updated entity description, or null to clear it."),
  status: z
    .enum(["active", "archived"])
    .optional()
    .describe("Updated entity status."),
  data: looseRecordSchema
    .optional()
    .describe("Replacement structured entity data."),
});

export const findDomainEntitiesInputSchema = z.object({
  profileId: z
    .string()
    .optional()
    .describe("Optional profile ID to search within. If omitted, the tool will use the most relevant profile it can find."),
  domain: z
    .string()
    .optional()
    .describe("Optional domain filter such as agriculture, education, clinic, or sales."),
  entityType: z
    .string()
    .optional()
    .describe("Optional entity type filter such as plot, student, patient, or client."),
  status: z
    .string()
    .optional()
    .describe("Optional status filter such as active or archived."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Maximum number of entities to return."),
});

export const getDomainProfileContextInputSchema = z.object({
  profileId: z
    .string()
    .optional()
    .describe("Optional explicit profile ID to load."),
  entityId: z
    .string()
    .optional()
    .describe("Optional entity ID; if provided, the owning profile will be loaded."),
  domain: z
    .string()
    .optional()
    .describe("Optional domain hint used to pick the most relevant profile."),
  entityType: z
    .string()
    .optional()
    .describe("Optional entity type filter for the returned entity list."),
  profileLimit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(1)
    .describe("How many candidate profiles to search when no profileId is provided."),
  entityLimit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe("How many related entities to include in the returned context."),
});
