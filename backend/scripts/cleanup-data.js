/**
 * ONE-TIME DATA CLEANUP SCRIPT
 *
 * Deletes all user-generated data from every table.
 * Preserves:
 *   - The system_admin user account (so login still works)
 *   - roles, kanban_columns, kanban_sub_stages, app_settings
 *     (these are seeded by migrations and are needed for the app to function)
 *
 * Run once with:
 *   node scripts/cleanup-data.js
 *
 * Requires DATABASE_URL in environment (same as the main app).
 * Uses a transaction — if anything fails, the entire cleanup rolls back.
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
    // Confirm the system_admin user exists before we do anything
    const adminCheck = await client.query(
      `SELECT u.id, u.email, u.first_name, u.last_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name = 'system_admin'`
    );

    if (adminCheck.rows.length === 0) {
      console.error('❌ No system_admin user found. Aborting — nothing was deleted.');
      process.exit(1);
    }

    const admin = adminCheck.rows[0];
    console.log(`✅ System admin found: ${admin.first_name} ${admin.last_name} (${admin.email})`);
    console.log('🚨 Starting cleanup inside a transaction...\n');

    await client.query('BEGIN');

    // ── Delete in dependency order (children before parents) ──────────────

    // Transition form responses
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

    // Integrations
    await del(client, 'meetings');
    await del(client, 'emails');
    await del(client, 'whatsapp_messages');

    // Notifications (clear all — admin will get fresh ones)
    await del(client, 'notifications');

    // Access control overrides and permissions (non-admin users being deleted anyway)
    await del(client, 'role_access_controls');
    await del(client, 'user_access_overrides');
    await del(client, 'user_permissions');

    // Lookup tables
    await del(client, 'tags');
    await del(client, 'industries');
    await del(client, 'business_team');

    // Users — delete everyone except the system_admin user(s)
    const userDel = await client.query(
      `DELETE FROM users
       WHERE id NOT IN (
         SELECT u.id FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'system_admin'
       )`
    );
    console.log(`  🗑  users — deleted ${userDel.rowCount} row(s) (system_admin preserved)`);

    await client.query('COMMIT');

    console.log('\n✅ Cleanup complete.');
    console.log(`   System admin "${admin.email}" is intact and can log in.`);
    console.log('   Kanban columns, sub-stages, roles, and app settings are untouched.');

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
