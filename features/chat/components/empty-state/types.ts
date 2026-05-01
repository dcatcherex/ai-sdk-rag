export type AgentStarterTaskIcon =
  | 'calendar'
  | 'chart'
  | 'edit'
  | 'mail'
  | 'message'
  | 'refresh'
  | 'search'
  | 'sparkles';

export type AgentStarterTask = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  icon: AgentStarterTaskIcon;
  priority: 'primary' | 'secondary';
};

export type AgentStarterTaskDraft = AgentStarterTask;
