import type { RichMenuBounds } from '@/db/schema';

export type SizeType = 'large' | 'compact';

export type LayoutDef = {
  id: string;
  sizeType: SizeType;
  width: 2500;
  height: number;      // 1686 (large) or 843 (compact)
  areas: RichMenuBounds[];
  label: string;       // human-readable e.g. "3 columns"
};

// ── Large: 2500 × 1686 ───────────────────────────────────────────────────────

const L = 2500;
const LH = 1686;
const LHH = LH / 2;   // 843 — half height for large

export const LARGE_LAYOUTS: LayoutDef[] = [
  {
    id: 'large-3x2',
    sizeType: 'large',
    width: 2500,
    height: LH,
    label: '3 × 2 grid',
    areas: [
      { x: 0,    y: 0,   width: 833,  height: LHH },
      { x: 833,  y: 0,   width: 834,  height: LHH },
      { x: 1667, y: 0,   width: 833,  height: LHH },
      { x: 0,    y: LHH, width: 833,  height: LHH },
      { x: 833,  y: LHH, width: 834,  height: LHH },
      { x: 1667, y: LHH, width: 833,  height: LHH },
    ],
  },
  {
    id: 'large-2x2',
    sizeType: 'large',
    width: 2500,
    height: LH,
    label: '2 × 2 grid',
    areas: [
      { x: 0,    y: 0,   width: 1250, height: LHH },
      { x: 1250, y: 0,   width: 1250, height: LHH },
      { x: 0,    y: LHH, width: 1250, height: LHH },
      { x: 1250, y: LHH, width: 1250, height: LHH },
    ],
  },
  {
    id: 'large-3top-1bottom',
    sizeType: 'large',
    width: 2500,
    height: LH,
    label: '3 top + 1 wide bottom',
    areas: [
      { x: 0,    y: 0,   width: 833,  height: LHH },
      { x: 833,  y: 0,   width: 834,  height: LHH },
      { x: 1667, y: 0,   width: 833,  height: LHH },
      { x: 0,    y: LHH, width: L,    height: LHH },
    ],
  },
  {
    id: 'large-1top-3bottom',
    sizeType: 'large',
    width: 2500,
    height: LH,
    label: '1 wide top + 3 bottom',
    areas: [
      { x: 0,    y: 0,   width: L,    height: LHH },
      { x: 0,    y: LHH, width: 833,  height: LHH },
      { x: 833,  y: LHH, width: 834,  height: LHH },
      { x: 1667, y: LHH, width: 833,  height: LHH },
    ],
  },
  {
    id: 'large-1left-2right',
    sizeType: 'large',
    width: 2500,
    height: LH,
    label: '1 left tall + 2 right',
    areas: [
      { x: 0,    y: 0,   width: 1250, height: LH  },
      { x: 1250, y: 0,   width: 1250, height: LHH },
      { x: 1250, y: LHH, width: 1250, height: LHH },
    ],
  },
  {
    id: 'large-2left-1right',
    sizeType: 'large',
    width: 2500,
    height: LH,
    label: '2 left + 1 right tall',
    areas: [
      { x: 0,    y: 0,   width: 1250, height: LHH },
      { x: 0,    y: LHH, width: 1250, height: LHH },
      { x: 1250, y: 0,   width: 1250, height: LH  },
    ],
  },
  {
    id: 'large-1top-2bottom',
    sizeType: 'large',
    width: 2500,
    height: LH,
    label: '1 wide top + 2 bottom',
    areas: [
      { x: 0,    y: 0,   width: L,    height: LHH },
      { x: 0,    y: LHH, width: 1250, height: LHH },
      { x: 1250, y: LHH, width: 1250, height: LHH },
    ],
  },
  {
    id: 'large-full',
    sizeType: 'large',
    width: 2500,
    height: LH,
    label: '1 full',
    areas: [{ x: 0, y: 0, width: L, height: LH }],
  },
];

// ── Compact: 2500 × 843 ──────────────────────────────────────────────────────

const CH = 843;

export const COMPACT_LAYOUTS: LayoutDef[] = [
  {
    id: 'compact-3col',
    sizeType: 'compact',
    width: 2500,
    height: CH,
    label: '3 columns',
    areas: [
      { x: 0,    y: 0, width: 833,  height: CH },
      { x: 833,  y: 0, width: 834,  height: CH },
      { x: 1667, y: 0, width: 833,  height: CH },
    ],
  },
  {
    id: 'compact-2col',
    sizeType: 'compact',
    width: 2500,
    height: CH,
    label: '2 columns',
    areas: [
      { x: 0,    y: 0, width: 1250, height: CH },
      { x: 1250, y: 0, width: 1250, height: CH },
    ],
  },
  {
    id: 'compact-wide-left',
    sizeType: 'compact',
    width: 2500,
    height: CH,
    label: 'Wide left + narrow right',
    areas: [
      { x: 0,    y: 0, width: 1667, height: CH },
      { x: 1667, y: 0, width: 833,  height: CH },
    ],
  },
  {
    id: 'compact-narrow-left',
    sizeType: 'compact',
    width: 2500,
    height: CH,
    label: 'Narrow left + wide right',
    areas: [
      { x: 0,    y: 0, width: 833,  height: CH },
      { x: 833,  y: 0, width: 1667, height: CH },
    ],
  },
  {
    id: 'compact-full',
    sizeType: 'compact',
    width: 2500,
    height: CH,
    label: '1 full width',
    areas: [{ x: 0, y: 0, width: L, height: CH }],
  },
];

export const ALL_LAYOUTS: LayoutDef[] = [...LARGE_LAYOUTS, ...COMPACT_LAYOUTS];

export function getLayout(id: string): LayoutDef | undefined {
  return ALL_LAYOUTS.find((l) => l.id === id);
}
