'use client'

import { useEffect, useState } from 'react'
import {
  GitPullRequest,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileEdit,
  FilePlus,
  BookOpen,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ToolManifest } from '@/features/tools/registry/types'
import type { DeployRunOutput } from '../types'

interface ToolPageProps {
  manifest: ToolManifest
}

type HistoryRow = {
  id: string
  status: string
  createdAt: string
  completedAt: string | null
  outputJson: DeployRunOutput | null
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  copy_edit: 'Copy Edit',
  page_clone: 'Page Clone',
  blog_post: 'Blog Post',
}

const CHANGE_TYPE_ICON: Record<string, typeof FileEdit> = {
  copy_edit: FileEdit,
  page_clone: FilePlus,
  blog_post: BookOpen,
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
        <CheckCircle2 className="size-3" />
        Published
      </Badge>
    )
  }
  if (status === 'pending') {
    return (
      <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-200 bg-yellow-50">
        <Clock className="size-3" />
        Awaiting confirm
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 text-red-600 border-red-200 bg-red-50">
      <XCircle className="size-3" />
      Failed
    </Badge>
  )
}

function HistoryItem({ row }: { row: HistoryRow }) {
  const output = row.outputJson
  const changeType = output && 'changeType' in output ? output.changeType : null
  const Icon = changeType ? (CHANGE_TYPE_ICON[changeType] ?? FileEdit) : FileEdit
  const prUrl = output && 'prUrl' in output ? output.prUrl : null
  const prNumber = output && 'prNumber' in output ? output.prNumber : null
  const summary = output && 'summary' in output ? output.summary : null
  const targetPath = output && 'targetPath' in output ? output.targetPath : null

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-zinc-100 dark:bg-zinc-800">
        <Icon className="size-4 text-zinc-600 dark:text-zinc-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {summary ?? 'Website change'}
          </span>
          <StatusBadge status={row.status} />
          {changeType && (
            <Badge variant="secondary" className="text-xs">
              {CHANGE_TYPE_LABEL[changeType] ?? changeType}
            </Badge>
          )}
        </div>
        {targetPath && (
          <p className="mt-0.5 font-mono text-xs text-zinc-500 truncate">{targetPath}</p>
        )}
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {new Date(row.createdAt).toLocaleString()}
          </span>
          {prUrl && prNumber && (
            <Button asChild variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs">
              <a href={prUrl} target="_blank" rel="noopener noreferrer">
                <GitPullRequest className="size-3" />
                PR #{prNumber}
                <ExternalLink className="size-3" />
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function DeployToolPage({ manifest: _manifest }: ToolPageProps) {
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/deploy/history')
      .then((r) => r.json())
      .then((data: HistoryRow[]) => setHistory(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <GitPullRequest className="size-5 text-zinc-600" />
          <h1 className="text-lg font-semibold">Web Publisher</h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Content changes sent to GitHub as pull requests. Vercel auto-deploys on merge.
        </p>
      </div>

      {/* How to use */}
      <div className="border-b bg-zinc-50 dark:bg-zinc-900/50 px-6 py-3">
        <p className="text-xs text-zinc-500">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">How to use: </span>
          Enable the <span className="font-mono">web-publisher</span> skill on your agent, then ask
          in chat — &quot;Edit the homepage headline&quot;, &quot;Write a blog post about X&quot;,
          or &quot;Create a pricing page like the features page&quot;.
        </p>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Deploy History
        </h2>

        {loading && (
          <div className="flex items-center justify-center py-12 text-zinc-400">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        {!loading && history.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GitPullRequest className="size-10 text-zinc-300 mb-3" />
            <p className="text-sm font-medium text-zinc-500">No deploys yet</p>
            <p className="text-xs text-zinc-400 mt-1">
              Your published changes will appear here with PR links.
            </p>
          </div>
        )}

        {!loading && history.length > 0 && (
          <div className="flex flex-col gap-2">
            {history.map((row) => (
              <HistoryItem key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
