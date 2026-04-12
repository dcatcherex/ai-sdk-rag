'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  BookmarkPlusIcon,
  ImagePlusIcon,
  LayoutGridIcon,
  PlusIcon,
  RocketIcon,
  StarIcon,
  Trash2Icon,
  PencilIcon,
  UserCheckIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  useRichMenus,
  useCreateRichMenu,
  useUpdateRichMenu,
  useDeleteRichMenu,
  useDeployRichMenu,
  useUploadRichMenuImage,
} from '../hooks/use-rich-menus';
import { useSaveMenuTemplate } from '../hooks/use-menu-templates';
import { useUpdateLineOaChannel } from '../hooks/use-line-oa';
import { RichMenuEditor } from './rich-menu-editor';
import type { RichMenuRecord, CreateRichMenuInput } from '../hooks/use-rich-menus';

export function RichMenuPanel({ channelId, memberRichMenuLineId }: { channelId: string; memberRichMenuLineId: string | null }) {
  const { data: menus = [], isLoading } = useRichMenus(channelId);
  const createMenu = useCreateRichMenu(channelId);
  const updateMenu = useUpdateRichMenu(channelId);
  const deleteMenu = useDeleteRichMenu(channelId);
  const deployMenu = useDeployRichMenu(channelId);
  const uploadImage = useUploadRichMenuImage(channelId);
  const saveTemplate = useSaveMenuTemplate();
  const updateChannel = useUpdateLineOaChannel();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RichMenuRecord | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);

  // Save-as-template dialog state
  const [templateDialogMenu, setTemplateDialogMenu] = useState<RichMenuRecord | null>(null);
  const [templateName, setTemplateName] = useState('');

  const openCreate = () => { setEditTarget(null); setEditorOpen(true); };
  const openEdit = (menu: RichMenuRecord) => { setEditTarget(menu); setEditorOpen(true); };

  const openSaveTemplate = (menu: RichMenuRecord) => {
    setTemplateDialogMenu(menu);
    setTemplateName(menu.name);
  };

  const confirmSaveTemplate = () => {
    if (!templateDialogMenu || !templateName.trim()) return;
    saveTemplate.mutate(
      { name: templateName.trim(), chatBarText: templateDialogMenu.chatBarText, areas: templateDialogMenu.areas },
      { onSuccess: () => { setTemplateDialogMenu(null); setTemplateName(''); } },
    );
  };

  const handleSubmit = (data: CreateRichMenuInput) => {
    if (editTarget) {
      updateMenu.mutate(
        { id: editTarget.id, ...data },
        { onSuccess: () => { setEditorOpen(false); setEditTarget(null); } },
      );
    } else {
      createMenu.mutate(data, { onSuccess: () => setEditorOpen(false) });
    }
  };

  const handleDeploy = (menu: RichMenuRecord, setAsDefault: boolean) => {
    setDeployingId(menu.id);
    deployMenu.mutate(
      { menuId: menu.id, setAsDefault },
      { onSettled: () => setDeployingId(null) },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <LayoutGridIcon className="size-3.5" />
          Rich Menus ({menus.length})
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1 px-2"
          onClick={openCreate}
        >
          <PlusIcon className="size-3" />
          New
        </Button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

      {menus.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground italic">
          No menus yet — create one to add a persistent tab bar to your LINE chat.
        </p>
      )}

      {menus.map((menu) => (
        <div key={menu.id} className="rounded-lg border bg-background/60 p-2.5 space-y-2">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-medium truncate">{menu.name}</span>
              <Badge
                variant={menu.status === 'active' ? 'default' : 'secondary'}
                className="text-[10px] h-4 px-1"
              >
                {menu.status}
              </Badge>
              {menu.isDefault && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5 text-yellow-600 border-yellow-400">
                  <StarIcon className="size-2.5" />
                  default
                </Badge>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                title="Save as template"
                onClick={() => openSaveTemplate(menu)}
              >
                <BookmarkPlusIcon className="size-3" />
              </Button>
              {/* Upload custom background image */}
              <label
                className="inline-flex items-center justify-center size-6 rounded-md hover:bg-accent cursor-pointer"
                title="Upload background image (PNG/JPG from Canva)"
              >
                <ImagePlusIcon className="size-3" />
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  disabled={uploadImage.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage.mutate({ menuId: menu.id, file });
                    e.target.value = '';
                  }}
                />
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => openEdit(menu)}
              >
                <PencilIcon className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-destructive hover:text-destructive"
                onClick={() => deleteMenu.mutate(menu.id)}
                disabled={deleteMenu.isPending}
              >
                <Trash2Icon className="size-3" />
              </Button>
            </div>
          </div>

          {/* Area preview strip */}
          {menu.backgroundImageUrl ? (
            // Custom uploaded image — display at natural aspect ratio
            <div className="rounded overflow-hidden w-full">
              <Image
                src={menu.backgroundImageUrl}
                alt="Rich menu background"
                width={1200}
                height={405}
                unoptimized
                className="h-auto w-full block"
              />
            </div>
          ) : (() => {
            const areas = menu.areas;
            const hasBounds = areas.length > 0 && areas.every((a) => a.bounds);
            if (hasBounds) {
              const canvasW = Math.max(...areas.map((a) => a.bounds!.x + a.bounds!.width));
              const canvasH = Math.max(...areas.map((a) => a.bounds!.y + a.bounds!.height));
              return (
                <div className="rounded overflow-hidden relative w-full" style={{ aspectRatio: `${canvasW} / ${canvasH}`, maxHeight: 56 }}>
                  {areas.map((area, i) => (
                    <div
                      key={i}
                      className="absolute flex items-center justify-center gap-1 text-white"
                      style={{
                        backgroundColor: area.bgColor,
                        left: `${(area.bounds!.x / canvasW) * 100}%`,
                        top: `${(area.bounds!.y / canvasH) * 100}%`,
                        width: `${(area.bounds!.width / canvasW) * 100}%`,
                        height: `${(area.bounds!.height / canvasH) * 100}%`,
                      }}
                    >
                      <span className="text-xs leading-none">{area.emoji}</span>
                      <span className="text-[8px] font-medium truncate">{area.label}</span>
                    </div>
                  ))}
                </div>
              );
            }
            return (
              <div className="rounded overflow-hidden flex h-8">
                {areas.map((area, i) => (
                  <div
                    key={i}
                    className="flex-1 flex items-center justify-center gap-1 text-white"
                    style={{ backgroundColor: area.bgColor }}
                  >
                    <span className="text-sm leading-none">{area.emoji}</span>
                    <span className="text-[9px] font-medium truncate">{area.label}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Deploy actions */}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 flex-1"
              disabled={deployingId === menu.id}
              onClick={() => handleDeploy(menu, false)}
            >
              <RocketIcon className="size-3" />
              {deployingId === menu.id ? 'Deploying…' : 'Deploy'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 flex-1"
              disabled={deployingId === menu.id || !menu.lineMenuId}
              onClick={() => handleDeploy(menu, true)}
              title={!menu.lineMenuId ? 'Deploy first, then set as default' : ''}
            >
              <StarIcon className="size-3" />
              Set default
            </Button>
          </div>
          {/* Member menu assignment */}
          <Button
            variant={memberRichMenuLineId === menu.lineMenuId && menu.lineMenuId ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs gap-1 w-full"
            disabled={!menu.lineMenuId || updateChannel.isPending}
            onClick={() => updateChannel.mutate({
              id: channelId,
              memberRichMenuLineId: memberRichMenuLineId === menu.lineMenuId ? null : (menu.lineMenuId ?? null),
            })}
            title={!menu.lineMenuId ? 'Deploy this menu first before setting it as member menu' : ''}
          >
            <UserCheckIcon className="size-3" />
            {memberRichMenuLineId === menu.lineMenuId && menu.lineMenuId
              ? 'Member menu (tap to unset)'
              : 'Set as member menu'}
          </Button>
        </div>
      ))}

      <RichMenuEditor
        key={editTarget?.id ?? 'new'}
        open={editorOpen}
        menu={editTarget}
        onClose={() => { setEditorOpen(false); setEditTarget(null); }}
        onSubmit={handleSubmit}
        isPending={createMenu.isPending || updateMenu.isPending}
      />

      {/* Save as template dialog */}
      <Dialog
        open={Boolean(templateDialogMenu)}
        onOpenChange={(o) => { if (!o) { setTemplateDialogMenu(null); setTemplateName(''); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Template name</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. EdLab Standard Menu"
                autoFocus
              />
            </div>
            {templateDialogMenu && (() => {
              const areas = templateDialogMenu.areas;
              const hasBounds = areas.length > 0 && areas.every((a) => a.bounds);
              if (hasBounds) {
                const canvasW = Math.max(...areas.map((a) => a.bounds!.x + a.bounds!.width));
                const canvasH = Math.max(...areas.map((a) => a.bounds!.y + a.bounds!.height));
                return (
                  <div className="rounded overflow-hidden relative w-full border" style={{ aspectRatio: `${canvasW} / ${canvasH}`, maxHeight: 56 }}>
                    {areas.map((area, i) => (
                      <div
                        key={i}
                        className="absolute flex items-center justify-center gap-1 text-white"
                        style={{
                          backgroundColor: area.bgColor,
                          left: `${(area.bounds!.x / canvasW) * 100}%`,
                          top: `${(area.bounds!.y / canvasH) * 100}%`,
                          width: `${(area.bounds!.width / canvasW) * 100}%`,
                          height: `${(area.bounds!.height / canvasH) * 100}%`,
                        }}
                      >
                        <span className="text-xs leading-none">{area.emoji}</span>
                        <span className="text-[8px] font-medium truncate">{area.label}</span>
                      </div>
                    ))}
                  </div>
                );
              }
              return (
                <div className="rounded overflow-hidden flex h-8 border">
                  {areas.map((area, i) => (
                    <div
                      key={i}
                      className="flex-1 flex items-center justify-center gap-1 text-white"
                      style={{ backgroundColor: area.bgColor }}
                    >
                      <span className="text-sm leading-none">{area.emoji}</span>
                      <span className="text-[9px] font-medium truncate">{area.label}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            <p className="text-xs text-muted-foreground">
              Templates are saved to your account and available across all LINE OA channels.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTemplateDialogMenu(null); setTemplateName(''); }}>
              Cancel
            </Button>
            <Button
              onClick={confirmSaveTemplate}
              disabled={!templateName.trim() || saveTemplate.isPending}
            >
              {saveTemplate.isPending ? 'Saving…' : 'Save template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
