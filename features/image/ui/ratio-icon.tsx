'use client';

import { ASPECT_RATIO_DIMS } from '../types';

export function RatioIcon({ ratio, size = 16 }: { ratio: string; size?: number }) {
  const [w, h] = ASPECT_RATIO_DIMS[ratio] ?? [size, size];
  const scale = size / Math.max(w, h);
  const pw = Math.round(w * scale);
  const ph = Math.round(h * scale);
  return (
    <span
      className="inline-block rounded-[2px] border border-current opacity-70 shrink-0"
      style={{ width: pw, height: ph }}
    />
  );
}
