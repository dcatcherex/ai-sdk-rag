'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboardIcon,
  ShareIcon,
  FileTextIcon,
  CalendarIcon,
  BarChart2Icon,
  SettingsIcon,
  TrendingUpIcon,
} from 'lucide-react';
import { HubOverviewTab } from './hub-overview-tab';
import { HubSocialTab } from './hub-social-tab';
import { HubTrendsTab } from './hub-trends-tab';
import { HubLongformTab } from './hub-longform-tab';
import { HubPlanTab } from './hub-plan-tab';
import { HubMeasureTab } from './hub-measure-tab';
import { HubSettingsTab } from './hub-settings-tab';
import type { SocialPlatform } from '@/features/content-marketing/types';

type Tab = 'overview' | 'social' | 'trends' | 'longform' | 'plan' | 'measure' | 'settings';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',  label: 'Overview',   icon: <LayoutDashboardIcon className="size-4" /> },
  { id: 'social',    label: 'Social',     icon: <ShareIcon className="size-4" /> },
  { id: 'trends',    label: 'Trends',     icon: <TrendingUpIcon className="size-4" /> },
  { id: 'longform',  label: 'Long-form',  icon: <FileTextIcon className="size-4" /> },
  { id: 'plan',      label: 'Plan',       icon: <CalendarIcon className="size-4" /> },
  { id: 'measure',   label: 'Measure',    icon: <BarChart2Icon className="size-4" /> },
  { id: 'settings',  label: 'Settings',   icon: <SettingsIcon className="size-4" /> },
];

export function ContentHubPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialTab = (searchParams.get('tab') as Tab) ?? 'overview';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const handleNavigate = (tab: string, extra?: Record<string, string>) => {
    const t = tab as Tab;
    setActiveTab(t);
    const params = new URLSearchParams();
    if (t !== 'overview') params.set('tab', t);
    if (extra) {
      for (const [k, v] of Object.entries(extra)) params.set(k, v);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Sync if URL changes externally (back/forward, returnTo redirects)
  useEffect(() => {
    const t = (searchParams.get('tab') as Tab) ?? 'overview';
    setActiveTab(t);
  }, [searchParams]);

  const handleUseTrend = (platform: SocialPlatform, topic: string) => {
    handleNavigate('social', { platform, topic: encodeURIComponent(topic) });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Content Hub</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Plan, create, distribute, and measure your content — all in one place.
        </p>
      </div>

      {/* Tab nav */}
      <div className="border-b shrink-0">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Content hub tabs">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleNavigate(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
                activeTab === id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeTab === 'overview'  && <HubOverviewTab onNavigate={handleNavigate} />}
        {activeTab === 'social'    && <HubSocialTab />}
        {activeTab === 'trends'    && <HubTrendsTab onUseTrend={handleUseTrend} />}
        {activeTab === 'longform'  && <HubLongformTab />}
        {activeTab === 'plan'      && <HubPlanTab />}
        {activeTab === 'measure'   && <HubMeasureTab />}
        {activeTab === 'settings'  && <HubSettingsTab />}
      </div>
    </div>
  );
}
