const { query } = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role_name;
    const isAdmin = ['system_admin', 'super_admin'].includes(role);

    // ── Visibility filters (parameterized to avoid SQL injection) ──────────
    // For non-admins: only stories/prospects assigned to their team or directly
    let storyVisibility = '';
    let prospectVisibility = '';
    let baseParams = [];

    if (!isAdmin) {
      storyVisibility = `AND (
        EXISTS (
          SELECT 1 FROM story_team_assignments sta
          JOIN team_members tm ON tm.team_id = sta.team_id
          WHERE sta.story_id = us.id AND tm.user_id = $1
        )
        OR EXISTS (
          SELECT 1 FROM story_member_assignments sma
          WHERE sma.story_id = us.id AND sma.user_id = $1
        )
      )`;
      prospectVisibility = `AND (
        EXISTS (
          SELECT 1 FROM prospect_team_assignments pta
          JOIN team_members tm ON tm.team_id = pta.team_id
          WHERE pta.prospect_id = pp.id AND tm.user_id = $1
        )
        OR EXISTS (
          SELECT 1 FROM prospect_member_assignments pma
          WHERE pma.prospect_id = pp.id AND pma.user_id = $1
        )
      )`;
      baseParams = [userId];
    }

    // ── 1. Story counts & value ────────────────────────────────────────────
    const storyStats = await query(`
      SELECT
        COUNT(DISTINCT us.id) AS total_stories,
        COALESCE(SUM(us.estimated_value), 0) AS pipeline_value
      FROM user_stories us
      WHERE 1=1 ${storyVisibility}
    `, baseParams);

    // ── 2. Story task stats ────────────────────────────────────────────────
    const storyTaskStats = await query(`
      SELECT
        COUNT(t.id) AS total,
        COUNT(t.id) FILTER (WHERE t.status = 'done') AS completed,
        COUNT(t.id) FILTER (WHERE t.status != 'done' AND t.due_date < CURRENT_DATE) AS overdue,
        COUNT(t.id) FILTER (
          WHERE t.status != 'done'
          AND t.start_date IS NOT NULL
          AND t.start_date <= CURRENT_DATE
          AND (t.due_date IS NULL OR t.due_date >= CURRENT_DATE)
        ) AS in_progress,
        COUNT(t.id) FILTER (WHERE t.status != 'done' AND (t.start_date IS NULL OR t.start_date > CURRENT_DATE) AND (t.due_date IS NULL OR t.due_date >= CURRENT_DATE)) AS upcoming
      FROM tasks t
      JOIN user_stories us ON us.id = t.user_story_id
      WHERE 1=1 ${storyVisibility}
    `, baseParams);

    // ── 3. Prospect counts ─────────────────────────────────────────────────
    const prospectStats = await query(`
      SELECT COUNT(pp.id) AS total_prospects
      FROM probable_prospects pp
      WHERE pp.promoted_at IS NULL ${prospectVisibility}
    `, baseParams);

    // ── 4. Prospect task stats ─────────────────────────────────────────────
    const prospectTaskStats = await query(`
      SELECT
        COUNT(pt.id) AS total,
        COUNT(pt.id) FILTER (WHERE pt.status = 'done') AS completed,
        COUNT(pt.id) FILTER (WHERE pt.status != 'done' AND pt.due_date < CURRENT_DATE) AS overdue,
        COUNT(pt.id) FILTER (
          WHERE pt.status != 'done'
          AND pt.start_date IS NOT NULL
          AND pt.start_date <= CURRENT_DATE
          AND (pt.due_date IS NULL OR pt.due_date >= CURRENT_DATE)
        ) AS in_progress,
        COUNT(pt.id) FILTER (WHERE pt.status != 'done' AND (pt.start_date IS NULL OR pt.start_date > CURRENT_DATE) AND (pt.due_date IS NULL OR pt.due_date >= CURRENT_DATE)) AS upcoming
      FROM prospect_tasks pt
      JOIN probable_prospects pp ON pp.id = pt.prospect_id
      WHERE pp.promoted_at IS NULL ${prospectVisibility}
    `, baseParams);

    // ── 5. Pipeline distribution (stories by column) ───────────────────────
    const pipelineResult = await query(`
      SELECT kc.name, kc.color, kc.position,
        COUNT(DISTINCT us.id) AS count,
        COALESCE(SUM(us.estimated_value), 0) AS value
      FROM kanban_columns kc
      LEFT JOIN user_stories us ON us.column_id = kc.id
      ${!isAdmin ? `AND us.id IN (
        SELECT us2.id FROM user_stories us2 WHERE EXISTS (
          SELECT 1 FROM story_team_assignments sta JOIN team_members tm ON tm.team_id = sta.team_id
          WHERE sta.story_id = us2.id AND tm.user_id = $1
        ) OR EXISTS (
          SELECT 1 FROM story_member_assignments sma WHERE sma.story_id = us2.id AND sma.user_id = $1
        )
      )` : ''}
      GROUP BY kc.id, kc.name, kc.color, kc.position
      ORDER BY kc.position
    `, isAdmin ? [] : [userId]);

    // ── 6. Story priority distribution ────────────────────────────────────
    const storyPriority = await query(`
      SELECT us.priority, COUNT(*) AS count
      FROM user_stories us
      WHERE 1=1 ${storyVisibility}
      GROUP BY us.priority
    `, baseParams);

    // ── 7. Prospect priority distribution ─────────────────────────────────
    const prospectPriority = await query(`
      SELECT pp.priority, COUNT(*) AS count
      FROM probable_prospects pp
      WHERE pp.promoted_at IS NULL ${prospectVisibility}
      GROUP BY pp.priority
    `, baseParams);

    // ── 8. Per-user task breakdown (all roles but filtered data) ──────────
    let userBreakdown = [];
    const userBreakdownResult = await query(`
      SELECT
        u.id,
        u.first_name || ' ' || u.last_name AS name,
        r.name AS role_name,
        COUNT(DISTINCT ta.task_id) AS story_tasks,
        COUNT(DISTINCT ta.task_id) FILTER (WHERE t.status != 'done' AND t.due_date < CURRENT_DATE) AS story_overdue,
        COUNT(DISTINCT pta.task_id) AS prospect_tasks,
        COUNT(DISTINCT pta.task_id) FILTER (WHERE pt.status != 'done' AND pt.due_date < CURRENT_DATE) AS prospect_overdue
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN task_assignees ta ON ta.user_id = u.id
      LEFT JOIN tasks t ON t.id = ta.task_id
      LEFT JOIN prospect_task_assignees pta ON pta.user_id = u.id
      LEFT JOIN prospect_tasks pt ON pt.id = pta.task_id
      WHERE r.name IN ('pre_sales_manager', 'pre_sales_executive')
        AND u.is_active = true
        ${!isAdmin ? `AND (
          EXISTS (
            SELECT 1 FROM team_members tm1
            WHERE tm1.user_id = u.id
            AND EXISTS (
              SELECT 1 FROM story_team_assignments sta JOIN team_members tm2 ON tm2.team_id = sta.team_id
              WHERE tm2.user_id = $1 AND tm1.team_id = sta.team_id
            )
          )
          OR EXISTS (
            SELECT 1 FROM story_member_assignments sma WHERE sma.user_id = $1
            AND u.id = $1
          )
        )` : ''}
      GROUP BY u.id, u.first_name, u.last_name, r.name
      ORDER BY (COUNT(DISTINCT ta.task_id) + COUNT(DISTINCT pta.task_id)) DESC
    `, isAdmin ? [] : [userId]);
    userBreakdown = userBreakdownResult.rows;

    // ── 9. Per-team breakdown ──────────────────────────────────────────────
    let teamBreakdown = [];
    const teamBreakdownResult = await query(`
      SELECT
        tm_t.id, tm_t.name, tm_t.accent_color,
        COUNT(DISTINCT sta.story_id) AS story_count,
        COUNT(DISTINCT pta.prospect_id) AS prospect_count,
        COUNT(DISTINCT t.id) AS task_count
      FROM teams tm_t
      LEFT JOIN story_team_assignments sta ON sta.team_id = tm_t.id
      LEFT JOIN prospect_team_assignments pta ON pta.team_id = tm_t.id
      LEFT JOIN tasks t ON t.user_story_id = sta.story_id
      ${!isAdmin ? `WHERE EXISTS (
        SELECT 1 FROM team_members tm WHERE tm.team_id = tm_t.id AND tm.user_id = $1
      )` : ''}
      GROUP BY tm_t.id, tm_t.name, tm_t.accent_color
      ORDER BY (COUNT(DISTINCT sta.story_id) + COUNT(DISTINCT pta.prospect_id)) DESC
    `, isAdmin ? [] : [userId]);
    teamBreakdown = teamBreakdownResult.rows;

    // ── 10. Monthly story creation trend (last 6 months) ──────────────────
    const trendResult = await query(`
      SELECT TO_CHAR(DATE_TRUNC('month', us.created_at), 'Mon YY') AS month,
        COUNT(*) AS stories,
        COALESCE(SUM(us.estimated_value), 0) AS value
      FROM user_stories us
      WHERE us.created_at >= NOW() - INTERVAL '6 months'
      ${storyVisibility}
      GROUP BY DATE_TRUNC('month', us.created_at)
      ORDER BY DATE_TRUNC('month', us.created_at)
    `, baseParams);

    // ── 11. Recent activity ────────────────────────────────────────────────
    const activityResult = await query(`
      SELECT scl.change_type, scl.created_at,
        u.first_name || ' ' || u.last_name AS user_name,
        us.title AS story_title, us.id AS story_id
      FROM story_change_logs scl
      JOIN users u ON scl.changed_by = u.id
      JOIN user_stories us ON scl.user_story_id = us.id
      WHERE 1=1 ${storyVisibility.replace('us.id', 'us.id')}
      ORDER BY scl.created_at DESC LIMIT 8
    `, baseParams);

    // ── 12. Task completion rate by user (last 30 days) ───────────────────
    const taskCompletionResult = await query(`
      SELECT
        u.first_name || ' ' || u.last_name AS name,
        COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.completed_at >= NOW() - INTERVAL '30 days') AS completed_30d,
        COUNT(t.id) AS total_assigned
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN task_assignees ta ON ta.user_id = u.id
      LEFT JOIN tasks t ON t.id = ta.task_id
      WHERE r.name IN ('pre_sales_manager', 'pre_sales_executive') AND u.is_active = true
      GROUP BY u.id, u.first_name, u.last_name
      HAVING COUNT(t.id) > 0
      ORDER BY completed_30d DESC LIMIT 8
    `);

    res.json({
      storyStats: storyStats.rows[0],
      storyTaskStats: storyTaskStats.rows[0],
      prospectStats: prospectStats.rows[0],
      prospectTaskStats: prospectTaskStats.rows[0],
      pipeline: pipelineResult.rows,
      storyPriority: storyPriority.rows,
      prospectPriority: prospectPriority.rows,
      userBreakdown,
      teamBreakdown,
      trend: trendResult.rows,
      recentActivity: activityResult.rows,
      taskCompletion: taskCompletionResult.rows,
      role,
      isAdmin,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
};

module.exports = { getDashboardStats };
