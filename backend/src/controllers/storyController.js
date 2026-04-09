const { query } = require('../config/database');

// Human-readable field labels
const FIELD_LABELS = {
  title: 'Title',
  client_name: 'Client Name',
  client_company: 'Client Company',
  column_id: 'Stage',
  sub_stage_id: 'Sub Stage',
  assigned_to: 'Assigned To',
  estimated_value: 'Est. Value',
  business_team_member_id: 'Sales Manager',
  priority: 'Priority',
  due_date: 'Due Date',
};

// Resolve a field value to a human-readable display string
const resolveDisplayValue = async (field, value) => {
  if (value === null || value === undefined || value === '' || value === 'null') return 'None';
  if (field === 'column_id') {
    const r = await query('SELECT name FROM kanban_columns WHERE id = $1', [value]);
    return r.rows[0]?.name || String(value);
  }
  if (field === 'sub_stage_id') {
    const r = await query('SELECT name FROM kanban_sub_stages WHERE id = $1', [value]);
    return r.rows[0]?.name || String(value);
  }
  if (field === 'assigned_to') {
    const r = await query("SELECT first_name || ' ' || last_name as name FROM users WHERE id = $1", [value]);
    return r.rows[0]?.name || String(value);
  }
  if (field === 'business_team_member_id') {
    const r = await query('SELECT name FROM business_team WHERE id = $1', [value]);
    return r.rows[0]?.name || String(value);
  }
  return String(value);
};

const getAllStories = async (req, res) => {
  try {
    const { column_id, assigned_to, search, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;

    let conditions = [];
    let values = [];
    let idx = 1;

    if (column_id) {
      conditions.push(`us.column_id = $${idx++}`);
      values.push(column_id);
    }
    if (assigned_to) {
      conditions.push(`us.assigned_to = $${idx++}`);
      values.push(assigned_to);
    }
    if (search) {
      conditions.push(`(us.title ILIKE $${idx} OR us.client_name ILIKE $${idx} OR us.client_company ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT us.*,
              kc.name as column_name, kc.slug as column_slug, kc.color as column_color,
              kss.name as sub_stage_name,
              u1.first_name || ' ' || u1.last_name as assigned_to_name,
              u1.avatar_url as assigned_to_avatar,
              u2.first_name || ' ' || u2.last_name as created_by_name,
              COUNT(DISTINCT t.id) as task_count,
              COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_task_count,
              COUNT(DISTINCT sc.id) as comment_count
       FROM user_stories us
       LEFT JOIN kanban_columns kc ON us.column_id = kc.id
       LEFT JOIN kanban_sub_stages kss ON us.sub_stage_id = kss.id
       LEFT JOIN users u1 ON us.assigned_to = u1.id
       LEFT JOIN users u2 ON us.created_by = u2.id
       LEFT JOIN tasks t ON t.user_story_id = us.id
       LEFT JOIN story_comments sc ON sc.user_story_id = us.id
       ${whereClause}
       GROUP BY us.id, kc.name, kc.slug, kc.color, kss.name, u1.first_name, u1.last_name,
                u1.avatar_url, u2.first_name, u2.last_name
       ORDER BY us.position ASC, us.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM user_stories us ${whereClause}`,
      values
    );

    res.json({
      stories: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ error: 'Failed to get stories' });
  }
};

const getStoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const storyResult = await query(
      `SELECT us.*,
              kc.name as column_name, kc.slug as column_slug,
              kss.name as sub_stage_name,
              u1.first_name || ' ' || u1.last_name as assigned_to_name,
              u2.first_name || ' ' || u2.last_name as created_by_name,
              bt.name as business_team_member_name,
              bt.role as business_team_member_role
       FROM user_stories us
       LEFT JOIN kanban_columns kc ON us.column_id = kc.id
       LEFT JOIN kanban_sub_stages kss ON us.sub_stage_id = kss.id
       LEFT JOIN users u1 ON us.assigned_to = u1.id
       LEFT JOIN users u2 ON us.created_by = u2.id
       LEFT JOIN business_team bt ON us.business_team_member_id = bt.id
       WHERE us.id = $1`,
      [id]
    );

    if (storyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }
    const story = storyResult.rows[0];

    // Business team hierarchy: from selected SM up to CGO
    let btHierarchy = [];
    if (story.business_team_member_id) {
      const hierarchyResult = await query(`
        WITH RECURSIVE hier AS (
          SELECT id, name, role, parent_id FROM business_team WHERE id = $1
          UNION ALL
          SELECT bt.id, bt.name, bt.role, bt.parent_id
          FROM business_team bt
          JOIN hier h ON bt.id = h.parent_id
        )
        SELECT id, name, role FROM hier
      `, [story.business_team_member_id]);
      btHierarchy = hierarchyResult.rows;
    }

    // Team assignments
    const teamAssignmentsResult = await query(`
      SELECT sta.team_id, t.name as team_name, t.accent_color
      FROM story_team_assignments sta
      JOIN teams t ON t.id = sta.team_id
      WHERE sta.story_id = $1
    `, [id]);

    // Member assignments
    const memberAssignmentsResult = await query(`
      SELECT sma.user_id, u.first_name || ' ' || u.last_name as user_name, r.name as role_name
      FROM story_member_assignments sma
      JOIN users u ON u.id = sma.user_id
      JOIN roles r ON r.id = u.role_id
      WHERE sma.story_id = $1
    `, [id]);

    // Tasks with multiple assignees
    const tasksResult = await query(`
      SELECT t.*,
        COALESCE(
          json_agg(
            json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) as assignees
      FROM tasks t
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN users u ON u.id = ta.user_id
      WHERE t.user_story_id = $1
      GROUP BY t.id
      ORDER BY t.created_at ASC
    `, [id]);

    const commentsResult = await query(
      `SELECT sc.*, u.first_name || ' ' || u.last_name as user_name, u.avatar_url
       FROM story_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.user_story_id = $1 ORDER BY sc.created_at ASC`,
      [id]
    );

    const changeLogsResult = await query(
      `SELECT scl.*, u.first_name || ' ' || u.last_name as changed_by_name
       FROM story_change_logs scl
       JOIN users u ON scl.changed_by = u.id
       WHERE scl.user_story_id = $1 ORDER BY scl.created_at DESC LIMIT 50`,
      [id]
    );

    const meetingsResult = await query(
      `SELECT * FROM meetings WHERE user_story_id = $1 ORDER BY start_time ASC`,
      [id]
    );

    res.json({
      story,
      btHierarchy,
      teamAssignments: teamAssignmentsResult.rows,
      memberAssignments: memberAssignmentsResult.rows,
      tasks: tasksResult.rows,
      comments: commentsResult.rows,
      changeLogs: changeLogsResult.rows,
      meetings: meetingsResult.rows,
    });
  } catch (error) {
    console.error('Get story error:', error);
    res.status(500).json({ error: 'Failed to get story' });
  }
};

