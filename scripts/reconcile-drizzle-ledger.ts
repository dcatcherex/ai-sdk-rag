import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const migrationDir = 'db/migrations';

type Check =
  | { kind: 'table'; name: string }
  | { kind: 'column'; table: string; column: string }
  | { kind: 'sql'; query: string };

type MigrationSpec = {
  id: number;
  tag: string;
  when: number;
  file: string;
  mode: 'backfill' | 'execute-then-backfill';
  checks: Check[];
};

const migrations: MigrationSpec[] = [
  {
    id: 23,
    tag: '0024_line_account_link',
    when: 1774700000000,
    file: '0024_line_account_link.sql',
    mode: 'backfill',
    checks: [
      { kind: 'table', name: 'line_account_link_token' },
      { kind: 'table', name: 'line_account_link' },
    ],
  },
  {
    id: 24,
    tag: '0025_public_agent_share',
    when: 1774800000000,
    file: '0025_public_agent_share.sql',
    mode: 'backfill',
    checks: [{ kind: 'table', name: 'public_agent_share' }],
  },
  {
    id: 25,
    tag: '0026_public_agent_share_protection',
    when: 1774900000000,
    file: '0026_public_agent_share_protection.sql',
    mode: 'backfill',
    checks: [
      { kind: 'column', table: 'public_agent_share', column: 'password_hash' },
      { kind: 'column', table: 'public_agent_share', column: 'expires_at' },
    ],
  },
  {
    id: 26,
    tag: '0027_public_agent_share_limits',
    when: 1775000000000,
    file: '0027_public_agent_share_limits.sql',
    mode: 'backfill',
    checks: [
      { kind: 'column', table: 'public_agent_share', column: 'max_uses' },
      { kind: 'column', table: 'public_agent_share', column: 'credit_limit' },
      { kind: 'column', table: 'public_agent_share', column: 'credits_used' },
    ],
  },
  {
    id: 27,
    tag: '0028_agent_starter_prompts',
    when: 1775100000000,
    file: '0028_agent_starter_prompts.sql',
    mode: 'backfill',
    checks: [{ kind: 'column', table: 'agent', column: 'starter_prompts' }],
  },
  {
    id: 28,
    tag: '0029_spotty_molly_hayes',
    when: 1775463314628,
    file: '0029_spotty_molly_hayes.sql',
    mode: 'backfill',
    checks: [{ kind: 'column', table: 'agent', column: 'structured_behavior' }],
  },
  {
    id: 29,
    tag: '0030_blue_spyke',
    when: 1775541003272,
    file: '0030_blue_spyke.sql',
    mode: 'backfill',
    checks: [{ kind: 'table', name: 'activity_record' }],
  },
  {
    id: 30,
    tag: '0031_square_sue_storm',
    when: 1775791895695,
    file: '0031_square_sue_storm.sql',
    mode: 'backfill',
    checks: [{ kind: 'sql', query: "select 1 where not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_preferences' and column_name = 'persona_detection_enabled')" }],
  },
  {
    id: 31,
    tag: '0032_add_memory_tables',
    when: 1775829555542,
    file: '0032_add_memory_tables.sql',
    mode: 'backfill',
    checks: [
      { kind: 'table', name: 'memory_record' },
      { kind: 'table', name: 'thread_working_memory' },
    ],
  },
  {
    id: 32,
    tag: '0033_abandoned_penance',
    when: 1776319164994,
    file: '0033_abandoned_penance.sql',
    mode: 'backfill',
    checks: [],
  },
  {
    id: 33,
    tag: '0034_mighty_randall_flagg',
    when: 1776393276860,
    file: '0034_mighty_randall_flagg.sql',
    mode: 'backfill',
    checks: [
      { kind: 'table', name: 'platform_settings' },
      { kind: 'table', name: 'guest_session' },
      { kind: 'column', table: 'chat_thread', column: 'guest_session_id' },
    ],
  },
  {
    id: 34,
    tag: '0035_numerous_lockheed',
    when: 1776414284233,
    file: '0035_numerous_lockheed.sql',
    mode: 'execute-then-backfill',
    checks: [{ kind: 'sql', query: "select 1 from agent where id = 'tpl_social_image'" }],
  },
  {
    id: 35,
    tag: '0036_slow_alex_wilder',
    when: 1776422412119,
    file: '0036_slow_alex_wilder.sql',
    mode: 'backfill',
    checks: [{ kind: 'column', table: 'platform_settings', column: 'admin_enabled_model_ids' }],
  },
  {
    id: 36,
    tag: '0037_past_owl',
    when: 1776579394775,
    file: '0037_past_owl.sql',
    mode: 'backfill',
    checks: [{ kind: 'sql', query: "select 1 where to_regclass('public.line_brand_draft') is not null or to_regclass('public.brand_profile') is not null" }],
  },
  {
    id: 37,
    tag: '0038_previous_the_hunter',
    when: 1776660425639,
    file: '0038_previous_the_hunter.sql',
    mode: 'backfill',
    checks: [{ kind: 'table', name: 'brand_photo' }],
  },
  {
    id: 38,
    tag: '0039_keen_mojo',
    when: 1776694084922,
    file: '0039_keen_mojo.sql',
    mode: 'backfill',
    checks: [
      { kind: 'column', table: 'chat_thread', column: 'agent_id' },
      { kind: 'column', table: 'chat_thread', column: 'share_token' },
      { kind: 'column', table: 'chat_thread', column: 'guest_id' },
    ],
  },
  {
    id: 39,
    tag: '0040_clear_iron_man',
    when: 1776851920912,
    file: '0040_clear_iron_man.sql',
    mode: 'backfill',
    checks: [
      { kind: 'table', name: 'line_brand_draft' },
      { kind: 'table', name: 'stock_image' },
      { kind: 'column', table: 'agent', column: 'brand_mode' },
    ],
  },
  {
    id: 40,
    tag: '0041_overjoyed_pyro',
    when: 1777356143815,
    file: '0041_overjoyed_pyro.sql',
    mode: 'backfill',
    checks: [
      { kind: 'table', name: 'line_flex_draft' },
      { kind: 'table', name: 'line_flex_template' },
    ],
  },
  {
    id: 41,
    tag: '0042_even_catseye',
    when: 1777363324078,
    file: '0042_even_catseye.sql',
    mode: 'backfill',
    checks: [
      { kind: 'table', name: 'user_tool' },
      { kind: 'table', name: 'user_tool_version' },
      { kind: 'table', name: 'user_tool_share' },
      { kind: 'table', name: 'user_tool_connection' },
      { kind: 'table', name: 'agent_user_tool_attachment' },
    ],
  },
  {
    id: 42,
    tag: '0043_complete_prowler',
    when: 1777382451943,
    file: '0043_complete_prowler.sql',
    mode: 'backfill',
    checks: [
      { kind: 'table', name: 'user_tool_workspace_share' },
      {
        kind: 'sql',
        query: `
          select 1
          from pg_constraint
          where conrelid = 'user_tool_workspace_share'::regclass
            and conname = 'user_tool_workspace_share_tool_id_user_tool_id_fk'
        `,
      },
      {
        kind: 'sql',
        query: `
          select 1
          from pg_constraint
          where conrelid = 'user_tool_workspace_share'::regclass
            and conname = 'user_tool_workspace_share_brand_id_brand_id_fk'
        `,
      },
      {
        kind: 'sql',
        query: `
          select 1
          from pg_indexes
          where schemaname = 'public'
            and tablename = 'user_tool_workspace_share'
            and indexname = 'user_tool_workspace_share_unique_idx'
        `,
      },
      {
        kind: 'sql',
        query: `
          select 1
          from pg_indexes
          where schemaname = 'public'
            and tablename = 'user_tool_workspace_share'
            and indexname = 'user_tool_workspace_share_toolId_idx'
        `,
      },
      {
        kind: 'sql',
        query: `
          select 1
          from pg_indexes
          where schemaname = 'public'
            and tablename = 'user_tool_workspace_share'
            and indexname = 'user_tool_workspace_share_brandId_idx'
        `,
      },
    ],
  },
];

