import assert from "node:assert/strict";
import test from "node:test";

import type { SkillRuntimeContext } from "@/features/skills/server/activation";

import {
  agricultureProfileDefinition,
  buildAgricultureSetupPromptBlock,
} from "./agriculture";

const emptySkillRuntime: SkillRuntimeContext = {
  catalogBlock: "",
  activatedSkills: [],
  activeSkillsBlock: "",
  skillResourcesBlock: "",
  skillToolIds: [],
};

test("agricultureProfileDefinition keeps setup lightweight and optional", () => {
  assert.equal(agricultureProfileDefinition.domain, "agriculture");
  assert.equal(agricultureProfileDefinition.setupQuestions[0]?.key, "province");
  assert.ok(agricultureProfileDefinition.entityTypes.plot.fields.includes("gpsPoint"));
  assert.ok(agricultureProfileDefinition.entityTypes.plot.fields.includes("boundaryGeoJson"));
});

test("buildAgricultureSetupPromptBlock suggests progressive setup when farming context appears", () => {
  const block = buildAgricultureSetupPromptBlock({
    userMessage: "I grow tomato on two rai and have a back field plot",
    context: null,
    skillRuntime: emptySkillRuntime,
  });

  assert.match(block, /<domain_setup_opportunity>/);
  assert.match(block, /province, district, mainCrop, approximateArea/);
  assert.match(block, /plot: "Back field"/);
  assert.match(block, /optional gpsPoint, optional boundaryGeoJson/);
});

test("buildAgricultureSetupPromptBlock stays quiet when agriculture context already exists", () => {
  const block = buildAgricultureSetupPromptBlock({
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
