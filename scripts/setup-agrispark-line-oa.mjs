/**
 * AgriSpark LINE OA Setup Script
 *
 * Usage:
 *   node scripts/setup-agrispark-line-oa.mjs <channelId>
 *
 * What it does:
 *   1. Links the LINE OA channel to the AgriSpark agent
 *   2. Creates TWO rich menus (draft):
 *      - "AgriSpark Default Menu"  — 3 top skills + wide bottom "สมัครสมาชิก"
 *      - "AgriSpark Member Menu"   — 3 top skills + wide bottom "เติมเครดิต"
 *
 * Layout: 3 top + 1 wide bottom (2500 × 540 canvas)
 *   Top row:    โรคพืช/แมลง | อากาศฟาร์ม | บันทึกฟาร์ม  (each 833×270)
 *   Bottom row: [full-width button]                       (2500×270)
 *
 * After running:
 *   1. Open the app → LINE OA → select this channel → Rich Menus
 *   2. Deploy "AgriSpark Default Menu" → Set as Default
 *   3. Deploy "AgriSpark Member Menu" → click "Set as member menu"
 *   4. Upload background images to each menu (optional)
 *
 * Available channels (no agent assigned):
 *   568670c9  Able Work Bot
 *   88374ad8  Link Together Bot
 *   887faa95  TA Bot
 *   c6110055  CAMSIS AI Bot
 */

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { nanoid } from 'nanoid';

const channelId = process.argv[2];
if (!channelId) {
  console.error('Usage: node scripts/setup-agrispark-line-oa.mjs <channelId>');
  process.exit(1);
}

const env = readFileSync('.env.local', 'utf8');
const dbUrl = env.match(/DATABASE_URL=([^\n\r]+)/)?.[1]?.trim();
const sql = neon(dbUrl);

const AGENT_ID = 'agrispark-farm-assistant-001';

// ─── Shared top row: 3 skill buttons (same on both menus) ────────────────────
// Canvas: 2500 × 540  (top half 270px, bottom half 270px)
const TOP_AREAS = [
  {
    label: 'โรคพืช/แมลง',
    emoji: '🌿',
    bgColor: '#4CAF50',
    bounds: { x: 0, y: 0, width: 833, height: 270 },
    action: {
      type: 'message',
      text: 'ถามเรื่องโรคพืชและแมลงศัตรูพืช',
    },
  },
  {
    label: 'อากาศฟาร์ม',
    emoji: '🌤️',
    bgColor: '#2196F3',
    bounds: { x: 833, y: 0, width: 834, height: 270 },
    action: {
      type: 'message',
      text: 'เช็คสภาพอากาศและความเสี่ยงฟาร์ม',
    },
  },
  {
    label: 'บันทึกฟาร์ม',
    emoji: '📋',
    bgColor: '#FF9800',
    bounds: { x: 1667, y: 0, width: 833, height: 270 },
    action: {
      type: 'message',
      text: 'บันทึกกิจกรรมฟาร์มวันนี้',
    },
  },
];

// ─── Default menu: wide bottom = สมัครสมาชิก ────────────────────────────────
const DEFAULT_MENU_AREAS = [
  ...TOP_AREAS,
  {
    label: 'สมัครสมาชิก',
    emoji: '👤',
    bgColor: '#388E3C',            // deeper green — CTA prominence
    bounds: { x: 0, y: 270, width: 2500, height: 270 },
    action: {
      type: 'message',
      text: 'สมัครสมาชิก',
    },
  },
];

// ─── Member menu: wide bottom = เติมเครดิต ──────────────────────────────────
const MEMBER_MENU_AREAS = [
  ...TOP_AREAS,
  {
    label: 'เติมเครดิต',
    emoji: '💳',
    bgColor: '#1565C0',            // deeper blue — distinct from skill buttons
    bounds: { x: 0, y: 270, width: 2500, height: 270 },
    action: {
      type: 'message',
      text: 'เติมเครดิต',
    },
  },
];

try {
  // 1. Link channel to AgriSpark agent
  const result = await sql`
    UPDATE line_oa_channel
    SET agent_id = ${AGENT_ID}
    WHERE id = ${channelId}
    RETURNING id, name, agent_id
  `;

  if (result.length === 0) {
    console.error(`Channel ${channelId} not found`);
    process.exit(1);
  }
  console.log(`✓ Channel linked: "${result[0].name}" → agent ${AGENT_ID}`);

  // 2. Remove any existing draft rich menus for this channel
  await sql`DELETE FROM line_rich_menu WHERE channel_id = ${channelId} AND status = 'draft'`;

  // 3. Create default menu (สมัครสมาชิก bottom)
  const defaultMenuId = nanoid();
  await sql`
    INSERT INTO line_rich_menu (
      id, channel_id, name, chat_bar_text, areas,
      is_default, status
    ) VALUES (
      ${defaultMenuId},
      ${channelId},
      ${'AgriSpark Default Menu'},
      ${'เมนู AgriSpark'},
      ${JSON.stringify(DEFAULT_MENU_AREAS)},
      ${false},
      ${'draft'}
    )
  `;
  console.log(`✓ Default menu created (draft): ${defaultMenuId}`);
  console.log('  → 3 skill buttons (top) + สมัครสมาชิก (wide bottom)');

  // 4. Create member menu (เติมเครดิต bottom)
  const memberMenuId = nanoid();
  await sql`
    INSERT INTO line_rich_menu (
      id, channel_id, name, chat_bar_text, areas,
      is_default, status
    ) VALUES (
      ${memberMenuId},
      ${channelId},
      ${'AgriSpark Member Menu'},
      ${'เมนู AgriSpark'},
      ${JSON.stringify(MEMBER_MENU_AREAS)},
      ${false},
      ${'draft'}
    )
  `;
  console.log(`✓ Member menu created (draft): ${memberMenuId}`);
  console.log('  → 3 skill buttons (top) + เติมเครดิต (wide bottom)');

  console.log('');
  console.log('Next steps:');
  console.log('  1. Open the app → LINE OA → select this channel → Rich Menus tab');
  console.log('  2. Deploy "AgriSpark Default Menu" → Set as Default');
  console.log('  3. Deploy "AgriSpark Member Menu" → click "Set as member menu"');
  console.log('  4. (Optional) Upload background images to each menu');
  console.log('');
  console.log('Or deploy via API:');
  console.log(`  POST /api/line-oa/${channelId}/rich-menus/${defaultMenuId}/deploy`);
  console.log(`  Body: { "setAsDefault": true }`);
  console.log(`  POST /api/line-oa/${channelId}/rich-menus/${memberMenuId}/deploy`);
  console.log(`  Body: { "setAsDefault": false }`);

} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
