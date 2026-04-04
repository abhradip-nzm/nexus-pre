const { query } = require('../config/database');

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
              u2.first_name || ' ' || u2.last_name as created_by_name
       FROM user_stories us
       LEFT JOIN kanban_columns kc ON us.column_id = kc.id
       LEFT JOIN kanban_sub_stages kss ON us.sub_stage_id = kss.id
       LEFT JOIN users u1 ON us.assigned_to = u1.id
       LEFT JOIN users u2 ON us.created_by = u2.id
       WHERE us.id = $1`,
      [id]
    );

    if (storyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }

    const tasksResult = await query(
      `SELECT t.*, u.first_name || ' ' || u.last_name as assigned_to_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.user_story_id = $1 ORDER BY t.created_at ASC`,
      [id]
    );

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

    const emailsResult = await query(
      `SELECT * FROM emails WHERE user_story_id = $1 ORDER BY received_at DESC LIMIT 10`,
      [id]
    );

    res.json({
      story: storyResult.rows[0],
      tasks: tasksResult.rows,
      comments: commentsResult.rows,
      changeLogs: changeLogsResult.rows,
      meetings: meetingsResult.rows,
      emails: emailsResult.rows,
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
      estimated_value, tags, due_date
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
        column_id, sub_stage_id, assigned_to, created_by, priority, estimated_value, tags, due_date, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [title, description, client_name, client_company, client_email, client_phone,
       column_id, sub_stage_id, assigned_to, req.user.id, priority || 'medium',
       estimated_value, tags, due_date, position]
    );

    // Log creation
    await query(
      `INSERT INTO story_change_logs (user_story_id, changed_by, change_type, comment)
       VALUES ($1, $2, 'created', 'Story created')`,
      [result.rows[0].id, req.user.id]
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
    const isExecutive = req.user.role_name === 'pre_sales_executive';

    const existing = await query('SELECT * FROM user_stories WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }
    const old = existing.rows[0];

    const {
      title, description, client_name, client_company, client_email, client_phone,
      column_id, sub_stage_id, assigned_to, priority, estimated_value, tags, due_date
    } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;
    const changes = [];

    const trackChange = (field, oldVal, newVal) => {
      if (oldVal !== newVal) {
        changes.push({ field, old: oldVal, new: newVal });
      }
    };

    if (title !== undefined) {
      trackChange('title', old.title, title);
      updates.push(`title = $${idx++}`); values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`); values.push(description);
    }
    if (client_name !== undefined) {
      trackChange('client_name', old.client_name, client_name);
      updates.push(`client_name = $${idx++}`); values.push(client_name);
    }
    if (client_company !== undefined) {
      trackChange('client_company', old.client_company, client_company);
      updates.push(`client_company = $${idx++}`); values.push(client_company);
    }
    if (client_email !== undefined) { updates.push(`client_email = $${idx++}`); values.push(client_email); }
    if (client_phone !== undefined) { updates.push(`client_phone = $${idx++}`); values.push(client_phone); }
    if (column_id !== undefined) {
      trackChange('column_id', String(old.column_id), String(column_id));
      updates.push(`column_id = $${idx++}`); values.push(column_id);
    }
    if (sub_stage_id !== undefined) {
      trackChange('sub_stage_id', String(old.sub_stage_id), String(sub_stage_id));
      updates.push(`sub_stage_id = $${idx++}`); values.push(sub_stage_id);
    }
    if (assigned_to !== undefined) {
      trackChange('assigned_to', old.assigned_to, assigned_to);
      updates.push(`assigned_to = $${idx++}`); values.push(assigned_to);
    }
    if (priority !== undefined) { updates.push(`priority = $${idx++}`); values.push(priority); }
    if (estimated_value !== undefined) {
      trackChange('estimated_value', String(old.estimated_value), String(estimated_value));
      updates.push(`estimated_value = $${idx++}`); values.push(estimated_value);
    }
    if (tags !== undefined) { updates.push(`tags = $${idx++}`); values.push(tags); }
    if (due_date !== undefined) { updates.push(`due_date = $${idx++}`); values.push(due_date); }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await query(
      `UPDATE user_stories SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    // Log all changes
    for (const change of changes) {
      await query(
        `INSERT INTO story_change_logs (user_story_id, changed_by, field_name, old_value, new_value, change_type)
         VALUES ($1, $2, $3, $4, $5, 'update')`,
        [id, req.user.id, change.field, change.old, change.new]
      );
    }

    if (isExecutive && changes.length === 0) {
      await query(
        `INSERT INTO story_change_logs (user_story_id, changed_by, change_type, comment)
         VALUES ($1, $2, 'update', 'Story updated by executive')`,
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

    // Log column change
    if (existing.rows[0].column_id !== column_id) {
      await query(
        `INSERT INTO story_change_logs (user_story_id, changed_by, field_name, old_value, new_value, change_type)
         VALUES ($1, $2, 'column_id', $3, $4, 'moved')`,
        [id, req.user.id, String(existing.rows[0].column_id), String(column_id)]
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

// Tasks
const getTasksByStory = async (req, res) => {
  try {
    const result = await query(
      `SELECT t.*, u.first_name || ' ' || u.last_name as assigned_to_name
       FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.user_story_id = $1 ORDER BY t.created_at ASC`,
      [req.params.storyId]
    );
    res.json({ tasks: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tasks' });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, assigned_to, due_date } = req.body;
    const { storyId } = req.params;

    const result = await query(
      `INSERT INTO tasks (user_story_id, title, description, assigned_to, created_by, due_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [storyId, title, description, assigned_to, req.user.id, due_date]
    );

    res.status(201).json({ task: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, status, assigned_to, due_date } = req.body;

    const completedAt = status === 'done' ? 'NOW()' : 'NULL';

    await query(
      `UPDATE tasks SET title = COALESCE($1, title), description = COALESCE($2, description),
       status = COALESCE($3, status), assigned_to = COALESCE($4, assigned_to),
       due_date = COALESCE($5, due_date), completed_at = ${completedAt}, updated_at = NOW()
       WHERE id = $6`,
      [title, description, status, assigned_to, due_date, id]
    );

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

// Comments
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
