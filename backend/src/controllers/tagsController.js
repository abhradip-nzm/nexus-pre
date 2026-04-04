const { query } = require('../config/database');

const getTags = async (req, res) => {
  try {
    const result = await query('SELECT * FROM tags ORDER BY name ASC');
    res.json({ tags: result.rows });
  } catch (err) {
    console.error('getTags error:', err);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
};

const createTag = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const result = await query(
      'INSERT INTO tags (name, color, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), color || '#3e72ae', req.user.id]
    );
    res.status(201).json({ tag: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tag name already exists' });
    console.error('createTag error:', err);
    res.status(500).json({ error: 'Failed to create tag' });
  }
};

const updateTag = async (req, res) => {
  try {
    const { name, color } = req.body;
    const result = await query(
      'UPDATE tags SET name = COALESCE($1, name), color = COALESCE($2, color) WHERE id = $3 RETURNING *',
      [name?.trim() || null, color || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tag not found' });
    res.json({ tag: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tag name already exists' });
    console.error('updateTag error:', err);
    res.status(500).json({ error: 'Failed to update tag' });
  }
};

const deleteTag = async (req, res) => {
  try {
    const result = await query('DELETE FROM tags WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Tag not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteTag error:', err);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
};

module.exports = { getTags, createTag, updateTag, deleteTag };
