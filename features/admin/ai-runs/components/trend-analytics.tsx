'use client';

import { Loader2Icon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  buildChartData,
  CHART_COLORS,
  CreditsChart,
  ErrorRateChart,
  KpiCard,
  RuntimeBreakdownCard,
  RunsOverTimeChart,
  TokenUsageChart,
} from './charts';
import type { AdminAiTrendsResponse } from '../types';

type Props = {
  data: AdminAiTrendsResponse | undefined;
  isLoading: boolean;
};

export function TrendAnalytics({ data, isLoading }: Props) {
  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading trend analytics...
        </CardContent>
      </Card>
    );
  }

  const { summary: s, prevSummary: p, avgLatencyMs } = data;
  const errorRate = s.totalRuns > 0 ? Math.round((s.totalErrors / s.totalRuns) * 1000) / 10 : 0;
  const avgTokens = s.totalRuns > 0 ? Math.round(s.totalTokens / s.totalRuns) : 0;
  const costPerRun = s.totalRuns > 0 ? (s.totalCredits / s.totalRuns).toFixed(2) : null;
  const chartData = buildChartData(data.daily);

  return (
    <>
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard title="Runs" value={s.totalRuns} sub="vs prev period" prev={p.totalRuns} />
        <KpiCard
          title="Errors"
          value={s.totalErrors}
          sub={`${errorRate}% error rate`}
          prev={p.totalErrors}
          colorClass={s.totalErrors > 0 ? 'text-rose-600' : 'text-emerald-600'}
        />
        <KpiCard
          title="Error Rate"
          value={`${errorRate}%`}
          colorClass={
            errorRate === 0 ? 'text-emerald-600' : errorRate < 5 ? 'text-amber-600' : 'text-rose-600'
          }
        />
        <KpiCard title="Avg Tokens / Run" value={avgTokens.toLocaleString()} sub="chat runs" />
        <KpiCard
          title="Cost / Run"
          value={costPerRun !== null ? `${costPerRun} cr` : '—'}
          sub="credits"
        />
        <KpiCard title="Total Credits" value={s.totalCredits} sub="vs prev period" prev={p.totalCredits} />
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RunsOverTimeChart data={chartData} />
        <ErrorRateChart data={chartData} />
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TokenUsageChart data={chartData} />
        <CreditsChart data={chartData} />
      </div>

      {/* Runtime breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        <RuntimeBreakdownCard
          label="Chat"
          color={CHART_COLORS.chat}
          runCount={s.byRuntime.chat.runCount}
          errorCount={s.byRuntime.chat.errorCount}
          tokenTotal={s.byRuntime.chat.tokenTotal}
          creditTotal={s.byRuntime.chat.creditTotal}
          totalRuns={s.totalRuns}
        />
        <RuntimeBreakdownCard
          label="Workspace AI"
          color={CHART_COLORS.workspace}
          runCount={s.byRuntime.workspace.runCount}
          errorCount={s.byRuntime.workspace.errorCount}
          tokenTotal={s.byRuntime.workspace.tokenTotal}
          creditTotal={s.byRuntime.workspace.creditTotal}
          totalRuns={s.totalRuns}
        />
        <RuntimeBreakdownCard
          label="Tools"
          color={CHART_COLORS.tool}
          runCount={s.byRuntime.tool.runCount}
          errorCount={s.byRuntime.tool.errorCount}
          tokenTotal={s.byRuntime.tool.tokenTotal}
          creditTotal={s.byRuntime.tool.creditTotal}
          totalRuns={s.totalRuns}
        />
      </div>

      {/* Avg latency (chat runs only) */}
      {avgLatencyMs !== null && (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <div className="text-sm font-medium text-muted-foreground">Avg Chat Response Time</div>
            <div className="text-lg font-bold">
              {avgLatencyMs >= 1000
                ? `${(avgLatencyMs / 1000).toFixed(1)}s`
                : `${avgLatencyMs}ms`}
            </div>
            <div className="text-xs text-muted-foreground">completed chat runs only</div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
