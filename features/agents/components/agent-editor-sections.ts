import {
  BlocksIcon,
  BookOpenIcon,
  BotIcon,
  CpuIcon,
  Settings2Icon,
  ShieldIcon,
  type LucideIcon,
} from 'lucide-react';

export type AgentEditorSectionId = 'general' | 'behavior' | 'knowledge' | 'tools' | 'sharing' | 'model';

export type AgentEditorSection = {
  id: AgentEditorSectionId;
  icon: LucideIcon;
  label: string;
  description: string;
};

export const AGENT_EDITOR_SECTIONS: AgentEditorSection[] = [
  {
    id: 'general',
    icon: Settings2Icon,
    label: 'General',
    description: 'Basic information users see when selecting this agent.',
  },
  {
    id: 'behavior',
    icon: BotIcon,
    label: 'AI Behavior',
    description: 'Configure how this agent should respond and what instructions it follows.',
  },
  {
    id: 'knowledge',
    icon: BookOpenIcon,
    label: 'Knowledge',
    description: 'Attach brand context, skills, and documents this agent can rely on.',
  },
  {
    id: 'tools',
    icon: BlocksIcon,
    label: 'Tools',
    description: 'Choose which capabilities this agent is allowed to use.',
  },
  {
    id: 'sharing',
    icon: ShieldIcon,
    label: 'Sharing',
    description: 'Control who can access this agent and how it is shared.',
  },
  {
    id: 'model',
    icon: CpuIcon,
    label: 'Model',
    description: 'Choose which model this agent should prefer when responding.',
  },
];
