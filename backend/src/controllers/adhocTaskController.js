const { query } = require('../config/database');

// ─── Shared SELECT for adhoc task list ───────────────────────────────────────
const ADHOC_SELECT = `
  SELECT
    at2.id, at2.title, at2.description, at2.status, at2.priority,
    at2.start_date, at2.due_date, at2.completed_at, at2.response_details,
    at2.created_at, at2.updated_at,
    at2.business_team_member_id,
    bt.name  AS business_team_member_name,
    bt.role  AS business_team_member_role,
    at2.story_id,
    us.title AS story_title,
    at2.prospect_id,
    pp.title AS prospect_title,
    cb.first_name || ' ' || cb.last_name AS created_by_name,
    COALESCE((
      SELECT json_agg(jsonb_build_object('team_id', ata.team_id, 'name', t.name))
      FROM adhoc_task_team_assignments ata
      JOIN teams t ON t.id = ata.team_id
      WHERE ata.adhoc_task_id = at2.id
    ), '[]') AS team_assignments,
    COALESCE((
      SELECT json_agg(jsonb_build_object('user_id', ama.user_id, 'name', u2.first_name || ' ' || u2.last_name))
      FROM adhoc_task_member_assignments ama
      JOIN users u2 ON u2.id = ama.user_id
      WHERE ama.adhoc_task_id = at2.id
    ), '[]') AS member_assignments
  FROM adhoc_tasks at2
  LEFT JOIN business_team bt  ON bt.id  = at2.business_team_member_id
  LEFT JOIN user_stories  us  ON us.id  = at2.story_id
  LEFT JOIN probable_prospects pp ON pp.id = at2.prospect_id
  LEFT JOIN users cb ON cb.id = at2.created_by
`;

// ─── Rebuild team/member assignments ─────────────────────────────────────────
async function rebuildAssignments(taskId, teamIds, memberIds) {
  await query('DELETE FROM adhoc_task_team_assignments   WHERE adhoc_task_id = $1', [taskId]);
  await query('DELETE FROM adhoc_task_member_assignments WHERE adhoc_task_id = $1', [taskId]);

  for (const tid of (teamIds || [])) {
    await query(
      'INSERT INTO adhoc_task_team_assignments (adhoc_task_id, team_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [taskId, tid]
    );
  }
  for (const uid of (memberIds || [])) {
    await query(
      'INSERT INTO adhoc_task_member_assignments (adhoc_task_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [taskId, uid]
    );
  }
}

// ─── GET /adhoc-tasks ─────────────────────────────────────────────────────────
const getAllAdhocTasks = async (req, res) => {
  try {
    const { search = '', status, priority } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (search.trim()) {
      conditions.push(`(at2.title ILIKE $${idx} OR us.title ILIKE $${idx} OR pp.title ILIKE $${idx})`);
      params.push(`%${search.trim()}%`);
      idx++;
    }
    if (status) {
      conditions.push(`at2.status = $${idx++}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`at2.priority = $${idx++}`);
      params.push(priority);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `${ADHOC_SELECT} ${where} ORDER BY at2.due_date ASC NULLS LAST, at2.created_at DESC`,
      params
    );
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('getAllAdhocTasks error:', err);
    res.status(500).json({ error: 'Failed to fetch ad-hoc tasks' });
  }
};

// ─── POST /adhoc-tasks ────────────────────────────────────────────────────────
const createAdhocTask = async (req, res) => {
  try {
    const {
      title, description, status = 'todo', priority = 'medium',
      start_date, due_date,
      business_team_member_id,
      story_id, prospect_id,
      team_ids = [], member_ids = [],
    } = req.body;

    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const result = await query(
      `INSERT INTO adhoc_tasks
         (title, description, status, priority, start_date, due_date,
          business_team_member_id, story_id, prospect_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        title.trim(), description || null, status, priority,
        start_date || null, due_date || null,
        business_team_member_id || null,
        story_id || null, prospect_id || null,
        req.user.id,
      ]
    );
    const taskId = result.rows[0].id;
    await rebuildAssignments(taskId, team_ids, member_ids);

    const full = await query(`${ADHOC_SELECT} WHERE at2.id = $1`, [taskId]);
    res.status(201).json({ task: full.rows[0] });
  } catch (err) {
    console.error('createAdhocTask error:', err);
    res.status(500).json({ error: 'Failed to create ad-hoc task' });
  }
};

// ─── PUT /adhoc-tasks/:id ─────────────────────────────────────────────────────
const updateAdhocTask = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, status, priority,
      start_date, due_date, response_details,
      business_team_member_id,
      story_id, prospect_id,
      team_ids, member_ids,
    } = req.body;

    // Build dynamic SET clause
    const sets = [];
    const vals = [];
    let idx = 1;

    const maybe = (col, val) => {
      if (val !== undefined) { sets.push(`${col} = $${idx++}`); vals.push(val === '' ? null : val); }
    };

    maybe('title',                    title?.trim() || undefined);
    maybe('description',              description);
    maybe('status',                   status);
    maybe('priority',                 priority);
    maybe('start_date',               start_date);
    maybe('due_date',                 due_date);
    maybe('response_details',         response_details);
    maybe('business_team_member_id',  business_team_member_id);
    maybe('story_id',                 story_id);
    maybe('prospect_id',              prospect_id);

    // Handle completion timestamp
    if (status === 'done') {
      sets.push(`completed_at = COALESCE(completed_at, NOW())`);
    } else if (status === 'todo' || status === 'in_progress') {
      sets.push(`completed_at = NULL`);
    }

    sets.push(`updated_at = NOW()`);

    if (sets.length === 1) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(id);
    await query(`UPDATE adhoc_tasks SET ${sets.join(', ')} WHERE id = $${idx}`, vals);

    if (team_ids !== undefined || member_ids !== undefined) {
      await rebuildAssignments(id, team_ids || [], member_ids || []);
    }

    const full = await query(`${ADHOC_SELECT} WHERE at2.id = $1`, [id]);
    if (!full.rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json({ task: full.rows[0] });
  } catch (err) {
    console.error('updateAdhocTask error:', err);
    res.status(500).json({ error: 'Failed to update ad-hoc task' });
  }
};

// ─── DELETE /adhoc-tasks/:id ──────────────────────────────────────────────────
const deleteAdhocTask = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM adhoc_tasks WHERE id = $1 RETURNING id', [id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteAdhocTask error:', err);
    res.status(500).json({ error: 'Failed to delete ad-hoc task' });
  }
};

module.exports = { getAllAdhocTasks, createAdhocTask, updateAdhocTask, deleteAdhocTask };
