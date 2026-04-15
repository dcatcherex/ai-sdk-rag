'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminAiTrendsResponse } from '../types';

export const CHART_COLORS = {
  chat: '#6366f1',
  workspace: '#8b5cf6',
  tool: '#f59e0b',
  error: '#ef4444',
  tokens: '#06b6d4',
  credits: '#10b981',
} as const;

const TOOLTIP_STYLE = {
  contentStyle: { fontSize: 12, borderRadius: 8, border: '1px solid oklch(0.9 0 0)' },
};

// ── Types ──────────────────────────────────────────────────────────────────

export type DailyChartRow = {
  day: string;
  chatRuns: number;
  workspaceRuns: number;
  toolRuns: number;
  totalRuns: number;
  errorRate: number;
  tokens: number;
  credits: number;
};

export function buildChartData(daily: AdminAiTrendsResponse['daily']): DailyChartRow[] {
  return daily.map((d) => ({
    day: d.day.slice(5),
    chatRuns: d.chat.runCount,
    workspaceRuns: d.workspace.runCount,
    toolRuns: d.tool.runCount,
    totalRuns: d.totalRuns,
    errorRate: d.totalRuns > 0 ? Math.round((d.totalErrors / d.totalRuns) * 1000) / 10 : 0,
    tokens: d.totalTokens,
    credits: d.totalCredits,
  }));
}

// ── Shared helpers ────────────────────────────────────────────────────────

function calcDelta(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

export function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  const delta = calcDelta(current, prev);
  if (delta === null) return null;
  const isUp = delta >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isUp ? 'text-emerald-600' : 'text-rose-600'
      }`}
    >
      {isUp ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
      {isUp ? '+' : ''}
      {delta}%
    </span>
  );
}

export function KpiCard({
  title,
  value,
  sub,
  prev,
  colorClass,
}: {
  title: string;
  value: string | number;
  sub?: string;
  prev?: number;
  colorClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className={`text-2xl font-bold ${colorClass ?? ''}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        {prev !== undefined && typeof value === 'number' && (
          <DeltaBadge current={value} prev={prev} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Chart components ─────────────────────────────────────────────────────

export function RunsOverTimeChart({ data }: { data: DailyChartRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Runs Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              {(['chat', 'workspace', 'tool'] as const).map((key) => (
                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[key]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS[key]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0 0)" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={(v) => `Date: ${v}`} />
            <Area type="monotone" dataKey="chatRuns" stackId="1" stroke={CHART_COLORS.chat} fill="url(#grad-chat)" name="Chat" strokeWidth={1.5} />
            <Area type="monotone" dataKey="workspaceRuns" stackId="1" stroke={CHART_COLORS.workspace} fill="url(#grad-workspace)" name="Workspace" strokeWidth={1.5} />
            <Area type="monotone" dataKey="toolRuns" stackId="1" stroke={CHART_COLORS.tool} fill="url(#grad-tool)" name="Tools" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          {(['chat', 'workspace', 'tool'] as const).map((key) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full" style={{ backgroundColor: CHART_COLORS[key] }} />
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ErrorRateChart({ data }: { data: DailyChartRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Error Rate Over Time (%)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0 0)" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} unit="%" />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v) => [`${v}%`, 'Error rate']}
              labelFormatter={(v) => `Date: ${v}`}
            />
            <Line type="monotone" dataKey="errorRate" stroke={CHART_COLORS.error} strokeWidth={2} dot={false} name="Error rate" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TokenUsageChart({ data }: { data: DailyChartRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Token Usage Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="grad-tokens" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.tokens} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.tokens} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0 0)" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v) => [typeof v === 'number' ? v.toLocaleString() : v, 'Tokens']}
              labelFormatter={(v) => `Date: ${v}`}
            />
            <Area type="monotone" dataKey="tokens" stroke={CHART_COLORS.tokens} fill="url(#grad-tokens)" strokeWidth={1.5} name="Tokens" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function CreditsChart({ data }: { data: DailyChartRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Credits Used Per Day</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0 0)" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v) => [v, 'Credits']}
              labelFormatter={(v) => `Date: ${v}`}
            />
            <Bar dataKey="credits" fill={CHART_COLORS.credits} name="Credits" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ── Runtime breakdown ─────────────────────────────────────────────────────

export function RuntimeBreakdownCard({
  label,
  color,
  runCount,
  errorCount,
  tokenTotal,
  creditTotal,
  totalRuns,
}: {
  label: string;
  color: string;
  runCount: number;
  errorCount: number;
  tokenTotal: number;
  creditTotal: number;
  totalRuns: number;
}) {
  const share = totalRuns > 0 ? Math.round((runCount / totalRuns) * 100) : 0;
  const errRate = runCount > 0 ? Math.round((errorCount / runCount) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold">{runCount}</span>
          <span className="text-xs text-muted-foreground">{share}% of total</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${share}%`, backgroundColor: color }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Error rate</div>
            <div className={`font-medium ${errRate > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {errRate}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Tokens</div>
            <div className="font-medium">{tokenTotal.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Credits</div>
            <div className="font-medium">{creditTotal}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Cost/run</div>
            <div className="font-medium">
              {runCount > 0 ? (creditTotal / runCount).toFixed(2) : '—'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
