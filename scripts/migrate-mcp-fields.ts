/**
 * Phase 0: Add MCP-related fields for the ready-to-use agents system.
 *
 * Changes:
 *   - agent.mcp_servers jsonb — list of MCP server configs per agent
 *   - user_preferences.mcp_credentials jsonb — per-user MCP API key store
 *
 * Run once: pnpm exec tsx scripts/migrate-mcp-fields.ts
 */
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE agent
    ADD COLUMN IF NOT EXISTS mcp_servers jsonb NOT NULL DEFAULT '[]'::jsonb
  `;
  console.log('✓ mcp_servers column added to agent table');

  await sql`
    ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS mcp_credentials jsonb DEFAULT '{}'::jsonb
  `;
  console.log('✓ mcp_credentials column added to user_preferences table');

  console.log('\nPhase 0 migration complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
