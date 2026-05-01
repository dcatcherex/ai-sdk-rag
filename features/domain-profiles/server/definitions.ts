export type DomainSetupQuestion = {
  key: string;
  label: string;
  required: boolean;
};

export type DomainEntityDefinition = {
  label: string;
  fields: string[];
  exampleName: string;
  exampleSummary: string;
};

export type DomainProfileDefinition = {
  domain: string;
  profileLabel: string;
  setupQuestions: DomainSetupQuestion[];
  profileFieldHints: string[];
  entityTypes: Record<string, DomainEntityDefinition>;
  setupPrompt: string;
  optionalityNote: string;
  skillHints: string[];
  messagePatterns: RegExp[];
};

export const agricultureProfileDefinition: DomainProfileDefinition = {
  domain: "agriculture",
  profileLabel: "Farm profile",
  setupQuestions: [
    { key: "province", label: "Province", required: true },
    { key: "district", label: "District", required: false },
    { key: "mainCrop", label: "Main crop", required: true },
    { key: "approximateArea", label: "Approximate area", required: false },
  ],
  profileFieldHints: [
    "province",
    "district",
    "mainCrop",
    "approximateArea",
    "preferredUnits",
    "waterSource",
    "farmingMethod",
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
      exampleName: "Back field",
      exampleSummary:
        'plot: "Back field" with area, locationText, soilType, irrigation, mainCrop, optional gpsPoint, optional boundaryGeoJson',
    },
    crop_cycle: {
      label: "Crop cycle",
      fields: ["crop", "startDate", "expectedHarvestDate", "plotId", "notes"],
      exampleName: "Tomato cycle May 2026",
      exampleSummary:
        'crop_cycle: "Tomato cycle May 2026" with crop, startDate, expectedHarvestDate, plotId',
    },
  },
  setupPrompt:
    "If the farmer says facts like province, crop, area, or plot names, offer to remember them as a farm profile.",
  optionalityNote:
    "Do not force setup, a form, GPS, or boundary data before helping.",
  skillHints: [
    "farm-record-keeper",
    "weather-farm-risk",
    "crop-market-advisor",
    "pest-disease-consult",
    "agriculture",
    "farmer",
    "farm",
    "crop",
  ],
  messagePatterns: [
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
  ],
};

export const educationProfileDefinition: DomainProfileDefinition = {
  domain: "education",
  profileLabel: "Class profile",
  setupQuestions: [
    { key: "school", label: "School", required: true },
    { key: "grade", label: "Grade", required: true },
    { key: "subject", label: "Subject", required: true },
    { key: "className", label: "Class name", required: false },
  ],
  profileFieldHints: [
    "school",
    "grade",
    "subject",
    "className",
    "studentCount",
    "schedule",
    "language",
  ],
  entityTypes: {
    class: {
      label: "Class",
      fields: ["grade", "subject", "studentCount", "schedule", "notes"],
      exampleName: "M2/1",
      exampleSummary:
        'class: "M2/1" with grade, subject, studentCount, schedule',
    },
    student: {
      label: "Student",
      fields: ["studentCode", "supportNeeds", "goals", "notes"],
      exampleName: "Student A",
      exampleSummary:
        'student: "Student A" with studentCode, supportNeeds, goals',
    },
    assessment: {
      label: "Assessment",
      fields: ["topic", "date", "weight", "classId", "notes"],
      exampleName: "Photosynthesis quiz",
      exampleSummary:
        'assessment: "Photosynthesis quiz" with topic, date, weight, classId',
    },
  },
  setupPrompt:
    "If the teacher shares school, grade, subject, class names, or student groups, offer to remember them as structured classroom context.",
  optionalityNote:
    "Do not force roster uploads or full student lists before helping with the current teaching task.",
  skillHints: [
    "education",
    "classroom-profile-setup",
    "teacher",
    "lesson",
    "exam",
    "quiz",
    "class",
  ],
  messagePatterns: [
    /\bteacher\b/i,
    /\bclass(room)?\b/i,
    /\bstudent\b/i,
    /\bgrade\b/i,
    /\bsubject\b/i,
    /\blesson\b/i,
    /\bquiz\b/i,
    /\bexam\b/i,
    /\bschool\b/i,
    /\bhomework\b/i,
  ],
};

export const clinicProfileDefinition: DomainProfileDefinition = {
  domain: "clinic",
  profileLabel: "Clinic profile",
  setupQuestions: [
    { key: "clinicName", label: "Clinic or facility", required: true },
    { key: "specialty", label: "Specialty", required: true },
    { key: "visitType", label: "Visit type", required: false },
    { key: "communicationConstraints", label: "Communication constraints", required: false },
  ],
  profileFieldHints: [
    "clinicName",
    "specialty",
    "visitType",
    "communicationConstraints",
    "followUpPolicy",
    "locale",
  ],
  entityTypes: {
    patient: {
      label: "Patient",
      fields: ["patientCode", "concern", "riskFlags", "notes"],
      exampleName: "Patient code P-102",
      exampleSummary:
        'patient: "Patient code P-102" with patientCode, concern, riskFlags',
    },
    visit: {
      label: "Visit",
      fields: ["visitDate", "visitType", "patientId", "followUpDate", "notes"],
      exampleName: "Follow-up visit",
      exampleSummary:
        'visit: "Follow-up visit" with visitDate, visitType, patientId, followUpDate',
    },
    care_note: {
      label: "Care note",
      fields: ["patientId", "summary", "nextAction", "notes"],
      exampleName: "Diabetes education note",
      exampleSummary:
        'care_note: "Diabetes education note" with patientId, summary, nextAction',
    },
  },
  setupPrompt:
    "If the user shares specialty, patient codes, visit types, or follow-up constraints, offer to remember them as structured clinic context.",
  optionalityNote:
    "Do not force full patient intake or sensitive personal data collection before helping. Keep identifiers lightweight.",
  skillHints: [
    "clinic",
    "patient-care-context",
    "patient",
    "visit",
    "medical",
    "follow-up",
  ],
  messagePatterns: [
    /\bclinic\b/i,
    /\bpatient\b/i,
    /\bvisit\b/i,
    /\bfollow-up\b/i,
    /\bmedical\b/i,
    /\bcare\b/i,
    /\bsymptom\b/i,
    /\btreatment\b/i,
  ],
};

