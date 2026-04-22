import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

type LegacyRow = {
  user_id: string | null;
  line_user_id: string | null;
  channel_id: string | null;
  field: string;
  value: string;
};

type LegacyGroup = {
  userId: string | null;
  lineUserId: string | null;
  channelId: string | null;
  fields: Record<string, string>;
};

function splitList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(
    raw
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => value.toLowerCase())
  )];
}

function parseArrayPreserveCase(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[\n,]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(trimmed);
  }
  return result;
}

function parseParagraphs(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(
    raw
      .split(/\n{2,}|\r\n\r\n/)
      .map((value) => value.trim())
      .filter(Boolean)
  )];
}

function parseUrlArray(raw: string | null | undefined, legacySingle?: string | null): string[] {
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === 'string' && value.startsWith('https://'));
      }
    } catch {
      // fall through
    }
  }

  if (legacySingle?.startsWith('https://')) return [legacySingle];
  return [];
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function buildBrandPayload(fields: Record<string, string>) {
  const colorNotes = fields.color_palette?.trim() || null;
  return {
    name: fields.brand_name?.trim() || 'Imported Brand',
    products_services: fields.products?.trim() || null,
    target_audience: fields.target_audience?.trim() || null,
    tone_of_voice: parseArrayPreserveCase(fields.tone),
    voice_examples: parseParagraphs(fields.brand_voice_examples),
    forbidden_phrases: parseArrayPreserveCase(fields.do_not_say),
    visual_aesthetics: parseArrayPreserveCase(fields.visual_style),
    colors: [] as Array<{ label: string; hex: string }>,
    color_notes: colorNotes,
    style_reference_mode: fields.style_reference_mode?.trim() || 'direct',
    style_description: fields.style_description?.trim() || null,
    writing_donts: fields.do_not_say?.trim() || null,
    usp: fields.usp?.trim() || null,
    price_range: fields.price_range?.trim() || null,
    keywords: parseArrayPreserveCase(fields.keywords),
    platforms: splitList(fields.platforms),
    promotion_style: fields.promotion_style?.trim() || null,
    competitors: parseArrayPreserveCase(fields.competitors),
    customer_pain_points: parseArrayPreserveCase(fields.customer_pain_points),
  };
}

