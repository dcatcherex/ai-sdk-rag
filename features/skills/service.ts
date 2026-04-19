export {
  getSkills,
  getSkillsByIds,
  getResolvedSkillIdsByAgentIds,
  getSkillById,
  getSkillFiles,
  getSkillFileContent,
} from './server/queries';

export {
  getSkillAttachmentsForAgent,
  getSkillsForAgent,
  replaceSkillAttachmentsForAgent,
} from './server/attachments';

export {
  createSkill,
  updateSkill,
  deleteSkill,
  installSkill,
  importSkillFromUrl,
  importSkillFromLocalPath,
} from './server/mutations';

export {
  SkillFileMutationError,
  createSkillFile,
  updateSkillFileContent,
  deleteSkillFile,
} from './server/file-mutations';

export {
  buildAvailableSkillsCatalog,
  detectTriggeredSkills,
  buildActiveSkillsBlock,
  resolveActivatedSkills,
  resolveSkillRuntimeContext,
  selectModelDiscoveredSkills,
} from './server/activation';

export {
  getResolvedSkillResourcesForPrompt,
} from './server/resources';

export {
  applySkillSync,
  checkSkillSync,
} from './server/sync';

export {
  calculateChangedFilePaths,
} from './server/sync-shared';

export {
  getSkillCatalog,
  listAdminSkillTemplates,
  getAdminSkillTemplateById,
  createAdminSkillTemplate,
  updateAdminSkillTemplate,
  publishAdminSkillTemplate,
  archiveAdminSkillTemplate,
  usePublishedSkillTemplate,
} from './server/catalog';
