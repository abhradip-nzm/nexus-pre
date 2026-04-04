const { query } = require('../config/database');

const getDashboardStats = async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const userId = req.user.id;
    const role = req.user.role_name;

    // For executives, filter to their assigned stories
    const userFilter = ['pre_sales_executive'].includes(role)
      ? `AND us.assigned_to = '${userId}'`
      : '';

    // Pipeline summary
    const pipelineResult = await query(
      `SELECT kc.name, kc.slug, kc.color, COUNT(us.id) as count, 
              COALESCE(SUM(us.estimated_value), 0) as total_value
       FROM kanban_columns kc
       LEFT JOIN user_stories us ON us.column_id = kc.id ${userFilter}
       GROUP BY kc.id, kc.name, kc.slug, kc.color
       ORDER BY kc.position`
    );

    // KPIs
    const kpiResult = await query(
      `SELECT 
        COUNT(DISTINCT us.id) as total_stories,
        COUNT(DISTINCT CASE WHEN kc.slug = 'client_onboarded' THEN us.id END) as won,
        COUNT(DISTINCT CASE WHEN kc.slug = 'closed_lost' THEN us.id END) as lost,
        COUNT(DISTINCT CASE WHEN kc.slug = 'dark_leads' THEN us.id END) as dark_leads,
        COUNT(DISTINCT CASE WHEN us.created_at >= NOW() - INTERVAL '${days} days' THEN us.id END) as new_this_period,
        COALESCE(SUM(CASE WHEN kc.slug = 'client_onboarded' THEN us.estimated_value END), 0) as won_value,
        COALESCE(SUM(us.estimated_value), 0) as pipeline_value,
        COUNT(DISTINCT m.id) FILTER (WHERE m.start_time >= NOW()) as upcoming_meetings,
        COUNT(DISTINCT m.id) FILTER (WHERE m.start_time >= CURRENT_DATE AND m.start_time < CURRENT_DATE + 1) as today_meetings
       FROM user_stories us
       LEFT JOIN kanban_columns kc ON us.column_id = kc.id
       LEFT JOIN meetings m ON m.user_story_id = us.id
       WHERE 1=1 ${userFilter.replace('AND ', 'AND ')}`
    );

    // Recent activity
    const activityResult = await query(
      `SELECT scl.*, 
              u.first_name || ' ' || u.last_name as user_name,
              us.title as story_title, us.id as story_id
       FROM story_change_logs scl
       JOIN users u ON scl.changed_by = u.id
       JOIN user_stories us ON scl.user_story_id = us.id
       ORDER BY scl.created_at DESC LIMIT 10`
    );

    // Upcoming meetings
    const upcomingMeetings = await query(
      `SELECT m.*, us.title as story_title, us.client_company,
              u.first_name || ' ' || u.last_name as organizer_name
       FROM meetings m
       LEFT JOIN user_stories us ON m.user_story_id = us.id
       LEFT JOIN users u ON m.organizer_id = u.id
       WHERE m.start_time >= NOW() AND m.start_time <= NOW() + INTERVAL '7 days'
       ORDER BY m.start_time ASC LIMIT 5`
    );

    // Story trend (last 30 days)
    const trendResult = await query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM user_stories
       WHERE created_at >= NOW() - INTERVAL '30 days'
       ${userFilter.replace('AND us.', 'AND ')}
       GROUP BY DATE(created_at)
       ORDER BY date`
    );

    // Team performance (manager only)
    let teamPerformance = [];
    if (['pre_sales_manager', 'super_admin', 'system_admin'].includes(role)) {
      const teamResult = await query(
        `SELECT u.id, u.first_name || ' ' || u.last_name as name, u.avatar_url,
                COUNT(DISTINCT us.id) as total_stories,
                COUNT(DISTINCT CASE WHEN kc.slug = 'client_onboarded' THEN us.id END) as won,
                COALESCE(SUM(CASE WHEN kc.slug = 'client_onboarded' THEN us.estimated_value END), 0) as won_value
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN user_stories us ON us.assigned_to = u.id
         LEFT JOIN kanban_columns kc ON us.column_id = kc.id
         WHERE r.name = 'pre_sales_executive' AND u.is_active = true
         GROUP BY u.id ORDER BY won DESC LIMIT 5`
      );
      teamPerformance = teamResult.rows;
    }

    res.json({
      pipeline: pipelineResult.rows,
      kpis: kpiResult.rows[0] || {},
      recentActivity: activityResult.rows,
      upcomingMeetings: upcomingMeetings.rows,
      trend: trendResult.rows,
      teamPerformance,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
};

module.exports = { getDashboardStats };
