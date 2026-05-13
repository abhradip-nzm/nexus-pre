const { query } = require('../config/database');
const { sendCustomEmail } = require('../utils/emailService');

// Shared SELECT for leads on public pages (no created_by_name on updates)
const PUBLIC_LEAD_SELECT = `
  SELECT
    pl.id, pl.pipeline_id, pl.account_name, pl.client_name,
    pl.business_manager_id,
    bt.name  AS business_manager_name,
    pl.industry_id,
    ind.name AS industry_name,
    pl.country, pl.status,
    pl.created_at, pl.updated_at,
    COALESCE((
      SELECT json_agg(
        jsonb_build_object(
          'id',          plu.id,
          'update_text', plu.update_text,
          'update_date', plu.update_date
        ) ORDER BY plu.update_date DESC, plu.created_at DESC
      )
      FROM pipeline_lead_updates plu
      WHERE plu.lead_id = pl.id
    ), '[]'::json) AS updates
  FROM pipeline_leads pl
  LEFT JOIN business_team bt  ON bt.id  = pl.business_manager_id
  LEFT JOIN industries    ind ON ind.id = pl.industry_id
`;

// ── Validate share token (internal helper) ────────────────────────────────────
async function validateShare(token) {
  const result = await query(
    `SELECT id, is_active, expires_at, pipeline_id FROM pipeline_shares WHERE id = $1`,
    [token]
  );
  if (!result.rows[0]) return { error: 'Share link not found', status: 404 };
  const share = result.rows[0];
  if (!share.is_active) return { error: 'This share link has been deactivated', status: 403 };
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    return { error: 'This share link has expired', status: 403 };
  }
  return { share };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED  (system_admin only)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /pipelines/:id/shares
const createShare = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipients = [], note = '', expires_at } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }
    // Basic email validation
    for (const r of recipients) {
      if (!r.email || !r.email.includes('@')) {
        return res.status(400).json({ error: `Invalid email: ${r.email}` });
      }
    }

    // Verify pipeline exists
    const pipeRes = await query('SELECT id, name FROM pipelines WHERE id = $1', [id]);
    if (!pipeRes.rows[0]) return res.status(404).json({ error: 'Pipeline not found' });
    const pipeline = pipeRes.rows[0];

    // Create the share record
    const shareRes = await query(
      `INSERT INTO pipeline_shares (pipeline_id, note, expires_at, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, note.trim() || null, expires_at || null, req.user.id]
    );
    const share = shareRes.rows[0];

    // Insert recipients
    const insertedRecipients = [];
    for (const r of recipients) {
      const rRes = await query(
        `INSERT INTO pipeline_share_recipients (share_id, email, name) VALUES ($1, $2, $3) RETURNING *`,
        [share.id, r.email.trim().toLowerCase(), r.name?.trim() || null]
      );
      insertedRecipients.push(rRes.rows[0]);
    }

    // Send emails (non-fatal)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const shareUrl = `${frontendUrl}/share/pipeline/${share.id}`;

    for (const r of insertedRecipients) {
      try {
        await sendCustomEmail(r.email, {
          subject: `Pipeline Shared With You: ${pipeline.name}`,
          heading: 'Pipeline Lead List Shared',
          subheading: pipeline.name,
          body: [
            `Hi ${r.name || 'there'},`,
            `A pipeline lead list has been shared with you. You can view and update the leads using the button below.`,
            ...(note.trim() ? [`<em>Note: ${note.trim()}</em>`] : []),
          ],
          cta: { label: 'View Pipeline Leads', url: shareUrl },
          alert: { type: 'info', text: 'You can update lead statuses and add notes directly from the shared page.' },
          footer: { unsubscribe: false },
        });
      } catch (emailErr) {
        console.warn(`[share] Email failed for ${r.email}:`, emailErr.message);
      }
    }

    res.status(201).json({ share: { ...share, recipients: insertedRecipients } });
  } catch (err) {
    console.error('createShare error:', err);
    res.status(500).json({ error: 'Failed to create share link' });
  }
};

// GET /pipelines/:id/shares
const getShares = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT
         ps.*,
         u.first_name || ' ' || u.last_name AS created_by_name,
         COALESCE(
           (SELECT json_agg(json_build_object(
              'id', psr.id, 'email', psr.email, 'name', psr.name, 'sent_at', psr.sent_at
           )) FROM pipeline_share_recipients psr WHERE psr.share_id = ps.id),
           '[]'
         ) AS recipients
       FROM pipeline_shares ps
       LEFT JOIN users u ON u.id = ps.created_by
       WHERE ps.pipeline_id = $1
       ORDER BY ps.created_at DESC`,
      [id]
    );
    res.json({ shares: result.rows });
  } catch (err) {
    console.error('getShares error:', err);
    res.status(500).json({ error: 'Failed to fetch shares' });
  }
};

