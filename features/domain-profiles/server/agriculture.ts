import type { SkillRuntimeContext } from "@/features/skills/server/activation";

import type { ResolvedDomainContext } from "../types";

export const agricultureProfileDefinition = {
  domain: "agriculture",
  profileLabel: "Farm profile",
  setupQuestions: [
    { key: "province", label: "Province", required: true },
    { key: "district", label: "District", required: false },
    { key: "mainCrop", label: "Main crop", required: true },
    { key: "approximateArea", label: "Approximate area", required: false },
  ],
  entityTypes: {
    plot: {
      label: "Plot",
      fields: [
        "area",
        "locationText",
        "gpsPoint",
        "boundaryGeoJson",
        "soilType",
        "irrigation",
        "mainCrop",
        "notes",
      ],
    },
    crop_cycle: {
      label: "Crop cycle",
      fields: [
        "crop",
        "startDate",
        "expectedHarvestDate",
        "plotId",
        "notes",
      ],
    },
  },
} as const;

const AGRICULTURE_SKILL_HINTS = [
  "farm-record-keeper",
  "weather-farm-risk",
  "crop-market-advisor",
  "pest-disease-consult",
  "agriculture",
  "farmer",
  "farm",
  "crop",
];

const AGRICULTURE_MESSAGE_PATTERNS = [
  /\bfarm\b/i,
  /\bfarmer\b/i,
  /\bplot\b/i,
  /\bcrop\b/i,
  /\bharvest\b/i,
  /\bfertilizer\b/i,
  /\birrigation\b/i,
  /\bplant(?:ing)?\b/i,
  /\bgreenhouse\b/i,
  /rai/i,
  /tomato/i,
  /cassava/i,
  /rice/i,
  /corn/i,
  /maize/i,
  /orchard/i,
  /field/i,
  /farm/i,
];

function hasAgricultureSkill(runtime: SkillRuntimeContext): boolean {
  return runtime.activatedSkills.some((entry) => {
    const haystack = [
      entry.skill.name,
      entry.skill.description ?? "",
      entry.instructionPath ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return AGRICULTURE_SKILL_HINTS.some((hint) => haystack.includes(hint));
  });
}

function looksAgricultural(message: string | null): boolean {
  if (!message?.trim()) {
    return false;
  }

  return AGRICULTURE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function buildAgricultureSetupPromptBlock(input: {
  userMessage: string | null;
  context: ResolvedDomainContext | null;
  skillRuntime: SkillRuntimeContext;
}): string {
  const hasAgricultureContext = input.context?.profile.domain === "agriculture";
  if (hasAgricultureContext) {
    return "";
  }

  const shouldOfferSetup =
    hasAgricultureSkill(input.skillRuntime) || looksAgricultural(input.userMessage);
  if (!shouldOfferSetup) {
    return "";
  }

  const lines = [
    "<domain_setup_opportunity>",
    "Optional progressive setup is available for agriculture.",
    "Only offer this if it helps the current conversation.",
    "Do not force setup, a form, GPS, or boundary data before helping.",
    "Keep the conversation lightweight and ask only one or two missing questions at a time.",
    "Good first fields to capture: province, district, mainCrop, approximateArea, preferredUnits, waterSource, farmingMethod.",
    "Good entity examples:",
    '- plot: "Back field" with area, locationText, soilType, irrigation, mainCrop, optional gpsPoint, optional boundaryGeoJson',
    '- crop_cycle: "Tomato cycle May 2026" with crop, startDate, expectedHarvestDate, plotId',
    "If the farmer says facts like province, crop, area, or plot names, offer to remember them as a farm profile.",
    "When the user clearly confirms saving persistent data, use create_profile, update_profile, create_entity, or update_entity as appropriate.",
    "</domain_setup_opportunity>",
  ];

  return `\n\n${lines.join("\n")}`;
}
