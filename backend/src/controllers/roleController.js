const { query } = require('../config/database');

const ACCESS_CONTROLS = [
  { module: 'kanban',    key: 'view_board',       label: 'View Kanban Board' },
  { module: 'kanban',    key: 'create_story',      label: 'Create Stories' },
  { module: 'kanban',    key: 'edit_story',        label: 'Edit Stories' },
  { module: 'kanban',    key: 'delete_story',      label: 'Delete Stories' },
  { module: 'kanban',    key: 'move_story',        label: 'Move / Drag Stories' },
  { module: 'dashboard', key: 'view_dashboard',    label: 'View Dashboard' },
  { module: 'dashboard', key: 'view_team_kpis',    label: 'View Team KPIs' },
  { module: 'stories',   key: 'view_details',      label: 'View Story Details' },
  { module: 'stories',   key: 'add_comments',      label: 'Add Comments' },
  { module: 'stories',   key: 'manage_tasks',      label: 'Manage Sub-Tasks' },
  { module: 'calendar',  key: 'view_calendar',     label: 'View Calendar' },
  { module: 'calendar',  key: 'create_meetings',   label: 'Create Meetings' },
  { module: 'calendar',  key: 'edit_meetings',     label: 'Edit / Delete Meetings' },
  { module: 'whatsapp',  key: 'view_messages',     label: 'View WhatsApp Messages' },
  { module: 'activity',  key: 'view_log',          label: 'View Activity Log' },
];

const SYSTEM_ROLES = ['system_admin', 'super_admin', 'pre_sales_manager', 'pre_sales_executive'];

const displayName = (name) => {
  const map = {
    system_admin: 'System Admin',
    super_admin: 'Super Admin',
    pre_sales_manager: 'Pre-Sales Manager',
    pre_sales_executive: 'Pre-Sales Executive',
  };
  return map[name] || name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const getRoles = async (req, res) => {
  try {
    const rolesRes = await query('SELECT * FROM roles ORDER BY id');
    const roles = rolesRes.rows.map(role => ({
      ...role,
      display_name: displayName(role.name),
      is_system: SYSTEM_ROLES.includes(role.name),
    }));
    res.json({ roles, access_controls_definition: ACCESS_CONTROLS });
  } catch (err) {
    console.error('getRoles error:', err);
    res.status(500).json({ error: 'Failed to get roles' });
  }
};

const getRoleAccessControls = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM role_access_controls WHERE role_id=$1', [id]);
    res.json({ controls: result.rows });
  } catch (err) {
    console.error('getRoleAccessControls error:', err);
    res.status(500).json({ error: 'Failed to get role access controls' });
  }
};

const createRole = async (req, res) => {
  try {
    const { name, description, access_controls } = req.body;
    if (!name) return res.status(400).json({ error: 'Role name required' });

    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const result = await query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *',
      [slug, description || '']
    );
    const role = {
      ...result.rows[0],
      display_name: req.body.name || slug,
      is_system: false,
    };

    // Seed access controls
    const acs = access_controls || ACCESS_CONTROLS.map(a => ({ ...a, is_enabled: true }));
    for (const ac of acs) {
      await query(
        `INSERT INTO role_access_controls (role_id, module, feature_key, is_enabled)
         VALUES ($1, $2, $3, $4) ON CONFLICT (role_id, module, feature_key) DO UPDATE SET is_enabled=$4`,
        [role.id, ac.module, ac.key, ac.is_enabled !== false]
      );
    }

    res.status(201).json({ role });
  } catch (err) {
    console.error('createRole error:', err);
    res.status(500).json({ error: 'Failed to create role' });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const result = await query(
      'UPDATE roles SET description=$1 WHERE id=$2 RETURNING *',
      [description, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Role not found' });
    res.json({ role: result.rows[0] });
  } catch (err) {
    console.error('updateRole error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await query('SELECT name FROM roles WHERE id=$1', [id]);
    if (!role.rows.length) return res.status(404).json({ error: 'Role not found' });
    const systemRoles = ['system_admin', 'super_admin', 'pre_sales_manager', 'pre_sales_executive'];
    if (systemRoles.includes(role.rows[0].name)) return res.status(400).json({ error: 'Cannot delete system roles' });
    const users = await query('SELECT id FROM users WHERE role_id=$1 LIMIT 1', [id]);
    if (users.rows.length) return res.status(400).json({ error: 'Cannot delete role with assigned users' });
    await query('DELETE FROM roles WHERE id=$1', [id]);
    res.json({ message: 'Role deleted' });
  } catch (err) {
    console.error('deleteRole error:', err);
    res.status(500).json({ error: 'Failed to delete role' });
  }
};

const updateRoleAccessControls = async (req, res) => {
  try {
    const { id } = req.params;
    const acList = req.body.access_controls || req.body.controls;
    if (!Array.isArray(acList)) return res.status(400).json({ error: 'access_controls must be array' });

    for (const ac of acList) {
      const fKey = ac.feature_key || ac.key;
      await query(
        `INSERT INTO role_access_controls (role_id, module, feature_key, is_enabled)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (role_id, module, feature_key) DO UPDATE SET is_enabled=$4`,
        [id, ac.module, fKey, ac.is_enabled]
      );
    }
    res.json({ message: 'Access controls updated' });
  } catch (err) {
    console.error('updateRoleAccessControls error:', err);
    res.status(500).json({ error: 'Failed to update access controls' });
  }
};

const getUserAccessOverrides = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM user_access_overrides WHERE user_id=$1', [id]);
    res.json({ overrides: result.rows });
  } catch (err) {
    console.error('getUserAccessOverrides error:', err);
    res.status(500).json({ error: 'Failed to get user access overrides' });
  }
};

const updateUserAccessOverride = async (req, res) => {
  try {
    const { id } = req.params;
    const { module, feature_key, key, is_enabled } = req.body;
    const fKey = feature_key || key;

    if (is_enabled === null || is_enabled === undefined) {
      // null means clear the override
      await query('DELETE FROM user_access_overrides WHERE user_id=$1 AND module=$2 AND feature_key=$3', [id, module, fKey]);
    } else {
      await query(
        `INSERT INTO user_access_overrides (user_id, module, feature_key, is_enabled)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, module, feature_key) DO UPDATE SET is_enabled=$4`,
        [id, module, fKey, is_enabled]
      );
    }
    res.json({ message: 'Override updated' });
  } catch (err) {
    console.error('updateUserAccessOverride error:', err);
    res.status(500).json({ error: 'Failed to update override' });
  }
};

module.exports = { getRoles, getRoleAccessControls, createRole, updateRole, deleteRole, updateRoleAccessControls, getUserAccessOverrides, updateUserAccessOverride, ACCESS_CONTROLS };
