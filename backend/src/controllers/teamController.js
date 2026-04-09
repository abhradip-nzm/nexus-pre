const { query } = require('../config/database');

async function getMembersForTeam(teamId) {
  const res = await query(
    `SELECT u.id, u.first_name, u.last_name, u.email, r.name as role_name,
            CONCAT(u.first_name, ' ', u.last_name) as full_name
     FROM team_members tm
     JOIN users u ON u.id = tm.user_id
     JOIN roles r ON r.id = u.role_id
     WHERE tm.team_id = $1
     ORDER BY u.first_name`,
    [teamId]
  );
  return res.rows;
}

async function checkMemberExclusivity(memberIds, excludeTeamId = null) {
  // Returns array of conflicts: { user_name, team_name }
  if (!memberIds || memberIds.length === 0) return [];
  const placeholders = memberIds.map((_, i) => `$${i + 1}`).join(',');
  const params = [...memberIds];
  let sql = `
    SELECT u.first_name || ' ' || u.last_name AS user_name,
           t.name AS team_name, tm.user_id, r.name as role_name
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    JOIN teams t ON t.id = tm.team_id
    JOIN roles r ON r.id = u.role_id
    WHERE tm.user_id IN (${placeholders})
    AND r.name IN ('pre_sales_manager', 'pre_sales_executive')
  `;
  if (excludeTeamId) {
    params.push(excludeTeamId);
    sql += ` AND tm.team_id != $${params.length}`;
  }
  const res = await query(sql, params);
  return res.rows;
}

const getTeams = async (req, res) => {
  try {
    const teamsRes = await query('SELECT * FROM teams ORDER BY created_at DESC');
    const membersRes = await query(
      `SELECT tm.team_id, u.id, u.first_name, u.last_name, u.email, r.name as role_name,
              CONCAT(u.first_name, ' ', u.last_name) as full_name
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       JOIN roles r ON r.id = u.role_id
       ORDER BY u.first_name`
    );
    const teams = teamsRes.rows.map(t => ({
      ...t,
      members: membersRes.rows.filter(m => m.team_id === t.id),
    }));
    res.json({ teams });
  } catch (err) {
    console.error('getTeams error:', err);
    res.status(500).json({ error: 'Failed to get teams' });
  }
};

const createTeam = async (req, res) => {
  try {
    const { name, purpose, accent_color, manager_id, executive_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'Team name required' });

    // Combine all member IDs
    const memberIds = [];
    if (manager_id) memberIds.push(manager_id);
    if (Array.isArray(executive_ids)) memberIds.push(...executive_ids);

    // Check exclusivity
    const conflicts = await checkMemberExclusivity(memberIds);
    if (conflicts.length > 0) {
      const names = conflicts.map(c => `${c.user_name} (already in "${c.team_name}")`).join(', ');
      return res.status(400).json({ error: `Cannot add: ${names}` });
    }

    const result = await query(
      'INSERT INTO teams (name, purpose, accent_color) VALUES ($1, $2, $3) RETURNING *',
      [name, purpose || '', accent_color || '#3e72ae']
    );
    const team = result.rows[0];

    for (const uid of memberIds) {
      await query(
        'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [team.id, uid]
      );
    }

    const members = await getMembersForTeam(team.id);
    res.status(201).json({ team: { ...team, members } });
  } catch (err) {
    console.error('createTeam error:', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, purpose, accent_color, manager_id, executive_ids } = req.body;

    const existing = await query('SELECT id FROM teams WHERE id=$1', [id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Team not found' });

    // Combine all member IDs
    const memberIds = [];
    if (manager_id) memberIds.push(manager_id);
    if (Array.isArray(executive_ids)) memberIds.push(...executive_ids);

    // Check exclusivity (exclude current team)
    const conflicts = await checkMemberExclusivity(memberIds, parseInt(id));
    if (conflicts.length > 0) {
      const names = conflicts.map(c => `${c.user_name} (already in "${c.team_name}")`).join(', ');
      return res.status(400).json({ error: `Cannot add: ${names}` });
    }

    const result = await query(
      'UPDATE teams SET name=$1, purpose=$2, accent_color=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
      [name, purpose, accent_color, id]
    );

    // Replace all members
    await query('DELETE FROM team_members WHERE team_id=$1', [id]);
    for (const uid of memberIds) {
      await query(
        'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, uid]
      );
    }

    const members = await getMembersForTeam(id);
    res.json({ team: { ...result.rows[0], members } });
  } catch (err) {
    console.error('updateTeam error:', err);
    res.status(500).json({ error: 'Failed to update team' });
  }
};

const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM team_members WHERE team_id=$1', [id]);
    await query('DELETE FROM teams WHERE id=$1', [id]);
    res.json({ message: 'Team deleted' });
  } catch (err) {
    console.error('deleteTeam error:', err);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};

module.exports = { getTeams, createTeam, updateTeam, deleteTeam };
