const { query } = require('../config/database');

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
    const { name, purpose, accent_color, member_ids } = req.body;
    if (!name) return res.status(400).json({ error: 'Team name required' });
    const result = await query(
      'INSERT INTO teams (name, purpose, accent_color) VALUES ($1, $2, $3) RETURNING *',
      [name, purpose || '', accent_color || '#3e72ae']
    );
    const team = result.rows[0];
    if (Array.isArray(member_ids)) {
      for (const uid of member_ids) {
        await query(
          'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [team.id, uid]
        );
      }
    }
    const membersRes = await query(
      `SELECT u.id, u.first_name, u.last_name, CONCAT(u.first_name, ' ', u.last_name) as full_name
       FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id=$1`,
      [team.id]
    );
    res.status(201).json({ team: { ...team, members: membersRes.rows } });
  } catch (err) {
    console.error('createTeam error:', err);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, purpose, accent_color, member_ids } = req.body;
    const result = await query(
      'UPDATE teams SET name=$1, purpose=$2, accent_color=$3 WHERE id=$4 RETURNING *',
      [name, purpose, accent_color, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Team not found' });
    if (Array.isArray(member_ids)) {
      await query('DELETE FROM team_members WHERE team_id=$1', [id]);
      for (const uid of member_ids) {
        await query('INSERT INTO team_members (team_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, uid]);
      }
    }
    const membersRes = await query(
      `SELECT u.id, u.first_name, u.last_name, CONCAT(u.first_name, ' ', u.last_name) as full_name
       FROM team_members tm JOIN users u ON u.id = tm.user_id WHERE tm.team_id=$1`,
      [id]
    );
    res.json({ team: { ...result.rows[0], members: membersRes.rows } });
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
