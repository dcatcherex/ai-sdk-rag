import type { z } from 'zod';
import type { cropPriceLookupOutputSchema, marketSummaryOutputSchema } from './schema';

export type CropPriceLookupOutput = z.infer<typeof cropPriceLookupOutputSchema>;
export type MarketSummaryOutput = z.infer<typeof marketSummaryOutputSchema>;

export type CropCode =
  | 'rice'
  | 'cassava'
  | 'sugarcane'
  | 'rubber'
  | 'maize'
  | 'palm_oil'
  | 'durian'
  | 'longan'
  | 'coconut'
  | 'soybean';

export type PriceSource = 'oae' | 'dit' | 'baac';

export interface CropMeta {
  thaiName: string;
  unit: string;
  oaeKeyword: string;
}

export const CROP_META: Record<CropCode, CropMeta> = {
  rice:     { thaiName: 'ข้าวเปลือก',     unit: 'บาท/ตัน',   oaeKeyword: 'ข้าวเปลือก' },
  cassava:  { thaiName: 'มันสำปะหลัง',    unit: 'บาท/กก.',   oaeKeyword: 'มันสำปะหลัง' },
  sugarcane:{ thaiName: 'อ้อย',           unit: 'บาท/ตัน',   oaeKeyword: 'อ้อย' },
  rubber:   { thaiName: 'ยางพารา',        unit: 'บาท/กก.',   oaeKeyword: 'ยางพารา' },
  maize:    { thaiName: 'ข้าวโพดเลี้ยงสัตว์', unit: 'บาท/กก.', oaeKeyword: 'ข้าวโพด' },
  palm_oil: { thaiName: 'ปาล์มน้ำมัน',   unit: 'บาท/กก.',   oaeKeyword: 'ปาล์มน้ำมัน' },
  durian:   { thaiName: 'ทุเรียน',        unit: 'บาท/กก.',   oaeKeyword: 'ทุเรียน' },
  longan:   { thaiName: 'ลำไย',           unit: 'บาท/กก.',   oaeKeyword: 'ลำไย' },
  coconut:  { thaiName: 'มะพร้าว',        unit: 'บาท/ผล',    oaeKeyword: 'มะพร้าว' },
  soybean:  { thaiName: 'ถั่วเหลือง',     unit: 'บาท/กก.',   oaeKeyword: 'ถั่วเหลือง' },
};
