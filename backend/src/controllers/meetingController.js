const { query } = require('../config/database');

const getMeetings = async (req, res) => {
  try {
    const { start, end, user_id } = req.query;
    let conditions = [];
    let values = [];
    let idx = 1;

    if (start) { conditions.push(`m.start_time >= $${idx++}`); values.push(start); }
    if (end) { conditions.push(`m.end_time <= $${idx++}`); values.push(end); }
    if (user_id) {
      conditions.push(`(m.organizer_id = $${idx} OR m.attendees @> $${idx+1}::jsonb)`);
      values.push(user_id, `[{"email": "${user_id}"}]`);
      idx += 2;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT m.*, 
              us.title as story_title, us.client_company,
              u.first_name || ' ' || u.last_name as organizer_name
       FROM meetings m
       LEFT JOIN user_stories us ON m.user_story_id = us.id
       LEFT JOIN users u ON m.organizer_id = u.id
       ${whereClause}
       ORDER BY m.start_time ASC`,
      values
    );

    res.json({ meetings: result.rows });
  } catch (error) {
    console.error('Get meetings error:', error);
    res.status(500).json({ error: 'Failed to get meetings' });
  }
};

const createMeeting = async (req, res) => {
  try {
    const {
      title, description, start_time, end_time, location,
      meeting_link, attendees, user_story_id, ms_teams_join_url
    } = req.body;

    const result = await query(
      `INSERT INTO meetings 
       (title, description, start_time, end_time, location, meeting_link, 
        attendees, user_story_id, organizer_id, ms_teams_join_url, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'manual') RETURNING *`,
      [title, description, start_time, end_time, location, meeting_link,
       JSON.stringify(attendees || []), user_story_id, req.user.id, ms_teams_join_url]
    );

    if (user_story_id) {
      await query(
        `INSERT INTO story_change_logs (user_story_id, changed_by, change_type, comment)
         VALUES ($1, $2, 'meeting_added', $3)`,
        [user_story_id, req.user.id, `Meeting "${title}" added`]
      );
    }

    res.status(201).json({ meeting: result.rows[0] });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
};

const updateMeeting = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, start_time, end_time, location, meeting_link, attendees, status } = req.body;

    await query(
      `UPDATE meetings SET 
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       start_time = COALESCE($3, start_time),
       end_time = COALESCE($4, end_time),
       location = COALESCE($5, location),
       meeting_link = COALESCE($6, meeting_link),
       attendees = COALESCE($7, attendees),
       status = COALESCE($8, status),
       updated_at = NOW()
       WHERE id = $9`,
      [title, description, start_time, end_time, location, meeting_link,
       attendees ? JSON.stringify(attendees) : null, status, id]
    );

    res.json({ message: 'Meeting updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update meeting' });
  }
};

const deleteMeeting = async (req, res) => {
  try {
    await query('DELETE FROM meetings WHERE id = $1', [req.params.id]);
    res.json({ message: 'Meeting deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
};

module.exports = { getMeetings, createMeeting, updateMeeting, deleteMeeting };