const createStory = async (req, res) => {
  try {
    if (req.user.role_name === 'pre_sales_executive') {
      return res.status(403).json({ error: 'Executives cannot create user stories' });
    }

    const {
      title, description, client_name, client_company, client_email,
      client_phone, column_id, sub_stage_id, assigned_to, priority,
      estimated_value, tags, due_date, business_team_member_id, team_ids, member_ids
    } = req.body;

    if (!title || !column_id) {
      return res.status(400).json({ error: 'Title and column are required' });
    }

    // Get max position in column
    const posResult = await query(
      'SELECT COALESCE(MAX(position), 0) as max_pos FROM user_stories WHERE column_id = $1',
      [column_id]
    );
    const position = parseFloat(posResult.rows[0].max_pos) + 1000;

    const result = await query(
      `INSERT INTO user_stories
       (title, description, client_name, client_company, client_email, client_phone,
        column_id, sub_stage_id, assigned_to, created_by, priority, estimated_value,
        tags, due_date, position, business_team_member_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [title, description || null, client_name || null, client_company || null,
       client_email || null, client_phone || null,
       column_id, sub_stage_id || null, assigned_to || null, req.user.id,
       priority || 'medium', estimated_value || null, tags || null,
       due_date || null, position, business_team_member_id || null]
    );

    const storyId = result.rows[0].id;

    // Team assignments
    if (Array.isArray(team_ids)) {
      for (const teamId of team_ids) {
        await query(
          'INSERT INTO story_team_assignments (story_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [storyId, teamId]
        );
      }
    }

    // Member assignments
    if (Array.isArray(member_ids)) {
      for (const userId of member_ids) {
        await query(
          'INSERT INTO story_member_assignments (story_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [storyId, userId]
        );
      }
    }

    // Log creation
    await query(
      `INSERT INTO story_change_logs (user_story_id, changed_by, change_type, comment)
       VALUES ($1, $2, 'created', 'Story created')`,
      [storyId, req.user.id]
    );

    res.status(201).json({ story: result.rows[0] });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
};

const updateStory = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT * FROM user_stories WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }
    const old = existing.rows[0];

    const {
      title, description, client_name, client_company, client_email, client_phone,
      column_id, sub_stage_id, assigned_to, priority, estimated_value, tags, due_date,
      business_team_member_id, team_ids, member_ids
    } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;
    const changes = [];

    // Helper: track a change with human-readable values
    const trackChange = async (field, oldVal, newVal) => {
      const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : null;
      const newStr = newVal !== null && newVal !== undefined ? String(newVal) : null;
      if (oldStr !== newStr) {
        const oldDisplay = await resolveDisplayValue(field, oldVal);
        const newDisplay = await resolveDisplayValue(field, newVal);
        changes.push({
          field: FIELD_LABELS[field] || field.replace(/_/g, ' '),
          old: oldDisplay,
          new: newDisplay,
        });
      }
    };

    if (title !== undefined) {
      await trackChange('title', old.title, title);
      updates.push(`title = $${idx++}`); values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`); values.push(description);
    }
    if (client_name !== undefined) {
      await trackChange('client_name', old.client_name, client_name);
      updates.push(`client_name = $${idx++}`); values.push(client_name);
    }
    if (client_company !== undefined) {
      await trackChange('client_company', old.client_company, client_company);
      updates.push(`client_company = $${idx++}`); values.push(client_company);
    }
    if (client_email !== undefined) { updates.push(`client_email = $${idx++}`); values.push(client_email); }
    if (client_phone !== undefined) { updates.push(`client_phone = $${idx++}`); values.push(client_phone); }
    if (column_id !== undefined) {
      await trackChange('column_id', old.column_id, column_id);
      updates.push(`column_id = $${idx++}`); values.push(column_id);
    }
    if (sub_stage_id !== undefined) {
      await trackChange('sub_stage_id', old.sub_stage_id, sub_stage_id || null);
      updates.push(`sub_stage_id = $${idx++}`); values.push(sub_stage_id || null);
    }
    if (assigned_to !== undefined) {
      await trackChange('assigned_to', old.assigned_to, assigned_to || null);
      updates.push(`assigned_to = $${idx++}`); values.push(assigned_to || null);
    }
    if (priority !== undefined) {
      updates.push(`priority = $${idx++}`); values.push(priority);
    }
    if (estimated_value !== undefined) {
      await trackChange('estimated_value', old.estimated_value, estimated_value || null);
      updates.push(`estimated_value = $${idx++}`); values.push(estimated_value || null);
    }
    if (tags !== undefined) { updates.push(`tags = $${idx++}`); values.push(tags); }
    if (due_date !== undefined) { updates.push(`due_date = $${idx++}`); values.push(due_date || null); }
    if (business_team_member_id !== undefined) {
      await trackChange('business_team_member_id', old.business_team_member_id, business_team_member_id || null);
      updates.push(`business_team_member_id = $${idx++}`); values.push(business_team_member_id || null);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await query(
      `UPDATE user_stories SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    // Handle team assignments
    if (Array.isArray(team_ids)) {
      await query('DELETE FROM story_team_assignments WHERE story_id = $1', [id]);
      for (const teamId of team_ids) {
        await query(
          'INSERT INTO story_team_assignments (story_id, team_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, teamId]
        );
      }
    }

    // Handle member assignments
    if (Array.isArray(member_ids)) {
      await query('DELETE FROM story_member_assignments WHERE story_id = $1', [id]);
      for (const userId of member_ids) {
        await query(
          'INSERT INTO story_member_assignments (story_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, userId]
        );
      }
    }

    // Log all field-level changes
    for (const change of changes) {
      await query(
        `INSERT INTO story_change_logs (user_story_id, changed_by, field_name, old_value, new_value, change_type)
         VALUES ($1, $2, $3, $4, $5, 'update')`,
        [id, req.user.id, change.field, change.old, change.new]
      );
    }

    // Log a generic update if nothing specific changed
    if (changes.length === 0) {
      await query(
        `INSERT INTO story_change_logs (user_story_id, changed_by, change_type, comment)
         VALUES ($1, $2, 'update', 'Story updated')`,
        [id, req.user.id]
      );
    }

    res.json({ message: 'Story updated successfully' });
  } catch (error) {
    console.error('Update story error:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
};

const moveStory = async (req, res) => {
  try {
    const { id } = req.params;
    const { column_id, position, sub_stage_id } = req.body;

    const existing = await query('SELECT column_id FROM user_stories WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }

    await query(
      `UPDATE user_stories SET column_id = $1, position = $2, sub_stage_id = $3, updated_at = NOW() WHERE id = $4`,
      [column_id, position, sub_stage_id || null, id]
    );

    // Log column change with human-readable column names
    const oldColId = existing.rows[0].column_id;
    if (String(oldColId) !== String(column_id)) {
      const oldName = await resolveDisplayValue('column_id', oldColId);
      const newName = await resolveDisplayValue('column_id', column_id);
      await query(
        `INSERT INTO story_change_logs (user_story_id, changed_by, field_name, old_value, new_value, change_type)
         VALUES ($1, $2, 'Stage', $3, $4, 'moved')`,
        [id, req.user.id, oldName, newName]
      );
    }

    res.json({ message: 'Story moved successfully' });
  } catch (error) {
    console.error('Move story error:', error);
    res.status(500).json({ error: 'Failed to move story' });
  }
};

const deleteStory = async (req, res) => {
  try {
    if (!['system_admin', 'super_admin', 'pre_sales_manager'].includes(req.user.role_name)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    await query('DELETE FROM user_stories WHERE id = $1', [req.params.id]);
    res.json({ message: 'Story deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
};

// ── Tasks ──────────────────────────────────────────────────────────────────────

const getTasksByStory = async (req, res) => {
  try {
    const result = await query(`
      SELECT t.*,
        COALESCE(
          json_agg(
            json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) as assignees
      FROM tasks t
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN users u ON u.id = ta.user_id
      WHERE t.user_story_id = $1
      GROUP BY t.id
      ORDER BY t.created_at ASC
    `, [req.params.storyId]);
    res.json({ tasks: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tasks' });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, assignee_ids, due_date } = req.body;
    const { storyId } = req.params;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const result = await query(
      `INSERT INTO tasks (user_story_id, title, description, created_by, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [storyId, title.trim(), description || null, req.user.id, due_date || null]
    );

    const taskId = result.rows[0].id;

    // Insert assignees
    if (Array.isArray(assignee_ids) && assignee_ids.length > 0) {
      for (const userId of assignee_ids) {
        await query(
          'INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [taskId, userId]
        );
      }
    }

    // Return task with assignees
    const taskWithAssignees = await query(`
      SELECT t.*,
        COALESCE(
          json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name))
          FILTER (WHERE u.id IS NOT NULL), '[]'
        ) as assignees
      FROM tasks t
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN users u ON u.id = ta.user_id
      WHERE t.id = $1
      GROUP BY t.id
    `, [taskId]);

    res.status(201).json({ task: taskWithAssignees.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, assignee_ids, due_date } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`); values.push(status);
      updates.push(`completed_at = ${status === 'done' ? 'NOW()' : 'NULL'}`);
    }
    if (due_date !== undefined) { updates.push(`due_date = $${idx++}`); values.push(due_date || null); }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    // Handle assignees: if provided, replace all
    if (assignee_ids !== undefined) {
      await query('DELETE FROM task_assignees WHERE task_id = $1', [id]);
      if (Array.isArray(assignee_ids)) {
        for (const userId of assignee_ids) {
          await query(
            'INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, userId]
          );
        }
      }
    }

    res.json({ message: 'Task updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
};

const deleteTask = async (req, res) => {
  try {
    await query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Task deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

// ── Comments ───────────────────────────────────────────────────────────────────

const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    const result = await query(
      `INSERT INTO story_comments (user_story_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.storyId, req.user.id, content]
    );
    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

module.exports = {
  getAllStories, getStoryById, createStory, updateStory, moveStory, deleteStory,
  getTasksByStory, createTask, updateTask, deleteTask, addComment
};
