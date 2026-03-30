'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentRawPromptEditor } from './agent-raw-prompt-editor';
import { AgentStructuredBehaviorForm } from './agent-structured-behavior-form';

type AgentBehaviorSectionProps = {
  behaviorMode: 'structured' | 'raw';
  contextValue: string;
  estimatedTokens: number;
  exampleRepliesValue: string;
  generatedPrompt: string;
  hasStructuredBehavior: boolean;
  isPanel: boolean;
  isRawCustomized: boolean;
  keyInstructionsValue: string[];
  languageEnglish: boolean;
  languageMobileFriendly: boolean;
  languageThai: boolean;
  onBehaviorModeChange: (value: 'structured' | 'raw') => void;
  onContextChange: (value: string) => void;
  onExampleRepliesChange: (value: string) => void;
  onKeyInstructionAdd: () => void;
  onKeyInstructionChange: (index: number, value: string) => void;
  onKeyInstructionInputChange: (value: string) => void;
  onKeyInstructionRemove: (index: number) => void;
  onLanguageEnglishChange: (value: boolean) => void;
  onLanguageMobileFriendlyChange: (value: boolean) => void;
  onLanguageThaiChange: (value: boolean) => void;
  onResetFromStructured: () => void;
  onRoleChange: (value: string) => void;
  onSystemPromptChange: (value: string) => void;
  onToneToggle: (tone: string) => void;
  onUseGeneratedPrompt: () => void;
  roleValue: string;
  selectedTones: string[];
  syncState: 'empty' | 'legacy' | 'synced' | 'diverged';
  systemPrompt: string;
  systemPromptChars: number;
  systemPromptLines: number;
  toneOptions: string[];
  workingInstructionValue: string;
};

export function AgentBehaviorSection({
  behaviorMode,
  contextValue,
  estimatedTokens,
  exampleRepliesValue,
  generatedPrompt,
  hasStructuredBehavior,
  isPanel,
  isRawCustomized,
  keyInstructionsValue,
  languageEnglish,
  languageMobileFriendly,
  languageThai,
  onBehaviorModeChange,
  onContextChange,
  onExampleRepliesChange,
  onKeyInstructionAdd,
  onKeyInstructionChange,
  onKeyInstructionInputChange,
  onKeyInstructionRemove,
  onLanguageEnglishChange,
  onLanguageMobileFriendlyChange,
  onLanguageThaiChange,
  onResetFromStructured,
  onRoleChange,
  onSystemPromptChange,
  onToneToggle,
  onUseGeneratedPrompt,
  roleValue,
  selectedTones,
  syncState,
  systemPrompt,
  systemPromptChars,
  systemPromptLines,
  toneOptions,
  workingInstructionValue,
}: AgentBehaviorSectionProps) {
  const relationshipMessage =
    syncState === 'legacy'
      ? {
          className: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100',
          title: 'Raw-only legacy prompt',
          description: 'This agent was created from a saved raw prompt. Structured fields start empty until you define them.',
        }
      : syncState === 'diverged'
        ? {
            className: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100',
            title: 'Raw prompt diverged from Structured',
            description: 'Raw mode has custom edits. Use Reset from Structured if you want the final prompt to match the guided fields again.',
          }
        : syncState === 'synced'
          ? {
              className: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100',
              title: 'Structured and Raw are aligned',
              description: 'Guided edits currently match the raw system prompt that will be saved.',
            }
          : {
              className: 'border-black/5 bg-muted/20 text-foreground dark:border-border',
              title: 'Start in Structured mode',
              description: hasStructuredBehavior
                ? 'Guided edits generate the saved system prompt. Raw mode remains available for advanced overrides.'
                : 'Use Structured mode for guided setup or switch to Raw mode if you prefer to write the prompt directly.',
            };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Configure how this agent should respond. Use Structured mode for guided setup or Raw mode for direct prompt editing.
        </p>
      </div>
      <div className={`rounded-lg border px-3 py-2 ${relationshipMessage.className}`}>
        <p className="text-sm font-medium">{relationshipMessage.title}</p>
        <p className="text-xs opacity-90">{relationshipMessage.description}</p>
      </div>
      <Tabs value={behaviorMode} onValueChange={(value) => onBehaviorModeChange(value as 'structured' | 'raw')}>
        <TabsList>
          <TabsTrigger value="structured">Structured</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>
        <TabsContent value="structured">
          <AgentStructuredBehaviorForm
            contextValue={contextValue}
            exampleRepliesValue={exampleRepliesValue}
            generatedPrompt={generatedPrompt}
            keyInstructionsValue={keyInstructionsValue}
            languageEnglish={languageEnglish}
            languageMobileFriendly={languageMobileFriendly}
            languageThai={languageThai}
            onContextChange={onContextChange}
            onExampleRepliesChange={onExampleRepliesChange}
            onKeyInstructionAdd={onKeyInstructionAdd}
            onKeyInstructionChange={onKeyInstructionChange}
            onKeyInstructionInputChange={onKeyInstructionInputChange}
            onKeyInstructionRemove={onKeyInstructionRemove}
            onLanguageEnglishChange={onLanguageEnglishChange}
            onLanguageMobileFriendlyChange={onLanguageMobileFriendlyChange}
            onLanguageThaiChange={onLanguageThaiChange}
            onRoleChange={onRoleChange}
            onToneToggle={onToneToggle}
            onUseGeneratedPrompt={onUseGeneratedPrompt}
            roleValue={roleValue}
            selectedTones={selectedTones}
            toneOptions={toneOptions}
            workingInstructionValue={workingInstructionValue}
          />
        </TabsContent>
        <TabsContent value="raw">
          <AgentRawPromptEditor
            estimatedTokens={estimatedTokens}
            generatedPrompt={generatedPrompt}
            isCustomized={isRawCustomized}
            isPanel={isPanel}
            onResetFromStructured={onResetFromStructured}
            onSystemPromptChange={onSystemPromptChange}
            systemPrompt={systemPrompt}
            systemPromptChars={systemPromptChars}
            systemPromptLines={systemPromptLines}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
