'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ChevronsUpDown,
  BrainCircuitIcon,
  ChevronDown,
  DatabaseIcon,
  GlobeIcon,
  HardDriveIcon,
  ImageIcon,
  TypeIcon,
  VideoIcon,
} from 'lucide-react';

import { availableModels, type ModelOption, type Capability, type Provider } from '@/lib/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEnabledModels } from '@/features/models/hooks/use-enabled-models';

// Capability → Lucide icon + label
const capabilityIcons: Record<Capability, { icon: React.ElementType; label: string; color: string }> = {
  text:               { icon: TypeIcon,         label: 'Text',             color: 'text-slate-500 dark:text-slate-400' },
  'implicit caching': { icon: DatabaseIcon,     label: 'Implicit caching', color: 'text-emerald-500 dark:text-emerald-400' },
  'explicit caching': { icon: HardDriveIcon,    label: 'Explicit caching', color: 'text-teal-500 dark:text-teal-400' },
  'web search':       { icon: GlobeIcon,        label: 'Web search',       color: 'text-sky-500 dark:text-sky-400' },
  'image gen':        { icon: ImageIcon,        label: 'Image generation', color: 'text-violet-500 dark:text-violet-400' },
  embeddings:         { icon: BrainCircuitIcon, label: 'Embeddings',       color: 'text-amber-500 dark:text-amber-400' },
  'video gen':        { icon: VideoIcon,        label: 'Video generation', color: 'text-rose-500 dark:text-rose-400' },
};

// Provider → avatar style
const providerMeta: Record<Provider, { label: string; bg: string; text: string; abbr: string }> = {
  google:     { label: 'Google',     bg: '#4285F4', text: '#fff', abbr: 'G'  },
  openai:     { label: 'OpenAI',     bg: '#10A37F', text: '#fff', abbr: 'O'  },
  anthropic:  { label: 'Anthropic',  bg: '#D97757', text: '#fff', abbr: 'A'  },
  xai:        { label: 'xAI',        bg: '#000000', text: '#fff', abbr: 'X'  },
  moonshotai: { label: 'Moonshot',   bg: '#6366f1', text: '#fff', abbr: 'M'  },
  deepseek:   { label: 'DeepSeek',   bg: '#0ea5e9', text: '#fff', abbr: 'DS' },
  alibaba:    { label: 'Alibaba',    bg: '#FF6A00', text: '#fff', abbr: 'Q'  },
  minimax:    { label: 'MiniMax',    bg: '#ec4899', text: '#fff', abbr: 'MM' },
  zai:        { label: 'ZAI',        bg: '#ca8a04', text: '#fff', abbr: 'Z'  },
};

function ProviderIcon({ provider }: { provider: Provider }) {
  const meta = providerMeta[provider];
  if (!meta) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold leading-none ring-2 ring-background"
            style={{ background: meta.bg, color: meta.text }}
          >
            {meta.abbr}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{meta.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CapabilityIcon({ cap }: { cap: Capability }) {
  const def = capabilityIcons[cap];
  if (!def) return null;
  const Icon = def.icon;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Icon className={`size-4 shrink-0 ${def.color}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{def.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function buildColumns(
  enabledModelIds: string[],
  toggleModel: (id: string) => void,
  toggleAll: (enable: boolean, visibleIds: string[]) => void,
): ColumnDef<ModelOption>[] {
  return [
  {
    id: 'enabled',
    header: ({ table }) => {
      const visibleIds = table.getRowModel().rows.map((r) => r.original.id);
      const allEnabled = visibleIds.length > 0 && visibleIds.every((id) => enabledModelIds.includes(id));
      const someEnabled = visibleIds.some((id) => enabledModelIds.includes(id));
      return (
        <Checkbox
          checked={allEnabled || (someEnabled ? 'indeterminate' : false)}
          onCheckedChange={(value) => toggleAll(!!value, visibleIds)}
          aria-label="Toggle all"
        />
      );
    },
    cell: ({ row }) => {
      const isEnabled = enabledModelIds.includes(row.original.id);
      return (
        <Checkbox
          checked={isEnabled}
          onCheckedChange={() => toggleModel(row.original.id)}
          aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${row.original.name}`}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Model
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-foreground">{row.getValue('name')}</p>
      </div>
    ),
  },
  {
    accessorKey: 'provider',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Provider
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => (
      <ProviderIcon provider={row.getValue('provider') as Provider} />
    ),
  },
  {
    accessorKey: 'capabilities',
    header: 'Capabilities',
    cell: ({ row }) => {
      const caps = row.getValue('capabilities') as Capability[] | undefined;
      if (!caps?.length) return <span className="text-sm text-muted-foreground">—</span>;
      return (
        <div className="flex items-center gap-1.5">
          {caps.map((cap) => <CapabilityIcon key={cap} cap={cap} />)}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: 'context',
    header: 'Context',
    cell: ({ row }) => (
      <span className="text-sm">{row.getValue('context') ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'latency',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Latency
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => {
      const val = row.getValue('latency') as number | undefined;
      return <span className="text-sm">{val != null ? `${val}s` : '—'}</span>;
    },
  },
  {
    accessorKey: 'throughput',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Throughput
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => {
      const val = row.getValue('throughput') as number | undefined;
      return <span className="text-sm">{val != null ? `${val} t/s` : '—'}</span>;
    },
  },
  {
    accessorKey: 'inputCost',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Input $/1M
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => {
      const val = row.getValue('inputCost') as number | undefined;
      return <span className="text-sm">{val != null ? `$${val}` : '—'}</span>;
    },
  },
  {
    accessorKey: 'outputCost',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Output $/1M
        <ChevronsUpDown className="ml-2 h-3.5 w-3.5" />
      </Button>
    ),
    cell: ({ row }) => {
      const val = row.getValue('outputCost') as number | undefined;
      return <span className="text-sm">{val != null ? `$${val}` : '—'}</span>;
    },
  },
  
];}

export function ModelsTable() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const { enabledModelIds, enabledModels, toggleModel, setEnabledModelIds } = useEnabledModels();

  const toggleAll = React.useCallback(
    (enable: boolean, visibleIds: string[]) => {
      if (enable) {
        setEnabledModelIds(Array.from(new Set([...enabledModelIds, ...visibleIds])));
      } else {
        const remaining = enabledModelIds.filter((id) => !visibleIds.includes(id));
        if (remaining.length > 0) setEnabledModelIds(remaining);
      }
    },
    [enabledModelIds, setEnabledModelIds]
  );

  const columns = React.useMemo(
    () => buildColumns(enabledModelIds, toggleModel, toggleAll),
    [enabledModelIds, toggleModel, toggleAll]
  );

  const table = useReactTable({
    data: availableModels as ModelOption[],
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: { sorting, columnFilters, columnVisibility },
    initialState: { pagination: { pageSize: 20 } },
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-black/5 dark:border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">AI Models</h2>
        <p className="text-sm text-muted-foreground">
          {enabledModels.length} of {availableModels.length} models enabled · {new Set(availableModels.map((m) => m.provider)).size} providers
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-6 py-3">
        <Input
          placeholder="Search models..."
          value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
          onChange={(e) => table.getColumn('name')?.setFilterValue(e.target.value)}
          className="max-w-xs"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto">
              Columns <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  className="capitalize"
                  checked={col.getIsVisible()}
                  onCheckedChange={(value) => col.toggleVisibility(!!value)}
                >
                  {col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6">
        <div className="overflow-hidden rounded-md border border-black/5 dark:border-border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                    No models found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-black/5 dark:border-border">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} model(s)
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
