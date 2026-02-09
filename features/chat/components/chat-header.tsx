'use client';

import Link from 'next/link';
import {
  BookOpenIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileTextIcon,
  LogOutIcon,
  MenuIcon,
  SparklesIcon,
  Trash2Icon,
  UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@/components/ai-elements/model-selector';
import { TokenUsageDisplay } from '@/components/token-usage-display';
import { CreditBalanceDisplay } from '@/components/credit-balance-display';
import { availableModels } from '@/lib/ai';
import type { ModelOption } from '@/lib/ai';
import type { ChatStatus } from 'ai';
import type { ThreadItem, RoutingMetadata } from '../types';

type UserProfileData = {
  displayName: string;
  email: string;
  initials: string;
  image: string;
};

type SessionData = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
} | null;

type ChatHeaderProps = {
  activeThread: ThreadItem | undefined;
  status: ChatStatus;
  // User
  sessionData: SessionData;
  userProfile: UserProfileData;
  isSigningOut: boolean;
  onSignOut: () => void;
  // Model selector
  currentModel: ModelOption;
  selectedModel: string;
  selectorModels: ModelOption[];
  modelSelectorOpen: boolean;
  enabledModelsOpen: boolean;
  enabledModelIds: string[];
  onModelSelectorOpenChange: (open: boolean) => void;
  onEnabledModelsOpenChange: (open: boolean) => void;
  onSelectModel: (modelId: string) => void;
  onToggleModel: (modelId: string) => void;
  // Routing
  lastRouting: RoutingMetadata | null;
  lastRoutingModel: ModelOption | undefined;
  // Actions
  onDeleteThread: (threadId: string) => void;
  isDeleting: boolean;
  onExport: (format: 'json' | 'markdown') => void;
  // Knowledge
  knowledgePanelOpen: boolean;
  onToggleKnowledgePanel: () => void;
  docCount: number;
  onOpenMobileSidebar?: () => void;
};

