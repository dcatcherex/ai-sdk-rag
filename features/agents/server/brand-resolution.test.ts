import assert from 'node:assert/strict';
import test from 'node:test';

import type { Brand } from '@/features/brands/types';
import { resolveEffectiveBrand } from './brand-resolution';

const makeBrand = (overrides: Partial<Brand> & Pick<Brand, 'id' | 'name'>): Brand => ({
  id: overrides.id,
  userId: overrides.userId ?? 'user-1',
  name: overrides.name,
  overview: overrides.overview ?? null,
  websiteUrl: overrides.websiteUrl ?? null,
  industry: overrides.industry ?? null,
  productsServices: overrides.productsServices ?? null,
  targetAudience: overrides.targetAudience ?? null,
  toneOfVoice: overrides.toneOfVoice ?? [],
  brandValues: overrides.brandValues ?? [],
  voiceExamples: overrides.voiceExamples ?? [],
  forbiddenPhrases: overrides.forbiddenPhrases ?? [],
  visualAesthetics: overrides.visualAesthetics ?? [],
  fonts: overrides.fonts ?? [],
  colors: overrides.colors ?? [],
  colorNotes: overrides.colorNotes ?? null,
  styleReferenceMode: overrides.styleReferenceMode ?? 'direct',
  styleDescription: overrides.styleDescription ?? null,
  writingDos: overrides.writingDos ?? null,
  writingDonts: overrides.writingDonts ?? null,
  usp: overrides.usp ?? null,
  priceRange: overrides.priceRange ?? null,
  keywords: overrides.keywords ?? [],
  platforms: overrides.platforms ?? [],
  promotionStyle: overrides.promotionStyle ?? null,
  competitors: overrides.competitors ?? [],
  customerPainPoints: overrides.customerPainPoints ?? [],
  positioningStatement: overrides.positioningStatement ?? null,
  messagingPillars: overrides.messagingPillars ?? [],
  proofPoints: overrides.proofPoints ?? [],
  exampleHeadlines: overrides.exampleHeadlines ?? [],
  exampleRejections: overrides.exampleRejections ?? [],
  isDefault: overrides.isDefault ?? false,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
  isOwner: overrides.isOwner,
  sharedWith: overrides.sharedWith,
});

const primaryBrand = makeBrand({ id: 'brand-primary', name: 'Primary Brand' });
const defaultBrand = makeBrand({ id: 'brand-default', name: 'Default Brand', isDefault: true });

const makeDeps = (brands: Brand[]) => ({
  getBrand: async (_userId: string, brandId: string) => brands.find((entry) => entry.id === brandId) ?? null,
  getBrands: async (_userId: string) => brands,
  hasWorkspaceAccess: async (_userId: string, brandId: string) => brands.some((entry) => entry.id === brandId),
});

test('uses active brand when no agent is provided', async () => {
  const result = await resolveEffectiveBrand(
    {
      userId: 'user-1',
      activeBrandId: primaryBrand.id,
      agent: null,
    },
    makeDeps([primaryBrand]),
  );

  assert.equal(result.effectiveBrandId, primaryBrand.id);
  assert.equal(result.reason, 'used_active_brand');
  assert.equal(result.shouldBlock, false);
});

test('none mode ignores active and bound brands', async () => {
  const result = await resolveEffectiveBrand(
    {
      userId: 'user-1',
      activeBrandId: primaryBrand.id,
      agent: {
        brandId: defaultBrand.id,
        brandMode: 'none',
        brandAccessPolicy: 'no_brand',
        requiresBrandForRun: false,
        fallbackBehavior: 'ask_or_continue',
      },
    },
    makeDeps([primaryBrand, defaultBrand]),
  );

  assert.equal(result.effectiveBrandId, null);
  assert.equal(result.reason, 'agent_none');
  assert.equal(result.mode, 'none');
});

test('suggested mode prefers active brand override before bound brand', async () => {
  const result = await resolveEffectiveBrand(
    {
      userId: 'user-1',
      activeBrandId: primaryBrand.id,
      agent: {
        brandId: defaultBrand.id,
        brandMode: 'suggested',
        brandAccessPolicy: 'specific_brand',
        requiresBrandForRun: false,
        fallbackBehavior: 'ask_or_continue',
      },
    },
    makeDeps([primaryBrand, defaultBrand]),
  );

  assert.equal(result.effectiveBrandId, primaryBrand.id);
  assert.equal(result.reason, 'used_active_brand');
  assert.equal(result.canOverride, true);
});

