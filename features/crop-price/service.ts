import { nanoid } from 'nanoid';
import type { ToolExecutionResult } from '@/features/tools/registry/types';
import type { CropPriceLookupOutput, MarketSummaryOutput, CropCode } from './types';
import { CROP_META } from './types';
import type { z } from 'zod';
import type { cropPriceLookupInputSchema, marketSummaryInputSchema } from './schema';

type LookupInput = z.infer<typeof cropPriceLookupInputSchema>;
type SummaryInput = z.infer<typeof marketSummaryInputSchema>;

// In-memory price cache: key = `${crop}:${province|'all'}`, TTL = 1 hour
const priceCache = new Map<string, { data: CropPriceLookupOutput; expiresAt: number }>();
const CACHE_TTL = 60 * 60 * 1000;

const OAE_SOURCES: Record<CropCode, string> = {
  rice:      'https://www.oae.go.th/view/1/ราคาข้าว/TH-TH',
  cassava:   'https://www.oae.go.th/view/1/ราคามันสำปะหลัง/TH-TH',
  sugarcane: 'https://www.oae.go.th/view/1/ราคาอ้อย/TH-TH',
  rubber:    'https://www.rubber.co.th/rubber-price/',
  maize:     'https://www.oae.go.th/view/1/ราคาข้าวโพด/TH-TH',
  palm_oil:  'https://www.oae.go.th/view/1/ราคาปาล์มน้ำมัน/TH-TH',
  durian:    'https://www.oae.go.th/view/1/ราคาทุเรียน/TH-TH',
  longan:    'https://www.oae.go.th/view/1/ราคาลำไย/TH-TH',
  coconut:   'https://www.oae.go.th/view/1/ราคามะพร้าว/TH-TH',
  soybean:   'https://www.oae.go.th/view/1/ราคาถั่วเหลือง/TH-TH',
};

async function fetchOAEPage(crop: CropCode): Promise<string | null> {
  try {
    const url = OAE_SOURCES[crop];
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VajaBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function parsePriceTable(html: string, crop: CropCode): CropPriceLookupOutput['prices'] {
  const meta = CROP_META[crop];
  const prices: CropPriceLookupOutput['prices'] = [];

  // Match <tr> rows containing price data (numbers with decimal)
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim();

  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowText = rowMatch[1];
    const cells: string[] = [];
    let cellMatch;
    const cellRe = new RegExp(cellRegex.source, 'gi');
    while ((cellMatch = cellRe.exec(rowText)) !== null) {
      cells.push(stripTags(cellMatch[1]));
    }

    // Look for rows that contain a region name + a numeric price
    if (cells.length < 2) continue;
    const priceCell = cells.find((c) => /^\d{1,2},?\d{3}(\.\d+)?$|^\d{2,4}(\.\d+)?$/.test(c.replace(/,/g, '')));
    if (!priceCell) continue;

    const numericPrice = parseFloat(priceCell.replace(/,/g, ''));
    if (isNaN(numericPrice) || numericPrice < 1) continue;

    const region = cells[0] || 'ทั่วประเทศ';
    prices.push({
      region,
      price: numericPrice,
      priceDisplay: `${numericPrice.toLocaleString('th-TH')} ${meta.unit}`,
      date: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }),
    });

    if (prices.length >= 5) break;
  }

  return prices;
}

export async function runCropPriceLookup(input: LookupInput): Promise<CropPriceLookupOutput> {
  const crop = input.crop as CropCode;
  const meta = CROP_META[crop];
  const cacheKey = `${crop}:${input.province ?? 'all'}`;
  const fetchedAt = new Date().toISOString();

  const cached = priceCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const html = await fetchOAEPage(crop);

  if (html) {
    let prices = parsePriceTable(html, crop);

    // Filter by province if requested
    if (input.province && prices.length > 0) {
      const filtered = prices.filter((p) =>
        p.region.toLowerCase().includes(input.province!.toLowerCase()),
      );
      if (filtered.length > 0) prices = filtered;
    }

    if (prices.length > 0) {
      const result: CropPriceLookupOutput = {
        crop: input.crop,
        thaiName: meta.thaiName,
        unit: meta.unit,
        prices,
        source: 'oae',
        sourceLabel: 'สำนักงานเศรษฐกิจการเกษตร (OAE)',
        sourceUrl: OAE_SOURCES[crop],
        fetchedAt,
      };
      priceCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL });
      return result;
    }
  }

  // Fallback: return unavailable with source URL so agent/user can visit manually
  const result: CropPriceLookupOutput = {
    crop: input.crop,
    thaiName: meta.thaiName,
    unit: meta.unit,
    prices: [],
    source: 'unavailable',
    sourceLabel: 'ไม่สามารถดึงข้อมูลได้ในขณะนี้',
    sourceUrl: OAE_SOURCES[crop],
    fetchedAt,
    note: `ไม่สามารถดึงราคาอัตโนมัติได้ กรุณาตรวจสอบโดยตรงที่ ${OAE_SOURCES[crop]}`,
  };
  return result;
}

