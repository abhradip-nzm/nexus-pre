const { query } = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role_name;
    const isAdmin = ['system_admin', 'super_admin'].includes(role);

    // ── Date range params ──────────────────────────────────────────────────
    const from_date = req.query.from_date && req.query.from_date.trim() ? req.query.from_date.trim() : null;
    const to_date   = req.query.to_date   && req.query.to_date.trim()   ? req.query.to_date.trim()   : null;

    // ── Visibility filter SQL fragments (non-admin sees only assigned items) ──
    const storyVisibility = isAdmin ? '' : `AND (
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

    const prospectVisibility = isAdmin ? '' : `AND (
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

    // ── Helper: append date conditions using parameterized placeholders ──────
    const buildDateCond = (alias, basePLen) => {
      let cond = '';
      const extra = [];
      if (from_date) {
        extra.push(from_date);
        cond += ` AND ${alias}.created_at::date >= $${basePLen + extra.length}`;
      }
      if (to_date) {
        extra.push(to_date);
        cond += ` AND ${alias}.created_at::date <= $${basePLen + extra.length}`;
      }
      return { cond, extra };
    };

    const baseLen = isAdmin ? 0 : 1; // $1 = userId for non-admins

    const sd  = buildDateCond('us',  baseLen);
    const pd  = buildDateCond('pp',  baseLen);
    const acd = buildDateCond('scl', baseLen);

    const storyParams    = isAdmin ? [...sd.extra]  : [userId, ...sd.extra];
    const prospectParams = isAdmin ? [...pd.extra]  : [userId, ...pd.extra];
    const activityParams = isAdmin ? [...acd.extra] : [userId, ...acd.extra];

    // ── Pipeline date cond (separate base params) ──────────────────────────
    const pipelineBaseParams = isAdmin ? [] : [userId];
    const pipeDateCond = (() => {
      let c = ''; const extra = [];
      if (from_date) { extra.push(from_date); c += ` AND us.created_at::date >= $${pipelineBaseParams.length + extra.length}`; }
      if (to_date)   { extra.push(to_date);   c += ` AND us.created_at::date <= $${pipelineBaseParams.length + extra.length}`; }
      return { cond: c, extra };
    })();
    const pipelineParams = [...pipelineBaseParams, ...pipeDateCond.extra];

    // ── User-breakdown date cond ───────────────────────────────────────────
    const ubBaseParams = isAdmin ? [] : [userId];
    const ubDateCond = (() => {
      let c = ''; const extra = [];
      if (from_date) { extra.push(from_date); c += ` AND t.created_at::date >= $${ubBaseParams.length + extra.length}`; }
      if (to_date)   { extra.push(to_date);   c += ` AND t.created_at::date <= $${ubBaseParams.length + extra.length}`; }
      return { cond: c, extra };
    })();
    const ubParams = [...ubBaseParams, ...ubDateCond.extra];

    // ── Task-completion date cond ──────────────────────────────────────────
    const tcDateCond = (() => {
      let c = ''; const extra = [];
      if (from_date) { extra.push(from_date); c += ` AND t.completed_at::date >= $${extra.length}`; }
      if (to_date)   { extra.push(to_date);   c += ` AND t.completed_at::date <= $${extra.length}`; }
      return { cond: c, extra };
    })();
    const tcParams = tcDateCond.extra;
    const completedFilter = tcDateCond.cond
      ? `t.status = 'done' ${tcDateCond.cond}`
      : `t.status = 'done' AND t.completed_at >= NOW() - INTERVAL '30 days'`;

    // ── Trend query — parameterized (fixes SQL injection) ─────────────────
    let trendGroupSQL, trendFormatSQL;
    if (from_date && to_date) {
      const days = Math.ceil((new Date(to_date) - new Date(from_date)) / 86400000);
      if (days <= 31) {
        trendGroupSQL  = `DATE_TRUNC('day', us.created_at)`;
        trendFormatSQL = `TO_CHAR(DATE_TRUNC('day', us.created_at), 'Mon DD')`;
      } else if (days <= 90) {
        trendGroupSQL  = `DATE_TRUNC('week', us.created_at)`;
        trendFormatSQL = `TO_CHAR(DATE_TRUNC('week', us.created_at), 'Mon DD')`;
      } else {
        trendGroupSQL  = `DATE_TRUNC('month', us.created_at)`;
        trendFormatSQL = `TO_CHAR(DATE_TRUNC('month', us.created_at), 'Mon ''YY')`;
      }
    } else {
      trendGroupSQL  = `DATE_TRUNC('month', us.created_at)`;
      trendFormatSQL = `TO_CHAR(DATE_TRUNC('month', us.created_at), 'Mon ''YY')`;
    }

    // Build parameterized interval condition for trend (no string interpolation of user input)
    const trendBaseParams = isAdmin ? [] : [userId];
    const trendDateExtra = [];
    let trendIntervalCond;
    if (from_date && to_date) {
      trendDateExtra.push(from_date);
      trendDateExtra.push(to_date);
      const p1 = trendBaseParams.length + 1;
      const p2 = trendBaseParams.length + 2;
      trendIntervalCond = `us.created_at::date >= $${p1} AND us.created_at::date <= $${p2}`;
    } else if (from_date) {
      trendDateExtra.push(from_date);
      const p1 = trendBaseParams.length + 1;
      trendIntervalCond = `us.created_at::date >= $${p1}`;
    } else {
      trendIntervalCond = `us.created_at >= NOW() - INTERVAL '6 months'`;
    }
    const trendParams = [...trendBaseParams, ...trendDateExtra];

    // ── Run all 12 queries in parallel ────────────────────────────────────
    const [
      storyStatsResult,
      storyTaskResult,
      prospectStatsResult,
      prospectTaskResult,
      pipelineResult,
      storyPriorityResult,
      prospectPriorityResult,
      userBreakdownResult,
      teamBreakdownResult,
      trendResult,
      activityResult,
      taskCompletionResult,
    ] = await Promise.all([

      // 1. Story counts & pipeline value
      query(`
        SELECT
          COUNT(DISTINCT us.id)                AS total_stories,
          COALESCE(SUM(us.estimated_value), 0) AS pipeline_value
        FROM user_stories us
        WHERE 1=1 ${storyVisibility} ${sd.cond}
      `, storyParams),

      // 2. Story task stats
      query(`
        SELECT
          COUNT(t.id) AS total,
          COUNT(t.id) FILTER (WHERE t.status = 'done') AS completed,
          COUNT(t.id) FILTER (WHERE t.status != 'done' AND t.due_date < CURRENT_DATE) AS overdue,
          COUNT(t.id) FILTER (
            WHERE t.status != 'done'
            AND t.start_date IS NOT NULL AND t.start_date <= CURRENT_DATE
            AND (t.due_date IS NULL OR t.due_date >= CURRENT_DATE)
          ) AS in_progress,
          COUNT(t.id) FILTER (
            WHERE t.status != 'done'
            AND (t.start_date IS NULL OR t.start_date > CURRENT_DATE)
            AND (t.due_date IS NULL OR t.due_date >= CURRENT_DATE)
          ) AS upcoming
        FROM tasks t
        JOIN user_stories us ON us.id = t.user_story_id
        WHERE 1=1 ${storyVisibility} ${sd.cond}
      `, storyParams),

      // 3. Prospect counts
      query(`
        SELECT COUNT(pp.id) AS total_prospects
        FROM probable_prospects pp
        WHERE pp.promoted_at IS NULL ${prospectVisibility} ${pd.cond}
      `, prospectParams),

      // 4. Prospect task stats
      query(`
        SELECT
          COUNT(pt.id) AS total,
          COUNT(pt.id) FILTER (WHERE pt.status = 'done') AS completed,
          COUNT(pt.id) FILTER (WHERE pt.status != 'done' AND pt.due_date < CURRENT_DATE) AS overdue,
          COUNT(pt.id) FILTER (
            WHERE pt.status != 'done'
            AND pt.start_date IS NOT NULL AND pt.start_date <= CURRENT_DATE
            AND (pt.due_date IS NULL OR pt.due_date >= CURRENT_DATE)
          ) AS in_progress,
          COUNT(pt.id) FILTER (
            WHERE pt.status != 'done'
            AND (pt.start_date IS NULL OR pt.start_date > CURRENT_DATE)
            AND (pt.due_date IS NULL OR pt.due_date >= CURRENT_DATE)
          ) AS upcoming
        FROM prospect_tasks pt
        JOIN probable_prospects pp ON pp.id = pt.prospect_id
        WHERE pp.promoted_at IS NULL ${prospectVisibility} ${pd.cond}
      `, prospectParams),

      // 5. Pipeline distribution (stories by column)
      query(`
        SELECT kc.name, kc.color, kc.position,
          COUNT(DISTINCT us.id) AS count,
          COALESCE(SUM(us.estimated_value), 0) AS value
        FROM kanban_columns kc
        LEFT JOIN user_stories us ON us.column_id = kc.id
          ${pipeDateCond.cond ? `AND 1=1 ${pipeDateCond.cond}` : ''}
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
      `, pipelineParams),

      // 6. Story priority distribution
      query(`
        SELECT us.priority, COUNT(*) AS count
        FROM user_stories us
        WHERE 1=1 ${storyVisibility} ${sd.cond}
        GROUP BY us.priority
      `, storyParams),

      // 7. Prospect priority distribution
      query(`
        SELECT pp.priority, COUNT(*) AS count
        FROM probable_prospects pp
        WHERE pp.promoted_at IS NULL ${prospectVisibility} ${pd.cond}
        GROUP BY pp.priority
      `, prospectParams),

      // 8. Per-user task breakdown
      query(`
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
        LEFT JOIN tasks t ON t.id = ta.task_id ${ubDateCond.cond ? `AND 1=1 ${ubDateCond.cond}` : ''}
        LEFT JOIN prospect_task_assignees pta ON pta.user_id = u.id
        LEFT JOIN prospect_tasks pt ON pt.id = pta.task_id
        WHERE r.name IN ('pre_sales_manager', 'pre_sales_executive')
          AND u.is_active = true
          ${!isAdmin ? `AND (
            EXISTS (
              SELECT 1 FROM team_members tm1 WHERE tm1.user_id = u.id
              AND EXISTS (
                SELECT 1 FROM story_team_assignments sta JOIN team_members tm2 ON tm2.team_id = sta.team_id
                WHERE tm2.user_id = $1 AND tm1.team_id = sta.team_id
              )
            )
            OR EXISTS (SELECT 1 FROM story_member_assignments sma WHERE sma.user_id = $1 AND u.id = $1)
          )` : ''}
        GROUP BY u.id, u.first_name, u.last_name, r.name
        ORDER BY (COUNT(DISTINCT ta.task_id) + COUNT(DISTINCT pta.task_id)) DESC
      `, ubParams),

      // 9. Per-team breakdown
      query(`
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
      `, isAdmin ? [] : [userId]),

      // 10. Story creation trend (fully parameterized — no user-input interpolation)
      query(`
        SELECT ${trendFormatSQL} AS month,
          COUNT(*) AS stories,
          COALESCE(SUM(us.estimated_value), 0) AS value
        FROM user_stories us
        WHERE ${trendIntervalCond}
        ${storyVisibility}
        GROUP BY ${trendGroupSQL}
        ORDER BY ${trendGroupSQL}
      `, trendParams),

      // 11. Recent activity
      query(`
        SELECT scl.change_type, scl.created_at,
          u.first_name || ' ' || u.last_name AS user_name,
          us.title AS story_title, us.id AS story_id
        FROM story_change_logs scl
        JOIN users u ON scl.changed_by = u.id
        JOIN user_stories us ON scl.user_story_id = us.id
        WHERE 1=1 ${storyVisibility} ${acd.cond}
        ORDER BY scl.created_at DESC LIMIT 8
      `, activityParams),

      // 12. Task completion by user
      query(`
        SELECT
          u.first_name || ' ' || u.last_name AS name,
          COUNT(t.id) FILTER (WHERE ${completedFilter}) AS completed_30d,
          COUNT(t.id) AS total_assigned
        FROM users u
        JOIN roles r ON r.id = u.role_id
        LEFT JOIN task_assignees ta ON ta.user_id = u.id
        LEFT JOIN tasks t ON t.id = ta.task_id
        WHERE r.name IN ('pre_sales_manager', 'pre_sales_executive') AND u.is_active = true
        GROUP BY u.id, u.first_name, u.last_name
        HAVING COUNT(t.id) > 0
        ORDER BY completed_30d DESC LIMIT 8
      `, tcParams),

    ]);

    res.json({
      storyStats:        storyStatsResult.rows[0],
      storyTaskStats:    storyTaskResult.rows[0],
      prospectStats:     prospectStatsResult.rows[0],
      prospectTaskStats: prospectTaskResult.rows[0],
      pipeline:          pipelineResult.rows,
      storyPriority:     storyPriorityResult.rows,
      prospectPriority:  prospectPriorityResult.rows,
      userBreakdown:     userBreakdownResult.rows,
      teamBreakdown:     teamBreakdownResult.rows,
      trend:             trendResult.rows,
      recentActivity:    activityResult.rows,
      taskCompletion:    taskCompletionResult.rows,
      role,
      isAdmin,
      appliedFrom: from_date,
      appliedTo:   to_date,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
};

module.exports = { getDashboardStats };
