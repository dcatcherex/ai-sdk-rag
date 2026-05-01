import { tool } from "ai";

import type { AgentToolContext } from "@/features/tools/registry/types";

import {
  createDomainEntity,
  createDomainProfile,
  getDomainProfile,
  listDomainEntities,
  listDomainProfiles,
  resolveRelevantDomainContext,
  updateDomainEntity,
  updateDomainProfile,
} from "./service";
import {
  createDomainEntityInputSchema,
  createDomainProfileInputSchema,
  findDomainEntitiesInputSchema,
  getDomainProfileContextInputSchema,
  updateDomainEntityInputSchema,
  updateDomainProfileInputSchema,
} from "./schema";

function buildOwnerContext(ctx: Pick<AgentToolContext, "userId" | "brandId">) {
  return {
    userId: ctx.userId,
    brandId: ctx.brandId ?? null,
  };
}

export function createDomainProfilesAgentTools(
  ctx: Pick<AgentToolContext, "userId" | "brandId">,
) {
  const owner = buildOwnerContext(ctx);

  return {
    create_profile: tool({
      description:
        "Create a structured professional profile such as a farm profile, class profile, clinic profile, sales pipeline, creator workspace, or other domain context. Always confirm with the user before writing persistent data.",
      inputSchema: createDomainProfileInputSchema,
      needsApproval: true,
      async execute(input) {
        const profile = await createDomainProfile(input, owner);
        return {
          success: true,
          kind: 'profile_saved',
          profile,
          message: `Created profile "${profile.name}" in domain "${profile.domain}".`,
        };
      },
    }),

    update_profile: tool({
      description:
        "Update an existing structured professional profile. Use this after the user confirms changes to stored fields such as province, main crop, grade, specialty, client stage, or other profile details.",
      inputSchema: updateDomainProfileInputSchema,
      needsApproval: true,
      async execute({ profileId, ...patch }) {
        const profile = await updateDomainProfile(profileId, patch, owner);
        if (!profile) {
          return {
            success: false,
            message: "Profile not found or not accessible.",
          };
        }

        return {
          success: true,
          kind: 'profile_updated',
          profile,
          message: `Updated profile "${profile.name}".`,
        };
      },
    }),

    create_entity: tool({
      description:
        "Create a structured entity inside a professional profile, such as a plot, crop cycle, class, student, patient, client, deal, project, or assessment. Always confirm with the user before writing persistent data.",
      inputSchema: createDomainEntityInputSchema,
      needsApproval: true,
      async execute({ profileId, ...input }) {
        const entity = await createDomainEntity(profileId, input, owner);
        return {
          success: true,
          kind: 'entity_saved',
          entity,
          message: `Created ${entity.entityType} "${entity.name}".`,
        };
      },
    }),

    update_entity: tool({
      description:
        "Update a structured entity such as a plot, class, student, patient, client, deal, or other domain object. Always confirm with the user before writing persistent data.",
      inputSchema: updateDomainEntityInputSchema,
      needsApproval: true,
      async execute({ entityId, ...patch }) {
        const entity = await updateDomainEntity(entityId, patch, owner);
        if (!entity) {
          return {
            success: false,
            message: "Entity not found or not accessible.",
          };
        }

        return {
          success: true,
          kind: 'entity_updated',
          entity,
          message: `Updated ${entity.entityType} "${entity.name}".`,
        };
      },
    }),

    find_entities: tool({
      description:
        "Find structured entities inside the user's professional context, such as plots, crop cycles, classes, students, patients, clients, or deals. Use this to inspect existing structured context before asking follow-up questions or making updates.",
      inputSchema: findDomainEntitiesInputSchema,
      async execute({ profileId, domain, entityType, status, limit }) {
        let resolvedProfileId = profileId;

        if (!resolvedProfileId) {
          const profiles = await listDomainProfiles(owner, {
            domain,
            limit: 1,
          });
          resolvedProfileId = profiles[0]?.id;
        }

        if (!resolvedProfileId) {
          return {
            success: true,
            profile: null,
            entities: [],
            message: "No matching profile was found for this query.",
          };
        }

        const [profile, entities] = await Promise.all([
          getDomainProfile(resolvedProfileId, owner),
          listDomainEntities(resolvedProfileId, owner, {
            entityType,
            status,
            limit,
          }),
        ]);

        return {
          success: true,
          kind: 'entity_list',
          profile,
          entities: entities ?? [],
          count: entities?.length ?? 0,
        };
      },
    }),

    get_profile_context: tool({
      description:
        "Get a compact structured context view for the most relevant professional profile and related entities. Use this when the conversation depends on a farm, classroom, clinic, client pipeline, or similar real-world operating context.",
      inputSchema: getDomainProfileContextInputSchema,
      async execute(input) {
        const context = await resolveRelevantDomainContext(input, owner);
        if (!context) {
          return {
            success: true,
            profile: null,
            entities: [],
            message: "No relevant profile context was found.",
          };
        }

        return {
          success: true,
          kind: 'profile_context',
          profile: context.profile,
          entities: context.entities,
          count: context.entities.length,
        };
      },
    }),
  };
}
