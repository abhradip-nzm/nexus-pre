const { query } = require('../config/database');

// ─── Shared SELECT for a pipeline lead (with updates aggregated) ──────────────
const LEAD_SELECT = `
  SELECT
    pl.id, pl.pipeline_id, pl.account_name, pl.client_name,
    pl.business_manager_id,
    bt.name  AS business_manager_name,
    bt.role  AS business_manager_role,
    pl.industry_id,
    ind.name AS industry_name,
    pl.country, pl.status,
    pl.created_at, pl.updated_at,
    COALESCE((
      SELECT json_agg(
        jsonb_build_object(
          'id', plu.id,
          'update_text', plu.update_text,
          'update_date', plu.update_date,
          'created_by',  plu.created_by,
          'created_by_name', u.first_name || ' ' || u.last_name
        ) ORDER BY plu.update_date DESC, plu.created_at DESC
      )
      FROM pipeline_lead_updates plu
      LEFT JOIN users u ON u.id = plu.created_by
      WHERE plu.lead_id = pl.id
    ), '[]'::json) AS updates
  FROM pipeline_leads pl
  LEFT JOIN business_team bt  ON bt.id  = pl.business_manager_id
  LEFT JOIN industries    ind ON ind.id = pl.industry_id
`;

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /pipelines
const getAllPipelines = async (req, res) => {
  try {
    const { search = '', status } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (search.trim()) {
      conditions.push(`p.name ILIKE $${idx++}`);
      params.push(`%${search.trim()}%`);
    }
    if (status) {
      conditions.push(`p.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT
         p.*,
         u.first_name || ' ' || u.last_name AS created_by_name,
         (SELECT COUNT(*) FROM pipeline_leads pl WHERE pl.pipeline_id = p.id)::int AS lead_count
       FROM pipelines p
       LEFT JOIN users u ON u.id = p.created_by
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );
    res.json({ pipelines: result.rows });
  } catch (err) {
    console.error('getAllPipelines error:', err);
    res.status(500).json({ error: 'Failed to fetch pipelines' });
  }
};

// GET /pipelines/:id
const getPipeline = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT
         p.*,
         u.first_name || ' ' || u.last_name AS created_by_name,
         (SELECT COUNT(*) FROM pipeline_leads pl WHERE pl.pipeline_id = p.id)::int AS lead_count
       FROM pipelines p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.id = $1`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pipeline not found' });
    res.json({ pipeline: result.rows[0] });
  } catch (err) {
    console.error('getPipeline error:', err);
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
};

// POST /pipelines
const createPipeline = async (req, res) => {
  try {
    const { name, start_date, end_date, status = 'active' } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Pipeline name is required' });

    const result = await query(
      `INSERT INTO pipelines (name, start_date, end_date, status, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name.trim(), start_date || null, end_date || null, status, req.user.id]
    );
    res.status(201).json({ pipeline: result.rows[0] });
  } catch (err) {
    console.error('createPipeline error:', err);
    res.status(500).json({ error: 'Failed to create pipeline' });
  }
};

// PUT /pipelines/:id
const updatePipeline = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, start_date, end_date, status } = req.body;

    const sets = [];
    const vals = [];
    let idx = 1;

    const maybe = (col, val) => {
      if (val !== undefined) { sets.push(`${col} = $${idx++}`); vals.push(val === '' ? null : val); }
    };

    maybe('name',       name?.trim());
    maybe('start_date', start_date);
    maybe('end_date',   end_date);
    maybe('status',     status);
    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(id);
    const result = await query(
      `UPDATE pipelines SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Pipeline not found' });
    res.json({ pipeline: result.rows[0] });
  } catch (err) {
    console.error('updatePipeline error:', err);
    res.status(500).json({ error: 'Failed to update pipeline' });
  }
};

// DELETE /pipelines/:id
const deletePipeline = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM pipelines WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Pipeline not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deletePipeline error:', err);
    res.status(500).json({ error: 'Failed to delete pipeline' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE LEADS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /pipelines/:id/leads
const getPipelineLeads = async (req, res) => {
  try {
    const { id } = req.params;
    const { search = '', status, business_manager_id, industry_id } = req.query;
    const conditions = [`pl.pipeline_id = $1`];
    const params = [id];
    let idx = 2;

    if (search.trim()) {
      conditions.push(`(pl.account_name ILIKE $${idx} OR pl.client_name ILIKE $${idx} OR pl.country ILIKE $${idx})`);
      params.push(`%${search.trim()}%`);
      idx++;
    }
    if (status) {
      conditions.push(`pl.status = $${idx++}`);
      params.push(status);
    }
    if (business_manager_id) {
      conditions.push(`pl.business_manager_id = $${idx++}`);
      params.push(business_manager_id);
    }
    if (industry_id) {
      conditions.push(`pl.industry_id = $${idx++}`);
      params.push(industry_id);
    }

    const result = await query(
      `${LEAD_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY pl.created_at DESC`,
      params
    );
    res.json({ leads: result.rows });
  } catch (err) {
    console.error('getPipelineLeads error:', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
};

// POST /pipelines/:id/leads
const createLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { account_name, client_name, business_manager_id, industry_id, country, status = 'hot' } = req.body;

    if (!account_name?.trim()) return res.status(400).json({ error: 'Account name is required' });
    if (!client_name?.trim())  return res.status(400).json({ error: 'Client name is required' });

    // Verify pipeline exists
    const pipe = await query('SELECT id FROM pipelines WHERE id = $1', [id]);
    if (!pipe.rows[0]) return res.status(404).json({ error: 'Pipeline not found' });

    const result = await query(
      `INSERT INTO pipeline_leads (pipeline_id, account_name, client_name, business_manager_id, industry_id, country, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [id, account_name.trim(), client_name.trim(), business_manager_id || null, industry_id || null, country || null, status]
    );
    const full = await query(`${LEAD_SELECT} WHERE pl.id = $1`, [result.rows[0].id]);
    res.status(201).json({ lead: full.rows[0] });
  } catch (err) {
    console.error('createLead error:', err);
    res.status(500).json({ error: 'Failed to create lead' });
  }
};

// PUT /pipeline-leads/:leadId
const updateLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { account_name, client_name, business_manager_id, industry_id, country, status } = req.body;

    const sets = [];
    const vals = [];
    let idx = 1;

    const maybe = (col, val) => {
      if (val !== undefined) { sets.push(`${col} = $${idx++}`); vals.push(val === '' ? null : val); }
    };

    maybe('account_name',        account_name?.trim());
    maybe('client_name',         client_name?.trim());
    maybe('business_manager_id', business_manager_id);
    maybe('industry_id',         industry_id);
    maybe('country',             country);
    maybe('status',              status);
    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(leadId);
    await query(`UPDATE pipeline_leads SET ${sets.join(', ')} WHERE id = $${idx}`, vals);

    const full = await query(`${LEAD_SELECT} WHERE pl.id = $1`, [leadId]);
    if (!full.rows[0]) return res.status(404).json({ error: 'Lead not found' });
    res.json({ lead: full.rows[0] });
  } catch (err) {
    console.error('updateLead error:', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
};

// DELETE /pipeline-leads/:leadId
const deleteLead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const result = await query('DELETE FROM pipeline_leads WHERE id = $1 RETURNING id', [leadId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteLead error:', err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD UPDATES (latest-update entries per lead)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /pipeline-leads/:leadId/updates
const addLeadUpdate = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { update_text, update_date } = req.body;
    if (!update_text?.trim()) return res.status(400).json({ error: 'Update text is required' });

    const result = await query(
      `INSERT INTO pipeline_lead_updates (lead_id, update_text, update_date, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [leadId, update_text.trim(), update_date || new Date().toISOString().slice(0, 10), req.user.id]
    );
    res.status(201).json({ update: result.rows[0] });
  } catch (err) {
    console.error('addLeadUpdate error:', err);
    res.status(500).json({ error: 'Failed to add update' });
  }
};

// DELETE /pipeline-lead-updates/:updateId
const deleteLeadUpdate = async (req, res) => {
  try {
    const { updateId } = req.params;
    const result = await query('DELETE FROM pipeline_lead_updates WHERE id = $1 RETURNING id', [updateId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Update not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteLeadUpdate error:', err);
    res.status(500).json({ error: 'Failed to delete update' });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS  GET /pipelines/:id/analytics
// ═══════════════════════════════════════════════════════════════════════════════
const getPipelineAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;

    // Build reusable date filter (appended to every per-lead WHERE clause)
    const dp = [id];
    let dateWhere = '';
    if (from_date) { dp.push(from_date);                    dateWhere += ` AND pl.created_at >= $${dp.length}`; }
    if (to_date)   { dp.push(to_date + ' 23:59:59.999');    dateWhere += ` AND pl.created_at <= $${dp.length}`; }

    const [statusRes, industryRes, countryRes, bmRes, trendRes, bmIndRes, bmCtyRes] = await Promise.all([
      // Status breakdown
      query(
        `SELECT status, COUNT(*)::int AS count
         FROM pipeline_leads pl WHERE pl.pipeline_id = $1${dateWhere}
         GROUP BY status`,
        dp
      ),
      // Industry distribution
      query(
        `SELECT COALESCE(ind.name, 'Unspecified') AS industry, COUNT(pl.id)::int AS count
         FROM pipeline_leads pl
         LEFT JOIN industries ind ON ind.id = pl.industry_id
         WHERE pl.pipeline_id = $1${dateWhere}
         GROUP BY COALESCE(ind.name, 'Unspecified')
         ORDER BY count DESC`,
        dp
      ),
      // Country distribution
      query(
        `SELECT COALESCE(pl.country, 'Unspecified') AS country, COUNT(*)::int AS count
         FROM pipeline_leads pl
         WHERE pl.pipeline_id = $1${dateWhere}
         GROUP BY COALESCE(pl.country, 'Unspecified')
         ORDER BY count DESC LIMIT 15`,
        dp
      ),
      // Business Manager Charter
      query(
        `SELECT
           COALESCE(bt.name, 'Unassigned') AS manager,
           COUNT(pl.id)::int AS total,
           SUM(CASE WHEN pl.status = 'hot'            THEN 1 ELSE 0 END)::int AS hot,
           SUM(CASE WHEN pl.status = 'cold'           THEN 1 ELSE 0 END)::int AS cold,
           SUM(CASE WHEN pl.status = 'onboarded'      THEN 1 ELSE 0 END)::int AS onboarded,
           SUM(CASE WHEN pl.status = 'no_requirement' THEN 1 ELSE 0 END)::int AS no_requirement
         FROM pipeline_leads pl
         LEFT JOIN business_team bt ON bt.id = pl.business_manager_id
         WHERE pl.pipeline_id = $1${dateWhere}
         GROUP BY COALESCE(bt.name, 'Unassigned')
         ORDER BY total DESC`,
        dp
      ),
      // Monthly trend
      query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', pl.created_at), 'Mon YYYY') AS month,
           DATE_TRUNC('month', pl.created_at) AS month_date,
           COUNT(*)::int AS count
         FROM pipeline_leads pl
         WHERE pl.pipeline_id = $1${dateWhere}
         GROUP BY DATE_TRUNC('month', pl.created_at)
         ORDER BY month_date ASC`,
        dp
      ),
      // BM × Industry
      query(
        `SELECT
           COALESCE(bt.name, 'Unassigned') AS manager,
           COALESCE(ind.name, 'Unspecified') AS industry,
           COUNT(pl.id)::int AS count
         FROM pipeline_leads pl
         LEFT JOIN business_team bt  ON bt.id  = pl.business_manager_id
         LEFT JOIN industries    ind ON ind.id = pl.industry_id
         WHERE pl.pipeline_id = $1${dateWhere}
         GROUP BY COALESCE(bt.name, 'Unassigned'), COALESCE(ind.name, 'Unspecified')
         ORDER BY manager, count DESC`,
        dp
      ),
      // BM × Country
      query(
        `SELECT
           COALESCE(bt.name, 'Unassigned') AS manager,
           COALESCE(pl.country, 'Unspecified') AS country,
           COUNT(pl.id)::int AS count
         FROM pipeline_leads pl
         LEFT JOIN business_team bt ON bt.id = pl.business_manager_id
         WHERE pl.pipeline_id = $1${dateWhere}
         GROUP BY COALESCE(bt.name, 'Unassigned'), COALESCE(pl.country, 'Unspecified')
         ORDER BY manager, count DESC`,
        dp
      ),
    ]);

    res.json({
      status_breakdown:      statusRes.rows,
      industry_distribution: industryRes.rows,
      country_distribution:  countryRes.rows,
      manager_performance:   bmRes.rows,
      monthly_trend:         trendRes.rows,
      bm_industry:           bmIndRes.rows,
      bm_country:            bmCtyRes.rows,
    });
  } catch (err) {
    console.error('getPipelineAnalytics error:', err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
};

module.exports = {
  getAllPipelines, getPipeline, createPipeline, updatePipeline, deletePipeline,
  getPipelineLeads, createLead, updateLead, deleteLead,
  addLeadUpdate, deleteLeadUpdate,
  getPipelineAnalytics,
};
