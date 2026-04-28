'use client';

import { useState, useCallback } from 'react';
import { CheckIcon, XIcon, WrapTextIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseFlexJson, validateFlexPayload } from '../utils';
import { FlexPreview } from './flex-preview';

type FlexEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onPayloadChange?: (payload: Record<string, unknown> | null) => void;
};

export function FlexEditor({ value, onChange, onPayloadChange }: FlexEditorProps) {
  const [error, setError] = useState<string | null>(null);

  const parsed = parseFlexJson(value);

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      const p = parseFlexJson(newValue);
      setError(null);
      onPayloadChange?.(p);
    },
    [onChange, onPayloadChange],
  );

  const format = () => {
    try {
      const p = JSON.parse(value) as unknown;
      onChange(JSON.stringify(p, null, 2));
      setError(null);
    } catch {
      setError('Invalid JSON — cannot format');
    }
  };

  const validate = () => {
    const p = parseFlexJson(value);
    if (!p) {
      setError('Invalid JSON');
      return;
    }
    const validationError = validateFlexPayload(p);
    if (validationError) {
      setError(validationError);
    } else {
      setError('✓ Valid Flex JSON');
    }
  };

  const isValid = Boolean(parsed && !validateFlexPayload(parsed));

  return (
    <div className="flex h-full min-h-0 gap-0 overflow-hidden rounded-lg border">
      {/* Left: JSON editor */}
      <div className="flex w-1/2 min-w-0 flex-col border-r">
        <div className="flex shrink-0 items-center gap-2 border-b bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">JSON</span>
          <div className="ml-auto flex gap-1.5">
            <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={format}>
              <WrapTextIcon className="size-3" />
              Format
            </Button>
            <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={validate}>
              {isValid ? (
                <CheckIcon className="size-3 text-green-600" />
              ) : (
                <XIcon className="size-3 text-red-500" />
              )}
              Validate
            </Button>
          </div>
        </div>

        {error && (
          <div
            className={[
              'shrink-0 px-3 py-1.5 text-xs',
              error.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
            ].join(' ')}
          >
            {error}
          </div>
        )}

        <textarea
          className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-relaxed outline-none"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          placeholder={`{\n  "type": "bubble",\n  "body": {\n    "type": "box",\n    "layout": "vertical",\n    "contents": []\n  }\n}`}
        />
      </div>

      {/* Right: Preview */}
      <div className="flex min-w-0 w-1/2 flex-col bg-[#F2F2F2]">
        <div className="shrink-0 border-b bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">Preview</span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <FlexPreview payload={parsed} />
        </div>
      </div>
    </div>
  );
}
