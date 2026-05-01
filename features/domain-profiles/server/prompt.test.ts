import assert from "node:assert/strict";
import test from "node:test";

import { renderDomainContextPromptBlock } from "./prompt";

test("renderDomainContextPromptBlock formats compact profile and entity context", () => {
  const block = renderDomainContextPromptBlock({
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
      data: {
        province: "Chiang Mai",
        mainCrop: "tomato",
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    entities: [
      {
        id: "entity-1",
        profileId: "profile-1",
        entityType: "plot",
        name: "Back field",
        description: null,
        status: "active",
        data: {
          area: { value: 2, unit: "rai" },
          mainCrop: "tomato",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  });

  assert.match(block, /<domain_context>/);
  assert.match(block, /Profile: Somchai Farm/);
  assert.match(block, /Domain: agriculture/);
  assert.match(block, /- province: Chiang Mai/);
  assert.match(block, /- mainCrop: tomato/);
  assert.match(block, /- plot: Back field/);
});
