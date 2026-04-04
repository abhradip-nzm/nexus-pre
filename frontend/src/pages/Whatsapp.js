import React, { useState, useEffect } from 'react';
import { MessageSquare, ExternalLink } from 'lucide-react';
import Header from '../components/layout/Header';
import { formatDateTime } from '../utils/helpers';
import api from '../utils/api';
import './Whatsapp.css';

export default function WhatsApp() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  // This page shows WhatsApp activity (webhook data)
  // In a real implementation, you would query whatsapp_messages table

  return (
    <>
      <Header title="WhatsApp" subtitle="WhatsApp group activity and lead tracking" />
      <div className="page-content">
        <div className="wa-info-banner">
          <div className="wa-banner-icon">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3>WhatsApp Lead Automation</h3>
            <p>
              When a pre-sales manager is tagged in a monitored WhatsApp group, Nexus Pre
              automatically creates a user story in the Kanban board. Configure group IDs
              and webhook settings in{' '}
              <a href="/settings?tab=integrations">Settings → Integrations</a>.
            </p>
          </div>
        </div>

        <div className="wa-setup-steps card">
          <div className="card-header">
            <h3 className="card-title">Setup Guide</h3>
          </div>
          <div className="card-body">
            <div className="setup-steps">
              <div className="setup-step">
                <div className="step-num">1</div>
                <div className="step-content">
                  <h4>Create Meta Business Account</h4>
                  <p>Go to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer">developers.facebook.com</a> and create a WhatsApp Business app.</p>
                </div>
              </div>
              <div className="setup-step">
                <div className="step-num">2</div>
                <div className="step-content">
                  <h4>Configure Webhook</h4>
                  <p>Set the webhook URL to your backend endpoint:</p>
                  <code className="code-block">{window.location.origin.replace('3000', '5000')}/api/webhooks/whatsapp</code>
                </div>
              </div>
              <div className="setup-step">
                <div className="step-num">3</div>
                <div className="step-content">
                  <h4>Set Environment Variables</h4>
                  <p>Add these to your backend <code>.env</code> file:</p>
                  <div className="env-block">
                    <code>WHATSAPP_VERIFY_TOKEN=your-verify-token</code>
                    <code>WHATSAPP_ACCESS_TOKEN=your-access-token</code>
                    <code>WHATSAPP_PHONE_NUMBER_ID=your-phone-id</code>
                  </div>
                </div>
              </div>
              <div className="setup-step">
                <div className="step-num">4</div>
                <div className="step-content">
                  <h4>Add Group IDs</h4>
                  <p>In Settings → Integrations, add the WhatsApp group phone number IDs to monitor. When someone tags a pre-sales manager in these groups, a lead is automatically created.</p>
                </div>
              </div>
              <div className="setup-step">
                <div className="step-num">5</div>
                <div className="step-content">
                  <h4>Add WhatsApp Numbers for Team</h4>
                  <p>Make sure each pre-sales manager's WhatsApp number is saved in their user profile (Team Management) so they can be matched when tagged.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="wa-flow card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3 className="card-title">How it works</h3>
          </div>
          <div className="card-body">
            <div className="wa-flow-steps">
              <div className="flow-step">
                <div className="flow-icon">💬</div>
                <div className="flow-text">
                  <strong>Someone tags @manager</strong>
                  <p>In a monitored WhatsApp group, a prospect or team member tags the pre-sales manager</p>
                </div>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <div className="flow-icon">🤖</div>
                <div className="flow-text">
                  <strong>Webhook fires</strong>
                  <p>Meta sends the message to Nexus Pre's webhook endpoint</p>
                </div>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <div className="flow-icon">📋</div>
                <div className="flow-text">
                  <strong>Story created</strong>
                  <p>A user story is auto-created in L1 Stage and assigned to the tagged manager</p>
                </div>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-step">
                <div className="flow-icon">🔔</div>
                <div className="flow-text">
                  <strong>Notification sent</strong>
                  <p>The manager receives a notification in Nexus Pre to review the new lead</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
