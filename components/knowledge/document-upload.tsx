'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloudIcon, LinkIcon, FileTextIcon, Loader2Icon, CheckCircle2Icon, XCircleIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUploadDocument } from '@/lib/hooks/use-documents';
import { cn } from '@/lib/utils';

const ACCEPTED_TYPES: Record<string, string[]> = {
  'text/plain': ['.txt'],
  'text/markdown': ['.md', '.markdown'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
  'application/pdf': ['.pdf'],
};

interface DocumentUploadProps {
  variant?: 'compact' | 'full';
  defaultCategory?: string;
  onUploadComplete?: () => void;
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export function DocumentUpload({
  variant = 'full',
  defaultCategory = 'general',
  onUploadComplete,
}: DocumentUploadProps) {
  const [category, setCategory] = useState(defaultCategory);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const upload = useUploadDocument();

  const resetStatus = () => {
    setTimeout(() => {
      setUploadStatus('idle');
      setErrorMessage('');
    }, 2000);
  };

  const handleUpload = useCallback(
    async (data: { file?: File; url?: string; text?: string }) => {
      setUploadStatus('uploading');
      setErrorMessage('');
      try {
        await upload.mutateAsync({
          ...data,
          category,
          title: title || undefined,
        });
        setUploadStatus('success');
        setUrl('');
        setText('');
        setTitle('');
        onUploadComplete?.();
        resetStatus();
      } catch (err) {
        setUploadStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
        resetStatus();
      }
    },
    [upload, category, title, onUploadComplete]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        handleUpload({ file: acceptedFiles[0] });
      }
    },
    [handleUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    disabled: uploadStatus === 'uploading',
  });

  if (variant === 'compact') {
    return (
      <div className="space-y-2">
        <div
          {...getRootProps()}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/10 px-3 py-3 text-center transition hover:border-black/20 hover:bg-black/[0.02]',
            isDragActive && 'border-primary/50 bg-primary/5',
            uploadStatus === 'uploading' && 'pointer-events-none opacity-60'
          )}
        >
          <input {...getInputProps()} />
          {uploadStatus === 'uploading' ? (
            <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
          ) : uploadStatus === 'success' ? (
            <CheckCircle2Icon className="size-4 text-green-600" />
          ) : uploadStatus === 'error' ? (
            <XCircleIcon className="size-4 text-destructive" />
          ) : (
            <UploadCloudIcon className="size-4 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">
            {isDragActive
              ? 'Drop file here'
              : uploadStatus === 'uploading'
                ? 'Uploading...'
                : uploadStatus === 'success'
                  ? 'Uploaded!'
                  : 'Drop file or click to upload'}
          </span>
        </div>
        {errorMessage && (
          <p className="text-xs text-destructive">{errorMessage}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file">
            <UploadCloudIcon className="size-3.5" />
            File
          </TabsTrigger>
          <TabsTrigger value="url">
            <LinkIcon className="size-3.5" />
            URL
          </TabsTrigger>
          <TabsTrigger value="text">
            <FileTextIcon className="size-3.5" />
            Text
          </TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <div
            {...getRootProps()}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-black/10 px-6 py-8 text-center transition hover:border-black/20 hover:bg-black/[0.02]',
              isDragActive && 'border-primary/50 bg-primary/5',
              uploadStatus === 'uploading' && 'pointer-events-none opacity-60'
            )}
          >
            <input {...getInputProps()} />
            <UploadCloudIcon className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {isDragActive ? 'Drop file here' : 'Drag & drop a file here'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports: PDF, TXT, MD, JSON, CSV
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="url">
          <div className="space-y-3">
            <Input
              placeholder="https://example.com/document"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button
              size="sm"
              onClick={() => url.trim() && handleUpload({ url: url.trim() })}
              disabled={!url.trim() || uploadStatus === 'uploading'}
            >
              {uploadStatus === 'uploading' ? (
                <Loader2Icon className="mr-2 size-3.5 animate-spin" />
              ) : null}
              Fetch & Ingest
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="text">
          <div className="space-y-3">
            <Input
              placeholder="Document title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Paste your document content here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
            />
            <Button
              size="sm"
              onClick={() =>
                text.trim() && handleUpload({ text: text.trim() })
              }
              disabled={!text.trim() || uploadStatus === 'uploading'}
            >
              {uploadStatus === 'uploading' ? (
                <Loader2Icon className="mr-2 size-3.5 animate-spin" />
              ) : null}
              Add Document
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Category selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Category:</span>
        <Input
          className="h-7 w-40 text-xs"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="general"
        />
      </div>

      {uploadStatus === 'uploading' && (
        <Progress value={undefined} className="h-1" />
      )}

      {uploadStatus === 'success' && (
        <p className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle2Icon className="size-3.5" />
          Document uploaded successfully
        </p>
      )}

      {errorMessage && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <XCircleIcon className="size-3.5" />
          {errorMessage}
        </p>
      )}
    </div>
  );
}
