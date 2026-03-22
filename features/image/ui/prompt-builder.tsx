'use client';

import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMPOSITIONS, STYLES } from '../constants';
import type { Mode } from '../hooks/use-image-generator';

interface BuilderFields {
  subject: string;
  composition: string;
  action: string;
  location: string;
  style: string;
  instructions: string;
}

interface Props {
  mode: Mode;
  onApply: (prompt: string) => void;
}

export function PromptBuilder({ mode, onApply }: Props) {
  const [fields, setFields] = useState<BuilderFields>({
    subject: '', composition: '', action: '', location: '', style: '', instructions: '',
  });
  const set = (k: keyof BuilderFields) => (v: string) => setFields(prev => ({ ...prev, [k]: v }));

  const handleApply = () => {
    const parts: string[] = [];
    if (fields.subject) parts.push(fields.subject);
    if (fields.action) parts.push(fields.action);
    if (fields.location) parts.push(`in ${fields.location}`);
    if (fields.composition) parts.push(fields.composition);
    if (fields.style) parts.push(`${fields.style} style`);
    if (mode === 'edit' && fields.instructions) parts.push(fields.instructions);
    if (parts.length) onApply(parts.join(', '));
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">6-element prompt builder</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Subject</Label>
          <Input placeholder="A stoic robot barista…" value={fields.subject} onChange={e => set('subject')(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Action</Label>
          <Input placeholder="Brewing a cup of coffee" value={fields.action} onChange={e => set('action')(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Location</Label>
          <Input placeholder="A futuristic cafe on Mars" value={fields.location} onChange={e => set('location')(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Composition</Label>
          <Select value={fields.composition} onValueChange={set('composition')}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              {COMPOSITIONS.map(c => <SelectItem key={c || '_'} value={c || 'any'}>{c || 'Any'}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Style</Label>
          <Select value={fields.style} onValueChange={set('style')}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              {STYLES.map(s => <SelectItem key={s || '_'} value={s || 'any'}>{s || 'Any'}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {mode === 'edit' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Editing instruction</Label>
            <Input placeholder="Change the sofa to navy blue" value={fields.instructions} onChange={e => set('instructions')(e.target.value)} className="h-8 text-sm" />
          </div>
        )}
      </div>
      <Button size="sm" onClick={handleApply} className="w-full mt-1">
        <Wand2 className="mr-2 h-3 w-3" />Build prompt
      </Button>
    </div>
  );
}
