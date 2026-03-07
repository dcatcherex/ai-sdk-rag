import { useEffect } from 'react';
import { ArrowLeftIcon, DownloadIcon, PanelRightIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EditorToolbar } from './editor-toolbar';
import { EditorCanvas } from './editor-canvas';
import { EditorPromptBar } from './editor-prompt-bar';
import { VersionPanel } from './version-panel';
import { useMaskCanvas } from '../../hooks/use-mask-canvas';
import { useImageEditor } from '../../hooks/use-image-editor';
import type { MediaAsset } from '../../types';

type Props = {
  asset: MediaAsset;
  onClose: () => void;
  editorState: ReturnType<typeof useImageEditor>;
  activeGalleryVersionId?: string | null;
  onSetActiveVersion?: (rootId: string, assetId: string) => void;
};

export const ImageEditor = ({ asset, onClose, editorState, activeGalleryVersionId, onSetActiveVersion }: Props) => {
  const rootId = asset.rootAssetId ?? asset.id;
  const {
    versionsOpen,
    setVersionsOpen,
    selectedVersion,
    selectedVersionId,
    setSelectedVersionId,
    versionHistory,
    selectedModel,
    setSelectedModel,
    modelSelectorOpen,
    setModelSelectorOpen,
    isSubmitting,
    submitError,
    submitEdit,
  } = editorState;

  const {
    maskCanvasRef,
    brushSize,
    setBrushSize,
    activeTool,
    setActiveTool,
    saveToHistory,
    undoMask,
    redoMask,
    clearMask,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    buildMaskDataUrl,
    initCanvas,
  } = useMaskCanvas();

  // Resize + clear the canvas whenever the active version changes.
  useEffect(() => {
    if (!selectedVersion) return;
    initCanvas(selectedVersion.width ?? 1024, selectedVersion.height ?? 1024);
  }, [selectedVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (text: string) => submitEdit(text, buildMaskDataUrl, clearMask);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-black/5 dark:border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground">Generated image</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={asset.url} download>
              <DownloadIcon className="size-4" />
            </a>
          </Button>
          <Button
            variant={versionsOpen ? 'secondary' : 'ghost'}
            size="icon-sm"
            title="Toggle versions"
            onClick={() => setVersionsOpen((v) => !v)}
          >
            <PanelRightIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Body: canvas + optional version panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-muted/10 p-6">
          <EditorToolbar
            activeTool={activeTool}
            brushSize={brushSize}
            onToolChange={setActiveTool}
            onBrushSizeChange={setBrushSize}
            onUndo={undoMask}
            onRedo={redoMask}
            onClear={() => { saveToHistory(); clearMask(); }}
          />
          <EditorCanvas
            selectedVersion={selectedVersion}
            maskCanvasRef={maskCanvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>

        {versionsOpen && (
          <VersionPanel
            versionHistory={versionHistory}
            selectedVersionId={selectedVersionId}
            activeGalleryVersionId={activeGalleryVersionId}
            onSelectVersion={setSelectedVersionId}
            onSetActiveVersion={onSetActiveVersion ? (assetId) => onSetActiveVersion(rootId, assetId) : undefined}
          />
        )}
      </div>

      {/* Prompt bar */}
      <EditorPromptBar
        submitError={submitError}
        isSubmitting={isSubmitting}
        selectedModel={selectedModel}
        modelSelectorOpen={modelSelectorOpen}
        onModelSelectorOpenChange={setModelSelectorOpen}
        onModelSelect={(id) => { setSelectedModel(id); setModelSelectorOpen(false); }}
        onSubmit={handleSubmit}
      />
    </div>
  );
};
