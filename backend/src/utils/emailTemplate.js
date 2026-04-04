/**
 * Nexus Pre — Universal Email Template Engine
 *
 * Usage:
 *   buildEmail({
 *     subject:    'Your temporary password',
 *     preheader:  'Use this to log in, then change it immediately.',
 *     heading:    'Password Reset',
 *     body:       ['Hi John,', 'Your account password has been reset.'],
 *     cta:        { label: 'Log In Now', url: 'https://app.nexuspre.com' },
 *     details:    [{ label: 'Email', value: 'john@acme.com' }],
 *     alert:      { type: 'warning', text: 'This link expires in 24 hours.' },
 *     footer:     { unsubscribe: false }
 *   })
 *
 * Options:
 *   subject     string    — email subject line (also used as fallback heading)
 *   preheader   string    — preview text shown in inbox (hidden in email body)
 *   heading     string    — large title inside the card
 *   subheading  string    — smaller line below heading
 *   body        string[]  — array of paragraph strings (supports basic HTML)
 *   cta         object    — { label, url, secondary?: { label, url } }
 *   details     object[]  — key-value rows  [{ label, value, mono? }]
 *   alert       object    — { type: 'info'|'warning'|'success'|'error', text }
 *   divider     boolean   — add a horizontal rule before footer area
 *   footer      object    — { note?, unsubscribe? }
 */

const BRAND = {
  primary:      '#3e72ae',
  primaryDark:  '#2d5a8e',
  secondary:    '#16a085',
  gradStart:    '#3e72ae',
  gradEnd:      '#16a085',
  bg:           '#f0f4f8',
  cardBg:       '#ffffff',
  text:         '#1a2332',
  textMuted:    '#4a5568',
  textLight:    '#718096',
  border:       '#e2e8f0',
  success:      '#27ae60',
  warning:      '#f59e0b',
  error:        '#e74c3c',
  info:         '#2980b9',
};

const ALERT_STYLES = {
  info:    { bg: '#ebf5fb', border: '#2980b9', icon: '#2980b9',  iconChar: 'i' },
  success: { bg: '#eafaf1', border: '#27ae60', icon: '#27ae60',  iconChar: '✓' },
  warning: { bg: '#fefce8', border: '#f59e0b', icon: '#f59e0b',  iconChar: '!' },
  error:   { bg: '#fdf2f2', border: '#e74c3c', icon: '#e74c3c',  iconChar: '×' },
};

/**
 * Escape HTML in plain text values to prevent injection
 */
