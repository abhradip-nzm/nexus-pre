const { query } = require('../config/database');

const getColumns = async (req, res) => {
  try {
    const columns = await query(
      `SELECT kc.*, 
              JSON_AGG(
                JSON_BUILD_OBJECT('id', kss.id, 'name', kss.name, 'position', kss.position)
                ORDER BY kss.position
              ) FILTER (WHERE kss.id IS NOT NULL) as sub_stages,
              COUNT(DISTINCT us.id) as story_count
       FROM kanban_columns kc
       LEFT JOIN kanban_sub_stages kss ON kss.column_id = kc.id
       LEFT JOIN user_stories us ON us.column_id = kc.id
       GROUP BY kc.id
       ORDER BY kc.position`
    );
    res.json({ columns: columns.rows });
  } catch (error) {
    console.error('Get columns error:', error);
    res.status(500).json({ error: 'Failed to get columns' });
  }
};

const createSubStage = async (req, res) => {
  try {
    const { column_id, name } = req.body;

    if (!['system_admin', 'super_admin', 'pre_sales_manager'].includes(req.user.role_name)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const posResult = await query(
      'SELECT COALESCE(MAX(position), 0) as max_pos FROM kanban_sub_stages WHERE column_id = $1',
      [column_id]
    );

    const result = await query(
      `INSERT INTO kanban_sub_stages (column_id, name, position, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [column_id, name, parseInt(posResult.rows[0].max_pos) + 1, req.user.id]
    );

    res.status(201).json({ subStage: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create sub-stage' });
  }
};

const updateSubStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, position } = req.body;

    await query(
      `UPDATE kanban_sub_stages SET name = COALESCE($1, name), position = COALESCE($2, position),
       updated_at = NOW() WHERE id = $3`,
      [name, position, id]
    );

    res.json({ message: 'Sub-stage updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update sub-stage' });
  }
};

const deleteSubStage = async (req, res) => {
  try {
    // Unset sub_stage from stories using it
    await query('UPDATE user_stories SET sub_stage_id = NULL WHERE sub_stage_id = $1', [req.params.id]);
    await query('DELETE FROM kanban_sub_stages WHERE id = $1', [req.params.id]);
    res.json({ message: 'Sub-stage deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete sub-stage' });
  }
};

const updateColumnOrder = async (req, res) => {
  try {
    const { columns } = req.body; // [{ id, position }]
    for (const col of columns) {
      await query('UPDATE kanban_columns SET position = $1 WHERE id = $2', [col.position, col.id]);
    }
    res.json({ message: 'Column order updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update column order' });
  }
};

const createColumn = async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Column name required' });
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
    const posRes = await query('SELECT COALESCE(MAX(position),0)+1 AS pos FROM kanban_columns');
    const pos = posRes.rows[0].pos;
    const result = await query(
      'INSERT INTO kanban_columns (name, slug, position, color, is_system) VALUES ($1, $2, $3, $4, false) RETURNING *',
      [name, slug, pos, color || '#3e72ae']
    );
    res.status(201).json({ column: result.rows[0] });
  } catch (err) {
    console.error('createColumn error:', err);
    res.status(500).json({ error: 'Failed to create column' });
  }
};

const updateColumn = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;
    const result = await query(
      'UPDATE kanban_columns SET name=$1, color=$2 WHERE id=$3 RETURNING *',
      [name, color, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Column not found' });
    res.json({ column: result.rows[0] });
  } catch (err) {
    console.error('updateColumn error:', err);
    res.status(500).json({ error: 'Failed to update column' });
  }
};

const deleteColumn = async (req, res) => {
  try {
    const { id } = req.params;
    const stories = await query('SELECT id FROM user_stories WHERE column_id=$1 LIMIT 1', [id]);
    if (stories.rows.length) return res.status(400).json({ error: 'Cannot delete column with existing stories' });
    await query('DELETE FROM kanban_sub_stages WHERE column_id=$1', [id]);
    await query('DELETE FROM kanban_columns WHERE id=$1', [id]);
    res.json({ message: 'Column deleted' });
  } catch (err) {
    console.error('deleteColumn error:', err);
    res.status(500).json({ error: 'Failed to delete column' });
  }
};

module.exports = { getColumns, createSubStage, updateSubStage, deleteSubStage, updateColumnOrder, createColumn, updateColumn, deleteColumn };
