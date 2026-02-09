'use client';

import { CoinsIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCredits } from '@/lib/hooks/use-credits';

export const CreditBalanceDisplay = () => {
  const { balance, isLoading } = useCredits();

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1.5 text-xs text-muted-foreground">
        <CoinsIcon className="size-3" />
        <span>…</span>
      </Badge>
    );
  }

  const isLow = balance <= 10;
  const isEmpty = balance <= 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isEmpty ? 'destructive' : isLow ? 'secondary' : 'outline'}
            className="gap-1.5 text-xs"
          >
            <CoinsIcon className="size-3" />
            <span>{balance}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {isEmpty
              ? 'No credits remaining. Contact admin for more.'
              : isLow
                ? `Low credits: ${balance} remaining`
                : `${balance} credits remaining`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