function migrationHash(file: string) {
  const text = readFileSync(`${migrationDir}/${file}`, 'utf8');
  return createHash('sha256').update(text).digest('hex');
}

async function checkTable(sql: postgres.Sql, name: string) {
  const rows = await sql`select to_regclass(${`public.${name}`}) as value`;
  return rows[0]?.value === name;
}

async function checkColumn(sql: postgres.Sql, table: string, column: string) {
  const rows = await sql`
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${table}
      and column_name = ${column}
  `;
  return rows.length > 0;
}

async function checkSql(sql: postgres.Sql, query: string) {
  const rows = await sql.unsafe(query);
  return rows.length > 0;
}

async function verifyChecks(sql: postgres.Sql, checks: Check[]) {
  for (const check of checks) {
    const ok =
      check.kind === 'table'
        ? await checkTable(sql, check.name)
        : check.kind === 'column'
          ? await checkColumn(sql, check.table, check.column)
          : await checkSql(sql, check.query);

    if (!ok) {
      throw new Error(`Verification failed for ${JSON.stringify(check)}`);
    }
  }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    for (const migration of migrations) {
      const existing = await sql`
        select 1
        from drizzle.__drizzle_migrations
        where id = ${migration.id}
           or hash = ${migrationHash(migration.file)}
      `;

      if (existing.length > 0) {
        console.log(`skip ${migration.tag} (already recorded)`);
        continue;
      }

      if (migration.mode === 'execute-then-backfill') {
        const fileText = readFileSync(`${migrationDir}/${migration.file}`, 'utf8');
        console.log(`apply ${migration.tag}`);
        await sql.unsafe(fileText);
      } else {
        await verifyChecks(sql, migration.checks);
        console.log(`backfill ${migration.tag}`);
      }

      await sql`
        insert into drizzle.__drizzle_migrations (id, hash, created_at)
        values (${migration.id}, ${migrationHash(migration.file)}, ${String(migration.when)})
      `;
    }
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
