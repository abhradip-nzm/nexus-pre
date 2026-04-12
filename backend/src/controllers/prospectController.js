const { query } = require('../config/database');
const { createNotificationForAdmins } = require('../utils/notifications');

const getProspects = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role_name;
    const isAdmin = ['system_admin', 'super_admin'].includes(role);

    // Pagination params
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    // Filter params
    const dateFrom     = req.query.date_from    || '';
    const dateTo       = req.query.date_to      || '';
    const asd          = req.query.asd          || '';   // sales_director_id
    const tasksFilter  = req.query.tasks_filter || '';

    const conditions = ['pp.promoted_at IS NULL'];
    const params = [];
    let idx = 1;

    if (!isAdmin) {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM prospect_team_assignments pta
          JOIN team_members tm ON tm.team_id = pta.team_id
          WHERE pta.prospect_id = pp.id AND tm.user_id = $${idx}
        )
        OR EXISTS (
          SELECT 1 FROM prospect_member_assignments pma
          WHERE pma.prospect_id = pp.id AND pma.user_id = $${idx}
        )
      )`);
      params.push(userId);
      idx++;
    }

    if (dateFrom) {
      conditions.push(`pp.created_at >= $${idx}::date`);
      params.push(dateFrom);
      idx++;
    }
    if (dateTo) {
      conditions.push(`pp.created_at < ($${idx}::date + INTERVAL '1 day')`);
      params.push(dateTo);
      idx++;
    }
    if (asd === 'none') {
      conditions.push(`pp.sales_director_id IS NULL`);
    } else if (asd) {
      conditions.push(`pp.sales_director_id = $${idx}`);
      params.push(parseInt(asd, 10));
      idx++;
    }
    if (tasksFilter === 'has_tasks') {
      conditions.push(`(SELECT COUNT(*) FROM prospect_tasks WHERE prospect_id = pp.id) > 0`);
    } else if (tasksFilter === 'no_tasks') {
      conditions.push(`(SELECT COUNT(*) FROM prospect_tasks WHERE prospect_id = pp.id) = 0`);
    } else if (tasksFilter === 'has_incomplete') {
      conditions.push(`(SELECT COUNT(*) FROM prospect_tasks WHERE prospect_id = pp.id AND status != 'done') > 0`);
    } else if (tasksFilter === 'all_complete') {
      conditions.push(`(SELECT COUNT(*) FROM prospect_tasks WHERE prospect_id = pp.id) > 0`);
      conditions.push(`(SELECT COUNT(*) FROM prospect_tasks WHERE prospect_id = pp.id AND status != 'done') = 0`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Count total matching rows
    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM probable_prospects pp ${whereClause}`,
      params
    );
    const total      = countResult.rows[0].total;
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch page data
    const dataParams = [...params, limit, offset];
    const result = await query(`
      SELECT pp.*,
        i.name as industry_name,
        u.first_name || ' ' || u.last_name as created_by_name,
        bt.name as sales_director_name,
        (SELECT COUNT(*)::int FROM prospect_tasks pt WHERE pt.prospect_id = pp.id) as total_tasks_count,
        (SELECT COUNT(*)::int FROM prospect_tasks pt WHERE pt.prospect_id = pp.id AND pt.status = 'done') as completed_tasks_count,
        COALESCE((
          SELECT json_agg(json_build_object('industry_id', pia.industry_id, 'industry_name', ind.name))
          FROM prospect_industry_assignments pia
          JOIN industries ind ON ind.id = pia.industry_id
          WHERE pia.prospect_id = pp.id
        ), '[]') as industry_assignments,
        COALESCE((
          SELECT json_agg(json_build_object('team_id', pta.team_id, 'team_name', t.name, 'accent_color', t.accent_color))
          FROM prospect_team_assignments pta
          JOIN teams t ON t.id = pta.team_id
          WHERE pta.prospect_id = pp.id
        ), '[]') as team_assignments,
        COALESCE((
          SELECT json_agg(json_build_object('user_id', pma.user_id, 'name', mu.first_name || ' ' || mu.last_name))
          FROM prospect_member_assignments pma
          JOIN users mu ON mu.id = pma.user_id
          WHERE pma.prospect_id = pp.id
        ), '[]') as member_assignments,
        COALESCE((
          SELECT json_agg(pt.tag_name)
          FROM prospect_tags pt
          WHERE pt.prospect_id = pp.id
        ), '[]') as tags
      FROM probable_prospects pp
      LEFT JOIN industries i ON i.id = pp.industry_id
      LEFT JOIN users u ON u.id = pp.created_by
      LEFT JOIN business_team bt ON bt.id = pp.sales_director_id
      ${whereClause}
      ORDER BY pp.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, dataParams);

    res.json({
      prospects: result.rows,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch prospects' });
  }
};

const createProspect = async (req, res) => {
  try {
    const { title, company_name, contact_name, contact_email, contact_phone, source, priority, notes, estimated_value, industry_ids, team_ids, member_ids, tags, country, sales_director_id } = req.body;
    const result = await query(`
      INSERT INTO probable_prospects (title, company_name, contact_name, contact_email, contact_phone, source, priority, notes, estimated_value, created_by, country, sales_director_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [title, company_name, contact_name, contact_email, contact_phone, source, priority || 'medium', notes, estimated_value || null, req.user.id, country || null, sales_director_id || null]);
    const prospect = result.rows[0];
    const id = prospect.id;

    // Industry assignments
    if (Array.isArray(industry_ids)) {
      for (const iid of industry_ids) {
        await query('INSERT INTO prospect_industry_assignments (prospect_id, industry_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, iid]);
      }
    }
    // Team assignments
    if (Array.isArray(team_ids)) {
      for (const tid of team_ids) {
        await query('INSERT INTO prospect_team_assignments (prospect_id, team_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, tid]);
      }
    }
    // Member assignments
    if (Array.isArray(member_ids)) {
      for (const uid of member_ids) {
        await query('INSERT INTO prospect_member_assignments (prospect_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, uid]);
      }
    }
    // Tags
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (tag.trim()) await query('INSERT INTO prospect_tags (prospect_id, tag_name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, tag.trim().toLowerCase()]);
      }
    }

    res.json(prospect);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create prospect' });
  }
};

const updateProspect = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, company_name, contact_name, contact_email, contact_phone, source, priority, notes, estimated_value, industry_ids, team_ids, member_ids, tags, country, sales_director_id } = req.body;
    const result = await query(`
      UPDATE probable_prospects SET
        title=$1, company_name=$2, contact_name=$3, contact_email=$4, contact_phone=$5,
        source=$6, priority=$7, notes=$8, estimated_value=$9, updated_at=NOW(), country=$10,
        sales_director_id=$11
      WHERE id=$12 RETURNING *
    `, [title, company_name, contact_name, contact_email, contact_phone, source, priority || 'medium', notes, estimated_value || null, country || null, sales_director_id || null, id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    // Replace industry assignments
    if (Array.isArray(industry_ids)) {
      await query('DELETE FROM prospect_industry_assignments WHERE prospect_id=$1', [id]);
      for (const iid of industry_ids) {
        await query('INSERT INTO prospect_industry_assignments (prospect_id, industry_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, iid]);
      }
    }
    // Replace team assignments
    if (Array.isArray(team_ids)) {
      await query('DELETE FROM prospect_team_assignments WHERE prospect_id=$1', [id]);
      for (const tid of team_ids) {
        await query('INSERT INTO prospect_team_assignments (prospect_id, team_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, tid]);
      }
    }
    // Replace member assignments
    if (Array.isArray(member_ids)) {
      await query('DELETE FROM prospect_member_assignments WHERE prospect_id=$1', [id]);
      for (const uid of member_ids) {
        await query('INSERT INTO prospect_member_assignments (prospect_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, uid]);
      }
    }
    // Replace tags
    if (Array.isArray(tags)) {
      await query('DELETE FROM prospect_tags WHERE prospect_id=$1', [id]);
      for (const tag of tags) {
        if (tag.trim()) await query('INSERT INTO prospect_tags (prospect_id, tag_name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, tag.trim().toLowerCase()]);
      }
    }

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

    const colResult = await query('SELECT id FROM kanban_columns ORDER BY position ASC LIMIT 1');
    if (!colResult.rows.length) return res.status(400).json({ error: 'No kanban columns configured' });
    const columnId = colResult.rows[0].id;

    const posResult = await query('SELECT COALESCE(MAX(position), 0) as max_pos FROM user_stories WHERE column_id = $1', [columnId]);
    const position = parseFloat(posResult.rows[0].max_pos) + 1000;

    const storyResult = await query(`
      INSERT INTO user_stories (title, client_name, client_company, client_email, client_phone, source, priority, description, estimated_value, column_id, created_by, position, country)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
    `, [p.title, p.contact_name, p.company_name, p.contact_email, p.contact_phone, p.source, p.priority, p.notes, p.estimated_value, columnId, req.user.id, position, p.country]);

    const story = storyResult.rows[0];

    // Copy industry assignments from prospect to story
    const prospectIndustries = await query('SELECT industry_id FROM prospect_industry_assignments WHERE prospect_id=$1', [id]);
    for (const row of prospectIndustries.rows) {
      await query('INSERT INTO story_industries (story_id, industry_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [story.id, row.industry_id]);
    }

    // Copy team assignments
    const prospectTeams = await query('SELECT team_id FROM prospect_team_assignments WHERE prospect_id=$1', [id]);
    for (const row of prospectTeams.rows) {
      await query('INSERT INTO story_team_assignments (story_id, team_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [story.id, row.team_id]);
    }

    // Copy member assignments
    const prospectMembers = await query('SELECT user_id FROM prospect_member_assignments WHERE prospect_id=$1', [id]);
    for (const row of prospectMembers.rows) {
      await query('INSERT INTO story_member_assignments (story_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [story.id, row.user_id]);
    }

    await query('UPDATE probable_prospects SET promoted_at=NOW(), promoted_to_story_id=$1 WHERE id=$2', [story.id, id]);
    await createNotificationForAdmins('Prospect Promoted', `"${p.title}" was promoted to a story in the pipeline`, 'promoted');

    res.json({ success: true, story });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to promote prospect' });
  }
};

const getProspectTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT pt.*,
        COALESCE((
          SELECT json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name))
          FROM prospect_task_assignees pta
          JOIN users u ON u.id = pta.user_id
          WHERE pta.task_id = pt.id
        ), '[]') as assignees
      FROM prospect_tasks pt
      WHERE pt.prospect_id=$1
      ORDER BY pt.created_at ASC
    `, [id]);
    res.json({ tasks: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prospect tasks' });
  }
};

const createProspectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, start_date, due_date, assignee_ids } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    const result = await query(
      'INSERT INTO prospect_tasks (prospect_id, title, description, start_date, due_date, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [id, title.trim(), description || null, start_date || null, due_date || null, req.user.id]
    );
    const taskId = result.rows[0].id;
    if (Array.isArray(assignee_ids)) {
      for (const uid of assignee_ids) {
        await query('INSERT INTO prospect_task_assignees (task_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [taskId, uid]);
      }
    }
    const full = await query(`
      SELECT pt.*,
        COALESCE((
          SELECT json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name))
          FROM prospect_task_assignees pta
          JOIN users u ON u.id = pta.user_id
          WHERE pta.task_id = pt.id
        ), '[]') as assignees
      FROM prospect_tasks pt WHERE pt.id=$1
    `, [taskId]);
    res.status(201).json({ task: full.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create prospect task' });
  }
};

const updateProspectTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, status, start_date, due_date, response_details, assignee_ids } = req.body;
    const updates = [];
    const values = [];
    let idx = 1;
    if (title !== undefined) { updates.push(`title=$${idx++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description=$${idx++}`); values.push(description); }
    if (status !== undefined) {
      updates.push(`status=$${idx++}`); values.push(status);
      updates.push(`completed_at=${status === 'done' ? 'NOW()' : 'NULL'}`);
      if (status !== 'done') {
        updates.push(`response_details=NULL`);
      }
    }
    if (status === 'done' && response_details !== undefined) { updates.push(`response_details=$${idx++}`); values.push(response_details); }
    else if (status === undefined && response_details !== undefined) { updates.push(`response_details=$${idx++}`); values.push(response_details); }
    if (start_date !== undefined) { updates.push(`start_date=$${idx++}`); values.push(start_date || null); }
    if (due_date !== undefined) { updates.push(`due_date=$${idx++}`); values.push(due_date || null); }
    updates.push('updated_at=NOW()');
    values.push(taskId);
    const result = await query(`UPDATE prospect_tasks SET ${updates.join(',')} WHERE id=$${idx} RETURNING *`, values);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    if (assignee_ids !== undefined) {
      await query('DELETE FROM prospect_task_assignees WHERE task_id=$1', [taskId]);
      if (Array.isArray(assignee_ids)) {
        for (const uid of assignee_ids) {
          await query('INSERT INTO prospect_task_assignees (task_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [taskId, uid]);
        }
      }
    }

    const full = await query(`
      SELECT pt.*,
        COALESCE((
          SELECT json_agg(json_build_object('id', u.id, 'name', u.first_name || ' ' || u.last_name))
          FROM prospect_task_assignees pta
          JOIN users u ON u.id = pta.user_id
          WHERE pta.task_id = pt.id
        ), '[]') as assignees
      FROM prospect_tasks pt WHERE pt.id=$1
    `, [taskId]);
    res.json({ task: full.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update prospect task' });
  }
};

const deleteProspectTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    await query('DELETE FROM prospect_tasks WHERE id=$1', [taskId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete prospect task' });
  }
};

const getProspectAssignableUsers = async (req, res) => {
  try {
    const { id } = req.params;
    const teamAssignments = await query('SELECT team_id FROM prospect_team_assignments WHERE prospect_id=$1', [id]);
    if (teamAssignments.rows.length > 0) {
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
    const memberAssignments = await query('SELECT user_id FROM prospect_member_assignments WHERE prospect_id=$1', [id]);
    if (memberAssignments.rows.length > 0) {
      const userIds = memberAssignments.rows.map(r => r.user_id);
      const members = await query(`
        SELECT u.id, u.first_name, u.last_name, r.name as role_name
        FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.id = ANY($1::uuid[]) AND u.is_active = true
      `, [userIds]);
      return res.json({ users: members.rows });
    }
    const allUsers = await query(`
      SELECT u.id, u.first_name, u.last_name, r.name as role_name
      FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.name IN ('system_admin', 'pre_sales_manager', 'pre_sales_executive') AND u.is_active = true
      ORDER BY u.first_name, u.last_name
    `);
    res.json({ users: allUsers.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get assignable users' });
  }
};

module.exports = { getProspects, createProspect, updateProspect, deleteProspect, promoteProspect, getProspectTasks, createProspectTask, updateProspectTask, deleteProspectTask, getProspectAssignableUsers };