function esc(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the complete HTML email string.
 * @param {object} opts
 * @returns {{ html: string, text: string }}
 */
function buildEmail(opts = {}) {
  const {
    subject     = 'Notification from Nexus Pre',
    preheader   = '',
    heading     = opts.subject || 'Nexus Pre',
    subheading  = '',
    body        = [],
    cta         = null,
    details     = [],
    alert       = null,
    divider     = false,
    footer      = {},
  } = opts;

  const preheaderText = preheader || (Array.isArray(body) ? body[0] || '' : body);

  /* ── Paragraphs ────────────────────────────────────────────────────── */
  const paragraphsHtml = (Array.isArray(body) ? body : [body])
    .filter(Boolean)
    .map(p => `
      <p style="margin:0 0 16px 0; font-size:15px; line-height:1.7;
                color:${BRAND.textMuted}; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
        ${p}
      </p>`)
    .join('');

  /* ── Alert box ─────────────────────────────────────────────────────── */
  const alertHtml = alert ? (() => {
    const s = ALERT_STYLES[alert.type] || ALERT_STYLES.info;
    return `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
             style="margin:0 0 24px 0;">
        <tr>
          <td style="background:${s.bg}; border:1.5px solid ${s.border};
                     border-radius:8px; padding:14px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td width="28" valign="top">
                  <div style="width:22px; height:22px; border-radius:50%;
                              background:${s.icon}; color:white;
                              font-size:13px; font-weight:700; text-align:center;
                              line-height:22px; font-family:Georgia,serif;">
                    ${s.iconChar}
                  </div>
                </td>
                <td style="font-size:13px; line-height:1.6; color:${BRAND.text};
                           font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                           padding-left:10px;">
                  ${alert.text}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
  })() : '';

  /* ── Details table ─────────────────────────────────────────────────── */
  const detailsHtml = details.length ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:0 0 24px 0; border:1.5px solid ${BRAND.border};
                  border-radius:8px; overflow:hidden; border-collapse:separate;">
      ${details.map((row, i) => `
        <tr>
          <td style="padding:11px 16px; font-size:12px; font-weight:600;
                     text-transform:uppercase; letter-spacing:0.05em;
                     color:${BRAND.textLight}; white-space:nowrap;
                     background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'};
                     border-bottom:1px solid ${BRAND.border};
                     font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                     width:35%;">
            ${esc(row.label)}
          </td>
          <td style="padding:11px 16px; font-size:13px; color:${BRAND.text};
                     background:${i % 2 === 0 ? '#f9fafb' : '#ffffff'};
                     border-bottom:1px solid ${BRAND.border};
                     font-family:${row.mono ? "'Courier New',Courier,monospace" : "'Segoe UI',Helvetica,Arial,sans-serif"};
                     font-weight:${row.mono ? '400' : '500'};
                     word-break:break-word;">
            ${row.mono ? `<span style="background:#f0f4f8; padding:2px 8px; border-radius:4px; font-size:13px;">${esc(row.value)}</span>` : esc(row.value)}
          </td>
        </tr>`).join('')}
    </table>` : '';

  /* ── CTA buttons ───────────────────────────────────────────────────── */
  const ctaHtml = cta ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:0 0 8px 0;">
      <tr>
        <td align="center" style="padding:8px 0 ${cta.secondary ? '12px' : '0'} 0;">
          <a href="${cta.url}"
             style="display:inline-block; padding:14px 36px;
                    background:linear-gradient(135deg,${BRAND.gradStart} 0%,${BRAND.gradEnd} 100%);
                    color:#ffffff; text-decoration:none; font-size:15px;
                    font-weight:700; border-radius:8px; letter-spacing:0.02em;
                    font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                    box-shadow:0 4px 14px rgba(62,114,174,0.4);"
             target="_blank">
            ${esc(cta.label)}
          </a>
        </td>
      </tr>
      ${cta.secondary ? `
      <tr>
        <td align="center" style="padding:0 0 8px 0;">
          <a href="${cta.secondary.url}"
             style="display:inline-block; padding:10px 24px;
                    color:${BRAND.primary}; text-decoration:none; font-size:13px;
                    font-weight:600; border:1.5px solid ${BRAND.primary};
                    border-radius:8px; background:#ffffff;
                    font-family:'Segoe UI',Helvetica,Arial,sans-serif;"
             target="_blank">
            ${esc(cta.secondary.label)}
          </a>
        </td>
      </tr>` : ''}
    </table>` : '';

  /* ── Divider ───────────────────────────────────────────────────────── */
  const dividerHtml = divider ? `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
           style="margin:24px 0 0 0;">
      <tr>
        <td style="border-top:1px solid ${BRAND.border}; font-size:0; line-height:0;">&nbsp;</td>
      </tr>
    </table>` : '';

  /* ── Footer note ───────────────────────────────────────────────────── */
  const footerNote = footer.note ? `
    <p style="margin:0 0 10px 0; font-size:12px; color:${BRAND.textLight};
              line-height:1.6; font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
      ${footer.note}
    </p>` : '';

  const unsubscribeHtml = footer.unsubscribe !== false ? `
    <p style="margin:0; font-size:11px; color:${BRAND.textLight};
              font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
      You're receiving this because you have an account on Nexus Pre.
    </p>` : '';

  const currentYear = new Date().getFullYear();

  /* ── Full HTML ─────────────────────────────────────────────────────── */
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
  <title>${esc(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width: 600px) {
      .email-wrapper  { padding: 16px 8px !important; }
      .email-card     { border-radius: 12px !important; }
      .email-body     { padding: 28px 20px !important; }
      .header-logo    { font-size: 20px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${BRAND.bg};
             -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">

  <!-- Preheader (hidden preview text) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;
              font-size:1px; color:${BRAND.bg}; line-height:1px;">
    ${esc(typeof preheaderText === 'string' ? preheaderText.replace(/<[^>]+>/g, '').slice(0, 140) : '')}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <!-- Email wrapper table -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         class="email-wrapper"
         style="background-color:${BRAND.bg}; padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Max-width container -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:580px; width:100%;">

          <!-- ── HEADER ─────────────────────────────────────────── -->
          <tr>
            <td align="center" style="padding:0 0 24px 0;">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding:14px 28px;
                             background:linear-gradient(135deg,${BRAND.gradStart} 0%,${BRAND.gradEnd} 100%);
                             border-radius:12px;">
                    <span class="header-logo"
                          style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                                 font-size:22px; font-weight:800; color:#ffffff;
                                 letter-spacing:-0.3px;">
                      Nexus&nbsp;<span style="opacity:0.85;">Pre</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── CARD ───────────────────────────────────────────── -->
          <tr>
            <td class="email-card"
                style="background:${BRAND.cardBg}; border-radius:16px;
                       box-shadow:0 4px 24px rgba(62,114,174,0.10);
                       overflow:hidden;">

              <!-- Gradient top bar -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="height:4px;
                             background:linear-gradient(90deg,${BRAND.gradStart} 0%,${BRAND.gradEnd} 100%);
                             font-size:0; line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Card body -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td class="email-body" style="padding:40px 40px 36px 40px;">

                    <!-- Heading -->
                    <h1 style="margin:0 0 ${subheading ? '6px' : '24px'} 0;
                                font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                                font-size:26px; font-weight:800; line-height:1.2;
                                color:${BRAND.text}; letter-spacing:-0.4px;">
                      ${heading}
                    </h1>
                    ${subheading ? `
                    <p style="margin:0 0 24px 0; font-size:14px; color:${BRAND.textLight};
                              font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                              font-weight:500; letter-spacing:0.01em;">
                      ${subheading}
                    </p>` : ''}

                    <!-- Body paragraphs -->
                    ${paragraphsHtml}

                    <!-- Alert box -->
                    ${alertHtml}

                    <!-- Details table -->
                    ${detailsHtml}

                    <!-- CTA buttons -->
                    ${ctaHtml}

                    ${dividerHtml}

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── FOOTER ─────────────────────────────────────────── -->
          <tr>
            <td align="center" style="padding:28px 20px 8px 20px;">

              <!-- Social / links row -->
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin-bottom:16px;">
                <tr>
                  <td style="padding:0 10px;">
                    <a href="#" style="font-size:12px; color:${BRAND.primary};
                                       text-decoration:none; font-weight:600;
                                       font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                      Dashboard
                    </a>
                  </td>
                  <td style="padding:0 10px; color:${BRAND.border}; font-size:12px;">|</td>
                  <td style="padding:0 10px;">
                    <a href="#" style="font-size:12px; color:${BRAND.primary};
                                       text-decoration:none; font-weight:600;
                                       font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                      Help &amp; Support
                    </a>
                  </td>
                  <td style="padding:0 10px; color:${BRAND.border}; font-size:12px;">|</td>
                  <td style="padding:0 10px;">
                    <a href="#" style="font-size:12px; color:${BRAND.primary};
                                       text-decoration:none; font-weight:600;
                                       font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                      Privacy Policy
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="max-width:400px; margin:0 auto 16px auto;">
                <tr>
                  <td style="border-top:1px solid ${BRAND.border}; font-size:0;">&nbsp;</td>
                </tr>
              </table>

              ${footerNote}
              ${unsubscribeHtml}

              <p style="margin:10px 0 0 0; font-size:11px; color:${BRAND.textLight};
                        font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
                &copy; ${currentYear} Nexus Pre. All rights reserved.
              </p>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  /* ── Plain-text fallback ───────────────────────────────────────────── */
  const textParts = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    'NEXUS PRE',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    heading.toUpperCase(),
    subheading ? subheading : '',
    '',
    ...(Array.isArray(body) ? body : [body]).map(p => p.replace(/<[^>]+>/g, '').trim()),
    '',
    ...(alert ? [`[${(alert.type || 'info').toUpperCase()}] ${alert.text.replace(/<[^>]+>/g, '')}`, ''] : []),
    ...(details.length ? [
      '────────────────────────────────',
      ...details.map(r => `${r.label}: ${r.value}`),
      '────────────────────────────────',
      '',
    ] : []),
    ...(cta ? [`${cta.label}: ${cta.url}`, ''] : []),
    ...(cta?.secondary ? [`${cta.secondary.label}: ${cta.secondary.url}`, ''] : []),
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `© ${currentYear} Nexus Pre. All rights reserved.`,
  ].filter(Boolean);

  return {
    subject,
    html,
    text: textParts.join('\n'),
  };
}

/* ─── Pre-built templates ──────────────────────────────────────────────────── */

/**
 * Welcome email sent when a new account is created by a system admin.
 */
function welcomeEmail({ name, email, tempPassword, loginUrl }) {
  return buildEmail({
    subject:    'Welcome to Nexus Pre — Your account is ready',
    preheader:  `Hi ${name}, your Nexus Pre account has been created. Log in with your temporary password.`,
    heading:    `Welcome, ${name}`,
    subheading: 'Your pre-sales workspace is ready',
    body: [
      `Your Nexus Pre account has been set up. Use the credentials below to log in for the first time.`,
      `You will be prompted to change your password after logging in. Keep your credentials secure and do not share them.`,
    ],
    details: [
      { label: 'Login Email',         value: email },
      { label: 'Temporary Password',  value: tempPassword, mono: true },
    ],
    alert: {
      type: 'warning',
      text: 'This is a temporary password. Please change it immediately after your first login.',
    },
    cta: { label: 'Log In to Nexus Pre', url: loginUrl },
    footer: { unsubscribe: false },
  });
}

/**
 * Password reset — new temporary password issued by an admin.
 */
function passwordResetEmail({ name, email, tempPassword, loginUrl }) {
  return buildEmail({
    subject:    'Your Nexus Pre password has been reset',
    preheader:  'A new temporary password has been generated for your account.',
    heading:    'Password Reset',
    subheading: 'A temporary password has been issued',
    body: [
      `Hi <strong>${name}</strong>, an administrator has reset your Nexus Pre account password.`,
      `Use the temporary password below to log in, then update it right away from your profile settings.`,
    ],
    details: [
      { label: 'Account Email',       value: email },
      { label: 'Temporary Password',  value: tempPassword, mono: true },
    ],
    alert: {
      type: 'warning',
      text: 'If you did not request this reset, contact your system administrator immediately.',
    },
    cta: { label: 'Log In Now', url: loginUrl },
    footer: { unsubscribe: false },
  });
}

/**
 * Meeting reminder sent before a scheduled meeting.
 */
function meetingReminderEmail({ name, title, date, time, location, description, joinUrl }) {
  return buildEmail({
    subject:    `Reminder: ${title}`,
    preheader:  `Your meeting "${title}" is coming up on ${date} at ${time}.`,
    heading:    'Meeting Reminder',
    subheading: title,
    body: [
      `Hi <strong>${name}</strong>, this is a reminder about your upcoming meeting.`,
      ...(description ? [description] : []),
    ],
    details: [
      { label: 'Date',        value: date },
      { label: 'Time',        value: time },
      ...(location ? [{ label: 'Location / Link', value: location }] : []),
    ],
    cta: joinUrl ? { label: 'Join Meeting', url: joinUrl } : null,
    footer: { unsubscribe: true },
  });
}

/**
 * New lead / story created notification.
 */
function newLeadEmail({ name, storyTitle, company, source, assignedTo, dashboardUrl }) {
  return buildEmail({
    subject:    `New Lead: ${storyTitle}`,
    preheader:  `A new lead from ${company} has been added to your pipeline.`,
    heading:    'New Lead Added',
    subheading: storyTitle,
    body: [
      `Hi <strong>${name}</strong>, a new lead has been added to your Nexus Pre pipeline and requires your attention.`,
    ],
    details: [
      { label: 'Company',     value: company },
      { label: 'Source',      value: source },
      { label: 'Assigned To', value: assignedTo },
    ],
    alert: {
      type: 'info',
      text: 'Review the lead in Nexus Pre and move it to the appropriate pipeline stage.',
    },
    cta: { label: 'View in Kanban Board', url: dashboardUrl },
    footer: { unsubscribe: true },
  });
}

/**
 * General notification — fully flexible.
 */
function notificationEmail({ name, subject, message, details = [], cta = null }) {
  return buildEmail({
    subject,
    preheader: message,
    heading:   subject,
    body:      [`Hi <strong>${name}</strong>,`, message],
    details,
    cta,
    footer:    { unsubscribe: true },
  });
}

module.exports = {
  buildEmail,
  welcomeEmail,
  passwordResetEmail,
  meetingReminderEmail,
  newLeadEmail,
  notificationEmail,
};
