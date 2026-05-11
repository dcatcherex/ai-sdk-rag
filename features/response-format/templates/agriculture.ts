import type { ResponseTemplate } from '@/features/response-format/types';

type SeedTemplateConfig = {
  key: string;
  seedName: string;
  title: string;
  intent: ResponseTemplate['intent'];
  requiredDataKeys: string[];
};

const AGRICULTURE_TEMPLATE_CONFIG: SeedTemplateConfig[] = [
  {
    key: 'agriculture.diagnosis',
    seedName: 'agrispark-diagnosis-result',
    title: 'Agriculture Diagnosis',
    intent: 'diagnosis',
    requiredDataKeys: ['crop_name', 'diagnosis', 'severity', 'recommendation'],
  },
  {
    key: 'agriculture.weather_risk',
    seedName: 'agrispark-weather-risk',
    title: 'Agriculture Weather Risk',
    intent: 'risk_summary',
    requiredDataKeys: ['location', 'temperature', 'humidity', 'rain_chance', 'farm_advice'],
  },
  {
    key: 'agriculture.forecast_7day',
    seedName: 'agrispark-7day-forecast',
    title: 'Agriculture 7-Day Forecast',
    intent: 'risk_summary',
    requiredDataKeys: [],
  },
  {
    key: 'agriculture.record_entry',
    seedName: 'agrispark-record-entry',
    title: 'Agriculture Record Entry',
    intent: 'record_saved',
    requiredDataKeys: ['activity', 'date'],
  },
  {
    key: 'agriculture.record_confirmation',
    seedName: 'agrispark-log-confirm',
    title: 'Agriculture Record Confirmation',
    intent: 'record_confirmation',
    requiredDataKeys: ['activity', 'date', 'log_id'],
  },
  {
    key: 'agriculture.weekly_summary',
    seedName: 'agrispark-weekly-summary',
    title: 'Agriculture Weekly Summary',
    intent: 'record_confirmation',
    requiredDataKeys: ['week_range', 'total_activities', 'total_cost', 'highlight'],
  },
];

export const AGRICULTURE_RESPONSE_TEMPLATES: ResponseTemplate[] = AGRICULTURE_TEMPLATE_CONFIG.flatMap((config) => {
  return [{
    key: config.key,
    title: config.title,
    supportedChannels: ['line', 'web'],
    intent: config.intent,
    requiredDataKeys: config.requiredDataKeys,
  }];
});
