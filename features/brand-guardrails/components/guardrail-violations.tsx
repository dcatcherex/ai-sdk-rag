'use client';

import { CheckCircleIcon, AlertTriangleIcon, XCircleIcon, InfoIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { GuardrailCheckResult, GuardrailSeverity, GuardrailViolation } from '../types';

type Props = {
  result: GuardrailCheckResult;
};

function SeverityIcon({ severity }: { severity: GuardrailSeverity }) {
  if (severity === 'block') return <XCircleIcon className="size-4 text-destructive shrink-0" />;
  if (severity === 'warning') return <AlertTriangleIcon className="size-4 text-amber-500 shrink-0" />;
  return <InfoIcon className="size-4 text-blue-500 shrink-0" />;
}

function SeverityBadge({ severity }: { severity: GuardrailSeverity }) {
  const variant =
    severity === 'block'
      ? 'destructive'
      : severity === 'warning'
      ? 'default'
      : 'secondary';
  return (
    <Badge variant={variant as 'destructive' | 'default' | 'secondary'} className="text-[10px] px-1.5 py-0">
      {severity}
    </Badge>
  );
}

export function GuardrailViolations({ result }: Props) {
  if (result.passed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2.5">
        <CheckCircleIcon className="size-4 text-emerald-600 shrink-0" />
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Content passes all brand guardrails
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {result.violations.length} violation{result.violations.length !== 1 ? 's' : ''} found
      </p>
      {result.violations.map((v: GuardrailViolation) => (
        <div
          key={v.ruleId}
          className="rounded-lg border border-black/5 dark:border-border bg-muted/30 px-3 py-2.5 space-y-1"
        >
          <div className="flex items-center gap-2">
            <SeverityIcon severity={v.severity} />
            <span className="text-sm font-medium flex-1">{v.title}</span>
            <SeverityBadge severity={v.severity} />
          </div>
          {v.excerpt && (
            <p className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1 truncate">
              …{v.excerpt}…
            </p>
          )}
          {v.suggestion && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Suggestion:</span> {v.suggestion}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