async function ensureRefactorSchema(sql: postgres.Sql) {
  await sql.unsafe(`
    ALTER TABLE "brand"
      ADD COLUMN IF NOT EXISTS "products_services" text,
      ADD COLUMN IF NOT EXISTS "voice_examples" text[] DEFAULT '{}'::text[] NOT NULL,
      ADD COLUMN IF NOT EXISTS "forbidden_phrases" text[] DEFAULT '{}'::text[] NOT NULL,
      ADD COLUMN IF NOT EXISTS "color_notes" text,
      ADD COLUMN IF NOT EXISTS "style_reference_mode" text DEFAULT 'direct' NOT NULL,
      ADD COLUMN IF NOT EXISTS "style_description" text,
      ADD COLUMN IF NOT EXISTS "usp" text,
      ADD COLUMN IF NOT EXISTS "price_range" text,
      ADD COLUMN IF NOT EXISTS "keywords" text[] DEFAULT '{}'::text[] NOT NULL,
      ADD COLUMN IF NOT EXISTS "platforms" text[] DEFAULT '{}'::text[] NOT NULL,
      ADD COLUMN IF NOT EXISTS "promotion_style" text,
      ADD COLUMN IF NOT EXISTS "competitors" text[] DEFAULT '{}'::text[] NOT NULL,
      ADD COLUMN IF NOT EXISTS "customer_pain_points" text[] DEFAULT '{}'::text[] NOT NULL;

    CREATE TABLE IF NOT EXISTS "line_brand_draft" (
      "id" text PRIMARY KEY NOT NULL,
      "line_user_id" text NOT NULL,
      "channel_id" text NOT NULL,
      "field" text NOT NULL,
      "value" text NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "line_brand_draft_lineUserId_channelId_idx"
      ON "line_brand_draft" ("line_user_id", "channel_id");
  `);
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  await ensureRefactorSchema(sql);

  const rows = await sql<LegacyRow[]>`
    select user_id, line_user_id, channel_id, field, value
    from brand_profile
    order by updated_at asc
  `;

  const groups = new Map<string, LegacyGroup>();
  for (const row of rows) {
    const key = row.user_id
      ? `user:${row.user_id}`
      : `line:${row.line_user_id ?? 'none'}:${row.channel_id ?? 'none'}`;
    const existing = groups.get(key) ?? {
      userId: row.user_id,
      lineUserId: row.line_user_id,
      channelId: row.channel_id,
      fields: {},
    };
    existing.fields[row.field] = row.value;
    groups.set(key, existing);
  }

  let createdBrands = 0;
  let updatedBrands = 0;
  let importedAssets = 0;
  let copiedLineDraftFields = 0;
  let ambiguousCases = 0;

  for (const group of groups.values()) {
    if (group.userId) {
      const payload = buildBrandPayload(group.fields);
      const brands = await sql`
        select *
        from brand
        where user_id = ${group.userId}
        order by is_default desc, created_at asc
      `;

      let targetBrand = brands[0] as Record<string, unknown> | undefined;
      if (brands.length === 0) {
        const [created] = await sql`
          insert into brand (
            id, user_id, name, products_services, target_audience, tone_of_voice,
            voice_examples, forbidden_phrases, visual_aesthetics, colors, color_notes,
            style_reference_mode, style_description, writing_donts, usp, price_range,
            keywords, platforms, promotion_style, competitors, customer_pain_points,
            created_at, updated_at
          )
          values (
              ${crypto.randomUUID()}, ${group.userId}, ${payload.name}, ${payload.products_services},
              ${payload.target_audience}, ${payload.tone_of_voice}, ${payload.voice_examples},
              ${payload.forbidden_phrases}, ${payload.visual_aesthetics}, ${sql`'[]'::jsonb`},
              ${payload.color_notes}, ${payload.style_reference_mode}, ${payload.style_description},
            ${payload.writing_donts}, ${payload.usp}, ${payload.price_range}, ${payload.keywords},
            ${payload.platforms}, ${payload.promotion_style}, ${payload.competitors},
            ${payload.customer_pain_points}, now(), now()
          )
          returning *
        `;
        targetBrand = created as Record<string, unknown>;
        createdBrands += 1;
      } else if (brands.length > 1) {
        const exactMatch = brands.find((brand) => normalizeName(String(brand.name)) === normalizeName(payload.name));
        if (exactMatch) {
          targetBrand = exactMatch as Record<string, unknown>;
        } else {
          const importedName = payload.name === 'Imported Brand' ? 'Imported Brand' : `${payload.name} (Imported)`;
          const [created] = await sql`
            insert into brand (
              id, user_id, name, products_services, target_audience, tone_of_voice,
              voice_examples, forbidden_phrases, visual_aesthetics, colors, color_notes,
              style_reference_mode, style_description, writing_donts, usp, price_range,
              keywords, platforms, promotion_style, competitors, customer_pain_points,
              created_at, updated_at
            )
            values (
              ${crypto.randomUUID()}, ${group.userId}, ${importedName}, ${payload.products_services},
              ${payload.target_audience}, ${payload.tone_of_voice}, ${payload.voice_examples},
              ${payload.forbidden_phrases}, ${payload.visual_aesthetics}, ${sql`'[]'::jsonb`},
              ${payload.color_notes}, ${payload.style_reference_mode}, ${payload.style_description},
              ${payload.writing_donts}, ${payload.usp}, ${payload.price_range}, ${payload.keywords},
              ${payload.platforms}, ${payload.promotion_style}, ${payload.competitors},
              ${payload.customer_pain_points}, now(), now()
            )
            returning *
          `;
          targetBrand = created as Record<string, unknown>;
          createdBrands += 1;
          ambiguousCases += 1;
        }
      }

      if (targetBrand) {
        if (brands.length > 0) {
          await sql`
            update brand
            set
              products_services = case when products_services is null or products_services = '' then ${payload.products_services} else products_services end,
              target_audience = case when target_audience is null or target_audience = '' then ${payload.target_audience} else target_audience end,
              tone_of_voice = case when coalesce(array_length(tone_of_voice, 1), 0) = 0 then ${payload.tone_of_voice} else tone_of_voice end,
              voice_examples = case when coalesce(array_length(voice_examples, 1), 0) = 0 then ${payload.voice_examples} else voice_examples end,
              forbidden_phrases = case when coalesce(array_length(forbidden_phrases, 1), 0) = 0 then ${payload.forbidden_phrases} else forbidden_phrases end,
              visual_aesthetics = case when coalesce(array_length(visual_aesthetics, 1), 0) = 0 then ${payload.visual_aesthetics} else visual_aesthetics end,
              color_notes = case when color_notes is null or color_notes = '' then ${payload.color_notes} else color_notes end,
              style_description = case when style_description is null or style_description = '' then ${payload.style_description} else style_description end,
              writing_donts = case when writing_donts is null or writing_donts = '' then ${payload.writing_donts} else writing_donts end,
              usp = case when usp is null or usp = '' then ${payload.usp} else usp end,
              price_range = case when price_range is null or price_range = '' then ${payload.price_range} else price_range end,
              keywords = case when coalesce(array_length(keywords, 1), 0) = 0 then ${payload.keywords} else keywords end,
              platforms = case when coalesce(array_length(platforms, 1), 0) = 0 then ${payload.platforms} else platforms end,
              promotion_style = case when promotion_style is null or promotion_style = '' then ${payload.promotion_style} else promotion_style end,
              competitors = case when coalesce(array_length(competitors, 1), 0) = 0 then ${payload.competitors} else competitors end,
              customer_pain_points = case when coalesce(array_length(customer_pain_points, 1), 0) = 0 then ${payload.customer_pain_points} else customer_pain_points end,
              updated_at = now()
            where id = ${String(targetBrand.id)}
          `;
          updatedBrands += 1;
        }

        const logoUrls = parseUrlArray(group.fields.logo_urls, group.fields.logo_url);
        const styleReferenceUrls = parseUrlArray(group.fields.style_reference_urls, group.fields.style_reference_url);
        for (const asset of [
          ...logoUrls.map((url) => ({ url, kind: 'logo', title: 'Imported Logo' })),
          ...styleReferenceUrls.map((url) => ({ url, kind: 'style_reference', title: 'Imported Style Reference' })),
        ]) {
          const existingAsset = await sql`
            select id
            from brand_asset
            where brand_id = ${String(targetBrand.id)}
              and url = ${asset.url}
              and kind = ${asset.kind}
            limit 1
          `;
          if (existingAsset.length > 0) continue;

          await sql`
            insert into brand_asset (
              id, brand_id, kind, title, r2_key, url, mime_type, metadata, sort_order, created_at
            )
            values (
              ${crypto.randomUUID()}, ${String(targetBrand.id)}, ${asset.kind}, ${asset.title},
              ${asset.url}, ${asset.url}, 'image/legacy-url', ${sql`'{}'::jsonb`}, 0, now()
            )
          `;
          importedAssets += 1;
        }
      }
      continue;
    }

    if (group.lineUserId && group.channelId) {
      for (const [field, value] of Object.entries(group.fields)) {
        const existing = await sql`
          select id
          from line_brand_draft
          where line_user_id = ${group.lineUserId}
            and channel_id = ${group.channelId}
            and field = ${field}
          limit 1
        `;

        if (existing.length > 0) {
          await sql`
            update line_brand_draft
            set value = ${value}, updated_at = now()
            where id = ${String(existing[0]!.id)}
          `;
        } else {
          await sql`
            insert into line_brand_draft (id, line_user_id, channel_id, field, value, updated_at)
            values (${crypto.randomUUID()}, ${group.lineUserId}, ${group.channelId}, ${field}, ${value}, now())
          `;
        }
        copiedLineDraftFields += 1;
      }
    }
  }

  console.log('Brand profile migration complete');
  console.log(JSON.stringify({
    createdBrands,
    updatedBrands,
    importedAssets,
    copiedLineDraftFields,
    ambiguousCases,
    totalLegacyGroups: groups.size,
  }, null, 2));

  await sql.end();
}

void main();
