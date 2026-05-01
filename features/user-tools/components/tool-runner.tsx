'use client';

import { Loader2Icon, PlayIcon, TestTubeDiagonalIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type ToolRunnerProps = {
  testInputText: string;
  lastResult: Record<string, unknown> | null;
  isPending: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onRun: (mode: 'test' | 'run') => void;
};

export function ToolRunner({
  testInputText,
  lastResult,
  isPending,
  disabled,
  onChange,
  onRun,
}: ToolRunnerProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tool-test-input">Test input JSON</Label>
        <Textarea
          id="tool-test-input"
          value={testInputText}
          onChange={(event) => onChange(event.target.value)}
          rows={14}
          className="font-mono text-xs"
          disabled={disabled}
        />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => onRun('test')} disabled={disabled || isPending} className="gap-2">
          {isPending ? <Loader2Icon className="size-4 animate-spin" /> : <TestTubeDiagonalIcon className="size-4" />}
          Test
        </Button>
        <Button type="button" onClick={() => onRun('run')} disabled={disabled || isPending} className="gap-2">
          {isPending ? <Loader2Icon className="size-4 animate-spin" /> : <PlayIcon className="size-4" />}
          Run
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Latest result</Label>
        <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-xs">
          {JSON.stringify(lastResult ?? { message: 'No result yet.' }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
