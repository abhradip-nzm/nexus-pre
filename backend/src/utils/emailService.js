const axios    = require('axios');
const nodemailer = require('nodemailer');
const {
  buildEmail,
  welcomeEmail,
  passwordResetEmail,
  meetingReminderEmail,
  newLeadEmail,
  notificationEmail,
} = require('./emailTemplate');

/* ─── Brevo HTTP API sender ────────────────────────────────────────────────────
   Used when BREVO_API_KEY is set.
   Goes over HTTPS port 443 — works on Render free tier.
   SMTP (port 587) is blocked by Render free tier — do not use SMTP on Render.
──────────────────────────────────────────────────────────────────────────────── */

async function sendViaBrevoAPI(to, template) {
  const apiKey      = process.env.BREVO_API_KEY;
  const fromName    = process.env.EMAIL_FROM_NAME    || 'Nexus Pre';
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@nexuspre.com';

  const recipients = (Array.isArray(to) ? to : [to]).map(email => ({ email }));

  const payload = {
    sender:      { name: fromName, email: fromAddress },
    to:          recipients,
    subject:     template.subject,
    htmlContent: template.html,
    textContent: template.text,
  };

  const response = await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    payload,
    {
      headers: {
        'api-key':      apiKey,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      timeout: 10000,
    }
  );

  return response.data?.messageId || response.data?.messageIds?.[0] || 'sent';
}

/* ─── SMTP transporter (fallback for non-Render environments) ──────────────── */

let _transporter = null;

function getSmtpTransporter() {
  if (_transporter) return _transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    _transporter = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   parseInt(SMTP_PORT || '587', 10),
      secure: SMTP_SECURE === 'true',
      auth:   { user: SMTP_USER, pass: SMTP_PASS },
    });
  }

  return _transporter;
}

/* ─── Startup verification ─────────────────────────────────────────────────── */

async function verifyEmailSetup() {
  const { BREVO_API_KEY, SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;

  if (BREVO_API_KEY) {
    // Test Brevo API with a lightweight accounts call
    try {
      await axios.get('https://api.brevo.com/v3/account', {
        headers: { 'api-key': BREVO_API_KEY },
        timeout: 8000,
      });
      const from = process.env.EMAIL_FROM_ADDRESS || 'noreply@nexuspre.com';
      console.log(`[Email] ✅ Brevo API connected — sending as: ${from}`);
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message || err.message;
      console.error(`[Email] ❌ Brevo API check failed (${status || 'network'}): ${msg}`);
      if (status === 401) {
        console.error('[Email]    → BREVO_API_KEY is invalid. Generate a new one in Brevo → Settings → API Keys.');
      }
    }
    return;
  }

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      await getSmtpTransporter().verify();
      console.log(`[Email] ✅ SMTP connected (${SMTP_HOST})`);
    } catch (err) {
      console.error(`[Email] ❌ SMTP failed: ${err.message}`);
    }
    return;
  }

  console.warn('[Email] ⚠️  No email provider configured — emails logged to console only.');
}

/* ─── Core send function ───────────────────────────────────────────────────── */

async function sendEmail(to, template) {
  const { BREVO_API_KEY, EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS, SMTP_USER } = process.env;

  // ── Brevo HTTP API (preferred — works on Render free tier)
  if (BREVO_API_KEY) {
    try {
      const msgId = await sendViaBrevoAPI(to, template);
      console.log(`[Email] ✅ Sent "${template.subject}" to ${to} — id: ${msgId}`);
      return true;
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message || err.message;
      console.error(`[Email] ❌ Brevo API error sending "${template.subject}" to ${to}`);
      console.error(`[Email]    Status: ${status || 'network'} | Message: ${msg}`);
      if (status === 401) console.error('[Email]    → Invalid BREVO_API_KEY');
      if (status === 400) console.error('[Email]    → Sender not verified in Brevo. Go to Brevo → Senders & IPs → Senders');
      return false;
    }
  }

  // ── SMTP fallback
  const transporter = getSmtpTransporter();
  if (transporter) {
    const fromName    = EMAIL_FROM_NAME    || 'Nexus Pre';
    const fromAddress = EMAIL_FROM_ADDRESS || SMTP_USER || 'noreply@nexuspre.com';
    try {
      const info = await transporter.sendMail({
        from:    `"${fromName}" <${fromAddress}>`,
        to:      Array.isArray(to) ? to.join(', ') : to,
        subject: template.subject,
        text:    template.text,
        html:    template.html,
      });
      console.log(`[Email] ✅ Sent via SMTP "${template.subject}" to ${to} — id: ${info.messageId}`);
      return true;
    } catch (err) {
      console.error(`[Email] ❌ SMTP error: ${err.code} | ${err.response || err.message}`);
      return false;
    }
  }

  // ── Console fallback (dev mode)
  const fromAddress = EMAIL_FROM_ADDRESS || SMTP_USER || 'noreply@nexuspre.com';
  console.log('\n─────── EMAIL (console mode) ───────');
  console.log('To:     ', Array.isArray(to) ? to.join(', ') : to);
  console.log('From:   ', fromAddress);
  console.log('Subject:', template.subject);
  console.log('Text:\n', template.text);
  console.log('────────────────────────────────────\n');
  return true;
}

/* ─── Convenience senders ──────────────────────────────────────────────────── */

const sendWelcomeEmail          = (to, data) => sendEmail(to, welcomeEmail(data));
const sendPasswordResetEmail    = (to, data) => sendEmail(to, passwordResetEmail(data));
const sendMeetingReminderEmail  = (to, data) => sendEmail(to, meetingReminderEmail(data));
const sendNewLeadEmail          = (to, data) => sendEmail(to, newLeadEmail(data));
const sendNotificationEmail     = (to, data) => sendEmail(to, notificationEmail(data));
const sendCustomEmail           = (to, opts) => sendEmail(to, buildEmail(opts));

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
