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

  const { BREVO_SMTP_KEY, BREVO_SMTP_USER, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

  if (BREVO_SMTP_KEY) {
    _transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: BREVO_SMTP_USER,
        pass: BREVO_SMTP_KEY,
      },
    });
    return _transporter;
  }

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587', 10),
      secure: SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return _transporter;
  }

  return null;
}

/**
 * Called at server startup — verifies SMTP connection and logs the result.
 * Never throws.
 */
async function verifyEmailSetup() {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[Email] ⚠️  No SMTP configured — emails will be logged to console only.');
    return;
  }
  try {
    await transporter.verify();
    const from = process.env.EMAIL_FROM_ADDRESS || process.env.BREVO_SMTP_USER || 'noreply@nexuspre.com';
    console.log(`[Email] ✅ SMTP connected — sending as: ${from}`);
  } catch (err) {
    console.error('[Email] ❌ SMTP connection failed:', err.message);
    console.error('[Email]    Full error:', JSON.stringify(err, null, 2));
    console.error('[Email]    Check BREVO_SMTP_KEY, BREVO_SMTP_USER and that your sender is verified in Brevo.');
    // Reset so next call retries
    _transporter = null;
  }
}

/* ─── Core send function ───────────────────────────────────────────────────── */

async function sendEmail(to, template) {
  const fromName    = process.env.EMAIL_FROM_NAME    || 'Nexus Pre';
  // When Brevo is configured use its verified sender; fall back to EMAIL_FROM_ADDRESS
  const fromAddress = process.env.EMAIL_FROM_ADDRESS
    || process.env.BREVO_SMTP_USER
    || process.env.SMTP_USER
    || 'noreply@nexuspre.com';
  const from = `"${fromName}" <${fromAddress}>`;

  const transporter = getTransporter();

  if (!transporter) {
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
    console.log(`[Email] ✅ Sent "${template.subject}" to ${to} — messageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Email] ❌ Failed to send "${template.subject}" to ${to}`);
    console.error(`[Email]    SMTP error code: ${err.code || 'unknown'} | Response: ${err.response || err.message}`);
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
  verifyEmailSetup,
};
