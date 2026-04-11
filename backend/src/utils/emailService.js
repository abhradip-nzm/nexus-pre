const nodemailer = require('nodemailer');
const {
  buildEmail,
  welcomeEmail,
  passwordResetEmail,
  meetingReminderEmail,
  newLeadEmail,
  notificationEmail,
} = require('./emailTemplate');

/* ─── Transporter ──────────────────────────────────────────────────────────── */

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const {
    // Brevo-specific (preferred)
    BREVO_SMTP_KEY, BREVO_SMTP_USER,
    // Generic SMTP fallback
    SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
    EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS,
  } = process.env;

  // Brevo SMTP (preferred)
  if (BREVO_SMTP_KEY) {
    _transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: BREVO_SMTP_USER || EMAIL_FROM_ADDRESS || SMTP_USER,
        pass: BREVO_SMTP_KEY,
      },
    });
    return _transporter;
  }

  // Generic SMTP fallback
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[Email] SMTP not configured — emails will be logged to console only.');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return _transporter;
}

/* ─── Core send function ───────────────────────────────────────────────────── */

/**
 * Send a single email.
 * @param {string|string[]} to    — recipient(s)
 * @param {{ subject, html, text }} template — output of buildEmail()
 * @returns {Promise<boolean>}
 */
async function sendEmail(to, template) {
  const fromName    = process.env.EMAIL_FROM_NAME    || 'Nexus Pre';
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || 'noreply@nexuspre.com';
  const from        = `"${fromName}" <${fromAddress}>`;

  const transporter = getTransporter();

  if (!transporter) {
    // Dev/test: log to console instead of sending
    console.log('\n─────── EMAIL (console mode) ───────');
    console.log('To:     ', Array.isArray(to) ? to.join(', ') : to);
    console.log('From:   ', from);
    console.log('Subject:', template.subject);
    console.log('Text:\n', template.text);
    console.log('────────────────────────────────────\n');
    return true;
  }

  try {
    const info = await transporter.sendMail({
      from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: template.subject,
      text:    template.text,
      html:    template.html,
    });

    console.log(`[Email] Sent to ${to} — messageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('[Email] Send error:', err.message);
    return false;
  }
}

/* ─── Convenience senders ──────────────────────────────────────────────────── */

async function sendWelcomeEmail(to, data) {
  return sendEmail(to, welcomeEmail(data));
}

async function sendPasswordResetEmail(to, data) {
  return sendEmail(to, passwordResetEmail(data));
}

async function sendMeetingReminderEmail(to, data) {
  return sendEmail(to, meetingReminderEmail(data));
}

async function sendNewLeadEmail(to, data) {
  return sendEmail(to, newLeadEmail(data));
}

async function sendNotificationEmail(to, data) {
  return sendEmail(to, notificationEmail(data));
}

/**
 * Send a fully custom email using buildEmail() options directly.
 * @param {string|string[]} to
 * @param {object} buildOpts  — same options as buildEmail()
 */
async function sendCustomEmail(to, buildOpts) {
  return sendEmail(to, buildEmail(buildOpts));
}

module.exports = {
  sendEmail,
  sendCustomEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendMeetingReminderEmail,
  sendNewLeadEmail,
  sendNotificationEmail,
};
