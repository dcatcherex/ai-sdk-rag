import assert from "node:assert/strict";
import test from "node:test";

import type { SkillRuntimeContext } from "@/features/skills/server/activation";
import type { Skill } from "@/features/skills/types";

import {
  agricultureProfileDefinition,
  creatorProfileDefinition,
  educationProfileDefinition,
} from "./definitions";
import { buildDomainSetupPromptBlock } from "./setup";

const emptySkillRuntime: SkillRuntimeContext = {
  catalogBlock: "",
  activatedSkills: [],
  activeSkillsBlock: "",
  skillResourcesBlock: "",
  skillToolIds: [],
};

function createPackageSkill(overrides: Partial<Skill> = {}): Skill {
  const now = new Date();

  return {
    id: "skill-1",
    userId: null,
    name: "content-workspace-context",
    category: "marketing",
    description: "Capture audience, platforms, and content pillars",
    triggerType: "keyword",
    trigger: null,
    promptFragment: "",
    enabledTools: ["domain_profiles"],
    sourceUrl: null,
    sourceId: null,
    skillKind: "package",
    activationMode: "model",
    entryFilePath: "SKILL.md",
    installedRef: null,
    installedCommitSha: null,
    upstreamCommitSha: null,
    syncStatus: "local",
    pinnedToInstalledVersion: false,
    hasBundledFiles: true,
    packageManifest: null,
    lastSyncCheckedAt: null,
    lastSyncedAt: null,
    imageUrl: null,
    isPublic: false,
    isTemplate: false,
    templateId: null,
    catalogScope: "personal",
    catalogStatus: "draft",
    managedByAdmin: false,
    cloneBehavior: "editable_copy",
    updatePolicy: "none",
    lockedFields: [],
    version: 1,
    sourceTemplateVersion: null,
    publishedAt: null,
    archivedAt: null,
    changelog: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("domain definitions preserve lightweight agriculture and education setup", () => {
  assert.equal(agricultureProfileDefinition.domain, "agriculture");
  assert.equal(agricultureProfileDefinition.setupQuestions[0]?.key, "province");
  assert.ok(agricultureProfileDefinition.entityTypes.plot.fields.includes("gpsPoint"));
  assert.ok(agricultureProfileDefinition.entityTypes.plot.fields.includes("boundaryGeoJson"));

  assert.equal(educationProfileDefinition.domain, "education");
  assert.equal(educationProfileDefinition.setupQuestions[0]?.key, "school");
  assert.ok(educationProfileDefinition.entityTypes.class.fields.includes("studentCount"));
});

test("buildDomainSetupPromptBlock suggests agriculture setup from farming context", () => {
  const block = buildDomainSetupPromptBlock({
    userMessage: "I grow tomato on two rai and have a back field plot",
    context: null,
    skillRuntime: emptySkillRuntime,
  });

  assert.match(block, /<domain_setup_opportunity>/);
  assert.match(block, /Optional progressive setup is available for agriculture/);
  assert.match(block, /province, district, mainCrop, approximateArea/);
  assert.match(block, /crop_cycle: "Tomato cycle May 2026"/);
});

test("buildDomainSetupPromptBlock suggests education setup from classroom context", () => {
  const block = buildDomainSetupPromptBlock({
    userMessage: "I teach grade 8 science and need lesson ideas for class M2/1",
    context: null,
    skillRuntime: emptySkillRuntime,
  });

  assert.match(block, /Optional progressive setup is available for education/);
  assert.match(block, /school, grade, subject, className, studentCount, schedule, language/);
  assert.match(block, /class: "M2\/1"/);
  assert.match(block, /student: "Student A"/);
});

test("buildDomainSetupPromptBlock can select creator setup from activated skill hints", () => {
  const block = buildDomainSetupPromptBlock({
    userMessage: "Help me plan posts for next month",
    context: null,
    skillRuntime: {
      ...emptySkillRuntime,
      activatedSkills: [
        {
          activationSource: "model",
          instructionContent: "creator workspace setup",
          instructionPath: "features/skills/packages/creator/content-workspace-context/SKILL.md",
          responseContracts: [],
          skill: createPackageSkill(),
        },
      ],
    },
  });

  assert.match(block, /Optional progressive setup is available for creator/);
  assert.match(block, new RegExp(creatorProfileDefinition.entityTypes.campaign.exampleName));
});

test("buildDomainSetupPromptBlock stays quiet when domain context already exists", () => {
  const block = buildDomainSetupPromptBlock({
    userMessage: "I planted tomato today",
    context: {
      profile: {
        id: "profile-1",
        userId: "user-1",
        lineUserId: null,
        channelId: null,
        brandId: null,
        domain: "agriculture",
        name: "Somchai Farm",
        description: null,
        locale: "th-TH",
        status: "active",
        data: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      entities: [],
    },
    skillRuntime: emptySkillRuntime,
  });

  assert.equal(block, "");
});
