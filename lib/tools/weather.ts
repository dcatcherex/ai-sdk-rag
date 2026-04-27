import { tool } from 'ai';
import { z } from 'zod';

const geocodingResultSchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  country: z.string().optional(),
  admin1: z.string().optional(),
  admin2: z.string().optional(),
  timezone: z.string().optional(),
});

const geocodingResponseSchema = z.object({
  results: z.array(geocodingResultSchema).optional(),
});

const LOCATION_ALIASES: Record<string, string> = {
  'กรุงเทพ': 'Bangkok',
  'กรุงเทพฯ': 'Bangkok',
  'กรุงเทพมหานคร': 'Bangkok',
  'เชียงใหม่': 'Chiang Mai',
  'เชียงราย': 'Chiang Rai',
  'ขอนแก่น': 'Khon Kaen',
  'นครราชสีมา': 'Nakhon Ratchasima',
  'โคราช': 'Nakhon Ratchasima',
  'ลำพูน': 'Lamphun',
  'ลำปาง': 'Lampang',
  'พิษณุโลก': 'Phitsanulok',
  'อุบลราชธานี': 'Ubon Ratchathani',
  'สุราษฎร์ธานี': 'Surat Thani',
  'สงขลา': 'Songkhla',
  'หาดใหญ่': 'Hat Yai',
};

const forecastResponseSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    relative_humidity_2m: z.number(),
    precipitation: z.number(),
    rain: z.number().optional(),
    showers: z.number().optional(),
    wind_speed_10m: z.number(),
    weather_code: z.number(),
  }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_sum: z.array(z.number()),
    rain_sum: z.array(z.number()).optional(),
    showers_sum: z.array(z.number()).optional(),
    precipitation_probability_max: z.array(z.number()),
    wind_speed_10m_max: z.array(z.number()),
  }),
});

export type WeatherRiskLevel = 'low' | 'moderate' | 'high';

export type WeatherRiskFlag = {
  type: 'heat' | 'rain' | 'wind' | 'field-access';
  level: WeatherRiskLevel;
  message: string;
};

function describeWeatherCode(code: number): string {
  switch (code) {
    case 0: return 'Clear sky';
    case 1:
    case 2:
    case 3: return 'Partly cloudy';
    case 45:
    case 48: return 'Fog';
    case 51:
    case 53:
    case 55: return 'Drizzle';
    case 56:
    case 57: return 'Freezing drizzle';
    case 61:
    case 63:
    case 65: return 'Rain';
    case 66:
    case 67: return 'Freezing rain';
    case 71:
    case 73:
    case 75:
    case 77: return 'Snow';
    case 80:
    case 81:
    case 82: return 'Rain showers';
    case 85:
    case 86: return 'Snow showers';
    case 95: return 'Thunderstorm';
    case 96:
    case 99: return 'Thunderstorm with hail';
    default: return 'Mixed conditions';
  }
}

function buildLocationLabel(location: z.infer<typeof geocodingResultSchema>): string {
  return [location.name, location.admin1, location.country].filter(Boolean).join(', ');
}

