'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Props = {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onApplyShortcut: (days: number) => void;
  onClear: () => void;
};

export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onApplyShortcut,
  onClear,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Date Range</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onApplyShortcut(7)}>
            Last 7d
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onApplyShortcut(30)}>
            Last 30d
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClear}>
            All time
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="mb-1.5 text-sm font-medium">From</div>
            <Input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} />
          </div>
          <div>
            <div className="mb-1.5 text-sm font-medium">To</div>
            <Input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={onClear}>
              Clear range
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
