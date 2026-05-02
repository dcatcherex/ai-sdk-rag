'use client';

import { useState } from 'react';
import type { ToolManifest } from '@/features/tools/registry/types';
import type { CropPriceLookupOutput, MarketSummaryOutput } from '../types';
import { CROP_META } from '../types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const CROP_OPTIONS = Object.entries(CROP_META).map(([code, meta]) => ({
  code,
  label: `${meta.thaiName} (${code})`,
}));

function PriceLookupTab() {
  const [crop, setCrop] = useState('rice');
  const [province, setProvince] = useState('');
  const [result, setResult] = useState<CropPriceLookupOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tools/crop-price/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop, province: province || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">พืช / Crop</label>
          <Select value={crop} onValueChange={setCrop}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CROP_OPTIONS.map((o) => (
                <SelectItem key={o.code} value={o.code}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">จังหวัด (ไม่จำเป็น)</label>
          <Input
            placeholder="เช่น นครราชสีมา, เชียงใหม่"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          />
        </div>
      </div>

      <Button onClick={handleLookup} disabled={loading} className="w-full sm:w-auto">
        {loading ? 'กำลังดึงข้อมูล...' : 'ดูราคา'}
      </Button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <div className="rounded-xl border bg-white/60 dark:bg-zinc-800/60 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base">{result.thaiName}</span>
            <Badge variant="outline">{result.unit}</Badge>
            <Badge variant={result.source === 'unavailable' ? 'destructive' : 'secondary'}>
              {result.sourceLabel}
            </Badge>
          </div>

          {result.prices.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1 text-left">ภูมิภาค / จังหวัด</th>
                  <th className="py-1 text-right">ราคา</th>
                  <th className="py-1 text-right">วันที่</th>
                </tr>
              </thead>
              <tbody>
                {result.prices.map((p, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5">{p.region}</td>
                    <td className="py-1.5 text-right font-medium">{p.priceDisplay}</td>
                    <td className="py-1.5 text-right text-muted-foreground text-xs">{p.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">{result.note}</p>
          )}

          <p className="text-xs text-muted-foreground">
            ดึงข้อมูลเมื่อ: {new Date(result.fetchedAt).toLocaleString('th-TH')}{' '}
            |{' '}
            <a
              href={result.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              แหล่งที่มา
            </a>
          </p>
        </div>
      )}
    </div>
  );
}

function MarketSummaryTab() {
  const [crop, setCrop] = useState('rice');
  const [result, setResult] = useState<MarketSummaryOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSummary() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tools/crop-price/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop }),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  const trendLabel: Record<string, string> = {
    up: 'ราคาขาขึ้น',
    down: 'ราคาขาลง',
    stable: 'ราคาทรงตัว',
    unknown: 'ไม่ทราบแนวโน้ม',
  };

  const trendVariant: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
    up: 'default',
    down: 'destructive',
    stable: 'secondary',
    unknown: 'outline',
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1 max-w-xs">
        <label className="text-sm font-medium">พืช / Crop</label>
        <Select value={crop} onValueChange={setCrop}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CROP_OPTIONS.map((o) => (
              <SelectItem key={o.code} value={o.code}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleSummary} disabled={loading} className="w-full sm:w-auto">
        {loading ? 'กำลังวิเคราะห์...' : 'ดูภาพรวมตลาด'}
      </Button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <div className="rounded-xl border bg-white/60 dark:bg-zinc-800/60 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base">{result.thaiName}</span>
            <Badge variant={trendVariant[result.trend]}>{trendLabel[result.trend]}</Badge>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">ราคาปัจจุบัน</p>
            <p className="text-sm">{result.currentPriceSummary}</p>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">ปัจจัยที่ควรติดตาม</p>
            <ul className="list-disc list-inside text-sm space-y-0.5">
              {result.keyFactors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">แนะนำการตัดสินใจ</p>
            <p className="text-sm">{result.sellTiming}</p>
          </div>

          <p className="text-xs text-muted-foreground border-t pt-2">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

export function CropPriceToolPage({ manifest }: { manifest: ToolManifest }) {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{manifest.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{manifest.description}</p>
      </div>

      <Tabs defaultValue="lookup">
        <TabsList>
          <TabsTrigger value="lookup">ดูราคาพืช</TabsTrigger>
          <TabsTrigger value="summary">ภาพรวมตลาด</TabsTrigger>
        </TabsList>

        <TabsContent value="lookup" className="pt-4">
          <PriceLookupTab />
        </TabsContent>

        <TabsContent value="summary" className="pt-4">
          <MarketSummaryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
