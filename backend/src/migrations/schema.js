const { pool } = require('../config/database');

const migrations = [
  // Users & Roles
  `CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    role_id INTEGER REFERENCES roles(id),
    is_active BOOLEAN DEFAULT true,
    ms_access_token TEXT,
    ms_refresh_token TEXT,
    ms_user_id VARCHAR(255),
    whatsapp_number VARCHAR(50),
    last_login TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // User permissions (system admin can set per-user)
  `CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    can_create BOOLEAN DEFAULT false,
    can_read BOOLEAN DEFAULT true,
    can_update BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    granted_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, module)
  )`,

  // Kanban metadata - configurable stages
  `CREATE TABLE IF NOT EXISTS kanban_columns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    position INTEGER NOT NULL,
    color VARCHAR(20) DEFAULT '#3e72ae',
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS kanban_sub_stages (
    id SERIAL PRIMARY KEY,
    column_id INTEGER REFERENCES kanban_columns(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INTEGER NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // User Stories (Kanban cards)
  `CREATE TABLE IF NOT EXISTS user_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    client_name VARCHAR(255),
    client_company VARCHAR(255),
    client_email VARCHAR(255),
    client_phone VARCHAR(50),
    column_id INTEGER REFERENCES kanban_columns(id),
    sub_stage_id INTEGER REFERENCES kanban_sub_stages(id),
    position FLOAT NOT NULL DEFAULT 0,
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    priority VARCHAR(20) DEFAULT 'medium',
    estimated_value DECIMAL(15,2),
    tags TEXT[],
    ms_event_id VARCHAR(255),
    whatsapp_thread_id VARCHAR(255),
    source VARCHAR(50) DEFAULT 'manual',
    due_date DATE,
    closed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Sub tasks
  `CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_story_id UUID REFERENCES user_stories(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo',
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    due_date DATE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Change logs for user stories
  `CREATE TABLE IF NOT EXISTS story_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_story_id UUID REFERENCES user_stories(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id),
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR(50) DEFAULT 'update',
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Comments
  `CREATE TABLE IF NOT EXISTS story_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_story_id UUID REFERENCES user_stories(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Meetings (synced from MS Teams / manual)
  `CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    ms_event_id VARCHAR(255) UNIQUE,
    user_story_id UUID REFERENCES user_stories(id),
    organizer_id UUID REFERENCES users(id),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location TEXT,
    meeting_link TEXT,
    attendees JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'scheduled',
    source VARCHAR(50) DEFAULT 'manual',
    ms_teams_join_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Email sync
  `CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ms_message_id VARCHAR(255) UNIQUE,
    user_id UUID REFERENCES users(id),
    user_story_id UUID REFERENCES user_stories(id),
    subject VARCHAR(1000),
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    recipients JSONB DEFAULT '[]',
    body_preview TEXT,
    received_at TIMESTAMP,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // WhatsApp messages
  `CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_message_id VARCHAR(255) UNIQUE,
    group_id VARCHAR(255),
    sender_number VARCHAR(50),
    sender_name VARCHAR(255),
    content TEXT,
    user_story_id UUID REFERENCES user_stories(id),
    processed BOOLEAN DEFAULT false,
    tagged_user_id UUID REFERENCES users(id),
    received_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // App settings
  `CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Notifications
  `CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Seed roles
  `INSERT INTO roles (name, description) VALUES
    ('system_admin', 'Full system access, can manage users and settings'),
    ('super_admin', 'Pre-sales manager with elevated access'),
    ('pre_sales_manager', 'Can manage team, stories, and view all data'),
    ('pre_sales_executive', 'Can view stories, create tasks, update stories with logged changes')
  ON CONFLICT (name) DO NOTHING`,

  // Seed default kanban columns
  `INSERT INTO kanban_columns (name, slug, position, color, is_system) VALUES
    ('L1 Stage', 'l1_stage', 1, '#3e72ae', false),
    ('L2 Stage', 'l2_stage', 2, '#6b5ea8', false),
    ('Commercial Stage', 'commercial_stage', 3, '#e67e22', true),
    ('Contract Stage', 'contract_stage', 4, '#27ae60', false),
    ('Client Onboarded', 'client_onboarded', 5, '#16a085', true),
    ('Dark Leads', 'dark_leads', 6, '#7f8c8d', true),
    ('Closed Lost', 'closed_lost', 7, '#c0392b', true)
  ON CONFLICT (slug) DO NOTHING`,

  // Individual contributor flag for Sales Managers who report directly to CGO
  `ALTER TABLE business_team ADD COLUMN IF NOT EXISTS is_individual_contributor BOOLEAN DEFAULT false`,

  // Sub-stage is now free-text on stories; drop the FK column and add a text column
  `ALTER TABLE user_stories ADD COLUMN IF NOT EXISTS sub_stage TEXT`,
  `ALTER TABLE user_stories DROP COLUMN IF EXISTS sub_stage_id`,
  // Remove all pre-seeded sub-stage dummy data
  `DELETE FROM kanban_sub_stages`,

  // Transition Forms
  `CREATE TABLE IF NOT EXISTS transition_forms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    from_column_id INTEGER REFERENCES kanban_columns(id) ON DELETE CASCADE,
    to_column_id INTEGER REFERENCES kanban_columns(id) ON DELETE CASCADE,
    is_mandatory BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(from_column_id, to_column_id)
  )`,

  `CREATE TABLE IF NOT EXISTS transition_form_fields (
    id SERIAL PRIMARY KEY,
    form_id INTEGER REFERENCES transition_forms(id) ON DELETE CASCADE,
    field_type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    placeholder TEXT DEFAULT '',
    is_required BOOLEAN DEFAULT false,
    options JSONB DEFAULT '[]',
    position INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS transition_form_responses (
    id SERIAL PRIMARY KEY,
    form_id INTEGER REFERENCES transition_forms(id) ON DELETE SET NULL,
    story_id UUID REFERENCES user_stories(id) ON DELETE CASCADE,
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    from_column_id INTEGER,
    to_column_id INTEGER,
    from_column_name VARCHAR(255),
    to_column_name VARCHAR(255),
    submitted_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS transition_form_field_responses (
    id SERIAL PRIMARY KEY,
    response_id INTEGER REFERENCES transition_form_responses(id) ON DELETE CASCADE,
    field_id INTEGER REFERENCES transition_form_fields(id) ON DELETE SET NULL,
    field_label VARCHAR(255),
    field_type VARCHAR(50),
    value TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Default app settings
  `INSERT INTO app_settings (key, value, description) VALUES
    ('app_name', 'Nexus Pre', 'Application name'),
    ('whatsapp_group_ids', '[]', 'JSON array of WhatsApp group IDs to monitor'),
    ('ms_sync_enabled', 'false', 'Enable Microsoft 365 sync'),
    ('whatsapp_enabled', 'false', 'Enable WhatsApp integration'),
    ('default_currency', 'USD', 'Default currency for deal values')
  ON CONFLICT (key) DO NOTHING`,

  // Teams
  `CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    purpose TEXT,
    accent_color VARCHAR(20) DEFAULT '#3e72ae',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(team_id, user_id)
  )`,

  // Role access controls
  `CREATE TABLE IF NOT EXISTS role_access_controls (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    feature_key VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role_id, module, feature_key)
  )`,

  // User-level access overrides
  `CREATE TABLE IF NOT EXISTS user_access_overrides (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    feature_key VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, module, feature_key)
  )`,

  // Tags table (system admin manages)
  `CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    color VARCHAR(20) DEFAULT '#3e72ae',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Industries table
  `CREATE TABLE IF NOT EXISTS industries (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Story-Tag junction
  `CREATE TABLE IF NOT EXISTS story_tags (
    story_id UUID REFERENCES user_stories(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, tag_id)
  )`,

  // Story-Industry junction
  `CREATE TABLE IF NOT EXISTS story_industries (
    story_id UUID REFERENCES user_stories(id) ON DELETE CASCADE,
    industry_id INTEGER REFERENCES industries(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, industry_id)
  )`,

  // Business Team hierarchy
  `CREATE TABLE IF NOT EXISTS business_team (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('cgo', 'asd', 'sales_manager', 'sales_executive')),
    parent_id INTEGER REFERENCES business_team(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Business team member tagging on user stories
  `ALTER TABLE user_stories ADD COLUMN IF NOT EXISTS business_team_member_id INTEGER REFERENCES business_team(id) ON DELETE SET NULL`,

  // Story ↔ Team assignments (a story can be assigned to one or more teams)
  `CREATE TABLE IF NOT EXISTS story_team_assignments (
    story_id UUID REFERENCES user_stories(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, team_id)
  )`,

  // Story ↔ Member assignments (individual user assignments)
  `CREATE TABLE IF NOT EXISTS story_member_assignments (
    story_id UUID REFERENCES user_stories(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (story_id, user_id)
  )`,

  // Task assignees (multiple assignees per task)
  `CREATE TABLE IF NOT EXISTS task_assignees (
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, user_id)
  )`,

  // Task start date
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE`,

  // Task activity / change log
  `CREATE TABLE IF NOT EXISTS task_change_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR(50) DEFAULT 'update',
    created_at TIMESTAMP DEFAULT NOW()
  )`,

  // Probable Prospects pipeline
  `CREATE TABLE IF NOT EXISTS probable_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    company_name VARCHAR(255),
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(100),
    source VARCHAR(100),
    priority VARCHAR(50) DEFAULT 'medium',
    notes TEXT,
    estimated_value NUMERIC(12,2),
    industry_id INTEGER REFERENCES industries(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    promoted_at TIMESTAMP,
    promoted_to_story_id UUID REFERENCES user_stories(id) ON DELETE SET NULL
  )`,
  `ALTER TABLE user_stories ADD COLUMN IF NOT EXISTS effective_start_date DATE`,

  // Task response details (mandatory before marking complete)
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS response_details TEXT`,

  // Prospect tasks
  `CREATE TABLE IF NOT EXISTS prospect_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES probable_prospects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'todo',
    response_details TEXT,
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Country field for stories and prospects
  `ALTER TABLE user_stories ADD COLUMN IF NOT EXISTS country VARCHAR(100)`,
  `ALTER TABLE probable_prospects ADD COLUMN IF NOT EXISTS country VARCHAR(100)`,

  // Prospect team and member assignments
  `CREATE TABLE IF NOT EXISTS prospect_team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES probable_prospects(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(prospect_id, team_id)
  )`,
  `CREATE TABLE IF NOT EXISTS prospect_member_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES probable_prospects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(prospect_id, user_id)
  )`,

  // Prospect industry assignments (multiselect)
  `CREATE TABLE IF NOT EXISTS prospect_industry_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES probable_prospects(id) ON DELETE CASCADE,
    industry_id INTEGER REFERENCES industries(id) ON DELETE CASCADE,
    UNIQUE(prospect_id, industry_id)
  )`,

  // Prospect tags
  `CREATE TABLE IF NOT EXISTS prospect_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID REFERENCES probable_prospects(id) ON DELETE CASCADE,
    tag_name VARCHAR(100) NOT NULL,
    UNIQUE(prospect_id, tag_name)
  )`,

  // Prospect task assignees
  `CREATE TABLE IF NOT EXISTS prospect_task_assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES prospect_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(task_id, user_id)
  )`,

  // Associate Sales Director link on prospects
  `ALTER TABLE probable_prospects ADD COLUMN IF NOT EXISTS sales_director_id INTEGER REFERENCES business_team(id) ON DELETE SET NULL`,

  // ─────────────────────────────────────────────────────────────────────────
  // Performance indexes
  // All CREATE INDEX statements use IF NOT EXISTS so they are safe to re-run.
  // ─────────────────────────────────────────────────────────────────────────

  // user_stories ─────────────────────────────────────────────────────────────
  // Most-hit query: Kanban board loads stories per column sorted by position
  `CREATE INDEX IF NOT EXISTS idx_us_column_position ON user_stories(column_id, position)`,
  // Dashboard trend, pipeline distribution, and prospect date filters
  `CREATE INDEX IF NOT EXISTS idx_us_created_at ON user_stories(created_at DESC)`,
  // Assigned-to filter used in story list and KPI queries
  `CREATE INDEX IF NOT EXISTS idx_us_assigned_to ON user_stories(assigned_to)`,

  // story_team_assignments ───────────────────────────────────────────────────
  // PK covers (story_id, team_id) — story_id lookups are fast.
  // team_id is the second column so reverse lookups (JOIN from team_members) need this:
  `CREATE INDEX IF NOT EXISTS idx_sta_team_id ON story_team_assignments(team_id)`,

  // story_member_assignments ─────────────────────────────────────────────────
  // PK covers (story_id, user_id). User-side lookups (EXISTS … user_id = $x) need this:
  `CREATE INDEX IF NOT EXISTS idx_sma_user_id ON story_member_assignments(user_id)`,

  // team_members ─────────────────────────────────────────────────────────────
  // UNIQUE(team_id, user_id) covers team_id first. user_id lookups need their own index:
  `CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)`,

  // tasks ────────────────────────────────────────────────────────────────────
  // Every task fetch is scoped to a story
  `CREATE INDEX IF NOT EXISTS idx_tasks_user_story_id ON tasks(user_story_id)`,
  // Dashboard overdue / in-progress / upcoming filters
  `CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
  // Task-completion chart filters on completed_at
  `CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at) WHERE completed_at IS NOT NULL`,

  // task_assignees ───────────────────────────────────────────────────────────
  // PK covers (task_id, user_id). "All tasks for user X" queries need the reverse:
  `CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id)`,

  // story_change_logs ────────────────────────────────────────────────────────
  // Dashboard recent-activity query joins on user_story_id then sorts by created_at
  `CREATE INDEX IF NOT EXISTS idx_scl_user_story_id ON story_change_logs(user_story_id)`,
  `CREATE INDEX IF NOT EXISTS idx_scl_created_at ON story_change_logs(created_at DESC)`,

  // probable_prospects ───────────────────────────────────────────────────────
  // Every single prospect query filters WHERE promoted_at IS NULL — partial index
  `CREATE INDEX IF NOT EXISTS idx_pp_active ON probable_prospects(created_at DESC) WHERE promoted_at IS NULL`,
  // Date-range filters on the prospect list and dashboard
  `CREATE INDEX IF NOT EXISTS idx_pp_created_at ON probable_prospects(created_at DESC)`,
  // ASD (sales director) filter on prospects
  `CREATE INDEX IF NOT EXISTS idx_pp_sales_director ON probable_prospects(sales_director_id)`,

  // prospect_team_assignments ────────────────────────────────────────────────
  // UNIQUE(prospect_id, team_id) covers prospect_id. Team-side EXISTS needs this:
  `CREATE INDEX IF NOT EXISTS idx_pta_team_id ON prospect_team_assignments(team_id)`,

  // prospect_member_assignments ──────────────────────────────────────────────
  // UNIQUE(prospect_id, user_id) covers prospect_id. User-side EXISTS needs this:
  `CREATE INDEX IF NOT EXISTS idx_pma_user_id ON prospect_member_assignments(user_id)`,

  // prospect_tasks ───────────────────────────────────────────────────────────
  // All prospect task fetches are scoped by prospect_id
  `CREATE INDEX IF NOT EXISTS idx_prospect_tasks_prospect_id ON prospect_tasks(prospect_id)`,
  // Dashboard overdue/upcoming filters
  `CREATE INDEX IF NOT EXISTS idx_prospect_tasks_due_date ON prospect_tasks(due_date) WHERE due_date IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_prospect_tasks_status ON prospect_tasks(status)`,

  // prospect_task_assignees ──────────────────────────────────────────────────
  // UNIQUE(task_id, user_id) covers task_id. User-side dashboard lookups need this:
  `CREATE INDEX IF NOT EXISTS idx_pta_assignee_user_id ON prospect_task_assignees(user_id)`,

  // notifications ────────────────────────────────────────────────────────────
  // Every notification fetch is for a specific user; unread badge uses (user_id, is_read)
  `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`,

  // users ────────────────────────────────────────────────────────────────────
  // User management and dashboard user-breakdown filter by role + active status
  `CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role_id, is_active)`,

  // meetings ─────────────────────────────────────────────────────────────────
  // Calendar view loads meetings by time range
  `CREATE INDEX IF NOT EXISTS idx_meetings_start_time ON meetings(start_time)`,
  // Story detail panel loads linked meetings
  `CREATE INDEX IF NOT EXISTS idx_meetings_user_story_id ON meetings(user_story_id) WHERE user_story_id IS NOT NULL`,

  // ── Ad-Hoc Tasks (system_admin standalone tasks) ──────────────────────────
  `CREATE TABLE IF NOT EXISTS adhoc_tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    start_date DATE,
    due_date DATE,
    completed_at TIMESTAMPTZ,
    response_details TEXT,
    business_team_member_id INTEGER REFERENCES business_team(id) ON DELETE SET NULL,
    story_id UUID REFERENCES user_stories(id) ON DELETE SET NULL,
    prospect_id UUID REFERENCES probable_prospects(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS adhoc_task_team_assignments (
    adhoc_task_id INTEGER REFERENCES adhoc_tasks(id) ON DELETE CASCADE,
    team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
    PRIMARY KEY (adhoc_task_id, team_id)
  )`,

  `CREATE TABLE IF NOT EXISTS adhoc_task_member_assignments (
    adhoc_task_id INTEGER REFERENCES adhoc_tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (adhoc_task_id, user_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_adhoc_tasks_created_by ON adhoc_tasks(created_by)`,
  `CREATE INDEX IF NOT EXISTS idx_adhoc_tasks_due_date ON adhoc_tasks(due_date) WHERE due_date IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_adhoc_tasks_story_id ON adhoc_tasks(story_id) WHERE story_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_adhoc_tasks_prospect_id ON adhoc_tasks(prospect_id) WHERE prospect_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_adhoc_tma_user_id ON adhoc_task_member_assignments(user_id)`,

  // ── Pipelines ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS pipelines (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS pipeline_leads (
    id SERIAL PRIMARY KEY,
    pipeline_id INTEGER REFERENCES pipelines(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    client_name TEXT NOT NULL,
    business_manager_id INTEGER REFERENCES business_team(id) ON DELETE SET NULL,
    industry_id INTEGER REFERENCES industries(id) ON DELETE SET NULL,
    country TEXT,
    status TEXT DEFAULT 'hot' CHECK (status IN ('hot', 'cold', 'onboarded', 'no_requirement')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS pipeline_lead_updates (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES pipeline_leads(id) ON DELETE CASCADE,
    update_text TEXT NOT NULL,
    update_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_pipelines_created_by ON pipelines(created_by)`,
  `CREATE INDEX IF NOT EXISTS idx_pipeline_leads_pipeline_id ON pipeline_leads(pipeline_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pipeline_leads_bm_id ON pipeline_leads(business_manager_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pipeline_lead_updates_lead_id ON pipeline_lead_updates(lead_id)`
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running database migrations...');
    await client.query('BEGIN');
    
    for (let i = 0; i < migrations.length; i++) {
      try {
        await client.query(migrations[i]);
        console.log(`✅ Migration ${i + 1}/${migrations.length} completed`);
      } catch (err) {
        console.error(`❌ Migration ${i + 1} failed:`, err.message);
        // Continue for seed statements that might fail on re-run
        if (!migrations[i].includes('INSERT')) {
          throw err;
        }
      }
    }
    
    await client.query('COMMIT');
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { runMigrations };