export async function cropPriceLookupAction(
  input: LookupInput,
): Promise<ToolExecutionResult<CropPriceLookupOutput>> {
  const data = await runCropPriceLookup(input);
  const meta = CROP_META[input.crop as CropCode];
  const topPrice = data.prices[0];

  return {
    tool: 'crop_price',
    runId: nanoid(),
    title: `ราคา${meta.thaiName} — ${data.sourceLabel}`,
    summary: topPrice
      ? `${meta.thaiName}: ${topPrice.priceDisplay} (${topPrice.region})`
      : `ไม่พบข้อมูลราคา${meta.thaiName}`,
    data,
    createdAt: new Date().toISOString(),
  };
}

export async function runMarketSummary(input: SummaryInput): Promise<MarketSummaryOutput> {
  const crop = input.crop as CropCode;
  const meta = CROP_META[crop];

  // Fetch live price to anchor the summary
  const priceData = await runCropPriceLookup({ crop: input.crop });
  const topPrice = priceData.prices[0];

  const currentPriceSummary = topPrice
    ? `ราคา${meta.thaiName}ล่าสุดอยู่ที่ ${topPrice.priceDisplay} (${topPrice.region}) ข้อมูล ณ ${topPrice.date}`
    : `ยังไม่สามารถดึงราคาปัจจุบันได้ กรุณาตรวจสอบที่ ${priceData.sourceUrl}`;

  const keyFactors: Record<CropCode, string[]> = {
    rice:      ['ราคาข้าวในตลาดโลก', 'ฤดูเก็บเกี่ยว', 'นโยบายราคาประกัน ธกส.', 'อัตราแลกเปลี่ยน'],
    cassava:   ['ความต้องการจากโรงงานแป้ง', 'ปริมาณผลผลิตในฤดูกาล', 'การนำเข้าจากเวียดนาม/กัมพูชา'],
    sugarcane: ['โควตาการผลิตน้ำตาล', 'ราคาน้ำตาลโลก', 'นโยบายรัฐ', 'ปริมาณน้ำฝน'],
    rubber:    ['ราคายางในตลาด SICOM/โตเกียว', 'ความต้องการจากจีน', 'ค่าเงินบาท', 'ปริมาณน้ำยาง'],
    maize:     ['ความต้องการอาหารสัตว์', 'ราคาข้าวโพดในตลาดชิคาโก', 'ปริมาณนำเข้า'],
    palm_oil:  ['ราคาน้ำมันปาล์มมาเลเซีย (BMD)', 'ความต้องการไบโอดีเซล', 'ปริมาณสต็อก'],
    durian:    ['การส่งออกไปจีน', 'ฤดูกาลผลไม้', 'คุณภาพผลผลิต', 'ราคาขนส่ง'],
    longan:    ['ความต้องการตลาดจีน', 'ฤดูกาลและสภาพอากาศ', 'การแข่งขันจากเวียดนาม'],
    coconut:   ['ความต้องการน้ำมันมะพร้าว', 'การส่งออก', 'อุตสาหกรรมเครื่องดื่ม'],
    soybean:   ['ราคาถั่วเหลืองชิคาโก', 'การนำเข้าจากสหรัฐ/บราซิล', 'ความต้องการอุตสาหกรรมอาหาร'],
  };

  return {
    crop: input.crop,
    thaiName: meta.thaiName,
    currentPriceSummary,
    trend: 'unknown',
    keyFactors: keyFactors[crop],
    sellTiming: 'ควรติดตามราคาต่อเนื่อง 3–5 วัน และเปรียบเทียบกับราคาประกันของ ธกส. ก่อนตัดสินใจขาย',
    disclaimer: 'ราคาเกษตรผันผวนตามฤดูกาล นโยบาย และตลาดโลก ข้อมูลนี้ใช้เพื่อประกอบการตัดสินใจเท่านั้น',
    fetchedAt: new Date().toISOString(),
  };
}

export async function marketSummaryAction(
  input: SummaryInput,
): Promise<ToolExecutionResult<MarketSummaryOutput>> {
  const data = await runMarketSummary(input);
  return {
    tool: 'crop_price',
    runId: nanoid(),
    title: `ภาพรวมตลาด${data.thaiName}`,
    summary: data.currentPriceSummary,
    data,
    createdAt: new Date().toISOString(),
  };
}
