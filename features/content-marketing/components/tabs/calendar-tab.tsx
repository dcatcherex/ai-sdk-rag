'use client';

import { TabsContent } from '@/components/ui/tabs';
import { MiniCalendar } from '../mini-calendar';
import type { SocialPostRecord } from '../../types';

type Props = {
  allPosts: SocialPostRecord[];
};

export function CalendarTab({ allPosts }: Props) {
  return (
    <TabsContent value="calendar" className="flex-1 overflow-y-auto m-0 p-6">
      <div className="max-w-sm">
        <MiniCalendar posts={allPosts} />
      </div>
    </TabsContent>
  );
}
