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