export const ChatHeader = ({
  activeThread,
  status,
  sessionData,
  userProfile,
  isSigningOut,
  onSignOut,
  currentModel,
  selectedModel,
  selectorModels,
  modelSelectorOpen,
  enabledModelsOpen,
  enabledModelIds,
  onModelSelectorOpenChange,
  onEnabledModelsOpenChange,
  onSelectModel,
  onToggleModel,
  lastRouting,
  lastRoutingModel,
  onDeleteThread,
  isDeleting,
  onExport,
  knowledgePanelOpen,
  onToggleKnowledgePanel,
  docCount,
  onOpenMobileSidebar,
}: ChatHeaderProps) => (
  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 px-3 py-3 md:gap-3 md:px-6 md:py-4">
    <div className="flex items-center gap-2">
      {/* Mobile hamburger */}
      <Button
        size="icon"
        variant="ghost"
        className="md:hidden"
        onClick={onOpenMobileSidebar}
      >
        <MenuIcon className="size-5" />
      </Button>
      <div className="min-w-0">
        <p className="hidden text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground sm:block">
          {activeThread ? 'Selected thread' : 'New conversation'}
        </p>
        <h2 className="truncate text-base font-semibold text-foreground md:text-lg">
          {activeThread?.title ?? 'New chat'}
        </h2>
      </div>
    </div>
    <div className="flex items-center gap-1.5 md:gap-3">
      <Button variant="outline" size="sm" className="hidden sm:inline-flex" asChild>
        <Link href="/gallery">Media gallery</Link>
      </Button>

      <UserMenu
        sessionData={sessionData}
        userProfile={userProfile}
        isSigningOut={isSigningOut}
        onSignOut={onSignOut}
      />

      <ModelSelectorDropdown
        currentModel={currentModel}
        selectedModel={selectedModel}
        selectorModels={selectorModels}
        modelSelectorOpen={modelSelectorOpen}
        enabledModelsOpen={enabledModelsOpen}
        enabledModelIds={enabledModelIds}
        onModelSelectorOpenChange={onModelSelectorOpenChange}
        onEnabledModelsOpenChange={onEnabledModelsOpenChange}
        onSelectModel={onSelectModel}
        onToggleModel={onToggleModel}
      />

      {selectedModel === 'auto' && lastRouting ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="hidden gap-1 text-xs sm:inline-flex">
                Auto → {lastRoutingModel?.name ?? lastRouting.modelId}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">{lastRouting.reason}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}

      <span className="hidden sm:inline-flex"><CreditBalanceDisplay /></span>

      {activeThread && <span className="hidden lg:inline-flex"><TokenUsageDisplay threadId={activeThread.id} /></span>}

      <div className="flex items-center gap-1 text-xs text-muted-foreground md:gap-2">
        {activeThread && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8 md:size-9">
                  <DownloadIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onExport('json')}>
                  <FileTextIcon className="mr-2 size-4" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('markdown')}>
                  <FileTextIcon className="mr-2 size-4" />
                  Export as Markdown
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 md:size-9"
                    onClick={() => onDeleteThread(activeThread.id)}
                    disabled={isDeleting}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete thread</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={knowledgePanelOpen ? 'default' : 'ghost'}
                onClick={onToggleKnowledgePanel}
                className="relative size-8 md:size-9"
              >
                <BookOpenIcon className="size-4" />
                {docCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1.5 -right-1.5 size-4 justify-center p-0 text-[9px]"
                  >
                    {docCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Knowledge base</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className="hidden sm:inline">
          {status === 'streaming'
            ? 'Streaming'
            : status === 'submitted'
              ? 'Thinking'
              : 'Ready'}
        </span>
      </div>
    </div>
  </div>
);

// --- Sub-components ---

type UserMenuProps = {
  sessionData: SessionData;
  userProfile: UserProfileData;
  isSigningOut: boolean;
  onSignOut: () => void;
};

const UserMenu = ({ sessionData, userProfile, isSigningOut, onSignOut }: UserMenuProps) => {
  if (!sessionData?.user) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/sign-in">
          <UserIcon className="mr-2 size-4" />
          Sign in
        </Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full border border-black/5 bg-white/80"
        >
          <Avatar size="sm">
            {userProfile.image ? (
              <AvatarImage src={userProfile.image} alt={userProfile.displayName} />
            ) : null}
            <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
              {userProfile.initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-foreground">
            {userProfile.displayName}
          </span>
          {userProfile.email ? (
            <span className="text-xs text-muted-foreground">{userProfile.email}</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} disabled={isSigningOut}>
          <LogOutIcon className="size-4" />
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

type ModelSelectorDropdownProps = {
  currentModel: ModelOption;
  selectedModel: string;
  selectorModels: ModelOption[];
  modelSelectorOpen: boolean;
  enabledModelsOpen: boolean;
  enabledModelIds: string[];
  onModelSelectorOpenChange: (open: boolean) => void;
  onEnabledModelsOpenChange: (open: boolean) => void;
  onSelectModel: (modelId: string) => void;
  onToggleModel: (modelId: string) => void;
};

const ModelSelectorDropdown = ({
  currentModel,
  selectedModel,
  selectorModels,
  modelSelectorOpen,
  enabledModelsOpen,
  enabledModelIds,
  onModelSelectorOpenChange,
  onEnabledModelsOpenChange,
  onSelectModel,
  onToggleModel,
}: ModelSelectorDropdownProps) => (
  <ModelSelector open={modelSelectorOpen} onOpenChange={onModelSelectorOpenChange}>
    <ModelSelectorTrigger asChild>
      <Button variant="outline" size="sm" className="gap-2">
        <ModelSelectorLogoGroup>
          <ModelSelectorLogo provider={currentModel?.provider ?? 'google'} />
        </ModelSelectorLogoGroup>
        <span className="hidden sm:inline">{currentModel?.name}</span>
        <SparklesIcon className="size-3" />
      </Button>
    </ModelSelectorTrigger>
    <ModelSelectorContent>
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Choose model
        </p>
        <p className="mt-1 text-sm text-foreground">
          Pick from your enabled models. Configure below.
        </p>
      </div>
      <ModelSelectorInput placeholder="Search models..." />
      <ModelSelectorList>
        {selectorModels.map((model) => (
          <ModelSelectorItem
            key={model.id}
            value={model.id}
            onSelect={() => onSelectModel(model.id)}
          >
            <ModelSelectorLogoGroup>
              <ModelSelectorLogo provider={model.provider} />
            </ModelSelectorLogoGroup>
            <div className="flex flex-col gap-0.5">
              <ModelSelectorName>{model.name}</ModelSelectorName>
              <span className="text-muted-foreground text-xs">
                {model.description}
              </span>
            </div>
          </ModelSelectorItem>
        ))}
      </ModelSelectorList>
      <div className="border-t border-border px-4 py-3">
        <Collapsible open={enabledModelsOpen} onOpenChange={onEnabledModelsOpenChange}>
          <CollapsibleTrigger asChild>
            <button
              className="group flex w-full items-center justify-between text-left"
              type="button"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Enabled models
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {enabledModelIds.length} selected • Click to manage
                </p>
              </div>
              <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 max-h-64 overflow-y-auto pr-1">
              <div className="grid gap-2">
                {availableModels.map((model) => (
                  <label
                    key={model.id}
                    className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2 text-xs text-foreground"
                  >
                    <Checkbox
                      checked={enabledModelIds.includes(model.id)}
                      onCheckedChange={() => onToggleModel(model.id)}
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">{model.name}</span>
                      <span className="text-muted-foreground">{model.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </ModelSelectorContent>
  </ModelSelector>
);