export const salesProfileDefinition: DomainProfileDefinition = {
  domain: "sales",
  profileLabel: "Sales pipeline profile",
  setupQuestions: [
    { key: "industry", label: "Industry", required: true },
    { key: "region", label: "Region", required: false },
    { key: "salesCycle", label: "Sales cycle", required: false },
    { key: "primaryGoal", label: "Primary goal", required: false },
  ],
  profileFieldHints: [
    "industry",
    "region",
    "salesCycle",
    "primaryGoal",
    "nextActionStyle",
    "preferredChannel",
  ],
  entityTypes: {
    client: {
      label: "Client",
      fields: ["industry", "contactName", "contactChannel", "notes"],
      exampleName: "ABC Foods",
      exampleSummary:
        'client: "ABC Foods" with industry, contactName, contactChannel',
    },
    deal: {
      label: "Deal",
      fields: ["stage", "value", "clientId", "nextAction", "closeDate"],
      exampleName: "POS rollout",
      exampleSummary:
        'deal: "POS rollout" with stage, value, clientId, nextAction, closeDate',
    },
    contact: {
      label: "Contact",
      fields: ["role", "channel", "clientId", "notes"],
      exampleName: "Procurement lead",
      exampleSummary:
        'contact: "Procurement lead" with role, channel, clientId',
    },
  },
  setupPrompt:
    "If the user shares industry, client names, deal stages, or next steps, offer to remember them as structured sales context.",
  optionalityNote:
    "Do not force CRM-style setup before helping draft messages, quotes, or follow-ups.",
  skillHints: [
    "sales",
    "pipeline-profile-setup",
    "deal",
    "client",
    "lead",
    "outreach",
  ],
  messagePatterns: [
    /\bsales\b/i,
    /\bclient\b/i,
    /\bdeal\b/i,
    /\blead\b/i,
    /\bpipeline\b/i,
    /\bquotation\b/i,
    /\bproposal\b/i,
    /\bfollow-up\b/i,
    /\boutreach\b/i,
  ],
};

export const creatorProfileDefinition: DomainProfileDefinition = {
  domain: "creator",
  profileLabel: "Creator workspace profile",
  setupQuestions: [
    { key: "brand", label: "Brand or channel", required: true },
    { key: "audience", label: "Audience", required: true },
    { key: "platforms", label: "Platforms", required: false },
    { key: "contentPillars", label: "Content pillars", required: false },
  ],
  profileFieldHints: [
    "brand",
    "audience",
    "platforms",
    "contentPillars",
    "voice",
    "cadence",
  ],
  entityTypes: {
    campaign: {
      label: "Campaign",
      fields: ["objective", "platform", "deadline", "notes"],
      exampleName: "May product launch",
      exampleSummary:
        'campaign: "May product launch" with objective, platform, deadline',
    },
    content_series: {
      label: "Content series",
      fields: ["pillar", "format", "platform", "notes"],
      exampleName: "Weekly creator diary",
      exampleSummary:
        'content_series: "Weekly creator diary" with pillar, format, platform',
    },
    sponsor: {
      label: "Sponsor",
      fields: ["brand", "deliverables", "deadline", "notes"],
      exampleName: "Skincare sponsor",
      exampleSummary:
        'sponsor: "Skincare sponsor" with brand, deliverables, deadline',
    },
  },
  setupPrompt:
    "If the user shares channel brand, audience, platforms, or content pillars, offer to remember them as a creator workspace profile.",
  optionalityNote:
    "Do not force a full brand questionnaire before helping with the current content task.",
  skillHints: [
    "creator",
    "content-workspace-context",
    "audience",
    "platform",
    "content pillar",
    "campaign",
  ],
  messagePatterns: [
    /\bcreator\b/i,
    /\baudience\b/i,
    /\bcontent\b/i,
    /\bplatform\b/i,
    /\byoutube\b/i,
    /\btiktok\b/i,
    /\binstagram\b/i,
    /\breel\b/i,
    /\bcampaign\b/i,
  ],
};

export const DOMAIN_PROFILE_DEFINITIONS: DomainProfileDefinition[] = [
  agricultureProfileDefinition,
  educationProfileDefinition,
  clinicProfileDefinition,
  salesProfileDefinition,
  creatorProfileDefinition,
];

export const DOMAIN_PROFILE_DEFINITION_MAP = Object.fromEntries(
  DOMAIN_PROFILE_DEFINITIONS.map((definition) => [definition.domain, definition]),
) as Record<string, DomainProfileDefinition>;
