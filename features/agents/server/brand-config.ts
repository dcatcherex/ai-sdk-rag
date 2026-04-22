import { z } from 'zod';

import type { BrandAccessPolicy, BrandMode, FallbackBehavior } from '../types';

export const BRAND_MODE_VALUES = ['none', 'optional', 'suggested', 'locked'] as const;
export const BRAND_ACCESS_POLICY_VALUES = ['no_brand', 'any_accessible', 'workspace_only', 'specific_brand'] as const;
export const FALLBACK_BEHAVIOR_VALUES = ['ask_or_continue', 'ask_to_select', 'block_run', 'use_default'] as const;

export const brandModeSchema = z.enum(BRAND_MODE_VALUES);
export const brandAccessPolicySchema = z.enum(BRAND_ACCESS_POLICY_VALUES);
export const fallbackBehaviorSchema = z.enum(FALLBACK_BEHAVIOR_VALUES);

export type AgentBrandConfigInput = {
  brandId?: string | null;
  brandMode?: BrandMode | null;
  brandAccessPolicy?: BrandAccessPolicy | null;
  requiresBrandForRun?: boolean | null;
  fallbackBehavior?: FallbackBehavior | null;
};

export type NormalizedAgentBrandConfig = {
  brandId: string | null;
  brandMode: BrandMode;
  brandAccessPolicy: BrandAccessPolicy;
  requiresBrandForRun: boolean;
  fallbackBehavior: FallbackBehavior;
};

export function normalizeAgentBrandConfig(input: AgentBrandConfigInput): NormalizedAgentBrandConfig {
  let brandId = input.brandId ?? null;
  let brandMode: BrandMode = input.brandMode ?? (brandId ? 'locked' : 'optional');
  let brandAccessPolicy: BrandAccessPolicy = input.brandAccessPolicy
    ?? (brandMode === 'none' ? 'no_brand' : brandId ? 'specific_brand' : 'any_accessible');
  let requiresBrandForRun = input.requiresBrandForRun ?? (brandMode === 'locked');
  const fallbackBehavior: FallbackBehavior = input.fallbackBehavior ?? 'ask_or_continue';

  if (brandMode === 'none') {
    brandId = null;
    brandAccessPolicy = 'no_brand';
    requiresBrandForRun = false;
  }

  if (brandAccessPolicy === 'no_brand') {
    brandMode = 'none';
    brandId = null;
    requiresBrandForRun = false;
  }

  if ((brandMode === 'locked' || brandMode === 'suggested') && !brandId) {
    throw new Error(`brandId is required when brandMode is "${brandMode}"`);
  }

  if (brandAccessPolicy === 'specific_brand' && !brandId) {
    throw new Error('brandId is required when brandAccessPolicy is "specific_brand"');
  }

  if (brandMode === 'locked') {
    brandAccessPolicy = 'specific_brand';
    requiresBrandForRun = true;
  }

  if (brandMode === 'suggested' && brandAccessPolicy === 'no_brand') {
    brandAccessPolicy = brandId ? 'specific_brand' : 'any_accessible';
  }

  return {
    brandId,
    brandMode,
    brandAccessPolicy,
    requiresBrandForRun,
    fallbackBehavior,
  };
}
