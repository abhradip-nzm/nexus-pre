const { query } = require('../config/database');
const { createNotification } = require('../utils/notifications');

// Human-readable field labels
const FIELD_LABELS = {
  title: 'Title',
  client_name: 'Client Name',
  client_company: 'Client Company',
  column_id: 'Stage',
  sub_stage_id: 'Sub Stage',
  assigned_to: 'Assigned To',
  estimated_value: 'Est. Value',
  business_team_member_id: 'Sales Executive',
  priority: 'Priority',
  due_date: 'Due Date',
};

// Resolve a field value to a human-readable display string
const resolveDisplayValue = async (field, value) => {
  try {
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
  } catch (e) {
    console.error(`resolveDisplayValue failed for field=${field}, value=${value}:`, e.message);
    return String(value ?? 'None');
  }
};

const getAllStories = async (req, res) => {
  try {
    const { column_id, assigned_to, search, page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    const userRole = req.user.role_name;
    const userId = req.user.id;

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

    // Visibility filter for non-admin roles
    if (!['system_admin', 'super_admin'].includes(userRole)) {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM story_team_assignments sta
          JOIN team_members tm ON tm.team_id = sta.team_id
          WHERE sta.story_id = us.id AND tm.user_id = $${idx}
        )
        OR
        EXISTS (
          SELECT 1 FROM story_member_assignments sma
          WHERE sma.story_id = us.id AND sma.user_id = $${idx}
        )
        OR
        EXISTS (
          SELECT 1 FROM story_member_assignments sma
          JOIN team_members tm_assigned ON tm_assigned.user_id = sma.user_id
          JOIN team_members tm_mine ON tm_mine.team_id = tm_assigned.team_id AND tm_mine.user_id = $${idx}
          WHERE sma.story_id = us.id
        )
      )`);
      values.push(userId);
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
              bt.name as business_team_member_name,
              COUNT(DISTINCT t.id) as task_count,
              COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_task_count,
              COUNT(DISTINCT sc.id) as comment_count,
              COALESCE((
                SELECT json_agg(jsonb_build_object('team_id', sta.team_id, 'name', t_ref.name))
                FROM story_team_assignments sta
                JOIN teams t_ref ON t_ref.id = sta.team_id
                WHERE sta.story_id = us.id
              ), '[]') as team_assignments,
              COALESCE((
                SELECT json_agg(jsonb_build_object('user_id', sma.user_id, 'name', u_ref.first_name || ' ' || u_ref.last_name))
                FROM story_member_assignments sma
                JOIN users u_ref ON u_ref.id = sma.user_id
                WHERE sma.story_id = us.id
              ), '[]') as member_assignments,
              COALESCE((
                SELECT json_agg(jsonb_build_object('industry_id', si.industry_id, 'name', i_ref.name))
                FROM story_industries si
                JOIN industries i_ref ON i_ref.id = si.industry_id
                WHERE si.story_id = us.id
              ), '[]') as industry_assignments
       FROM user_stories us
       LEFT JOIN kanban_columns kc ON us.column_id = kc.id
       LEFT JOIN kanban_sub_stages kss ON us.sub_stage_id = kss.id
       LEFT JOIN users u1 ON us.assigned_to = u1.id
       LEFT JOIN users u2 ON us.created_by = u2.id
       LEFT JOIN tasks t ON t.user_story_id = us.id
       LEFT JOIN story_comments sc ON sc.user_story_id = us.id
       LEFT JOIN business_team bt ON us.business_team_member_id = bt.id
       ${whereClause}
       GROUP BY us.id, kc.name, kc.slug, kc.color, kss.name, u1.first_name, u1.last_name,
                u1.avatar_url, u2.first_name, u2.last_name, bt.name
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

    // Industry assignments
    const industryAssignmentsResult = await query(`
      SELECT si.industry_id, i.name as industry_name
      FROM story_industries si
      JOIN industries i ON i.id = si.industry_id
      WHERE si.story_id = $1
    `, [id]);

    // Tasks with multiple assignees and activity logs
    const tasksResult = await query(`
      SELECT t.*,
        COALESCE(
          json_agg(
            json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) as assignees,
        COALESCE(
          (SELECT json_agg(
            jsonb_build_object(
              'id', tcl.id,
              'change_type', tcl.change_type,
              'field_name', tcl.field_name,
              'old_value', tcl.old_value,
              'new_value', tcl.new_value,
              'created_at', tcl.created_at,
              'changed_by_name', ub.first_name || ' ' || ub.last_name
            ) ORDER BY tcl.created_at ASC
          )
          FROM task_change_logs tcl
          LEFT JOIN users ub ON ub.id = tcl.changed_by
          WHERE tcl.task_id = t.id),
          '[]'
        ) AS activity_logs
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
      industryAssignments: industryAssignmentsResult.rows,
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
      estimated_value, tags, due_date, effective_start_date, business_team_member_id, team_ids, member_ids, industry_ids, country
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
        tags, due_date, effective_start_date, position, business_team_member_id, country)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [title, description || null, client_name || null, client_company || null,
       client_email || null, client_phone || null,
       column_id, sub_stage_id || null, assigned_to || null, req.user.id,
       priority || 'medium', estimated_value || null, tags || null,
       due_date || null, effective_start_date || null, position, business_team_member_id || null, country || null]
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

    // Industry assignments
    if (Array.isArray(industry_ids)) {
      for (const industryId of industry_ids) {
        await query(
          'INSERT INTO story_industries (story_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [storyId, industryId]
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
      effective_start_date, business_team_member_id, team_ids, member_ids, industry_ids, country
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
    if (effective_start_date !== undefined) { updates.push(`effective_start_date = $${idx++}`); values.push(effective_start_date || null); }
    if (business_team_member_id !== undefined) {
      await trackChange('business_team_member_id', old.business_team_member_id, business_team_member_id || null);
      updates.push(`business_team_member_id = $${idx++}`); values.push(business_team_member_id || null);
    }
    if (country !== undefined) { updates.push(`country = $${idx++}`); values.push(country || null); }

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

    // Handle industry assignments
    if (Array.isArray(industry_ids)) {
      await query('DELETE FROM story_industries WHERE story_id = $1', [id]);
      for (const industryId of industry_ids) {
        await query(
          'INSERT INTO story_industries (story_id, industry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, industryId]
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

    // Notify assigned members when story is moved to a different column
    if (String(oldColId) !== String(column_id)) {
      try {
        const movedStory = await query('SELECT title FROM user_stories WHERE id=$1', [id]);
        const columnInfo = await query('SELECT name FROM kanban_columns WHERE id=$1', [column_id]);
        const members = await query(`
          SELECT DISTINCT u.id FROM users u
          JOIN story_member_assignments sma ON sma.user_id = u.id
          WHERE sma.story_id = $1 AND u.id != $2
        `, [id, req.user.id]);
        const storyTitleVal = movedStory.rows[0]?.title || '';
        const colName = columnInfo.rows[0]?.name || '';
        for (const m of members.rows) {
          await createNotification(m.id, 'Story Moved', `"${storyTitleVal}" moved to ${colName}`, 'story_moved');
        }
      } catch (err) {
        console.error('Failed to send story moved notifications:', err.message);
      }
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

// Helper: log a task change
const logTaskChange = async (taskId, changedBy, changeType, fieldName, oldVal, newVal) => {
  try {
    await query(
      `INSERT INTO task_change_logs (task_id, changed_by, change_type, field_name, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [taskId, changedBy, changeType, fieldName || null,
       oldVal != null ? String(oldVal) : null,
       newVal != null ? String(newVal) : null]
    );
  } catch (e) {
    console.error('Failed to log task change:', e.message);
  }
};

const getTasksByStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userRole = req.user.role_name;
    const userId = req.user.id;

    // Check story visibility for non-admin users
    if (!['system_admin', 'super_admin'].includes(userRole)) {
      const accessCheck = await query(`
        SELECT 1 FROM user_stories us
        WHERE us.id = $1 AND (
          EXISTS (
            SELECT 1 FROM story_team_assignments sta
            JOIN team_members tm ON tm.team_id = sta.team_id
            WHERE sta.story_id = us.id AND tm.user_id = $2
          )
          OR
          EXISTS (
            SELECT 1 FROM story_member_assignments sma
            WHERE sma.story_id = us.id AND sma.user_id = $2
          )
          OR
          EXISTS (
            SELECT 1 FROM story_member_assignments sma
            JOIN team_members tm_assigned ON tm_assigned.user_id = sma.user_id
            JOIN team_members tm_mine ON tm_mine.team_id = tm_assigned.team_id AND tm_mine.user_id = $2
            WHERE sma.story_id = us.id
          )
        )
      `, [storyId, userId]);

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await query(`
      SELECT t.*,
        COALESCE(
          json_agg(
            json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name)
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) as assignees,
        COALESCE(
          (SELECT json_agg(
            jsonb_build_object(
              'id', tcl.id,
              'change_type', tcl.change_type,
              'field_name', tcl.field_name,
              'old_value', tcl.old_value,
              'new_value', tcl.new_value,
              'created_at', tcl.created_at,
              'changed_by_name', ub.first_name || ' ' || ub.last_name
            ) ORDER BY tcl.created_at ASC
          )
          FROM task_change_logs tcl
          LEFT JOIN users ub ON ub.id = tcl.changed_by
          WHERE tcl.task_id = t.id),
          '[]'
        ) AS activity_logs
      FROM tasks t
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN users u ON u.id = ta.user_id
      WHERE t.user_story_id = $1
      GROUP BY t.id
      ORDER BY t.created_at ASC
    `, [storyId]);
    res.json({ tasks: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tasks' });
  }
};

const createTask = async (req, res) => {
  try {
    const { title, description, assignee_ids, start_date, due_date } = req.body;
    const { storyId } = req.params;

    if (!title?.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const result = await query(
      `INSERT INTO tasks (user_story_id, title, description, created_by, start_date, due_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [storyId, title.trim(), description || null, req.user.id, start_date || null, due_date || null]
    );

    const taskId = result.rows[0].id;

    // Log creation
    await logTaskChange(taskId, req.user.id, 'created', null, null, null);

    // Insert assignees
    if (Array.isArray(assignee_ids) && assignee_ids.length > 0) {
      for (const userId of assignee_ids) {
        await query(
          'INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [taskId, userId]
        );
      }
      // Notify assignees
      try {
        const storyTitle = await query('SELECT title FROM user_stories WHERE id=$1', [storyId]);
        const sTitle = storyTitle.rows[0]?.title || 'a story';
        for (const userId of assignee_ids) {
          if (userId !== req.user.id) {
            await createNotification(userId, 'Task Assigned', `You have been assigned to "${title.trim()}" on story "${sTitle}"`, 'task_assigned');
          }
        }
      } catch (err) {
        console.error('Failed to send task assigned notifications:', err.message);
      }
    }

    // Return task with assignees and empty activity_logs
    const taskWithAssignees = await query(`
      SELECT t.*,
        COALESCE(
          json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name))
          FILTER (WHERE u.id IS NOT NULL), '[]'
        ) as assignees,
        COALESCE(
          (SELECT json_agg(jsonb_build_object(
            'id', tcl.id, 'change_type', tcl.change_type,
            'field_name', tcl.field_name, 'old_value', tcl.old_value,
            'new_value', tcl.new_value, 'created_at', tcl.created_at,
            'changed_by_name', ub.first_name || ' ' || ub.last_name
          ) ORDER BY tcl.created_at ASC)
          FROM task_change_logs tcl
          LEFT JOIN users ub ON ub.id = tcl.changed_by
          WHERE tcl.task_id = t.id),
          '[]'
        ) AS activity_logs
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
    const { title, description, status, assignee_ids, start_date, due_date, response_details } = req.body;

    // Fetch current state for change logging
    const current = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    const currentTask = current.rows[0];

    const updates = [];
    const values = [];
    let idx = 1;

    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`); values.push(status);
      updates.push(`completed_at = ${status === 'done' ? 'NOW()' : 'NULL'}`);
      if (status !== 'done') {
        updates.push(`response_details = NULL`);
      }
    }
    if (start_date !== undefined) { updates.push(`start_date = $${idx++}`); values.push(start_date || null); }
    if (due_date !== undefined) { updates.push(`due_date = $${idx++}`); values.push(due_date || null); }
    if (status === 'done' && response_details !== undefined) { updates.push(`response_details = $${idx++}`); values.push(response_details || null); }
    else if (status === undefined && response_details !== undefined) { updates.push(`response_details = $${idx++}`); values.push(response_details || null); }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${idx}`, values);

    // Log changes
    if (currentTask) {
      const changedBy = req.user.id;
      if (title !== undefined && title !== currentTask.title) {
        await logTaskChange(id, changedBy, 'update', 'Title', currentTask.title, title);
      }
      if (status !== undefined && status !== currentTask.status) {
        const changeType = status === 'done' ? 'completed' : 'reopened';
        await logTaskChange(id, changedBy, changeType, 'Status',
          currentTask.status === 'done' ? 'Completed' : 'Open',
          status === 'done' ? 'Completed' : 'Open'
        );
      }
      if (start_date !== undefined) {
        const oldV = currentTask.start_date ? currentTask.start_date.toISOString().slice(0, 10) : null;
        if (oldV !== (start_date || null)) {
          await logTaskChange(id, changedBy, 'update', 'Start Date', oldV || 'None', start_date || 'None');
        }
      }
      if (due_date !== undefined) {
        const oldV = currentTask.due_date ? currentTask.due_date.toISOString().slice(0, 10) : null;
        if (oldV !== (due_date || null)) {
          await logTaskChange(id, changedBy, 'update', 'Due Date', oldV || 'None', due_date || 'None');
        }
      }
    }

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

    // Notify story creator when task is completed
    if (status === 'done' && currentTask && currentTask.status !== 'done') {
      try {
        const storyInfo = await query('SELECT title, created_by FROM user_stories WHERE id=(SELECT user_story_id FROM tasks WHERE id=$1)', [id]);
        if (storyInfo.rows.length && storyInfo.rows[0].created_by && storyInfo.rows[0].created_by !== req.user.id) {
          await createNotification(storyInfo.rows[0].created_by, 'Task Completed', `Task "${currentTask.title}" was marked complete`, 'task_completed');
        }
      } catch (err) {
        console.error('Failed to send task completed notification:', err.message);
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

// ── My Tasks ──────────────────────────────────────────────────────────────────

const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = ['system_admin', 'super_admin'].includes(req.user.role_name);
    const assigneeFilter = req.query.assignee_id;
    const filterUserId = assigneeFilter || (isAdmin ? null : userId);

    // --- Story tasks ---
    let storyWhereClause = '';
    let storyParams = [];
    if (assigneeFilter === 'none') {
      storyWhereClause = 'WHERE t.id NOT IN (SELECT task_id FROM task_assignees)';
    } else if (!isAdmin) {
      storyWhereClause = 'WHERE t.id IN (SELECT task_id FROM task_assignees WHERE user_id = $1)';
      storyParams = [userId];
    } else if (filterUserId) {
      storyWhereClause = 'WHERE t.id IN (SELECT task_id FROM task_assignees WHERE user_id = $1)';
      storyParams = [filterUserId];
    }

    const storyResult = await query(`
      SELECT
        t.id, t.title, t.description, t.status, t.start_date, t.due_date, t.completed_at,
        t.created_at, t.updated_at, t.response_details,
        'story' AS task_type,
        us.id AS story_id, us.title AS story_title,
        NULL::uuid AS prospect_id, NULL::text AS prospect_title,
        cb.first_name || ' ' || cb.last_name AS created_by_name,
        COALESCE(
          (SELECT json_agg(jsonb_build_object('id', u2.id, 'name', u2.first_name || ' ' || u2.last_name))
           FROM task_assignees ta2 JOIN users u2 ON u2.id = ta2.user_id WHERE ta2.task_id = t.id),
          '[]'
        ) AS assignees
      FROM tasks t
      JOIN user_stories us ON us.id = t.user_story_id
      LEFT JOIN users cb ON cb.id = t.created_by
      ${storyWhereClause}
    `, storyParams);

    // --- Prospect tasks ---
    let prospectWhereClause = '';
    let prospectParams = [];
    if (assigneeFilter === 'none') {
      prospectWhereClause = 'WHERE pt.id NOT IN (SELECT task_id FROM prospect_task_assignees)';
    } else if (!isAdmin) {
      prospectWhereClause = 'WHERE pt.id IN (SELECT task_id FROM prospect_task_assignees WHERE user_id = $1)';
      prospectParams = [userId];
    } else if (filterUserId) {
      prospectWhereClause = 'WHERE pt.id IN (SELECT task_id FROM prospect_task_assignees WHERE user_id = $1)';
      prospectParams = [filterUserId];
    }

    const prospectResult = await query(`
      SELECT
        pt.id, pt.title, pt.description, pt.status, pt.start_date, pt.due_date, pt.completed_at,
        pt.created_at, pt.updated_at, pt.response_details,
        'prospect' AS task_type,
        NULL::uuid AS story_id, NULL::text AS story_title,
        pp.id AS prospect_id, pp.title AS prospect_title,
        cb.first_name || ' ' || cb.last_name AS created_by_name,
        COALESCE(
          (SELECT json_agg(jsonb_build_object('id', u2.id, 'name', u2.first_name || ' ' || u2.last_name))
           FROM prospect_task_assignees pta2 JOIN users u2 ON u2.id = pta2.user_id WHERE pta2.task_id = pt.id),
          '[]'
        ) AS assignees
      FROM prospect_tasks pt
      JOIN probable_prospects pp ON pp.id = pt.prospect_id
      LEFT JOIN users cb ON cb.id = pt.created_by
      ${prospectWhereClause}
    `, prospectParams);

    const allTasks = [...storyResult.rows, ...prospectResult.rows].sort((a, b) => {
      if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    res.json({ tasks: allTasks });
  } catch (error) {
    console.error('getMyTasks error:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
};

// ── Assignable Users for a Story ──────────────────────────────────────────────

const getStoryAssignableUsers = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if story has team assignments
    const teamAssignments = await query(
      'SELECT team_id FROM story_team_assignments WHERE story_id=$1', [id]
    );

    if (teamAssignments.rows.length > 0) {
      // Get all members from assigned teams (including managers)
      const teamIds = teamAssignments.rows.map(r => r.team_id);
      const members = await query(`
        SELECT DISTINCT u.id, u.first_name, u.last_name, r.name as role_name
        FROM team_members tm
        JOIN users u ON u.id = tm.user_id
        JOIN roles r ON r.id = u.role_id
        WHERE tm.team_id = ANY($1::int[]) AND u.is_active = true
      `, [teamIds]);
      return res.json({ users: members.rows });
    }

    // Check individual member assignments
    const memberAssignments = await query(
      'SELECT user_id FROM story_member_assignments WHERE story_id=$1', [id]
    );

    if (memberAssignments.rows.length > 0) {
      const userIds = memberAssignments.rows.map(r => r.user_id);
      const members = await query(`
        SELECT u.id, u.first_name, u.last_name, r.name as role_name
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = ANY($1::uuid[]) AND u.is_active = true
      `, [userIds]);
      return res.json({ users: members.rows });
    }

    // Fall back to all assignable users (including system_admin)
    const allUsers = await query(`
      SELECT u.id, u.first_name, u.last_name, r.name as role_name
      FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.name IN ('system_admin', 'pre_sales_manager', 'pre_sales_executive') AND u.is_active = true
      ORDER BY u.first_name, u.last_name
    `);
    res.json({ users: allUsers.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get assignable users' });
  }
};

// ── Comments ───────────────────────────────────────────────────────────────────

const addComment = async (req, res) => {
  try {
    const { content } = req.body;
    const storyId = req.params.storyId;
    const result = await query(
      `INSERT INTO story_comments (user_story_id, user_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [storyId, req.user.id, content]
    );
    res.status(201).json({ comment: result.rows[0] });

    // Notify other story members (fire-and-forget)
    try {
      const storyMembers = await query(`
        SELECT DISTINCT u.id FROM users u
        JOIN story_member_assignments sma ON sma.user_id = u.id
        WHERE sma.story_id = $1 AND u.id != $2
      `, [storyId, req.user.id]);
      const storyTitle = await query('SELECT title FROM user_stories WHERE id=$1', [storyId]);
      const sTitle = storyTitle.rows[0]?.title || '';
      for (const member of storyMembers.rows) {
        await createNotification(member.id, 'New Comment', `New comment on story "${sTitle}"`, 'comment');
      }
    } catch (err) {
      console.error('Failed to send comment notifications:', err.message);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

module.exports = {
  getAllStories, getStoryById, createStory, updateStory, moveStory, deleteStory,
  getTasksByStory, createTask, updateTask, deleteTask, getMyTasks, addComment,
  getStoryAssignableUsers
};
