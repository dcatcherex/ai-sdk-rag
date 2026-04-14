'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type AdminAgentCatalogSectionProps = {
  changelog: string;
  cloneBehavior: 'locked' | 'editable_copy';
  lockedFields: string[];
  onChangelogChange: (value: string) => void;
  onCloneBehaviorChange: (value: 'locked' | 'editable_copy') => void;
  onLockedFieldToggle: (field: string) => void;
  onUpdatePolicyChange: (value: 'none' | 'notify' | 'auto_for_locked') => void;
  updatePolicy: 'none' | 'notify' | 'auto_for_locked';
};

const AGENT_LOCK_FIELDS = [
  'systemPrompt',
  'enabledTools',
  'modelId',
  'brandId',
  'documentIds',
  'starterPrompts',
] as const;

export function AdminAgentCatalogSection({
  changelog,
  cloneBehavior,
  lockedFields,
  onChangelogChange,
  onCloneBehaviorChange,
  onLockedFieldToggle,
  onUpdatePolicyChange,
  updatePolicy,
}: AdminAgentCatalogSectionProps) {
  return (
    <div className="space-y-5 rounded-2xl border bg-background p-5">
      <div>
        <h3 className="text-base font-semibold">Catalog Settings</h3>
        <p className="text-sm text-muted-foreground">
          Control how this official template is copied and updated after publishing.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Clone behavior</Label>
          <Select value={cloneBehavior} onValueChange={onCloneBehaviorChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editable_copy">Editable copy</SelectItem>
              <SelectItem value="locked">Locked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Update policy</Label>
          <Select value={updatePolicy} onValueChange={onUpdatePolicyChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="notify">Notify users</SelectItem>
              <SelectItem value="none">No update prompts</SelectItem>
              <SelectItem value="auto_for_locked">Auto update locked</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Locked fields</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {AGENT_LOCK_FIELDS.map((field) => {
            const checked = lockedFields.includes(field);
            return (
              <label key={field} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onLockedFieldToggle(field)}
                />
                {field}
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="agent-changelog">Changelog</Label>
        <Textarea
          id="agent-changelog"
          value={changelog}
          onChange={(event) => onChangelogChange(event.target.value)}
          className="min-h-24"
          placeholder="What changed in this version?"
        />
      </div>
    </div>
  );
}
