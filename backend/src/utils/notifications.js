const { query } = require('../config/database');
const { sendNotificationEmail } = require('./emailService');

const APP_URL = () => process.env.FRONTEND_URL || 'https://nexuspre.com';

/**
 * Create an in-app notification and fire an email to the user (non-blocking).
 */
async function createNotification(userId, title, message, type = 'info', link = null) {
  try {
    await query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)',
      [userId, title, message, type, link]
    );
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }

  // Send email — fire-and-forget, never blocks or throws
  _sendEmailForUser(userId, title, message, link).catch(err =>
    console.error('[Email] Notification email error:', err.message)
  );
}

/**
 * Create notifications for all active system_admin / super_admin users.
 */
async function createNotificationForAdmins(title, message, type = 'info', link = null) {
  try {
    const admins = await query(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE r.name IN ('system_admin', 'super_admin') AND u.is_active = true`
    );
    await Promise.all(admins.rows.map(a => createNotification(a.id, title, message, type, link)));
  } catch (err) {
    console.error('Failed to notify admins:', err.message);
  }
}

/* ─── Internal ─────────────────────────────────────────────────────────────── */

async function _sendEmailForUser(userId, title, message, link) {
  try {
    const result = await query(
      `SELECT first_name, last_name, email FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    if (!result.rows.length) return;

    const { first_name, last_name, email } = result.rows[0];
    const name = `${first_name} ${last_name}`;

    await sendNotificationEmail(email, {
      name,
      subject: title,
      message,
      cta: link ? { label: 'View in Nexus Pre', url: `${APP_URL()}${link}` } : {
        label: 'Go to Dashboard',
        url: `${APP_URL()}/dashboard`,
      },
    });
  } catch (err) {
    console.error('[Email] _sendEmailForUser error:', err.message);
  }
}

module.exports = { createNotification, createNotificationForAdmins };
