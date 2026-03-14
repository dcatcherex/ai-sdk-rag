'use client';

import { ExternalLinkIcon, MessageSquareIcon } from 'lucide-react';
import type { Brand } from '../types';
import { useBrandAssets, useBrandStats } from '../hooks/use-brands';

function ColorSwatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="h-10 w-10 rounded-full border border-black/8 dark:border-white/10 shadow-sm"
        style={{ background: hex }}
      />
      <span className="font-mono text-[10px] text-muted-foreground">{hex}</span>
      <span className="text-[10px] text-muted-foreground capitalize">{label}</span>
    </div>
  );
}

function ChipGroup({ items, label }: { items: string[]; label: string }) {
  if (!items.length) return null;
  return (
    <div className="rounded-xl border border-black/5 dark:border-border p-4">
      <p className="mb-3 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((v) => (
          <span
            key={v}
            className="rounded-lg border border-black/10 dark:border-border px-3 py-1 text-sm"
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BrandPreview({ brand }: { brand: Brand }) {
  const { data: assets = [] } = useBrandAssets(brand.id);
  const { data: stats } = useBrandStats(brand.id);

  const logoAsset = assets.find((a) => a.kind === 'logo');
  const imageAssets = assets.filter((a) => a.mimeType.startsWith('image/') && a.kind !== 'logo');
  const colors = brand.colors.filter((c) => c.hex);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-xl border border-black/5 dark:border-border px-5 py-4">
        <h2 className="text-2xl font-bold">{brand.name}</h2>
        {brand.websiteUrl && (
          <a
            href={brand.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLinkIcon className="size-3.5" />
            {brand.websiteUrl}
          </a>
        )}
        {brand.targetAudience && (
          <p className="mt-1.5 text-sm text-muted-foreground">{brand.targetAudience}</p>
        )}
      </div>

      {/* Logo + Fonts */}
      {(logoAsset || brand.fonts.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {logoAsset && (
            <div
              className="flex items-center justify-center rounded-xl border border-black/5 dark:border-border p-5"
              style={brand.colors[3]?.hex ? { background: brand.colors[3].hex } : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoAsset.url}
                alt="Logo"
                className="max-h-20 max-w-full object-contain"
              />
            </div>
          )}
          {brand.fonts.length > 0 && (
            <div className="rounded-xl border border-black/5 dark:border-border p-4">
              <p className="mb-3 text-sm font-semibold">Fonts</p>
              <div className="flex flex-wrap gap-5">
                {brand.fonts.map((font) => (
                  <div key={font} className="text-center">
                    <p
                      className="text-3xl"
                      style={{ fontFamily: font, color: brand.colors[0]?.hex ?? undefined }}
                    >
                      Aa
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{font}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Colors */}
      {colors.length > 0 && (
        <div className="rounded-xl border border-black/5 dark:border-border p-4">
          <p className="mb-4 text-sm font-semibold">Colors</p>
          <div className="flex flex-wrap gap-6">
            {colors.map((c) => (
              <ColorSwatch key={c.label} hex={c.hex} label={c.label} />
            ))}
          </div>
        </div>
      )}

      {/* Aesthetics + Tone */}
      {(brand.visualAesthetics.length > 0 || brand.toneOfVoice.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <ChipGroup items={brand.visualAesthetics} label="Brand aesthetic" />
          <ChipGroup items={brand.toneOfVoice} label="Brand tone of voice" />
        </div>
      )}

      {/* Brand values */}
      <ChipGroup items={brand.brandValues} label="Brand values" />

      {/* Overview */}
      {brand.overview && (
        <div className="rounded-xl border border-black/5 dark:border-border p-4">
          <p className="mb-2 text-sm font-semibold">Business overview</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{brand.overview}</p>
        </div>
      )}

      {/* Writing guidelines */}
      {(brand.writingDos || brand.writingDonts) && (
        <div
          className={`grid gap-3 ${brand.writingDos && brand.writingDonts ? 'grid-cols-2' : 'grid-cols-1'}`}
        >
          {brand.writingDos && (
            <div className="rounded-xl border border-black/5 dark:border-border p-4">
              <p className="mb-2 text-sm font-semibold">Writing do&apos;s</p>
              <p className="text-sm text-muted-foreground">{brand.writingDos}</p>
            </div>
          )}
          {brand.writingDonts && (
            <div className="rounded-xl border border-black/5 dark:border-border p-4">
              <p className="mb-2 text-sm font-semibold">Writing don&apos;ts</p>
              <p className="text-sm text-muted-foreground">{brand.writingDonts}</p>
            </div>
          )}
        </div>
      )}

      {/* Image gallery */}
      {imageAssets.length > 0 && (
        <div className="rounded-xl border border-black/5 dark:border-border p-4">
          <p className="mb-3 text-sm font-semibold">
            Assets{' '}
            <span className="font-normal text-muted-foreground">({imageAssets.length})</span>
          </p>
          <div className="grid grid-cols-4 gap-2">
            {imageAssets.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.id}
                src={a.url}
                alt={a.title}
                title={a.title}
                className="aspect-square rounded-lg object-cover"
              />
            ))}
          </div>
        </div>
      )}

      {/* Usage */}
      {stats !== undefined && (
        <div className="rounded-xl border border-black/5 dark:border-border p-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareIcon className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">
              {stats.threadCount === 0
                ? 'No conversations yet'
                : `${stats.threadCount} conversation${stats.threadCount !== 1 ? 's' : ''}`}
            </p>
          </div>
          {stats.recentThreads.length > 0 && (
            <ul className="space-y-1">
              {stats.recentThreads.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-black/3 dark:hover:bg-white/5">
                  <span className="truncate text-sm text-muted-foreground">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground/60">
                    {new Date(t.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
