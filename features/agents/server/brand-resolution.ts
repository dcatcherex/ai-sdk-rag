import type { Brand } from '@/features/brands/types';
import type { Agent, BrandAccessPolicy, BrandMode, FallbackBehavior } from '@/features/agents/types';
import { normalizeAgentBrandConfig } from './brand-config';

type AgentBrandRuntimeConfig = {
  brandId?: string | null;
  brandMode?: BrandMode | string | null;
  brandAccessPolicy?: BrandAccessPolicy | string | null;
  requiresBrandForRun?: boolean | null;
  fallbackBehavior?: FallbackBehavior | string | null;
};

export type ResolveEffectiveBrandInput = {
  userId: string;
  activeBrandId?: string | null;
  agent: AgentBrandRuntimeConfig | null;
};

export type BrandResolutionDependencies = {
  getBrand: (userId: string, brandId: string) => Promise<Brand | null>;
  getBrands: (userId: string) => Promise<Brand[]>;
  hasWorkspaceAccess: (userId: string, brandId: string) => Promise<boolean>;
};

export type ResolveEffectiveBrandResult = {
  effectiveBrandId: string | null;
  effectiveBrand: Brand | null;
  mode: BrandMode;
  canOverride: boolean;
  reason:
    | 'agent_none'
    | 'used_active_brand'
    | 'used_agent_brand'
    | 'used_default_brand'
    | 'no_brand'
    | 'blocked_missing_required_brand'
    | 'prompt_to_select_brand';
  shouldBlock: boolean;
  blockMessage?: string;
  promptInstruction?: string;
};

const DEFAULT_AGENT_BRAND_CONFIG: Required<Pick<
  Agent,
  'brandId' | 'brandMode' | 'brandAccessPolicy' | 'requiresBrandForRun' | 'fallbackBehavior'
>> = {
  brandId: null,
  brandMode: 'optional',
  brandAccessPolicy: 'any_accessible',
  requiresBrandForRun: false,
  fallbackBehavior: 'ask_or_continue',
};

async function loadDefaultDependencies(): Promise<BrandResolutionDependencies> {
  const [brandService, collaborationService] = await Promise.all([
    import('@/features/brands/service'),
    import('@/features/collaboration/service'),
  ]);
  return {
    getBrand: brandService.getBrand,
    getBrands: brandService.getBrands,
    hasWorkspaceAccess: async (userId: string, brandId: string) => {
      const brand = await brandService.getBrand(userId, brandId);
      if (!brand) return false;
      if (brand.userId === userId) return true;
      const role = await collaborationService.getUserBrandRole(userId, brandId);
      return role !== null;
    },
  };
}

