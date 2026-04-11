import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon, MessageSquare, Monitor,
  Plus, Trash2, Save, X, Edit2, Check, Copy, Info, Globe, Server, Layers
} from 'lucide-react';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './Settings.css';

const TABS = [
  { id: 'integrations', label: 'Integrations', icon: MessageSquare },
  { id: 'app', label: 'App Settings', icon: Monitor },
  { id: 'deployment', label: 'Deployment', icon: Info },
];

export default function Settings() {
  const { isSystemAdmin, isManager } = useAuth();
  const [activeTab, setActiveTab] = useState('integrations');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const setRes = await api.get('/settings');
      setSettings(setRes.data.settings || {});
    } catch { toast.error('Failed to load settings'); }
    finally { setLoading(false); }
  };

  const saveSettings = async (updates) => {
    setSaving(true);
    try {
      await api.put('/settings', { settings: updates });
      toast.success('Settings saved');
      loadData();
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="page-loading"><div className="page-spinner" /></div>;

  return (
    <>
      <Header title="Settings" subtitle="Configure application and integrations" />
      <div className="page-content">
        <div className="settings-layout">
          <div className="settings-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="settings-content">
            {activeTab === 'integrations' && (
              <IntegrationsSettings settings={settings} onSave={saveSettings} saving={saving} isAdmin={isSystemAdmin()} />
            )}
            {activeTab === 'app' && (
              <AppSettings settings={settings} onSave={saveSettings} saving={saving} isAdmin={isSystemAdmin()} />
            )}
            {activeTab === 'deployment' && (
              <DeploymentInfo />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function KanbanSettings({ columns, onRefresh, isManager }) {
  const [editingCol, setEditingCol] = useState(null);
  const [newSubStage, setNewSubStage] = useState({});
  const [adding, setAdding] = useState(false);
  const [editingSubStage, setEditingSubStage] = useState(null);
  const [editSubStageName, setEditSubStageName] = useState('');

  const addSubStage = async (colId) => {
    const name = newSubStage[colId];
    if (!name?.trim()) return;
    try {
      await api.post('/kanban/sub-stages', { column_id: colId, name });
      setNewSubStage(prev => ({ ...prev, [colId]: '' }));
      onRefresh();
      toast.success('Sub-stage added');
    } catch { toast.error('Failed to add sub-stage'); }
  };

  const deleteSubStage = async (id) => {
    if (!window.confirm('Delete this sub-stage? Stories using it will be unassigned.')) return;
    try {
      await api.delete(`/kanban/sub-stages/${id}`);
      onRefresh();
      toast.success('Sub-stage deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const updateSubStage = async (id) => {
    if (!editSubStageName.trim()) return;
    try {
      await api.put(`/kanban/sub-stages/${id}`, { name: editSubStageName });
      setEditingSubStage(null);
      onRefresh();
      toast.success('Updated');
    } catch { toast.error('Failed to update'); }
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Kanban Stage Configuration</h2>
        <p>Configure sub-stages for each pipeline column. Managers can add, rename, or remove sub-stages.</p>
      </div>

      <div className="kanban-config-list">
        {columns.map(col => (
          <div key={col.id} className="kanban-config-col">
            <div className="kcc-header" style={{ borderLeftColor: col.color }}>
              <div className="kcc-title-row">
                <div className="kcc-dot" style={{ background: col.color }} />
                <h3 className="kcc-name">{col.name}</h3>
                <span className="kcc-count">{col.story_count || 0} stories</span>
              </div>
            </div>

            <div className="kcc-substages">
              {(col.sub_stages || []).map(ss => (
                <div key={ss.id} className="kcc-substage-item">
                  {editingSubStage === ss.id ? (
                    <div className="substage-edit-row">
                      <input
                        className="form-control"
                        style={{ fontSize: 12, padding: '4px 8px' }}
                        value={editSubStageName}
                        onChange={e => setEditSubStageName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && updateSubStage(ss.id)}
                        autoFocus
                      />
                      <button className="btn btn-primary btn-icon btn-sm" onClick={() => updateSubStage(ss.id)}>
                        <Check size={13} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditingSubStage(null)}>
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="substage-name">{ss.name}</span>
                      {isManager && (
                        <div className="substage-actions">
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            onClick={() => { setEditingSubStage(ss.id); setEditSubStageName(ss.name); }}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm danger-hover"
                            onClick={() => deleteSubStage(ss.id)}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}

              {isManager && (
                <div className="kcc-add-substage">
                  <input
                    className="form-control"
                    style={{ fontSize: 12, padding: '5px 8px' }}
                    placeholder="Add sub-stage..."
                    value={newSubStage[col.id] || ''}
                    onChange={e => setNewSubStage(prev => ({ ...prev, [col.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addSubStage(col.id)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => addSubStage(col.id)}
                    disabled={!newSubStage[col.id]?.trim()}
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              )}

              {(!col.sub_stages || col.sub_stages.length === 0) && !isManager && (
                <p className="kcc-empty">No sub-stages configured</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button className="copy-btn" onClick={copy} title="Copy">
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function CodeLine({ value }) {
  return (
    <div className="code-line">
      <code>{value}</code>
      <CopyButton text={value} />
    </div>
  );
}

function IntegrationsSettings({ settings, onSave, saving, isAdmin }) {
  const [msEnabled, setMsEnabled] = useState(settings.ms_sync_enabled?.value === 'true');
  const [waEnabled, setWaEnabled] = useState(settings.whatsapp_enabled?.value === 'true');
  const [waGroups, setWaGroups] = useState(settings.whatsapp_group_ids?.value || '');

  const apiBase = window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : 'https://api.nexuspre.com';
  const webhookUrl = `${apiBase}/api/webhooks/whatsapp`;
  const msRedirectUri = `${apiBase}/api/auth/microsoft/callback`;

  const save = () => {
    onSave({
      ms_sync_enabled: msEnabled.toString(),
      whatsapp_enabled: waEnabled.toString(),
      whatsapp_group_ids: waGroups,
    });
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Integrations</h2>
        <p>Connect Nexus Pre with external services to automate your pre-sales workflow.</p>
      </div>

      {/* Microsoft 365 / Teams */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon ms-icon">
            <svg viewBox="0 0 23 23" width="26" height="26">
              <path fill="#f25022" d="M1 1h10v10H1z"/>
              <path fill="#7fba00" d="M12 1h10v10H12z"/>
              <path fill="#00a4ef" d="M1 12h10v10H1z"/>
              <path fill="#ffb900" d="M12 12h10v10H12z"/>
            </svg>
          </div>
          <div className="integration-info">
            <h3>Microsoft 365 — Teams Meeting Sync</h3>
            <p>Automatically sync Microsoft Teams meetings into the Nexus Pre calendar. Meetings scheduled via Teams will appear in the Calendar module for all linked users.</p>
          </div>
          <button
            className={`toggle-switch ${msEnabled ? 'on' : 'off'}`}
            onClick={() => isAdmin && setMsEnabled(v => !v)}
            disabled={!isAdmin}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="integration-config">
          <div className={`integration-status ${msEnabled ? 'status-active' : 'status-inactive'}`}>
            <span className="status-dot-sm" />
            {msEnabled ? 'Enabled — Teams meetings will sync to calendar' : 'Disabled — enable to start syncing'}
          </div>

          <div className="setup-guide">
            <h4><Info size={14} /> Setup Guide — Azure App Registration</h4>
            <div className="setup-steps">
              <div className="setup-step">
                <span className="step-num">1</span>
                <div>
                  <strong>Register an Azure AD App</strong>
                  <p>Go to <strong>Azure Portal → Azure Active Directory → App Registrations → New Registration</strong>. Name it "Nexus Pre" and set the account type to your organisation.</p>
                </div>
              </div>
              <div className="setup-step">
                <span className="step-num">2</span>
                <div>
                  <strong>Set the Redirect URI</strong>
                  <p>Under <strong>Authentication → Add a platform → Web</strong>, add this redirect URI:</p>
                  <CodeLine value={msRedirectUri} />
                </div>
              </div>
              <div className="setup-step">
                <span className="step-num">3</span>
                <div>
                  <strong>Grant API Permissions</strong>
                  <p>Under <strong>API Permissions → Add a permission → Microsoft Graph</strong>, add these <strong>Delegated</strong> permissions:</p>
                  <div className="permission-list">
                    {['Calendars.ReadWrite', 'OnlineMeetings.ReadWrite', 'User.Read', 'Mail.Read', 'offline_access'].map(p => (
                      <span key={p} className="permission-badge">{p}</span>
                    ))}
                  </div>
                  <p style={{ marginTop: 8 }}>Then click <strong>Grant admin consent</strong> for your organisation.</p>
                </div>
              </div>
              <div className="setup-step">
                <span className="step-num">4</span>
                <div>
                  <strong>Copy credentials to your .env file</strong>
                  <p>Under <strong>Overview</strong> copy the Application ID and Tenant ID. Under <strong>Certificates & secrets → New client secret</strong> create a secret and copy the value.</p>
                  <div className="env-block">
                    <CodeLine value="MS_CLIENT_ID=your-application-id" />
                    <CodeLine value="MS_CLIENT_SECRET=your-client-secret-value" />
                    <CodeLine value="MS_TENANT_ID=your-tenant-id" />
                    <CodeLine value={`MS_REDIRECT_URI=${msRedirectUri}`} />
                  </div>
                </div>
              </div>
              <div className="setup-step">
                <span className="step-num">5</span>
                <div>
                  <strong>Restart the backend</strong>
                  <p>After saving the <code>.env</code> file, restart the backend server. Each user will then be prompted to connect their Microsoft account on first login.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp */}
      <div className="integration-card">
        <div className="integration-header">
          <div className="integration-icon wa-icon">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          </div>
          <div className="integration-info">
            <h3>WhatsApp Business — Lead Auto-Creation</h3>
            <p>Automatically create leads in Nexus Pre when your pre-sales team is tagged in monitored WhatsApp Business groups.</p>
          </div>
          <button
            className={`toggle-switch ${waEnabled ? 'on' : 'off'}`}
            onClick={() => isAdmin && setWaEnabled(v => !v)}
            disabled={!isAdmin}
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        <div className="integration-config">
          <div className={`integration-status ${waEnabled ? 'status-active' : 'status-inactive'}`}>
            <span className="status-dot-sm" />
            {waEnabled ? 'Enabled — group mentions will create leads' : 'Disabled — enable to start monitoring groups'}
          </div>

          <div className="setup-guide">
            <h4><Info size={14} /> Setup Guide — Meta Business WhatsApp API</h4>
            <div className="setup-steps">
              <div className="setup-step">
                <span className="step-num">1</span>
                <div>
                  <strong>Create a Meta Business App</strong>
                  <p>Go to <strong>Meta for Developers → My Apps → Create App</strong>. Select <strong>Business</strong> type, add the <strong>WhatsApp</strong> product.</p>
                </div>
              </div>
              <div className="setup-step">
                <span className="step-num">2</span>
                <div>
                  <strong>Configure the Webhook</strong>
                  <p>Under <strong>WhatsApp → Configuration → Webhooks</strong>, set:</p>
                  <div className="env-block">
                    <div style={{ marginBottom: 6 }}>
                      <span className="env-label">Callback URL:</span>
                      <CodeLine value={webhookUrl} />
                    </div>
                    <div>
                      <span className="env-label">Verify Token:</span>
                      <CodeLine value="WHATSAPP_VERIFY_TOKEN (set this in .env)" />
                    </div>
                  </div>
                  <p style={{ marginTop: 8 }}>Subscribe to the <strong>messages</strong> webhook field.</p>
                </div>
              </div>
              <div className="setup-step">
                <span className="step-num">3</span>
                <div>
                  <strong>Add credentials to .env</strong>
                  <div className="env-block">
                    <CodeLine value="WHATSAPP_VERIFY_TOKEN=your-custom-verify-token" />
                    <CodeLine value="WHATSAPP_ACCESS_TOKEN=your-permanent-access-token" />
                    <CodeLine value="WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id" />
                  </div>
                  <p style={{ marginTop: 8 }}>The <strong>Access Token</strong> and <strong>Phone Number ID</strong> are found under <strong>WhatsApp → API Setup</strong>.</p>
                </div>
              </div>
              <div className="setup-step">
                <span className="step-num">4</span>
                <div>
                  <strong>Enter monitored group IDs below</strong>
                  <p>Add the WhatsApp group phone number IDs to monitor. When the pre-sales manager is tagged in these groups, a new lead is automatically created.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Monitored WhatsApp Group IDs</label>
            <textarea
              className="form-control"
              rows={3}
              value={waGroups}
              onChange={e => setWaGroups(e.target.value)}
              placeholder='["120363012345678901@g.us", "120363098765432109@g.us"]'
              disabled={!isAdmin}
            />
            <p className="form-hint">Paste the group IDs as a JSON array. Each group ID ends in <code>@g.us</code>. You can find the group ID from the webhook message payload once the webhook is live.</p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <span className="btn-spinner" /> : <Save size={15} />}
          Save Integration Settings
        </button>
      )}
    </div>
  );
}

function DeploymentInfo() {
  const isProduction = window.location.hostname !== 'localhost';
  const env = isProduction ? 'Production' : 'Development';

  const rows = [
    {
      icon: <Globe size={16} />,
      label: 'Frontend URL',
      value: isProduction ? 'https://nexuspre.com' : 'http://localhost:3000',
      note: isProduction ? 'Hosted on Netlify' : 'Local CRA dev server',
    },
    {
      icon: <Server size={16} />,
      label: 'API Base URL',
      value: isProduction ? 'https://api.nexuspre.com' : 'http://localhost:4000',
      note: isProduction ? 'Hosted on Render' : 'Local Express server',
    },
    {
      icon: <Layers size={16} />,
      label: 'WhatsApp Webhook',
      value: isProduction
        ? 'https://api.nexuspre.com/api/webhooks/whatsapp'
        : 'http://localhost:4000/api/webhooks/whatsapp',
      note: 'Paste this into Meta Business → WhatsApp → Configuration',
    },
    {
      icon: <Layers size={16} />,
      label: 'Microsoft Redirect URI',
      value: isProduction
        ? 'https://api.nexuspre.com/api/auth/microsoft/callback'
        : 'http://localhost:4000/api/auth/microsoft/callback',
      note: 'Add this to Azure App Registration → Authentication',
    },
  ];

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Deployment Information</h2>
        <p>URLs and endpoints for the current environment. Use these when configuring external services.</p>
      </div>

      <div className="deployment-env-badge" data-env={isProduction ? 'production' : 'development'}>
        <span className="status-dot-sm" />
        {env} environment
      </div>

      <div className="deployment-rows">
        {rows.map(row => (
          <div className="deployment-row" key={row.label}>
            <div className="deployment-row-label">
              {row.icon}
              <span>{row.label}</span>
            </div>
            <div className="deployment-row-value">
              <CodeLine value={row.value} />
              <p className="form-hint" style={{ marginTop: 4 }}>{row.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="setup-guide" style={{ marginTop: 24 }}>
        <h4><Info size={14} /> DNS Configuration</h4>
        <div className="setup-steps">
          <div className="setup-step">
            <span className="step-num">1</span>
            <div>
              <strong>nexuspre.com → Netlify</strong>
              <p>In GoDaddy DNS, add an <strong>A record</strong>: <code>@</code> → <code>75.2.60.5</code> and a <strong>CNAME</strong>: <code>www</code> → <code>unique-duckanoo-fe44b4.netlify.app</code></p>
            </div>
          </div>
          <div className="setup-step">
            <span className="step-num">2</span>
            <div>
              <strong>api.nexuspre.com → Render</strong>
              <p>In GoDaddy DNS, add a <strong>CNAME</strong>: <code>api</code> → your Render service hostname (e.g. <code>nexus-pre-api.onrender.com</code>)</p>
            </div>
          </div>
          <div className="setup-step">
            <span className="step-num">3</span>
            <div>
              <strong>Netlify — set environment variable</strong>
              <p>In Netlify → Site configuration → Environment variables, add: <code>REACT_APP_API_URL</code> = <code>https://api.nexuspre.com</code></p>
            </div>
          </div>
          <div className="setup-step">
            <span className="step-num">4</span>
            <div>
              <strong>Render — set environment variable</strong>
              <p>In Render → your backend service → Environment, set: <code>FRONTEND_URL</code> = <code>https://nexuspre.com</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppSettings({ settings, onSave, saving, isAdmin }) {
  const [appName, setAppName] = useState(settings.app_name?.value || 'Nexus Pre');
  const [currency, setCurrency] = useState(settings.default_currency?.value || 'USD');

  const save = () => {
    onSave({ app_name: appName, default_currency: currency });
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Application Settings</h2>
        <p>General application configuration.</p>
      </div>

      <div className="settings-form">
        <div className="form-group">
          <label className="form-label">Application Name</label>
          <input
            className="form-control"
            style={{ maxWidth: 300 }}
            value={appName}
            onChange={e => setAppName(e.target.value)}
            disabled={!isAdmin}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Default Currency</label>
          <select
            className="form-control"
            style={{ maxWidth: 200 }}
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            disabled={!isAdmin}
          >
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="INR">INR — Indian Rupee</option>
            <option value="AUD">AUD — Australian Dollar</option>
            <option value="CAD">CAD — Canadian Dollar</option>
            <option value="SGD">SGD — Singapore Dollar</option>
            <option value="JPY">JPY — Japanese Yen</option>
          </select>
        </div>

        {isAdmin && (
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <span className="btn-spinner" /> : <Save size={15} />}
            Save Settings
          </button>
        )}
      </div>
    </div>
  );
}
