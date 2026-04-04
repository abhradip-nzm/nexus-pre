import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

/* ─── Tiny scroll hook ─── */
function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [threshold]);
  return scrolled;
}

/* ─── Animated counter ─── */
function Counter({ target, suffix = '', duration = 1800 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return <>{count.toLocaleString()}{suffix}</>;
}

export default function Landing() {
  const navigate = useNavigate();
  const scrolled = useScrolled();

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="lp">

      {/* ═══════════════════════════════════════════
          NAVBAR
      ═══════════════════════════════════════════ */}
      <nav className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="lp-container">
          <div className="lp-nav-inner">
            {/* Logo */}
            <a className="lp-nav-logo" href="/">
              <div className="lp-nav-logo-icon">N</div>
              <div>
                <div className="lp-nav-logo-text">Nexus Pre</div>
                <div className="lp-nav-logo-sub">Pre-Sales Platform</div>
              </div>
            </a>

            {/* Links */}
            <div className="lp-nav-links">
              <button className="lp-nav-link" onClick={() => scrollTo('features')}>Features</button>
              <button className="lp-nav-link" onClick={() => scrollTo('how-it-works')}>How it Works</button>
              <button className="lp-nav-link" onClick={() => scrollTo('testimonials')}>Testimonials</button>
              <button className="lp-nav-link" onClick={() => scrollTo('integrations')}>Integrations</button>
            </div>

            {/* Actions */}
            <div className="lp-nav-actions">
              <button className="lp-btn-ghost" onClick={() => navigate('/login')}>Sign In</button>
              <button className="lp-btn-primary" onClick={() => navigate('/login')}>
                Get Started →
              </button>
            </div>
          </div>
        </div>
      </nav>


      {/* ═══════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════ */}
      <section className="lp-hero">
        <div className="lp-hero-bg" />
        <div className="lp-hero-grid" />
        <div className="lp-hero-orb lp-hero-orb-1" />
        <div className="lp-hero-orb lp-hero-orb-2" />
        <div className="lp-hero-orb lp-hero-orb-3" />

        <div className="lp-container">
          <div className="lp-hero-inner">

            {/* Content */}
            <div className="lp-hero-content">
              <div className="lp-hero-badge">
                <span className="lp-badge">
                  <span className="lp-badge-dot" />
                  Enterprise Pre-Sales Platform
                </span>
              </div>

              <h1 className="lp-hero-title">
                Close More Deals.{' '}
                <span className="lp-gradient-text">Faster.</span>
              </h1>

              <p className="lp-hero-desc">
                Nexus Pre gives your pre-sales team a unified command center — Kanban pipelines,
                real-time analytics, meeting management, and team collaboration, all in one
                beautifully designed platform.
              </p>

              <div className="lp-hero-cta">
                <button className="lp-btn-primary lp-btn-large" onClick={() => navigate('/login')}>
                  Start Free Trial →
                </button>
                <button className="lp-btn-outline" onClick={() => scrollTo('features')}>
                  ▶ See Features
                </button>
              </div>

              <div className="lp-hero-trust">
                <div className="lp-hero-avatars">
                  <div className="av av-a">RK</div>
                  <div className="av av-b">SM</div>
                  <div className="av av-c">AL</div>
                  <div className="av av-d">PR</div>
                </div>
                <div className="lp-hero-trust-text">
                  Trusted by <strong>500+ pre-sales teams</strong> worldwide
                </div>
              </div>
            </div>

            {/* Mockup Visual */}
            <div className="lp-hero-visual">
              {/* Floating metric card — top right */}
              <div className="lp-float-card lp-float-card-2">
                <div className="lp-fc-icon">📈</div>
                <div className="lp-fc-label">Win Rate</div>
                <div className="lp-fc-value">68%</div>
                <div className="lp-fc-sub">↑ 12% this month</div>
              </div>

              {/* Mini Kanban board */}
              <div className="lp-hero-mockup">
                <div className="lp-mockup-bar">
                  <div className="lp-mockup-dot dot-red" />
                  <div className="lp-mockup-dot dot-amber" />
                  <div className="lp-mockup-dot dot-green" />
                  <div className="lp-mockup-url">nexuspre.app/kanban</div>
                </div>
                <div className="lp-mockup-body">
                  {/* L1 Stage */}
                  <div className="lp-mkb-col">
                    <div className="lp-mkb-col-head">
                      L1 Stage <span className="lp-mkb-count">4</span>
                    </div>
                    <div className="lp-mkb-card">
                      <div className="lp-mkb-card-title">Acme Corp — ERP</div>
                      <div className="lp-mkb-card-meta">
                        <span className="lp-mkb-tag tag-blue">High</span>
                        <span className="lp-mkb-tag tag-green">Inbound</span>
                      </div>
                      <div className="lp-mkb-progress"><div className="lp-mkb-progress-fill" style={{ width: '40%' }} /></div>
                    </div>
                    <div className="lp-mkb-card">
                      <div className="lp-mkb-card-title">TechVision — CRM</div>
                      <div className="lp-mkb-card-meta">
                        <span className="lp-mkb-tag tag-amber">Med</span>
                      </div>
                      <div className="lp-mkb-progress"><div className="lp-mkb-progress-fill" style={{ width: '20%' }} /></div>
                    </div>
                  </div>

                  {/* Commercial */}
                  <div className="lp-mkb-col">
                    <div className="lp-mkb-col-head">
                      Commercial <span className="lp-mkb-count">2</span>
                    </div>
                    <div className="lp-mkb-card">
                      <div className="lp-mkb-card-title">GlobalNet — Security</div>
                      <div className="lp-mkb-card-meta">
                        <span className="lp-mkb-tag tag-purple">Critical</span>
                      </div>
                      <div className="lp-mkb-progress"><div className="lp-mkb-progress-fill" style={{ width: '75%' }} /></div>
                    </div>
                  </div>

                  {/* Onboarded */}
                  <div className="lp-mkb-col">
                    <div className="lp-mkb-col-head">
                      Onboarded <span className="lp-mkb-count">6</span>
                    </div>
                    <div className="lp-mkb-card">
                      <div className="lp-mkb-card-title">NovaTech — Cloud</div>
                      <div className="lp-mkb-card-meta">
                        <span className="lp-mkb-tag tag-green">Won</span>
                      </div>
                      <div className="lp-mkb-progress"><div className="lp-mkb-progress-fill" style={{ width: '100%' }} /></div>
                    </div>
                    <div className="lp-mkb-card">
                      <div className="lp-mkb-card-title">Solaris — Analytics</div>
                      <div className="lp-mkb-card-meta">
                        <span className="lp-mkb-tag tag-green">Won</span>
                      </div>
                      <div className="lp-mkb-progress"><div className="lp-mkb-progress-fill" style={{ width: '100%' }} /></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating metric card — bottom left */}
              <div className="lp-float-card lp-float-card-1">
                <div className="lp-fc-icon">💰</div>
                <div className="lp-fc-label">Pipeline Value</div>
                <div className="lp-fc-value">$4.2M</div>
                <div className="lp-fc-sub">↑ 23% vs last quarter</div>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════
          SOCIAL PROOF LOGOS
      ═══════════════════════════════════════════ */}
      <div className="lp-logos">
        <div className="lp-container">
          <div className="lp-logos-label">Trusted by leading enterprises across industries</div>
          <div className="lp-logos-row">
            {[
              { icon: '🏦', name: 'FinanceCore' },
              { icon: '🏥', name: 'MediSystems' },
              { icon: '🏗️', name: 'BuildTech' },
              { icon: '🛒', name: 'RetailMax' },
              { icon: '✈️', name: 'AeroLogic' },
              { icon: '🔬', name: 'DataVault' },
            ].map(co => (
              <div key={co.name} className="lp-logo-item">
                <span className="lp-logo-icon">{co.icon}</span>
                {co.name}
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ═══════════════════════════════════════════
          STATS
      ═══════════════════════════════════════════ */}
      <section className="lp-stats">
        <div className="lp-container">
          <div className="lp-stats-grid">
            {[
              { icon: '🚀', num: 500,  suffix: '+',  label: 'Teams Onboarded' },
              { icon: '💼', num: 48000, suffix: '+', label: 'Deals Managed' },
              { icon: '📈', num: 68,   suffix: '%',  label: 'Avg Win Rate Lift' },
              { icon: '⚡', num: 3,    suffix: 'x',  label: 'Faster Deal Cycles' },
            ].map((s, i) => (
              <div className="lp-stat-card" key={i}>
                <span className="lp-stat-icon">{s.icon}</span>
                <div className="lp-stat-num">
                  <Counter target={s.num} suffix={s.suffix} />
                </div>
                <div className="lp-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════
          FEATURES
      ═══════════════════════════════════════════ */}
      <section className="lp-features" id="features">
        <div className="lp-container">
          <div className="lp-features-header">
            <div className="lp-section-label">Platform Features</div>
            <h2 className="lp-section-title">
              Everything your pre-sales<br />team needs to <span className="lp-gradient-text">win</span>
            </h2>
            <p className="lp-section-sub">
              From pipeline visibility to team collaboration, Nexus Pre is purpose-built for enterprise pre-sales workflows.
            </p>
          </div>

          <div className="lp-features-grid">

            {/* Featured — Kanban */}
            <div className="lp-feat-card featured">
              <div className="lp-feat-icon fi-blue">📋</div>
              <h3 className="lp-feat-title">Visual Kanban Pipeline</h3>
              <p className="lp-feat-desc">
                Manage your entire pre-sales pipeline with a powerful drag-and-drop Kanban board.
                Move deals across L1, L2, Commercial, Contract, and Onboarding stages in real-time.
                Customise sub-stages, assign owners, set priorities, and track deal values — all from a single view.
              </p>
              <div className="lp-feat-tags">
                <span className="lp-feat-tag tag-blue">7 Default Stages</span>
                <span className="lp-feat-tag tag-green">Drag & Drop</span>
                <span className="lp-feat-tag tag-purple">Sub-Stages</span>
                <span className="lp-feat-tag tag-amber">Deal Scoring</span>
              </div>
            </div>

            {/* Dashboard */}
            <div className="lp-feat-card">
              <div className="lp-feat-icon fi-teal">📊</div>
              <h3 className="lp-feat-title">Executive Dashboard</h3>
              <p className="lp-feat-desc">
                Real-time KPIs, pipeline analytics, win-rate trends, and team leaderboards —
                beautifully visualised so leadership always has the full picture.
              </p>
            </div>

            {/* Calendar */}
            <div className="lp-feat-card">
              <div className="lp-feat-icon fi-purple">📅</div>
              <h3 className="lp-feat-title">Meeting Calendar</h3>
              <p className="lp-feat-desc">
                Schedule and track all pre-sales meetings in one place. Native Microsoft Teams
                integration auto-generates join links and syncs with Outlook.
              </p>
            </div>

            {/* Team */}
            <div className="lp-feat-card">
              <div className="lp-feat-icon fi-green">👥</div>
              <h3 className="lp-feat-title">Team Management</h3>
              <p className="lp-feat-desc">
                Role-based access for System Admins, Managers, and Executives.
                Granular module permissions, performance tracking, and activity logs keep everyone accountable.
              </p>
            </div>

            {/* WhatsApp */}
            <div className="lp-feat-card">
              <div className="lp-feat-icon fi-amber">💬</div>
              <h3 className="lp-feat-title">WhatsApp Integration</h3>
              <p className="lp-feat-desc">
                Capture leads directly from WhatsApp Business. Tagged messages automatically
                create pipeline stories so no opportunity slips through the cracks.
              </p>
            </div>

            {/* Audit */}
            <div className="lp-feat-card">
              <div className="lp-feat-icon fi-red">🔒</div>
              <h3 className="lp-feat-title">Full Audit Trail</h3>
              <p className="lp-feat-desc">
                Complete change logs on every story, comment, and stage transition.
                Know who did what and when — compliance-ready out of the box.
              </p>
            </div>

          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════
          HOW IT WORKS
      ═══════════════════════════════════════════ */}
      <section className="lp-hiw" id="how-it-works">
        <div className="lp-container">
          <div className="lp-hiw-header lp-center">
            <div className="lp-section-label">How It Works</div>
            <h2 className="lp-section-title">Up and running in minutes</h2>
            <p className="lp-section-sub">
              No complex setup. No lengthy onboarding. Your team can start closing deals the same day.
            </p>
          </div>

          <div className="lp-hiw-steps">
            {[
              {
                n: '1',
                title: 'Set Up Your Pipeline',
                desc: 'Configure your Kanban stages, sub-stages, and team roles to match your exact pre-sales process. Takes less than 10 minutes.',
              },
              {
                n: '2',
                title: 'Invite Your Team',
                desc: 'Add pre-sales executives and managers with granular role-based permissions. Connect Microsoft 365 and WhatsApp in one click.',
              },
              {
                n: '3',
                title: 'Start Winning Deals',
                desc: 'Track every opportunity through your pipeline, measure performance on the dashboard, and close deals faster than ever.',
              },
            ].map((step) => (
              <div className="lp-step" key={step.n}>
                <div className="lp-step-num">{step.n}</div>
                <h3 className="lp-step-title">{step.title}</h3>
                <p className="lp-step-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════
          TESTIMONIALS
      ═══════════════════════════════════════════ */}
      <section className="lp-testimonials" id="testimonials">
        <div className="lp-container">
          <div className="lp-testimonials-header lp-center">
            <div className="lp-section-label">Customer Stories</div>
            <h2 className="lp-section-title">Loved by pre-sales teams</h2>
          </div>

          <div className="lp-testi-grid">
            {[
              {
                quote: "Nexus Pre completely transformed how our team manages the sales funnel. We went from spreadsheets and scattered notes to a single, clean pipeline view. Our win rate jumped 22% in the first quarter.",
                name: 'Rajiv Kumar',
                role: 'Head of Pre-Sales, FinanceCore',
                initials: 'RK',
                color: 'linear-gradient(135deg, #3e72ae, #06b6d4)',
              },
              {
                quote: "The WhatsApp integration alone saves us 2 hours a day. Leads from our business groups automatically appear in the pipeline — no manual entry, no missed opportunities. It's brilliant.",
                name: 'Samantha Lee',
                role: 'Pre-Sales Manager, MediSystems',
                initials: 'SL',
                color: 'linear-gradient(135deg, #8b5cf6, #e8734a)',
              },
              {
                quote: "Executive dashboards give our CRO real-time visibility without chasing down reports. The drag-and-drop Kanban is intuitive — our team adopted it with zero training.",
                name: 'Arjun Mehta',
                role: 'VP Sales, BuildTech Industries',
                initials: 'AM',
                color: 'linear-gradient(135deg, #22c55e, #3e72ae)',
              },
            ].map((t, i) => (
              <div className="lp-testi-card" key={i}>
                <div className="lp-testi-stars">
                  {[...Array(5)].map((_, s) => <span key={s} className="lp-star">★</span>)}
                </div>
                <p className="lp-testi-quote">"{t.quote}"</p>
                <div className="lp-testi-author">
                  <div className="lp-testi-av" style={{ background: t.color }}>{t.initials}</div>
                  <div>
                    <div className="lp-testi-name">{t.name}</div>
                    <div className="lp-testi-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════
          INTEGRATIONS
      ═══════════════════════════════════════════ */}
      <section className="lp-integrations" id="integrations">
        <div className="lp-container">
          <div className="lp-integrations-header lp-center">
            <div className="lp-section-label">Integrations</div>
            <h2 className="lp-section-title">Works with the tools you already use</h2>
            <p className="lp-section-sub">
              Plug Nexus Pre into your existing stack. Native integrations keep your workflow connected.
            </p>
          </div>

          <div className="lp-int-grid">
            {[
              { icon: '🪟', name: 'Microsoft 365', desc: 'Calendar sync, Outlook integration & Teams meeting links', status: 'live' },
              { icon: '💬', name: 'WhatsApp Business', desc: 'Auto-capture leads from WhatsApp group messages', status: 'live' },
              { icon: '📧', name: 'Outlook Mail', desc: 'Email tracking and client correspondence logging', status: 'live' },
              { icon: '🔗', name: 'Slack', desc: 'Deal updates and notifications pushed to your channels', status: 'soon' },
              { icon: '📊', name: 'Power BI', desc: 'Export pipeline data for advanced reporting', status: 'soon' },
              { icon: '🗂️', name: 'SharePoint', desc: 'Link documents and proposals directly to deals', status: 'soon' },
              { icon: '📞', name: 'Twilio', desc: 'SMS and voice communication for deal follow-ups', status: 'soon' },
              { icon: '🔑', name: 'SSO / SAML', desc: 'Enterprise single sign-on with Azure AD support', status: 'live' },
            ].map((int, i) => (
              <div className="lp-int-card" key={i}>
                <span className="lp-int-icon">{int.icon}</span>
                <div className="lp-int-name">{int.name}</div>
                <div className="lp-int-desc">{int.desc}</div>
                <span className={`lp-int-status ${int.status === 'live' ? 'status-live' : 'status-soon'}`}>
                  {int.status === 'live' ? '✓ Live' : '⏳ Coming Soon'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════
          CTA
      ═══════════════════════════════════════════ */}
      <section className="lp-cta">
        <div className="lp-container">
          <div className="lp-cta-box">
            <div className="lp-section-label" style={{ justifyContent: 'center', display: 'flex' }}>Ready to get started?</div>
            <h2 className="lp-cta-title">
              Your pipeline. <span className="lp-gradient-text">Supercharged.</span>
            </h2>
            <p className="lp-cta-desc">
              Join hundreds of pre-sales teams who have eliminated spreadsheet chaos and started
              closing more deals with Nexus Pre.
            </p>
            <div className="lp-cta-actions">
              <button className="lp-btn-primary lp-btn-large" onClick={() => navigate('/login')}>
                Get Started Free →
              </button>
              <button className="lp-btn-outline" onClick={() => scrollTo('features')}>
                Explore Features
              </button>
            </div>
            <p className="lp-cta-note">No credit card required · Setup in under 10 minutes · Cancel anytime</p>
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-top">
            {/* Brand */}
            <div>
              <a className="lp-nav-logo" href="/" style={{ textDecoration: 'none' }}>
                <div className="lp-nav-logo-icon">N</div>
                <div>
                  <div className="lp-nav-logo-text">Nexus Pre</div>
                  <div className="lp-nav-logo-sub">Pre-Sales Platform</div>
                </div>
              </a>
              <p className="lp-footer-brand-desc">
                The enterprise pre-sales workflow platform built to help teams manage pipelines,
                collaborate smarter, and close more deals.
              </p>
              <div className="lp-footer-social">
                <a className="lp-social-btn" href="#" aria-label="LinkedIn">in</a>
                <a className="lp-social-btn" href="#" aria-label="Twitter">𝕏</a>
                <a className="lp-social-btn" href="#" aria-label="GitHub">⌥</a>
              </div>
            </div>

            {/* Product */}
            <div>
              <div className="lp-footer-col-title">Product</div>
              <div className="lp-footer-links">
                <button className="lp-footer-link" onClick={() => scrollTo('features')}>Features</button>
                <button className="lp-footer-link" onClick={() => scrollTo('integrations')}>Integrations</button>
                <button className="lp-footer-link" onClick={() => scrollTo('how-it-works')}>How It Works</button>
                <button className="lp-footer-link" onClick={() => navigate('/login')}>Login</button>
              </div>
            </div>

            {/* Platform */}
            <div>
              <div className="lp-footer-col-title">Platform</div>
              <div className="lp-footer-links">
                <span className="lp-footer-link">Kanban Board</span>
                <span className="lp-footer-link">Dashboard Analytics</span>
                <span className="lp-footer-link">Team Management</span>
                <span className="lp-footer-link">Meeting Calendar</span>
              </div>
            </div>

            {/* Company */}
            <div>
              <div className="lp-footer-col-title">Company</div>
              <div className="lp-footer-links">
                <span className="lp-footer-link">About</span>
                <span className="lp-footer-link">Blog</span>
                <span className="lp-footer-link">Careers</span>
                <span className="lp-footer-link">Contact</span>
              </div>
            </div>
          </div>

          <div className="lp-footer-bottom">
            <div className="lp-footer-copy">
              © {new Date().getFullYear()} Nexus Pre. All rights reserved.
            </div>
            <div className="lp-footer-legal">
              <a className="lp-footer-legal-link" href="#">Privacy Policy</a>
              <a className="lp-footer-legal-link" href="#">Terms of Service</a>
              <a className="lp-footer-legal-link" href="#">Security</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
