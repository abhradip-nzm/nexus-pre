/**
 * FULL DATA CLEANUP SCRIPT
 *
 * Deletes ALL data from every table including all users.
 * Preserves (seeded by migrations, needed for the app to function):
 *   - roles
 *   - kanban_columns
 *   - kanban_sub_stages
 *   - app_settings
 *
 * After running this script the app will be completely empty.
 * You will need to create a new system_admin via the setup endpoint.
 *
 * Run with:
 *   cd backend && node scripts/cleanup-data.js
 *
 * Requires DATABASE_URL in environment (.env file or set in shell).
 * Uses a transaction — if anything fails, everything rolls back.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function cleanup() {
  const client = await pool.connect();
  try {
    console.log('🚨 Full cleanup — ALL data including users will be deleted.');
    console.log('   Roles, kanban columns, and app settings will be preserved.');
    console.log('   Starting transaction...\n');

    await client.query('BEGIN');

    // ── Delete in dependency order (children before parents) ──────────────

    // Transition forms
    await del(client, 'transition_form_field_responses');
    await del(client, 'transition_form_responses');
    await del(client, 'transition_form_fields');
    await del(client, 'transition_forms');

    // Prospect data
    await del(client, 'prospect_task_assignees');
    await del(client, 'prospect_tasks');
    await del(client, 'prospect_industry_assignments');
    await del(client, 'prospect_member_assignments');
    await del(client, 'prospect_team_assignments');
    await del(client, 'prospect_tags');
    await del(client, 'probable_prospects');

    // Integrations referencing user_stories (must come before user_stories)
    await del(client, 'meetings');
    await del(client, 'emails');
    await del(client, 'whatsapp_messages');

    // Story data
    await del(client, 'task_change_logs');
    await del(client, 'task_assignees');
    await del(client, 'tasks');
    await del(client, 'story_change_logs');
    await del(client, 'story_comments');
    await del(client, 'story_tags');
    await del(client, 'story_industries');
    await del(client, 'story_team_assignments');
    await del(client, 'story_member_assignments');
    await del(client, 'user_stories');

    // Teams
    await del(client, 'team_members');
    await del(client, 'teams');

    // Notifications
    await del(client, 'notifications');

    // Access controls and permissions
    await del(client, 'role_access_controls');
    await del(client, 'user_access_overrides');
    await del(client, 'user_permissions');

    // Lookup tables
    await del(client, 'tags');
    await del(client, 'industries');
    await del(client, 'business_team');

    // ALL users
    await del(client, 'users');

    await client.query('COMMIT');

    console.log('\n✅ Full cleanup complete. Database is empty.');
    console.log('   Next step: create a new system_admin by calling:');
    console.log('   POST /api/setup/init  with { email, password, first_name, last_name }');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Cleanup FAILED — all changes rolled back.');
    console.error(err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

async function del(client, table) {
  const result = await client.query(`DELETE FROM ${table}`);
  console.log(`  🗑  ${table.padEnd(35)} deleted ${result.rowCount} row(s)`);
}

cleanup();
