'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusIcon, Trash2Icon, PlugIcon } from 'lucide-react';
import type { McpServerConfig } from '../types';

type AgentMcpSectionProps = {
  mcpServers: McpServerConfig[];
  onChange: (servers: McpServerConfig[]) => void;
};

const EMPTY_SERVER: McpServerConfig = {
  name: '',
  url: '',
  description: '',
  authType: 'none',
  credentialKey: '',
};

export function AgentMcpSection({ mcpServers, onChange }: AgentMcpSectionProps) {
  const [draft, setDraft] = useState<McpServerConfig>({ ...EMPTY_SERVER });
  const [showForm, setShowForm] = useState(false);

  const addServer = () => {
    if (!draft.name.trim() || !draft.url.trim()) return;
    onChange([...mcpServers, { ...draft }]);
    setDraft({ ...EMPTY_SERVER });
    setShowForm(false);
  };

  const removeServer = (index: number) => {
    onChange(mcpServers.filter((_, i) => i !== index));
  };

  const updateDraft = (patch: Partial<McpServerConfig>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>MCP Servers</Label>
        <p className="text-sm text-muted-foreground">
          Connect external MCP servers to give this agent access to additional tools and data
          sources. All MCP tools require user approval before execution.
        </p>
      </div>

      {/* Server list */}
      {mcpServers.length > 0 ? (
        <div className="space-y-2">
          {mcpServers.map((server, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-black/5 bg-background p-3 dark:border-border"
            >
              <PlugIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium">{server.name}</p>
                <p className="truncate text-xs text-muted-foreground">{server.url}</p>
                {server.description && (
                  <p className="text-xs text-muted-foreground">{server.description}</p>
                )}
                {server.authType && server.authType !== 'none' && (
                  <p className="text-xs text-muted-foreground">
                    Auth: {server.authType}
                    {server.credentialKey ? ` (key: ${server.credentialKey})` : ''}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeServer(i)}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No MCP servers configured.</p>
      )}

      {/* Add form */}
      {showForm ? (
        <div className="space-y-3 rounded-lg border border-black/5 bg-muted/30 p-4 dark:border-border">
          <p className="text-sm font-medium">Add MCP Server</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Name *</Label>
              <Input
                placeholder="e.g. doae"
                value={draft.name}
                onChange={(e) => updateDraft({ name: e.target.value.replace(/[^a-z0-9_-]/gi, '') })}
              />
              <p className="text-xs text-muted-foreground">Used as tool prefix (letters, numbers, _ -)</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Server URL *</Label>
              <Input
                placeholder="https://mcp.example.com/api"
                value={draft.url}
                onChange={(e) => updateDraft({ url: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input
              placeholder="What this server provides…"
              value={draft.description ?? ''}
              onChange={(e) => updateDraft({ description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Authentication</Label>
              <Select
                value={draft.authType ?? 'none'}
                onValueChange={(v) => updateDraft({ authType: v as McpServerConfig['authType'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="bearer">Bearer token</SelectItem>
                  <SelectItem value="api_key">API key (X-API-Key)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.authType !== 'none' && (
              <div className="space-y-1">
                <Label className="text-xs">Credential key</Label>
                <Input
                  placeholder="e.g. doae_api_key"
                  value={draft.credentialKey ?? ''}
                  onChange={(e) => updateDraft({ credentialKey: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Key name from your MCP credentials</p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={addServer}
              disabled={!draft.name.trim() || !draft.url.trim()}
            >
              Add server
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setShowForm(false); setDraft({ ...EMPTY_SERVER }); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowForm(true)}
        >
          <PlusIcon className="size-3.5" />
          Add MCP server
        </Button>
      )}

      <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
        <strong>MCP credentials</strong> (API keys for these servers) are stored in{' '}
        <span className="font-mono">Settings → MCP Credentials</span>. All MCP tools show an
        Approve / Deny prompt before executing.
      </div>
    </div>
  );
}
