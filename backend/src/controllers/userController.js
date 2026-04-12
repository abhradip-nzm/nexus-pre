const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/emailService');
const { createNotification } = require('../utils/notifications');

const getAllUsers = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.role_id, u.is_active, u.last_login, u.whatsapp_number,
              u.ms_user_id, u.created_at, r.name as role_name,
              COUNT(DISTINCT us.id) as total_stories,
              COUNT(DISTINCT CASE WHEN us.column_id IN (
                SELECT id FROM kanban_columns WHERE slug = 'client_onboarded'
              ) THEN us.id END) as won_stories
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       LEFT JOIN user_stories us ON us.assigned_to = u.id
       WHERE r.name != 'system_admin'
       GROUP BY u.id, r.name
       ORDER BY u.created_at DESC`
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar_url,
              u.role_id, u.is_active, u.last_login, u.whatsapp_number,
              u.ms_user_id, u.created_at, r.name as role_name
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const permResult = await query('SELECT * FROM user_permissions WHERE user_id = $1', [id]);

    res.json({
      user: result.rows[0],
      permissions: permResult.rows,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

const createUser = async (req, res) => {
  try {
    const { email, first_name, last_name, phone, role_id, whatsapp_number, password } = req.body;

    if (!email || !first_name || !last_name || !role_id) {
      return res.status(400).json({ error: 'Email, name, and role are required' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const tempPassword = password || Math.random().toString(36).slice(-8) + 'Nx1!';
    const hash = await bcrypt.hash(tempPassword, 12);

    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, role_id, whatsapp_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, email, first_name, last_name, role_id, created_at`,
      [email.toLowerCase(), hash, first_name, last_name, phone, role_id, whatsapp_number]
    );

    // Create in-app notification
    await createNotification(
      result.rows[0].id,
      'Welcome to Nexus Pre',
      'Your account has been created. Please change your password on first login.',
      'info'
    );

    // Send welcome email with temp password (separate from notification email — richer template)
    sendWelcomeEmail(email.toLowerCase(), {
      name:        `${first_name} ${last_name}`,
      email:       email.toLowerCase(),
      tempPassword,
      loginUrl:    `${process.env.FRONTEND_URL || 'https://nexuspre.com'}/login`,
    }).catch(err => console.error('[Email] ❌ Welcome email failed — code:', err.code, '| response:', err.response || err.message));

    res.status(201).json({
      user: result.rows[0],
      tempPassword: !password ? tempPassword : undefined,
      message: 'User created successfully',
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, phone, role_id, is_active, whatsapp_number, avatar_url } = req.body;

    // Non-admins can only update their own profile (limited fields)
    if (req.user.role_name !== 'system_admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Cannot update other users' });
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (first_name) { updates.push(`first_name = $${idx++}`); values.push(first_name); }
    if (last_name) { updates.push(`last_name = $${idx++}`); values.push(last_name); }
    if (phone !== undefined) { updates.push(`phone = $${idx++}`); values.push(phone); }
    if (whatsapp_number !== undefined) { updates.push(`whatsapp_number = $${idx++}`); values.push(whatsapp_number); }
    if (avatar_url !== undefined) { updates.push(`avatar_url = $${idx++}`); values.push(avatar_url); }

    // Only system admin can change roles and active status
    if (req.user.role_name === 'system_admin') {
      if (role_id) { updates.push(`role_id = $${idx++}`); values.push(role_id); }
      if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    // Return the updated user so callers can refresh their state
    const updated = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.is_active,
              r.name as role_name, u.last_login
       FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [id]
    );

    res.json({ message: 'User updated successfully', user: updated.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (req.user.role_name !== 'system_admin') {
      return res.status(403).json({ error: 'Only system admins can reset passwords' });
    }

    const tempPassword = newPassword || Math.random().toString(36).slice(-8) + 'Nx1!';
    const hash = await bcrypt.hash(tempPassword, 12);

    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, id]);

    // Send password reset email if we have user details
    const userRes = await query(
      'SELECT email, first_name, last_name FROM users WHERE id = $1', [id]
    );
    if (userRes.rows.length > 0) {
      const u = userRes.rows[0];
      sendPasswordResetEmail(u.email, {
        name:        `${u.first_name} ${u.last_name}`,
        email:       u.email,
        tempPassword,
        loginUrl:    `${process.env.FRONTEND_URL || 'https://nexuspre.com'}/login`,
      }).catch(err => console.error('[Email] ❌ Password reset email failed — code:', err.code, '| response:', err.response || err.message));
    }

    res.json({
      message: 'Password reset successfully',
      tempPassword: !newPassword ? tempPassword : undefined,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
};

const updatePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    if (req.user.role_name !== 'system_admin') {
      return res.status(403).json({ error: 'Only system admins can update permissions' });
    }

    for (const perm of permissions) {
      await query(
        `INSERT INTO user_permissions (user_id, module, can_create, can_read, can_update, can_delete, granted_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, module) 
         DO UPDATE SET can_create = $3, can_read = $4, can_update = $5, can_delete = $6, 
                       granted_by = $7, updated_at = NOW()`,
        [id, perm.module, perm.can_create, perm.can_read, perm.can_update, perm.can_delete, req.user.id]
      );
    }

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions' });
  }
};

