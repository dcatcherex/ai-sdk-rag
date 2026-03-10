// Speed / cost dot indicators shared by model selector and compare picker

export function speedTier(model: { throughput?: number } | undefined): number {
  if (!model?.throughput) return 1;
  if (model.throughput >= 200) return 3;
  if (model.throughput >= 80) return 2;
  return 1;
}

export function costTier(model: { inputCost?: number } | undefined): number {
  if (!model?.inputCost) return 1;
  if (model.inputCost >= 2) return 3;
  if (model.inputCost >= 0.4) return 2;
  return 1;
}

export const Dots = ({ filled, color }: { filled: number; color: string }) => (
  <div className="flex gap-0.5">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className={`size-1.5 rounded-full ${i < filled ? color : 'bg-zinc-200 dark:bg-zinc-700'}`}
      />
    ))}
  </div>
);
