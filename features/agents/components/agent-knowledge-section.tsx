'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DocumentSummary } from '../hooks/use-agent-documents';

type AgentKnowledgeSectionProps = {
  docSearch: string;
  docsLoading: boolean;
  documentIds: string[];
  filteredDocuments: DocumentSummary[];
  onDocSearchChange: (value: string) => void;
  onDocumentToggle: (documentId: string, checked: boolean) => void;
  userDocuments: DocumentSummary[];
};

export function AgentKnowledgeSection({
  docSearch,
  docsLoading,
  documentIds,
  filteredDocuments,
  onDocSearchChange,
  onDocumentToggle,
  userDocuments,
}: AgentKnowledgeSectionProps) {
  return (
    <div className="space-y-2">
      <Label>Knowledge Documents</Label>
      <p className="text-xs text-muted-foreground">
        These documents are automatically used when this agent is active — no manual selection needed.
      </p>
      {docsLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : userDocuments.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          No documents yet. Upload in the Knowledge section.
        </p>
      ) : (
        <div className="space-y-1.5">
          <Input
            placeholder="Search documents…"
            value={docSearch}
            onChange={(event) => onDocSearchChange(event.target.value)}
            className="h-8 text-xs"
          />
          <div className="max-h-96 space-y-0.5 overflow-y-auto rounded-md border border-black/5 p-1 dark:border-border">
            {filteredDocuments.map((doc) => {
              const title = (doc.metadata?.title as string | undefined) ?? doc.id;
              const checked = documentIds.includes(doc.id);
              return (
                <div key={doc.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
                  <Checkbox
                    id={`doc-${doc.id}`}
                    checked={checked}
                    onCheckedChange={(checkedState) => onDocumentToggle(doc.id, Boolean(checkedState))}
                  />
                  <label
                    htmlFor={`doc-${doc.id}`}
                    className="cursor-pointer truncate text-xs leading-none"
                    title={title}
                  >
                    {title}
                  </label>
                </div>
              );
            })}
          </div>
          {documentIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {documentIds.length} document{documentIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      )}
    </div>
  );
}
