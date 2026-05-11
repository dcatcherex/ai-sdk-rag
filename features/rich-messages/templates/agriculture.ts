import {
  agricultureDiagnosisRichMessageSchema,
  agricultureForecast7DayRichMessageSchema,
  agricultureRecordConfirmationRichMessageSchema,
  agricultureRecordEntryRichMessageSchema,
  agricultureWeatherRiskRichMessageSchema,
  agricultureWeeklySummaryRichMessageSchema,
} from '@/features/rich-messages/schema';
import type { RichMessageTemplate } from '@/features/rich-messages/types';

export const AGRICULTURE_RICH_MESSAGE_TEMPLATES: RichMessageTemplate[] = [
  {
    key: 'agriculture.diagnosis',
    title: 'Agriculture Diagnosis',
    description: 'Diagnosis summary for crop issues that can render in both LINE and web chat.',
    category: 'agriculture',
    intent: 'diagnosis',
    schema: agricultureDiagnosisRichMessageSchema,
    supportedChannels: ['line', 'web', 'plain_text'],
    layout: {
      type: 'card',
      tone: 'success',
      eyebrow: 'ผลการวินิจฉัย',
      title: '{{crop_name}}',
      summary: '{{diagnosis}}',
      sections: [
        {
          label: 'โรค/แมลง',
          value: '{{diagnosis}}',
        },
        {
          label: 'ระดับความเสี่ยง',
          value: '{{severity}}',
          toneFrom: 'severity',
        },
        {
          label: 'วิธีแก้ไข',
          value: '{{recommendation}}',
        },
      ],
    },
    fallback: {
      altText: '{{altText}}',
    },
  },
  {
    key: 'agriculture.weather_risk',
    title: 'Agriculture Weather Risk',
    description: 'Weather risk summary for agriculture workflows.',
    category: 'agriculture',
    intent: 'risk_summary',
    schema: agricultureWeatherRiskRichMessageSchema,
    supportedChannels: ['line', 'web', 'plain_text'],
    layout: {
      type: 'card',
      tone: 'warning',
      eyebrow: 'Weather Risk',
      title: '{{location}}',
      summary: '{{farm_advice}}',
      sections: [
        {
          label: 'Temperature',
          value: '{{temperature}}',
        },
        {
          label: 'Humidity',
          value: '{{humidity}}',
        },
        {
          label: 'Rain chance',
          value: '{{rain_chance}}',
        },
      ],
    },
    fallback: {
      altText: '{{altText}}',
    },
  },
  {
    key: 'agriculture.forecast_7day',
    title: 'Agriculture 7-Day Forecast',
    description: 'Seven-day forecast summary for agriculture workflows.',
    category: 'agriculture',
    intent: 'risk_summary',
    schema: agricultureForecast7DayRichMessageSchema,
    supportedChannels: ['line', 'web', 'plain_text'],
    layout: {
      type: 'summary',
      tone: 'info',
      eyebrow: 'Forecast',
      title: '{{title}}',
      summary: '{{summary}}',
    },
    fallback: {
      altText: '{{altText}}',
    },
  },
  {
    key: 'agriculture.record_entry',
    title: 'Agriculture Record Entry',
    description: 'Saved farm activity entry.',
    category: 'agriculture',
    intent: 'record_saved',
    schema: agricultureRecordEntryRichMessageSchema,
    supportedChannels: ['line', 'web', 'plain_text'],
    layout: {
      type: 'card',
      tone: 'success',
      eyebrow: 'Record Saved',
      title: '{{activity}}',
      summary: '{{plot}}',
      sections: [
        {
          label: 'Date',
          value: '{{date}}',
        },
        {
          label: 'Cost',
          value: '{{cost}}',
        },
      ],
    },
    fallback: {
      altText: '{{altText}}',
    },
  },
  {
    key: 'agriculture.record_confirmation',
    title: 'Agriculture Record Confirmation',
    description: 'Pre-save confirmation for a farm activity record.',
    category: 'agriculture',
    intent: 'record_confirmation',
    schema: agricultureRecordConfirmationRichMessageSchema,
    supportedChannels: ['line', 'web', 'plain_text'],
    layout: {
      type: 'card',
      tone: 'warning',
      eyebrow: 'Confirm',
      title: '{{activity}}',
      summary: '{{plot}}',
      sections: [
        {
          label: 'Date',
          value: '{{date}}',
        },
      ],
    },
    fallback: {
      altText: '{{altText}}',
    },
  },
  {
    key: 'agriculture.weekly_summary',
    title: 'Agriculture Weekly Summary',
    description: 'Weekly farm activity summary.',
    category: 'agriculture',
    intent: 'record_confirmation',
    schema: agricultureWeeklySummaryRichMessageSchema,
    supportedChannels: ['line', 'web', 'plain_text'],
    layout: {
      type: 'summary',
      tone: 'success',
      eyebrow: 'Summary',
      title: '{{week_range}}',
      summary: '{{highlight}}',
      sections: [
        {
          label: 'Activities',
          value: '{{total_activities}}',
        },
        {
          label: 'Cost',
          value: '{{total_cost}}',
        },
      ],
    },
    fallback: {
      altText: '{{altText}}',
    },
  },
];
