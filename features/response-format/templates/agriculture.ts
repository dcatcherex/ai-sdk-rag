import type { FlexMessage } from '@/features/line-oa/webhook/types';
import { AGRISPARK_TEMPLATES } from '@/features/line-oa/flex/seeds/agrispark-templates';
import type { ResponseTemplate } from '@/features/response-format/types';
import {
  buildWebCardFields,
  interpolateTemplatePayload,
  readTemplateString,
} from '@/features/response-format/templates/shared';

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
];

export const AGRICULTURE_RESPONSE_TEMPLATES: ResponseTemplate[] = AGRICULTURE_TEMPLATE_CONFIG.flatMap((config) => {
  const seed = AGRISPARK_TEMPLATES.find((entry) => entry.name === config.seedName);
  if (!seed) return [];

  return [{
    key: config.key,
    title: config.title,
    supportedChannels: ['line', 'web'],
    intent: config.intent,
    requiredDataKeys: config.requiredDataKeys,
    renderLine(data) {
      return {
        type: 'flex',
        altText: String(data.altText ?? seed.altText),
        contents: interpolateTemplatePayload(seed.flexPayload, data),
      } as FlexMessage;
    },
    renderWeb(data) {
      if (config.key === 'agriculture.weather_risk') {
        return {
          kind: 'card',
          tone: 'warning',
          eyebrow: 'Weather Risk',
          title: readTemplateString(data, 'location', 'Weather summary'),
          summary: readTemplateString(data, 'farm_advice'),
          fields: buildWebCardFields([
            { label: 'Temperature', value: data.temperature },
            { label: 'Humidity', value: data.humidity },
            { label: 'Rain chance', value: data.rain_chance },
          ]),
        };
      }

      if (config.key === 'agriculture.record_entry') {
        return {
          kind: 'card',
          tone: 'success',
          eyebrow: 'Record Saved',
          title: readTemplateString(data, 'activity', 'Record entry'),
          summary: readTemplateString(data, 'plot'),
          fields: buildWebCardFields([
            { label: 'Date', value: data.date },
            { label: 'Cost', value: data.cost },
          ]),
        };
      }

      if (config.key === 'agriculture.record_confirmation') {
        return {
          kind: 'card',
          tone: 'warning',
          eyebrow: 'Confirm',
          title: readTemplateString(data, 'activity', 'Confirm record'),
          summary: readTemplateString(data, 'plot'),
          fields: buildWebCardFields([
            { label: 'Date', value: data.date },
          ]),
        };
      }

      return {
        kind: 'card',
        tone: 'neutral',
        eyebrow: 'Diagnosis',
        title: readTemplateString(data, 'crop_name', 'Diagnosis'),
        summary: readTemplateString(data, 'diagnosis'),
        fields: buildWebCardFields([
          { label: 'Severity', value: data.severity },
          { label: 'Recommendation', value: data.recommendation },
        ]),
      };
    },
  }];
});
