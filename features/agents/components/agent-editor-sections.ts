import {
  BlocksIcon,
  BookOpenIcon,
  BotIcon,
  EyeIcon,
  PlugIcon,
  Settings2Icon,
  ShieldIcon,
  SparklesIcon,
  type LucideIcon,
} from 'lucide-react';

export type AgentEditorSectionId = 'general' | 'behavior' | 'skills' | 'knowledge' | 'tools' | 'mcp' | 'sharing' | 'preview';

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
    description: 'Configure the system prompt, brand voice, and how this agent responds.',
  },
  {
    id: 'skills',
    icon: SparklesIcon,
    label: 'Skills',
    description: 'Attach domain skills that activate contextually to give this agent specialized expertise.',
  },
  {
    id: 'knowledge',
    icon: BookOpenIcon,
    label: 'Knowledge',
    description: 'Attach reference documents this agent retrieves automatically when relevant.',
  },
  {
    id: 'tools',
    icon: BlocksIcon,
    label: 'Tools',
    description: 'Choose which capabilities this agent is allowed to use.',
  },
  {
    id: 'mcp',
    icon: PlugIcon,
    label: 'MCP Servers',
    description: 'Connect external MCP servers to give this agent access to additional tools and live data.',
  },
  {
    id: 'sharing',
    icon: ShieldIcon,
    label: 'Sharing',
    description: 'Control who can access this agent and how it is shared.',
  },
  {
    id: 'preview',
    icon: EyeIcon,
    label: 'Preview Prompt',
    description: 'See the fully assembled system prompt the model receives, including injected skills and context blocks.',
  },
];
