import type { ToolManifest } from "@/features/tools/registry/types";

export const domainProfilesManifest: ToolManifest = {
  id: "domain_profiles",
  slug: "domain-profiles",
  title: "Domain Profiles",
  description:
    "Store and retrieve structured professional context such as farm profiles, plots, classes, students, patients, clients, deals, and other domain entities.",
  icon: "Folders",
  category: "utilities",
  professions: ["all", "teacher", "marketer", "developer", "business", "minimal"],
  supportsAgent: true,
  supportsSidebar: false,
  supportsExport: false,
  defaultEnabled: false,
  access: {
    requiresAuth: true,
    enabled: true,
  },
};