export async function resolveEffectiveBrand(
  input: ResolveEffectiveBrandInput,
  deps?: BrandResolutionDependencies,
): Promise<ResolveEffectiveBrandResult> {
  const services = deps ?? await loadDefaultDependencies();
  const config = input.agent
    ? normalizeAgentBrandConfig({
        brandId: input.agent.brandId ?? null,
        brandMode: input.agent.brandMode as BrandMode | null | undefined,
        brandAccessPolicy: input.agent.brandAccessPolicy as BrandAccessPolicy | null | undefined,
        requiresBrandForRun: input.agent.requiresBrandForRun ?? null,
        fallbackBehavior: input.agent.fallbackBehavior as FallbackBehavior | null | undefined,
      })
    : DEFAULT_AGENT_BRAND_CONFIG;
  const getAccessibleBrand = async (brandId: string | null | undefined) => {
    if (!brandId) return null;
    const brand = await services.getBrand(input.userId, brandId);
    if (!brand) return null;
    if (config.brandAccessPolicy === 'workspace_only') {
      const allowed = await services.hasWorkspaceAccess(input.userId, brandId);
      return allowed ? brand : null;
    }
    return brand;
  };
  const getDefaultBrand = async () => {
    const brands = await services.getBrands(input.userId);
    if (config.brandAccessPolicy !== 'workspace_only') {
      return brands.find((entry) => entry.isDefault) ?? brands[0] ?? null;
    }

    const candidates = await Promise.all(
      brands.map(async (brand) => ({
        brand,
        allowed: await services.hasWorkspaceAccess(input.userId, brand.id),
      })),
    );
    const workspaceBrands = candidates.filter((entry) => entry.allowed).map((entry) => entry.brand);
    return workspaceBrands.find((entry) => entry.isDefault) ?? workspaceBrands[0] ?? null;
  };
  const resolveFallback = async (mode: BrandMode, canOverride: boolean) => {
    if (config.fallbackBehavior === 'use_default') {
      const defaultBrand = await getDefaultBrand();
      if (defaultBrand) {
        return {
          effectiveBrandId: defaultBrand.id,
          effectiveBrand: defaultBrand,
          mode,
          canOverride,
          reason: 'used_default_brand' as const,
          shouldBlock: false,
        };
      }
    }

    if (config.fallbackBehavior === 'ask_to_select') {
      return {
        effectiveBrandId: null,
        effectiveBrand: null,
        mode,
        canOverride,
        reason: 'prompt_to_select_brand' as const,
        shouldBlock: false,
        promptInstruction:
          'Brand context is required before proceeding. Ask the user to select a brand, and do not continue with the requested task until they choose one.',
      };
    }

    if (config.fallbackBehavior === 'block_run' || config.requiresBrandForRun) {
      return {
        effectiveBrandId: null,
        effectiveBrand: null,
        mode,
        canOverride,
        reason: 'blocked_missing_required_brand' as const,
        shouldBlock: true,
        blockMessage: 'This agent requires an accessible brand before it can run.',
      };
    }

    return {
      effectiveBrandId: null,
      effectiveBrand: null,
      mode,
      canOverride,
      reason: 'no_brand' as const,
      shouldBlock: false,
    };
  };
  const activeBrand = await getAccessibleBrand(input.activeBrandId);

  if (!input.agent) {
    return {
      effectiveBrandId: activeBrand?.id ?? null,
      effectiveBrand: activeBrand,
      mode: 'optional',
      canOverride: true,
      reason: activeBrand ? 'used_active_brand' : 'no_brand',
      shouldBlock: false,
    };
  }

  if (config.brandMode === 'none' || config.brandAccessPolicy === 'no_brand') {
    return {
      effectiveBrandId: null,
      effectiveBrand: null,
      mode: 'none',
      canOverride: false,
      reason: 'agent_none',
      shouldBlock: false,
    };
  }

  if (config.brandMode === 'optional') {
    if (activeBrand) {
      return {
        effectiveBrandId: activeBrand.id,
        effectiveBrand: activeBrand,
        mode: 'optional',
        canOverride: true,
        reason: 'used_active_brand',
        shouldBlock: false,
      };
    }

    return resolveFallback('optional', true);
  }

  const agentBrand = await getAccessibleBrand(config.brandId);

  if (config.brandMode === 'suggested') {
    if (activeBrand) {
      return {
        effectiveBrandId: activeBrand.id,
        effectiveBrand: activeBrand,
        mode: 'suggested',
        canOverride: true,
        reason: 'used_active_brand',
        shouldBlock: false,
      };
    }

    if (agentBrand) {
      return {
        effectiveBrandId: agentBrand.id,
        effectiveBrand: agentBrand,
        mode: 'suggested',
        canOverride: true,
        reason: 'used_agent_brand',
        shouldBlock: false,
      };
    }

    return resolveFallback('suggested', true);
  }

  if (agentBrand) {
    return {
      effectiveBrandId: agentBrand.id,
      effectiveBrand: agentBrand,
      mode: 'locked',
      canOverride: false,
      reason: 'used_agent_brand',
      shouldBlock: false,
    };
  }

  return resolveFallback('locked', false);
}
