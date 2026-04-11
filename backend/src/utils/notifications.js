const { query } = require('../config/database');

async function createNotification(userId, title, message, type = 'info', link = null) {
  try {
    await query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)',
      [userId, title, message, type, link]
    );
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
}

async function createNotificationForAdmins(title, message, type = 'info', link = null) {
  try {
    const admins = await query(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name IN ('system_admin', 'super_admin') AND u.is_active = true`
    );
    for (const admin of admins.rows) {
      await createNotification(admin.id, title, message, type, link);
    }
  } catch (err) {
    console.error('Failed to notify admins:', err.message);
  }
}

module.exports = { createNotification, createNotificationForAdmins };