test('locked mode falls back to default brand when configured', async () => {
  const result = await resolveEffectiveBrand(
    {
      userId: 'user-1',
      activeBrandId: primaryBrand.id,
      agent: {
        brandId: 'missing-brand',
        brandMode: 'locked',
        brandAccessPolicy: 'specific_brand',
        requiresBrandForRun: true,
        fallbackBehavior: 'use_default',
      },
    },
    makeDeps([primaryBrand, defaultBrand]),
  );

  assert.equal(result.effectiveBrandId, defaultBrand.id);
  assert.equal(result.reason, 'used_default_brand');
  assert.equal(result.shouldBlock, false);
});

test('optional mode with ask_to_select returns prompt instruction', async () => {
  const result = await resolveEffectiveBrand(
    {
      userId: 'user-1',
      activeBrandId: null,
      agent: {
        brandId: null,
        brandMode: 'optional',
        brandAccessPolicy: 'any_accessible',
        requiresBrandForRun: false,
        fallbackBehavior: 'ask_to_select',
      },
    },
    makeDeps([]),
  );

  assert.equal(result.effectiveBrandId, null);
  assert.equal(result.reason, 'prompt_to_select_brand');
  assert.match(result.promptInstruction ?? '', /select a brand/i);
});

test('locked mode blocks when required brand is inaccessible and fallback is block_run', async () => {
  const result = await resolveEffectiveBrand(
    {
      userId: 'user-1',
      activeBrandId: primaryBrand.id,
      agent: {
        brandId: 'missing-brand',
        brandMode: 'locked',
        brandAccessPolicy: 'specific_brand',
        requiresBrandForRun: true,
        fallbackBehavior: 'block_run',
      },
    },
    makeDeps([primaryBrand]),
  );

  assert.equal(result.effectiveBrandId, null);
  assert.equal(result.shouldBlock, true);
  assert.equal(result.reason, 'blocked_missing_required_brand');
});

test('workspace_only ignores active shared-only brand and falls back to workspace default', async () => {
  const sharedOnlyBrand = makeBrand({ id: 'brand-shared', name: 'Shared Only Brand', isDefault: true });
  const workspaceBrand = makeBrand({ id: 'brand-workspace', name: 'Workspace Brand' });
  const deps = {
    getBrand: async (_userId: string, brandId: string) =>
      [sharedOnlyBrand, workspaceBrand].find((entry) => entry.id === brandId) ?? null,
    getBrands: async (_userId: string) => [sharedOnlyBrand, workspaceBrand],
    hasWorkspaceAccess: async (_userId: string, brandId: string) => brandId === workspaceBrand.id,
  };

  const result = await resolveEffectiveBrand(
    {
      userId: 'user-1',
      activeBrandId: sharedOnlyBrand.id,
      agent: {
        brandId: null,
        brandMode: 'optional',
        brandAccessPolicy: 'workspace_only',
        requiresBrandForRun: false,
        fallbackBehavior: 'use_default',
      },
    },
    deps,
  );

  assert.equal(result.effectiveBrandId, workspaceBrand.id);
  assert.equal(result.reason, 'used_default_brand');
});

test('workspace_only suggested brand falls back when bound brand is not in workspace', async () => {
  const sharedOnlyBrand = makeBrand({ id: 'brand-shared', name: 'Shared Only Brand' });
  const deps = {
    getBrand: async (_userId: string, brandId: string) =>
      brandId === sharedOnlyBrand.id ? sharedOnlyBrand : null,
    getBrands: async (_userId: string) => [sharedOnlyBrand],
    hasWorkspaceAccess: async () => false,
  };

  const result = await resolveEffectiveBrand(
    {
      userId: 'user-1',
      activeBrandId: null,
      agent: {
        brandId: sharedOnlyBrand.id,
        brandMode: 'suggested',
        brandAccessPolicy: 'workspace_only',
        requiresBrandForRun: false,
        fallbackBehavior: 'ask_to_select',
      },
    },
    deps,
  );

  assert.equal(result.effectiveBrandId, null);
  assert.equal(result.reason, 'prompt_to_select_brand');
});
