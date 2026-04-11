'use client';

import { availableModels } from '@/lib/ai';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type AgentModelSectionProps = {
  modelId: string;
  onModelChange: (value: string) => void;
};

export function AgentModelSection({ modelId, onModelChange }: AgentModelSectionProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Preferred Model</Label>
        <Select key={modelId} value={modelId} onValueChange={onModelChange}>
          <SelectTrigger>
            <SelectValue placeholder="Auto (recommended)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (recommended)</SelectItem>
            {availableModels.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">
        Auto works best for most agents and keeps model choice simple for non-technical users.
      </p>
    </div>
  );
}
