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

  // Seed default sub stages
  `INSERT INTO kanban_sub_stages (column_id, name, position) 
  SELECT id, 'First L1 Meeting', 1 FROM kanban_columns WHERE slug = 'l1_stage'
  ON CONFLICT DO NOTHING`,

  `INSERT INTO kanban_sub_stages (column_id, name, position)
  SELECT id, 'Second L1 Meeting', 2 FROM kanban_columns WHERE slug = 'l1_stage'
  ON CONFLICT DO NOTHING`,

  `INSERT INTO kanban_sub_stages (column_id, name, position)
  SELECT id, 'Discovery', 1 FROM kanban_columns WHERE slug = 'l2_stage'
  ON CONFLICT DO NOTHING`,

  `INSERT INTO kanban_sub_stages (column_id, name, position)
  SELECT id, 'Solution Walkthrough', 2 FROM kanban_columns WHERE slug = 'l2_stage'
  ON CONFLICT DO NOTHING`,

  `INSERT INTO kanban_sub_stages (column_id, name, position)
  SELECT id, 'Technical Proposal Presentation', 3 FROM kanban_columns WHERE slug = 'l2_stage'
  ON CONFLICT DO NOTHING`,

  `INSERT INTO kanban_sub_stages (column_id, name, position)
  SELECT id, 'Contract Signing Pending', 1 FROM kanban_columns WHERE slug = 'contract_stage'
  ON CONFLICT DO NOTHING`,

  `INSERT INTO kanban_sub_stages (column_id, name, position)
  SELECT id, 'Contract Signed', 2 FROM kanban_columns WHERE slug = 'contract_stage'
  ON CONFLICT DO NOTHING`,

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
  )`
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