const getUserKPIs = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30' } = req.query;
    const days = parseInt(period);

    // Count stories assigned to this user via team or direct member assignment
    const storyResult = await query(
      `SELECT COUNT(DISTINCT us.id) as total_stories
       FROM user_stories us
       WHERE us.created_at >= NOW() - INTERVAL '${days} days'
         AND (
           EXISTS (
             SELECT 1 FROM story_team_assignments sta
             JOIN team_members tm ON tm.team_id = sta.team_id
             WHERE sta.story_id = us.id AND tm.user_id = $1
           ) OR EXISTS (
             SELECT 1 FROM story_member_assignments sma
             WHERE sma.story_id = us.id AND sma.user_id = $1
           )
         )`,
      [id]
    );

    // Count tasks assigned to this user (via task_assignees table or assigned_to)
    const taskResult = await query(
      `SELECT
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as in_progress_tasks,
        COUNT(DISTINCT CASE WHEN t.status != 'completed' AND t.due_date < NOW()::DATE THEN t.id END) as overdue_tasks
       FROM tasks t
       WHERE t.id IN (
         SELECT ta.task_id FROM task_assignees ta WHERE ta.user_id = $1
         UNION
         SELECT t2.id FROM tasks t2 WHERE t2.assigned_to = $1
       )`,
      [id]
    );

    res.json({
      kpis: {
        total_stories: parseInt(storyResult.rows[0]?.total_stories || 0),
        completed_tasks: parseInt(taskResult.rows[0]?.completed_tasks || 0),
        in_progress_tasks: parseInt(taskResult.rows[0]?.in_progress_tasks || 0),
        overdue_tasks: parseInt(taskResult.rows[0]?.overdue_tasks || 0),
      }
    });
  } catch (error) {
    console.error('Get KPIs error:', error);
    res.status(500).json({ error: 'Failed to get KPIs' });
  }
};

const getRoles = async (req, res) => {
  try {
    const result = await query('SELECT * FROM roles WHERE name != $1 ORDER BY id', ['system_admin']);
    res.json({ roles: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get roles' });
  }
};

// Returns all pre_sales users - accessible by all authenticated users (for assignment dropdowns)
const getAssignableUsers = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, r.name as role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE r.name IN ('pre_sales_manager', 'pre_sales_executive')
         AND u.is_active = true
       ORDER BY u.first_name, u.last_name`
    );
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get assignable users error:', error);
    res.status(500).json({ error: 'Failed to get assignable users' });
  }
};

module.exports = {
  getAllUsers, getUserById, createUser, updateUser,
  resetPassword, updatePermissions, getUserKPIs, getRoles, getAssignableUsers
};
