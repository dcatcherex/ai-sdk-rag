import type { AgentRunPolicy } from './run-types';

export const WEB_AGENT_RUN_POLICY: AgentRunPolicy = {
  maxSteps: 5,
  allowTools: true,
  allowMcp: true,
  allowMemoryRead: true,
  allowMemoryWrite: true,
  allowPromptEnhancement: true,
  allowDirectImageGeneration: true,
  allowDirectVideoGeneration: false,
  responseFormat: 'ui_stream',
};

export const SHARED_LINK_AGENT_RUN_POLICY: AgentRunPolicy = {
  maxSteps: 5,
  allowTools: true,
  allowMcp: false,
  allowMemoryRead: false,
  allowMemoryWrite: false,
  allowPromptEnhancement: false,
  allowDirectImageGeneration: true,
  allowDirectVideoGeneration: false,
  responseFormat: 'ui_stream',
};

export const LINE_AGENT_RUN_POLICY: AgentRunPolicy = {
  maxSteps: 5,
  allowTools: true,
  allowMcp: false,
  allowMemoryRead: true,
  allowMemoryWrite: true,
  allowPromptEnhancement: false,
  allowDirectImageGeneration: true,
  allowDirectVideoGeneration: true,
  responseFormat: 'plain_text',
};
