/**
 * Email Preview Generator
 * Run: node src/utils/emailPreview.js
 * Opens preview HTML files in the /tmp directory.
 */

const fs   = require('fs');
const path = require('path');
const {
  welcomeEmail,
  passwordResetEmail,
  meetingReminderEmail,
  newLeadEmail,
  notificationEmail,
  buildEmail,
} = require('./emailTemplate');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const previews = [
  {
    name: '01-welcome',
    template: welcomeEmail({
      name:        'Rahul Sharma',
      email:       'rahul@nexus.com',
      tempPassword: 'Xk9#mP2!qW',
      loginUrl:    `${FRONTEND_URL}/login`,
    }),
  },
  {
    name: '02-password-reset',
    template: passwordResetEmail({
      name:        'Priya Verma',
      email:       'priya@nexus.com',
      tempPassword: 'Lp7@nQ3#vR',
      loginUrl:    `${FRONTEND_URL}/login`,
    }),
  },
  {
    name: '03-meeting-reminder',
    template: meetingReminderEmail({
      name:        'Alex Chen',
      title:       'Product Demo — Acme Corp',
      date:        'Monday, 7 April 2026',
      time:        '10:00 AM IST',
      location:    'Microsoft Teams',
      description: 'Quarterly product walkthrough for the Acme Corp procurement team. Please prepare the updated deck.',
      joinUrl:     'https://teams.microsoft.com/l/meetup-join/example',
    }),
  },
  {
    name: '04-new-lead',
    template: newLeadEmail({
      name:       'Rahul Sharma',
      storyTitle: 'Cloud Migration Proposal',
      company:    'TechCorp India Pvt. Ltd.',
      source:     'WhatsApp',
      assignedTo: 'Priya Verma',
      dashboardUrl: `${FRONTEND_URL}/kanban`,
    }),
  },
  {
    name: '05-notification',
    template: notificationEmail({
      name:    'Admin',
      subject: 'Your monthly pipeline report is ready',
      message: 'Your Nexus Pre pipeline summary for March 2026 is now available. Log in to view detailed analytics.',
      cta:     { label: 'View Report', url: `${FRONTEND_URL}/dashboard` },
    }),
  },
  {
    name: '06-custom-example',
    template: buildEmail({
      subject:    'Action Required: Story Moved to Proposal Stage',
      preheader:  'A story you own has been moved and requires your review.',
      heading:    'Story Stage Updated',
      subheading: 'ERP Implementation — Zeta Industries',
      body: [
        'Hi <strong>Rahul</strong>, a user story assigned to you has been moved to a new stage by your manager.',
        'Please review the story details and update the proposal document at your earliest convenience.',
      ],
      details: [
        { label: 'Story',       value: 'ERP Implementation — Zeta Industries' },
        { label: 'Previous Stage', value: 'Discovery' },
        { label: 'New Stage',   value: 'Proposal' },
        { label: 'Moved By',    value: 'Priya Verma (Manager)' },
        { label: 'Due Date',    value: '10 April 2026' },
      ],
      alert: { type: 'info', text: 'Stories in the Proposal stage must have an attached document within 48 hours.' },
      cta: {
        label: 'Open Story',
        url:   `${FRONTEND_URL}/kanban`,
        secondary: { label: 'View All My Stories', url: `${FRONTEND_URL}/kanban` },
      },
    }),
  },
];

const outDir = path.join(__dirname, '../../../email-previews');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

previews.forEach(({ name, template }) => {
  const file = path.join(outDir, `${name}.html`);
  fs.writeFileSync(file, template.html, 'utf8');
  console.log(`Wrote: ${file}`);
});

console.log(`\nAll ${previews.length} previews generated in: ${outDir}`);
console.log('Open the HTML files in your browser to review.\n');