// DELETE /pipeline-shares/:shareId  (deactivate)
const deactivateShare = async (req, res) => {
  try {
    const { shareId } = req.params;
    const result = await query(
      `UPDATE pipeline_shares SET is_active = false WHERE id = $1 RETURNING id`,
      [shareId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Share not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deactivateShare error:', err);
    res.status(500).json({ error: 'Failed to deactivate share' });
  }
};

// GET /pipeline-leads/:leadId/audit  — per-lead audit
const getLeadAudit = async (req, res) => {
  try {
    const { leadId } = req.params;
    const result = await query(
      `SELECT pla.*
       FROM pipeline_lead_audit pla
       WHERE pla.lead_id = $1
       ORDER BY pla.changed_at DESC`,
      [leadId]
    );
    res.json({ audit: result.rows });
  } catch (err) {
    console.error('getLeadAudit error:', err);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
};

// GET /pipelines/:id/audit  — all audits for a pipeline
const getPipelineAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT pla.*, pl.account_name, pl.client_name
       FROM pipeline_lead_audit pla
       JOIN pipeline_leads pl ON pl.id = pla.lead_id
       WHERE pl.pipeline_id = $1
       ORDER BY pla.changed_at DESC
       LIMIT 500`,
      [id]
    );
    res.json({ audit: result.rows });
  } catch (err) {
    console.error('getPipelineAudit error:', err);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC  (no auth — token-based)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /public/pipeline-share/:token
const getSharedPipeline = async (req, res) => {
  try {
    const { token } = req.params;

    const shareRes = await query(
      `SELECT ps.*, p.name AS pipeline_name, p.start_date, p.end_date, p.status AS pipeline_status
       FROM pipeline_shares ps
       JOIN pipelines p ON p.id = ps.pipeline_id
       WHERE ps.id = $1`,
      [token]
    );

    if (!shareRes.rows[0]) return res.status(404).json({ error: 'Share link not found' });
    const share = shareRes.rows[0];
    if (!share.is_active) return res.status(403).json({ error: 'This share link has been deactivated' });
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(403).json({ error: 'This share link has expired' });
    }

    const leadsRes = await query(
      `${PUBLIC_LEAD_SELECT} WHERE pl.pipeline_id = $1 ORDER BY pl.created_at DESC`,
      [share.pipeline_id]
    );

    res.json({
      pipeline: {
        id: share.pipeline_id,
        name: share.pipeline_name,
        start_date: share.start_date,
        end_date: share.end_date,
        status: share.pipeline_status,
      },
      leads: leadsRes.rows,
      share: { id: share.id, note: share.note, created_at: share.created_at },
    });
  } catch (err) {
    console.error('getSharedPipeline error:', err);
    res.status(500).json({ error: 'Failed to load shared pipeline' });
  }
};

// PUT /public/pipeline-share/:token/leads/:leadId
const updateSharedLead = async (req, res) => {
  try {
    const { token, leadId } = req.params;
    const { viewer_name, viewer_email, status, country, account_name, client_name } = req.body;

    const { share, error, status: errStatus } = await validateShare(token);
    if (error) return res.status(errStatus).json({ error });

    // Get current lead to diff
    const currentRes = await query(
      `SELECT * FROM pipeline_leads WHERE id = $1 AND pipeline_id = $2`,
      [leadId, share.pipeline_id]
    );
    if (!currentRes.rows[0]) return res.status(404).json({ error: 'Lead not found in this pipeline' });
    const current = currentRes.rows[0];

    const sets = [];
    const vals = [];
    let idx = 1;
    const changes = {};

    const maybe = (col, val) => {
      if (val === undefined) return;
      const newVal = val === '' ? null : (typeof val === 'string' ? val.trim() : val);
      if (String(newVal ?? '') !== String(current[col] ?? '')) {
        changes[col] = { old: current[col], new: newVal };
        sets.push(`${col} = $${idx++}`);
        vals.push(newVal);
      }
    };

    maybe('status',       status);
    maybe('country',      country);
    maybe('account_name', account_name);
    maybe('client_name',  client_name);

    if (sets.length > 0) {
      sets.push(`updated_at = NOW()`);
      vals.push(leadId);
      await query(`UPDATE pipeline_leads SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
    }

    // Always record audit if any changes
    if (Object.keys(changes).length > 0) {
      await query(
        `INSERT INTO pipeline_lead_audit (lead_id, share_id, changed_by_email, changed_by_name, action, changes)
         VALUES ($1, $2, $3, $4, 'update_lead', $5)`,
        [leadId, token, viewer_email || null, viewer_name || null, JSON.stringify(changes)]
      );
    }

    const full = await query(`${PUBLIC_LEAD_SELECT} WHERE pl.id = $1`, [leadId]);
    res.json({ lead: full.rows[0] });
  } catch (err) {
    console.error('updateSharedLead error:', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
};

// POST /public/pipeline-share/:token/leads/:leadId/updates
const addSharedLeadUpdate = async (req, res) => {
  try {
    const { token, leadId } = req.params;
    const { viewer_name, viewer_email, update_text, update_date } = req.body;

    if (!update_text?.trim()) return res.status(400).json({ error: 'Update text is required' });

    const { share, error, status: errStatus } = await validateShare(token);
    if (error) return res.status(errStatus).json({ error });

    // Verify lead belongs to this pipeline
    const leadCheck = await query(
      `SELECT id FROM pipeline_leads WHERE id = $1 AND pipeline_id = $2`,
      [leadId, share.pipeline_id]
    );
    if (!leadCheck.rows[0]) return res.status(404).json({ error: 'Lead not found' });

    const result = await query(
      `INSERT INTO pipeline_lead_updates (lead_id, update_text, update_date, created_by)
       VALUES ($1, $2, $3, NULL) RETURNING *`,
      [leadId, update_text.trim(), update_date || new Date().toISOString().slice(0, 10)]
    );

    // Record audit
    await query(
      `INSERT INTO pipeline_lead_audit (lead_id, share_id, changed_by_email, changed_by_name, action, changes)
       VALUES ($1, $2, $3, $4, 'add_update', $5)`,
      [leadId, token, viewer_email || null, viewer_name || null,
       JSON.stringify({ update_text: update_text.trim(), update_date: result.rows[0].update_date })]
    );

    res.status(201).json({
      update: { ...result.rows[0], created_by_name: viewer_name || 'Shared User' },
    });
  } catch (err) {
    console.error('addSharedLeadUpdate error:', err);
    res.status(500).json({ error: 'Failed to add update' });
  }
};

module.exports = {
  createShare, getShares, deactivateShare,
  getLeadAudit, getPipelineAudit,
  getSharedPipeline, updateSharedLead, addSharedLeadUpdate,
};
