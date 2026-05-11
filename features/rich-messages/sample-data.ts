import type { RichMessageTemplate } from '@/features/rich-messages/types';

const SAMPLE_DATA_BY_TEMPLATE_KEY: Record<string, Record<string, unknown>> = {
  'common.confirmation': {
    title: 'Record saved',
    summary: 'Your changes were saved successfully.',
    altText: 'Record saved',
  },
  'common.summary': {
    title: 'Summary',
    summary: 'Here is the latest snapshot for this request.',
    altText: 'Summary',
  },
  'common.approval_request': {
    title: 'June campaign post',
    summary: 'Needs approval before scheduling.',
    status: 'pending',
    assigneeName: 'Nok',
    dueAt: '2026-05-05 09:00',
    altText: 'Approval request',
  },
  'common.escalation': {
    title: 'Needs human review',
    summary: 'This case should be reviewed by a specialist today.',
    altText: 'Escalation',
  },
  'agriculture.diagnosis': {
    crop_name: 'Tomato',
    diagnosis: 'Leaf blight',
    severity: 'High',
    recommendation: 'Remove infected leaves and reduce overnight moisture.',
    altText: 'Plant diagnosis result',
  },
  'agriculture.weather_risk': {
    location: 'Chiang Mai',
    temperature: '31',
    humidity: '78',
    rain_chance: '65',
    farm_advice: 'Rain likely in the next 2 days. Delay spraying and improve drainage.',
    altText: 'Weather risk summary',
  },
  'agriculture.forecast_7day': {
    title: '7-day forecast',
    summary: 'Days 3-4 are the wettest. Plan spraying on days 1-2 or after day 5.',
    altText: '7-day forecast',
  },
  'agriculture.record_entry': {
    activity: 'Applied urea fertilizer',
    plot: 'North field',
    date: '2026-05-10',
    cost: '850',
    altText: 'Record saved',
  },
  'agriculture.record_confirmation': {
    activity: 'Applied urea fertilizer',
    plot: 'North field',
    date: '2026-05-10',
    log_id: 'pending-123',
    altText: 'Confirm record',
  },
  'agriculture.weekly_summary': {
    week_range: 'May 6 - May 12',
    total_activities: '5',
    total_cost: '2,450',
    highlight: 'Fertilized north field, checked irrigation lines, and prepared for rain.',
    altText: 'Weekly summary',
  },
};

export function getSampleRichMessageData(
  template: RichMessageTemplate,
): Record<string, unknown> {
  return SAMPLE_DATA_BY_TEMPLATE_KEY[template.key] ?? {
    title: template.title,
    summary: template.description ?? template.title,
    altText: template.title,
  };
}