export function buildWeatherRiskSummary(input: {
  currentTempC: number;
  currentRainMm: number;
  currentWindKmh: number;
  dailyRainMm: number[];
  dailyRainProbability: number[];
  dailyMaxTempC: number[];
  dailyWindKmh: number[];
}): {
  headline: string;
  flags: WeatherRiskFlag[];
} {
  const flags: WeatherRiskFlag[] = [];
  const maxRain = Math.max(0, ...input.dailyRainMm);
  const maxRainProbability = Math.max(0, ...input.dailyRainProbability);
  const maxTemp = Math.max(input.currentTempC, ...input.dailyMaxTempC);
  const maxWind = Math.max(input.currentWindKmh, ...input.dailyWindKmh);

  if (maxTemp >= 38) {
    flags.push({
      type: 'heat',
      level: 'high',
      message: 'Heat stress risk is high. Protect young plants and avoid midday spraying.',
    });
  } else if (maxTemp >= 34) {
    flags.push({
      type: 'heat',
      level: 'moderate',
      message: 'Hot conditions are likely. Watch irrigation timing and plant stress.',
    });
  }

  if (maxRain >= 50 || maxRainProbability >= 85) {
    flags.push({
      type: 'rain',
      level: 'high',
      message: 'Heavy rain risk is elevated. Check drainage and disease pressure.',
    });
  } else if (maxRain >= 20 || maxRainProbability >= 60 || input.currentRainMm >= 5) {
    flags.push({
      type: 'rain',
      level: 'moderate',
      message: 'Rain is likely. Plan field work around wet periods.',
    });
  }

  if (maxWind >= 40) {
    flags.push({
      type: 'wind',
      level: 'high',
      message: 'Strong wind risk is high. Secure supports and delay spraying if needed.',
    });
  } else if (maxWind >= 25) {
    flags.push({
      type: 'wind',
      level: 'moderate',
      message: 'Wind may affect spraying and weak plants. Use caution in exposed plots.',
    });
  }

  if (maxRain >= 30 || (maxRain >= 15 && maxWind >= 25)) {
    flags.push({
      type: 'field-access',
      level: 'moderate',
      message: 'Field access may be muddy or delayed after rain. Adjust labor and harvest timing.',
    });
  }

  const headline = flags.length > 0
    ? flags.map((flag) => flag.message).join(' ')
    : 'No major short-term field risks detected from the current forecast.';

  return { headline, flags };
}

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Vaja-AI-Weather-Tool/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Weather service request failed with status ${response.status}.`);
  }

  return schema.parse(await response.json());
}

function normalizeLocationQuery(location: string): string {
  const trimmed = location.trim();
  return LOCATION_ALIASES[trimmed] ?? trimmed;
}

export async function getForecastForLocation(locationQuery: string) {
  const trimmedLocation = locationQuery.trim();
  if (!trimmedLocation) {
    return {
      error: 'missing_location' as const,
      message: 'Please provide a location name to check the weather.',
      source: 'Open-Meteo',
    };
  }

  const normalizedLocation = normalizeLocationQuery(trimmedLocation);

  const geocodingUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geocodingUrl.searchParams.set('name', normalizedLocation);
  geocodingUrl.searchParams.set('count', '1');
  geocodingUrl.searchParams.set('language', 'en');
  geocodingUrl.searchParams.set('format', 'json');

  const geocoding = await fetchJson(geocodingUrl.toString(), geocodingResponseSchema);
  const match = geocoding.results?.[0];

  if (!match) {
    return {
      error: 'location_not_found' as const,
      message: `I could not find weather data for "${trimmedLocation}". Try a province, district, or city name.`,
      source: 'Open-Meteo',
    };
  }

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.searchParams.set('latitude', String(match.latitude));
  forecastUrl.searchParams.set('longitude', String(match.longitude));
  forecastUrl.searchParams.set('forecast_days', '7');
  forecastUrl.searchParams.set('timezone', 'auto');
  forecastUrl.searchParams.set(
    'current',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation',
      'rain',
      'showers',
      'wind_speed_10m',
      'weather_code',
    ].join(','),
  );
  forecastUrl.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'rain_sum',
      'showers_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
    ].join(','),
  );

  const forecast = await fetchJson(forecastUrl.toString(), forecastResponseSchema);
  const riskSummary = buildWeatherRiskSummary({
    currentTempC: forecast.current.temperature_2m,
    currentRainMm: forecast.current.precipitation,
    currentWindKmh: forecast.current.wind_speed_10m,
    dailyRainMm: forecast.daily.precipitation_sum,
    dailyRainProbability: forecast.daily.precipitation_probability_max,
    dailyMaxTempC: forecast.daily.temperature_2m_max,
    dailyWindKmh: forecast.daily.wind_speed_10m_max,
  });

  return {
    location: {
      name: match.name,
      admin1: match.admin1 ?? null,
      admin2: match.admin2 ?? null,
      country: match.country ?? null,
      latitude: match.latitude,
      longitude: match.longitude,
      timezone: match.timezone ?? null,
      label: buildLocationLabel(match),
    },
    current: {
      temperatureC: forecast.current.temperature_2m,
      humidityPercent: forecast.current.relative_humidity_2m,
      precipitationMm: forecast.current.precipitation,
      windSpeedKmh: forecast.current.wind_speed_10m,
      weatherCode: forecast.current.weather_code,
      weatherDescription: describeWeatherCode(forecast.current.weather_code),
    },
    daily: forecast.daily.time.map((date, index) => ({
      date,
      weatherCode: forecast.daily.weather_code[index] ?? 0,
      weatherDescription: describeWeatherCode(forecast.daily.weather_code[index] ?? 0),
      temperatureMaxC: forecast.daily.temperature_2m_max[index] ?? 0,
      temperatureMinC: forecast.daily.temperature_2m_min[index] ?? 0,
      precipitationMm: forecast.daily.precipitation_sum[index] ?? 0,
      rainMm: forecast.daily.rain_sum?.[index] ?? 0,
      showersMm: forecast.daily.showers_sum?.[index] ?? 0,
      precipitationProbabilityPercent: forecast.daily.precipitation_probability_max[index] ?? 0,
      windSpeedMaxKmh: forecast.daily.wind_speed_10m_max[index] ?? 0,
    })),
    riskSummary: {
      headline: riskSummary.headline,
      flags: riskSummary.flags,
    },
    source: 'Open-Meteo',
  };
}

export const weatherTools = {
  weather: tool({
    description: 'Get real current weather and a 7-day forecast for a location in Celsius, millimeters, and km/h.',
    inputSchema: z.object({
      location: z.string().describe('The city, district, or province to get the weather for'),
    }),
    async execute({ location }) {
      try {
        return await getForecastForLocation(location);
      } catch (error) {
        return {
          error: 'weather_lookup_failed',
          message: error instanceof Error
            ? error.message
            : 'Weather lookup failed unexpectedly.',
          source: 'Open-Meteo',
        };
      }
    },
  }),
  convertFahrenheitToCelsius: tool({
    description: 'Convert a temperature in fahrenheit to celsius',
    inputSchema: z.object({
      temperature: z.number().describe('The temperature in fahrenheit to convert'),
    }),
    async execute({ temperature }) {
      const celsius = Math.round((temperature - 32) * (5 / 9));
      return { celsius };
    },
  }),
};
