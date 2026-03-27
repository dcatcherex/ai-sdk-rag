'use client';

import { useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MENU_COLORS } from '@/features/line-oa/webhook/rich-menu/types';
import type { RichMenuAreaInput, RichMenuRecord, CreateRichMenuInput } from '../hooks/use-rich-menus';

const DEFAULT_AREA = (): RichMenuAreaInput => ({
  label: '',
  emoji: '💬',
  bgColor: '#06C755',
  action: { type: 'message', text: '' },
});

type Props = {
  open: boolean;
  menu?: RichMenuRecord | null;
  onClose: () => void;
  onSubmit: (data: CreateRichMenuInput) => void;
  isPending: boolean;
};

export function RichMenuEditor({ open, menu, onClose, onSubmit, isPending }: Props) {
  const [name, setName] = useState(menu?.name ?? '');
  const [chatBarText, setChatBarText] = useState(menu?.chatBarText ?? 'เมนู');
  const [areas, setAreas] = useState<RichMenuAreaInput[]>(
    menu?.areas ?? [DEFAULT_AREA(), DEFAULT_AREA(), DEFAULT_AREA()],
  );

  // Reset when menu prop changes
  const resetToMenu = (m: RichMenuRecord | null | undefined) => {
    setName(m?.name ?? '');
    setChatBarText(m?.chatBarText ?? 'เมนู');
    setAreas(m?.areas ?? [DEFAULT_AREA(), DEFAULT_AREA(), DEFAULT_AREA()]);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) { onClose(); resetToMenu(null); }
  };

  const updateArea = (i: number, patch: Partial<RichMenuAreaInput>) => {
    setAreas((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };

  const updateAreaAction = (i: number, type: RichMenuAreaInput['action']['type']) => {
    const base = { type } as RichMenuAreaInput['action'];
    if (type === 'message') (base as { type: 'message'; text: string }).text = '';
    if (type === 'uri') (base as { type: 'uri'; uri: string }).uri = 'https://';
    if (type === 'postback') (base as { type: 'postback'; data: string }).data = '';
    updateArea(i, { action: base });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, chatBarText, areas });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{menu ? 'Edit Rich Menu' : 'New Rich Menu'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Menu name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Menu"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Chat bar text</Label>
              <Input
                value={chatBarText}
                onChange={(e) => setChatBarText(e.target.value)}
                placeholder="เมนู"
                maxLength={14}
                required
              />
              <p className="text-[11px] text-muted-foreground">Label shown on the bar (max 14 chars)</p>
            </div>
          </div>

          {/* Preview strip */}
          <div className="rounded-lg overflow-hidden border flex h-16">
            {areas.map((area, i) => (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-center text-white text-xs font-bold gap-0.5"
                style={{ backgroundColor: area.bgColor }}
              >
                <span className="text-lg leading-none">{area.emoji}</span>
                <span className="truncate w-full text-center px-1" style={{ fontSize: 9 }}>{area.label}</span>
              </div>
            ))}
          </div>

          {/* Areas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Menu areas ({areas.length})</Label>
              {areas.length < 6 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setAreas((p) => [...p, DEFAULT_AREA()])}
                >
                  <PlusIcon className="size-3" /> Add area
                </Button>
              )}
            </div>

            {areas.map((area, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Area {i + 1}</span>
                  {areas.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6 text-destructive hover:text-destructive"
                      onClick={() => setAreas((p) => p.filter((_, idx) => idx !== i))}
                    >
                      <Trash2Icon className="size-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Emoji</Label>
                    <Input
                      value={area.emoji}
                      onChange={(e) => updateArea(i, { emoji: e.target.value })}
                      placeholder="💬"
                      className="text-center"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={area.label}
                      onChange={(e) => updateArea(i, { label: e.target.value })}
                      placeholder="Button label"
                      required
                    />
                  </div>
                </div>

                {/* Color picker */}
                <div className="space-y-1">
                  <Label className="text-xs">Background color</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {MENU_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`size-7 rounded-md border-2 transition ${area.bgColor === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => updateArea(i, { bgColor: color })}
                      />
                    ))}
                    <input
                      type="color"
                      value={area.bgColor}
                      onChange={(e) => updateArea(i, { bgColor: e.target.value })}
                      className="size-7 rounded-md cursor-pointer border"
                      title="Custom color"
                    />
                  </div>
                </div>

                {/* Action */}
                <div className="space-y-2">
                  <Label className="text-xs">Action</Label>
                  <Select
                    value={area.action.type}
                    onValueChange={(v) => updateAreaAction(i, v as RichMenuAreaInput['action']['type'])}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="message">Send message</SelectItem>
                      <SelectItem value="uri">Open URL</SelectItem>
                      <SelectItem value="postback">Postback</SelectItem>
                    </SelectContent>
                  </Select>

                  {area.action.type === 'message' && (
                    <Input
                      className="text-xs h-8"
                      value={(area.action as { type: 'message'; text: string }).text}
                      onChange={(e) => updateArea(i, { action: { type: 'message', text: e.target.value } })}
                      placeholder="Message text to send when tapped"
                      required
                    />
                  )}
                  {area.action.type === 'uri' && (
                    <Input
                      className="text-xs h-8"
                      value={(area.action as { type: 'uri'; uri: string }).uri}
                      onChange={(e) => updateArea(i, { action: { type: 'uri', uri: e.target.value } })}
                      placeholder="https://example.com"
                      type="url"
                      required
                    />
                  )}
                  {area.action.type === 'postback' && (
                    <Input
                      className="text-xs h-8"
                      value={(area.action as { type: 'postback'; data: string }).data}
                      onChange={(e) => updateArea(i, { action: { type: 'postback', data: e.target.value } })}
                      placeholder="Postback data (e.g. action=quiz)"
                      required
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : menu ? 'Save changes' : 'Create menu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
