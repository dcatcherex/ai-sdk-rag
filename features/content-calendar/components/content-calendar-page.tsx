'use client';

import { useState } from 'react';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBrands } from '@/features/brands/hooks/use-brands';
import {
  useCalendarEntries,
  useKanbanEntries,
  useCampaignBriefs,
} from '../hooks/use-calendar';
import { MonthlyCalendar } from './monthly-calendar';
import { KanbanBoard } from './kanban-board';
import { CampaignBriefCard } from './campaign-brief-card';
import { CampaignBriefForm } from './campaign-brief-form';
import { CalendarEntryForm } from './calendar-entry-form';
import type { CalendarEntry } from '../types';

const NONE_BRAND = '__none__';

export function ContentCalendarPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>('');
  const [briefFormOpen, setBriefFormOpen] = useState(false);

  const { data: brands } = useBrands();
  const brandId = selectedBrandId || undefined;

  const { data: calendarEntries = [] } = useCalendarEntries(selectedYear, selectedMonth, { brandId });
  const { data: kanbanEntries } = useKanbanEntries({ brandId });
  const { data: briefs = [] } = useCampaignBriefs({ brandId });

  const defaultKanban = {
    idea: [], briefed: [], drafting: [], review: [],
    approved: [], scheduled: [], published: [], repurposed: [],
  };

  function prevMonth() {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  function openAddEntry(date: string) {
    setDefaultDate(date);
    setEditingEntry(null);
    setEntryFormOpen(true);
  }

  function openEditEntry(entry: CalendarEntry) {
    setEditingEntry(entry);
    setDefaultDate('');
    setEntryFormOpen(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background via-background to-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col p-4 gap-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Content Calendar</h1>
          <div className="flex items-center gap-2">
            {/* Brand Selector */}
            <Select
              value={selectedBrandId || NONE_BRAND}
              onValueChange={(v) => setSelectedBrandId(v === NONE_BRAND ? '' : v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_BRAND}>All brands</SelectItem>
                {(brands ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => { setEditingEntry(null); setDefaultDate(''); setEntryFormOpen(true); }} size="sm">
              <PlusIcon className="size-4 mr-1" />
              Add Entry
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="calendar" className="flex-1">
          <TabsList>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>

          {/* Monthly Calendar Tab */}
          <TabsContent value="calendar" className="mt-4">
            <div className="rounded-xl border bg-card p-4">
              <MonthlyCalendar
                year={selectedYear}
                month={selectedMonth}
                entries={calendarEntries}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                onEntryClick={openEditEntry}
                onAddEntry={openAddEntry}
              />
            </div>
          </TabsContent>

          {/* Kanban Board Tab */}
          <TabsContent value="board" className="mt-4">
            <div className="rounded-xl border bg-card p-4 overflow-x-auto">
              <KanbanBoard
                entries={kanbanEntries ?? defaultKanban}
                onEntryClick={openEditEntry}
              />
            </div>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Campaign Briefs</h2>
              <Button onClick={() => setBriefFormOpen(true)} size="sm">
                <PlusIcon className="size-4 mr-1" />
                New Campaign
              </Button>
            </div>
            {briefs.length === 0 ? (
              <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
                <p>No campaigns yet. Create your first campaign brief.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {briefs.map((brief) => (
                  <CampaignBriefCard key={brief.id} brief={brief} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CalendarEntryForm
        open={entryFormOpen}
        onOpenChange={setEntryFormOpen}
        entry={editingEntry}
        defaultDate={defaultDate}
      />
      <CampaignBriefForm
        open={briefFormOpen}
        onOpenChange={setBriefFormOpen}
        brief={null}
      />
    </div>
  );
}
