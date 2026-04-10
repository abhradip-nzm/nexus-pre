const { query } = require('../config/database');

const getProspects = async (req, res) => {
  try {
    const result = await query(`
      SELECT pp.*, i.name as industry_name,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM probable_prospects pp
      LEFT JOIN industries i ON i.id = pp.industry_id
      LEFT JOIN users u ON u.id = pp.created_by
      WHERE pp.promoted_at IS NULL
      ORDER BY pp.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch prospects' });
  }
};

const createProspect = async (req, res) => {
  try {
    const { title, company_name, contact_name, contact_email, contact_phone, source, priority, notes, estimated_value, industry_id } = req.body;
    const result = await query(`
      INSERT INTO probable_prospects (title, company_name, contact_name, contact_email, contact_phone, source, priority, notes, estimated_value, industry_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
    `, [title, company_name, contact_name, contact_email, contact_phone, source, priority || 'medium', notes, estimated_value, industry_id || null, req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create prospect' });
  }
};

const updateProspect = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, company_name, contact_name, contact_email, contact_phone, source, priority, notes, estimated_value, industry_id } = req.body;
    const result = await query(`
      UPDATE probable_prospects SET
        title=$1, company_name=$2, contact_name=$3, contact_email=$4, contact_phone=$5,
        source=$6, priority=$7, notes=$8, estimated_value=$9, industry_id=$10, updated_at=NOW()
      WHERE id=$11 RETURNING *
    `, [title, company_name, contact_name, contact_email, contact_phone, source, priority || 'medium', notes, estimated_value, industry_id || null, id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update prospect' });
  }
};

const deleteProspect = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM probable_prospects WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete prospect' });
  }
};

const promoteProspect = async (req, res) => {
  try {
    const { id } = req.params;
    const prospect = await query('SELECT * FROM probable_prospects WHERE id=$1', [id]);
    if (!prospect.rows.length) return res.status(404).json({ error: 'Not found' });
    const p = prospect.rows[0];

    // Get the first/L1 kanban column
    const colResult = await query('SELECT id FROM kanban_columns ORDER BY position ASC LIMIT 1');
    if (!colResult.rows.length) return res.status(400).json({ error: 'No kanban columns configured' });
    const columnId = colResult.rows[0].id;

    // Get max position in column
    const posResult = await query(
      'SELECT COALESCE(MAX(position), 0) as max_pos FROM user_stories WHERE column_id = $1',
      [columnId]
    );
    const position = parseFloat(posResult.rows[0].max_pos) + 1000;

    // Create user story from prospect using actual user_stories columns
    const storyResult = await query(`
      INSERT INTO user_stories (title, client_name, client_company, client_email, client_phone, source, priority, description, estimated_value, column_id, created_by, position)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [
      p.title,
      p.contact_name,
      p.company_name,
      p.contact_email,
      p.contact_phone,
      p.source,
      p.priority,
      p.notes,
      p.estimated_value,
      columnId,
      req.user.id,
      position
    ]);

    const story = storyResult.rows[0];

    // Assign industry if present
    if (p.industry_id) {
      await query(
        'INSERT INTO story_industries (story_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [story.id, p.industry_id]
      );
    }

    // Mark prospect as promoted
    await query('UPDATE probable_prospects SET promoted_at=NOW(), promoted_to_story_id=$1 WHERE id=$2', [story.id, id]);

    res.json({ success: true, story });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to promote prospect' });
  }
};

module.exports = { getProspects, createProspect, updateProspect, deleteProspect, promoteProspect };
