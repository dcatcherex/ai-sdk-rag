/**
 * AI SDK tool definitions for the LINE Content Planner agent.
 *
 * Call buildContentPlannerLineTools(userId) to get a tools object
 * ready to pass to generateText(). userId may be null for non-linked
 * LINE users — write tools will return a helpful error.
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
  createCampaignBrief,
  getCampaignBriefs,
  createCalendarEntry,
  getCalendarEntries,
} from './service';

const CHANNEL_VALUES = ['instagram', 'facebook', 'linkedin', 'email', 'blog', 'other'] as const;
const CONTENT_TYPE_VALUES = ['blog_post', 'newsletter', 'social', 'email', 'ad_copy', 'other'] as const;

const NOT_LINKED_MSG =
  'Your LINE account is not linked. ' +
  'Type /link TOKEN (get the token from Settings → LINE OA → Link Account) ' +
  'to connect your account, then I can manage your content calendar.';

export function buildContentPlannerLineTools(userId: string | null) {
  return {
    /** Create a new campaign brief */
    create_campaign: tool({
      description:
        'Create a new marketing campaign brief. ' +
        'Captures the campaign name, goal, key message, CTA, target channels, and date range.',
      inputSchema: z.object({
        title: z.string().describe('Campaign name, e.g. "Summer Sale 2026"'),
        goal: z.string().optional().describe('Campaign goal or objective'),
        keyMessage: z.string().optional().describe('Core message the campaign should convey'),
        cta: z.string().optional().describe('Call to action, e.g. "Shop now", "Sign up today"'),
        channels: z
          .array(z.enum(CHANNEL_VALUES))
          .optional()
          .describe('Target channels: instagram, facebook, linkedin, email, blog, other'),
        startDate: z
          .string()
          .optional()
          .describe('Campaign start date in YYYY-MM-DD format'),
        endDate: z
          .string()
          .optional()
          .describe('Campaign end date in YYYY-MM-DD format'),
      }),
      execute: async ({ title, goal, keyMessage, cta, channels, startDate, endDate }) => {
        if (!userId) return { success: false, campaignId: null as string | null, message: NOT_LINKED_MSG };
        const brief = await createCampaignBrief(userId, {
          title,
          goal,
          keyMessage,
          cta,
          channels: channels ?? [],
          startDate,
          endDate,
          status: 'draft',
        });
        return {
          success: true,
          kind: 'campaign_created',
          campaignId: brief.id,
          title: brief.title,
          message: `Campaign "${brief.title}" created (ID: ${brief.id.slice(0, 8)}). View it in Content Calendar → Campaigns.`,
        };
      },
    }),

    /** List the user's recent campaigns */
    list_campaigns: tool({
      description: 'List the most recent campaign briefs. Useful before adding calendar entries so you can reference the right campaignId.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!userId) return { campaigns: [] as Array<{ id: string; title: string; status: string; startDate: string | null }>, message: NOT_LINKED_MSG };
        const briefs = await getCampaignBriefs(userId);
        const campaigns = briefs.slice(0, 8).map((b) => ({
          id: b.id.slice(0, 8),
          fullId: b.id,
          title: b.title,
          status: b.status,
          startDate: b.startDate ?? null,
          endDate: b.endDate ?? null,
        }));
        return {
          campaigns,
          message: campaigns.length === 0 ? 'No campaigns yet.' : `Found ${campaigns.length} campaign(s).`,
        };
      },
    }),

    /** Add a content calendar entry */
    add_calendar_entry: tool({
      description:
        'Add a content piece to the editorial calendar. ' +
        'Specify the title, content type, target channel, planned date, and optionally link to a campaign.',
      inputSchema: z.object({
        title: z.string().describe('Title of the content piece, e.g. "Summer Sale Instagram Reel"'),
        contentType: z
          .enum(CONTENT_TYPE_VALUES)
          .describe('Content type: blog_post, newsletter, social, email, ad_copy, or other'),
        channel: z
          .enum(CHANNEL_VALUES)
          .optional()
          .describe('Primary channel: instagram, facebook, linkedin, email, blog, or other'),
        plannedDate: z
          .string()
          .describe('Date to publish in YYYY-MM-DD format'),
        notes: z.string().optional().describe('Any notes or brief for the writer'),
        campaignId: z
          .string()
          .optional()
          .describe('Full campaign ID to link this entry to a campaign (use list_campaigns to get IDs)'),
      }),
      execute: async ({ title, contentType, channel, plannedDate, notes, campaignId }) => {
        if (!userId) return { success: false, entryId: null as string | null, message: NOT_LINKED_MSG };
        const entry = await createCalendarEntry(userId, {
          title,
          contentType,
          channel,
          plannedDate,
          notes,
          campaignId,
          status: 'idea',
        });
        return {
          success: true,
          kind: 'calendar_entry_created',
          entryId: entry.id,
          title: entry.title,
          plannedDate: entry.plannedDate,
          message: `Added "${entry.title}" to the calendar on ${entry.plannedDate}. View it in Content Calendar.`,
        };
      },
    }),

    /** List upcoming calendar entries */
    list_upcoming_entries: tool({
      description: 'List upcoming content calendar entries for the current or next month.',
      inputSchema: z.object({
        month: z
          .number()
          .int()
          .min(1)
          .max(12)
          .optional()
          .describe('Month number (1-12). Defaults to the current month.'),
        year: z
          .number()
          .int()
          .optional()
          .describe('4-digit year. Defaults to the current year.'),
        campaignId: z
          .string()
          .optional()
          .describe('Filter by campaign ID'),
      }),
      execute: async ({ month, year, campaignId }) => {
        if (!userId) return { entries: [] as Array<{ id: string; title: string; contentType: string; plannedDate: string; status: string }>, message: NOT_LINKED_MSG };
        const now = new Date();
        const entries = await getCalendarEntries(userId, {
          year: year ?? now.getFullYear(),
          month: month ?? (now.getMonth() + 1),
          campaignId,
        });
        const result = entries.slice(0, 10).map((e) => ({
          id: e.id.slice(0, 8),
          title: e.title,
          contentType: e.contentType,
          channel: e.channel ?? 'unset',
          plannedDate: e.plannedDate,
          status: e.status,
        }));
        return {
          entries: result,
          message: result.length === 0 ? 'No entries for that period.' : `Found ${result.length} entr${result.length === 1 ? 'y' : 'ies'}.`,
        };
      },
    }),
  };
}
