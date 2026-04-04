const { query } = require('../config/database');

const getIndustries = async (req, res) => {
  try {
    const result = await query('SELECT * FROM industries ORDER BY name ASC');
    res.json({ industries: result.rows });
  } catch (err) {
    console.error('getIndustries error:', err);
    res.status(500).json({ error: 'Failed to fetch industries' });
  }
};

const createIndustry = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const result = await query(
      'INSERT INTO industries (name, created_by) VALUES ($1, $2) RETURNING *',
      [name.trim(), req.user.id]
    );
    res.status(201).json({ industry: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Industry name already exists' });
    console.error('createIndustry error:', err);
    res.status(500).json({ error: 'Failed to create industry' });
  }
};

const updateIndustry = async (req, res) => {
  try {
    const { name } = req.body;
    const result = await query(
      'UPDATE industries SET name = $1 WHERE id = $2 RETURNING *',
      [name.trim(), req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Industry not found' });
    res.json({ industry: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Industry name already exists' });
    console.error('updateIndustry error:', err);
    res.status(500).json({ error: 'Failed to update industry' });
  }
};

const deleteIndustry = async (req, res) => {
  try {
    const result = await query('DELETE FROM industries WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Industry not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteIndustry error:', err);
    res.status(500).json({ error: 'Failed to delete industry' });
  }
};

module.exports = { getIndustries, createIndustry, updateIndustry, deleteIndustry };
