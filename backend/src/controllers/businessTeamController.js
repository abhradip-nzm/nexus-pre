const { query } = require('../config/database');

// Role hierarchy map: what parent role is required for each role
const PARENT_ROLE = {
  cgo: null,
  asd: 'cgo',
  sales_manager: 'asd',
  sales_executive: 'sales_manager',
};

const ROLE_LABELS = {
  cgo: 'Chief Growth Officer',
  asd: 'Associate Sales Director',
  sales_manager: 'Sales Manager',
  sales_executive: 'Sales Executive',
};

// GET /api/business-team — flat list with parent info
async function getAll(req, res) {
  try {
    const result = await query(`
      SELECT
        bt.id, bt.name, bt.phone, bt.email, bt.role,
        bt.parent_id, bt.is_individual_contributor, bt.created_at, bt.updated_at,
        p.name AS parent_name, p.role AS parent_role
      FROM business_team bt
      LEFT JOIN business_team p ON p.id = bt.parent_id
      ORDER BY
        CASE bt.role
          WHEN 'cgo' THEN 1
          WHEN 'asd' THEN 2
          WHEN 'sales_manager' THEN 3
          WHEN 'sales_executive' THEN 4
        END,
        bt.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('businessTeam getAll error:', err);
    res.status(500).json({ error: 'Failed to fetch business team' });
  }
}

// GET /api/business-team/tree — nested tree structure
async function getTree(req, res) {
  try {
    const result = await query(`
      SELECT id, name, phone, email, role, parent_id, is_individual_contributor
      FROM business_team
      ORDER BY
        CASE role
          WHEN 'cgo' THEN 1
          WHEN 'asd' THEN 2
          WHEN 'sales_manager' THEN 3
          WHEN 'sales_executive' THEN 4
        END,
        name
    `);

    const nodes = result.rows;
    const map = {};
    nodes.forEach(n => { map[n.id] = { ...n, children: [] }; });

    const roots = [];
    nodes.forEach(n => {
      if (n.parent_id && map[n.parent_id]) {
        map[n.parent_id].children.push(map[n.id]);
      } else {
        roots.push(map[n.id]);
      }
    });

    res.json(roots);
  } catch (err) {
    console.error('businessTeam getTree error:', err);
    res.status(500).json({ error: 'Failed to build team tree' });
  }
}

// POST /api/business-team
async function create(req, res) {
  try {
    const { name, phone, email, role, parent_id, is_individual_contributor } = req.body;
    const isIC = role === 'sales_manager' && !!is_individual_contributor;

    if (!name || !phone || !email || !role) {
      return res.status(400).json({ error: 'Name, phone, email and role are required' });
    }

    if (!ROLE_LABELS[role]) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // CGO must be unique
    if (role === 'cgo') {
      const existing = await query(`SELECT id FROM business_team WHERE role = 'cgo'`);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'A Chief Growth Officer already exists. Only one CGO is allowed.' });
      }
      if (parent_id) {
        return res.status(400).json({ error: 'Chief Growth Officer cannot have a parent' });
      }
    }

    // Individual-contributor Sales Managers report to CGO; otherwise use normal hierarchy
    const requiredParentRole = isIC ? 'cgo' : PARENT_ROLE[role];
    if (requiredParentRole) {
      if (!parent_id) {
        return res.status(400).json({
          error: `${ROLE_LABELS[role]} must have a ${ROLE_LABELS[requiredParentRole]} as parent`
        });
      }
      const parent = await query(`SELECT id, role FROM business_team WHERE id = $1`, [parent_id]);
      if (parent.rows.length === 0) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.rows[0].role !== requiredParentRole) {
        return res.status(400).json({
          error: `${ROLE_LABELS[role]} must report to a ${ROLE_LABELS[requiredParentRole]}`
        });
      }
    }

    // Check email uniqueness
    const emailCheck = await query(`SELECT id FROM business_team WHERE LOWER(email) = LOWER($1)`, [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists in business team' });
    }

    const result = await query(
      `INSERT INTO business_team (name, phone, email, role, parent_id, is_individual_contributor)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name.trim(), phone.trim(), email.toLowerCase().trim(), role, parent_id || null, isIC]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('businessTeam create error:', err);
    res.status(500).json({ error: 'Failed to create team member' });
  }
}

// PUT /api/business-team/:id
async function update(req, res) {
  try {
    const { id } = req.params;
    const { name, phone, email, role, parent_id, is_individual_contributor } = req.body;
    const isIC = role === 'sales_manager' && !!is_individual_contributor;

    if (!name || !phone || !email || !role) {
      return res.status(400).json({ error: 'Name, phone, email and role are required' });
    }

    if (!ROLE_LABELS[role]) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const existing = await query(`SELECT * FROM business_team WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    const current = existing.rows[0];

    // CGO uniqueness — if changing to CGO, ensure no other CGO exists
    if (role === 'cgo' && current.role !== 'cgo') {
      const cgoCheck = await query(`SELECT id FROM business_team WHERE role = 'cgo' AND id != $1`, [id]);
      if (cgoCheck.rows.length > 0) {
        return res.status(400).json({ error: 'A Chief Growth Officer already exists. Only one CGO is allowed.' });
      }
    }

    if (role === 'cgo' && parent_id) {
      return res.status(400).json({ error: 'Chief Growth Officer cannot have a parent' });
    }

    // Individual-contributor Sales Managers report to CGO; otherwise use normal hierarchy
    const requiredParentRole = isIC ? 'cgo' : PARENT_ROLE[role];
    if (requiredParentRole) {
      if (!parent_id) {
        return res.status(400).json({
          error: `${ROLE_LABELS[role]} must have a ${ROLE_LABELS[requiredParentRole]} as parent`
        });
      }

      // Prevent circular reference
      if (parseInt(parent_id) === parseInt(id)) {
        return res.status(400).json({ error: 'A member cannot be their own parent' });
      }

      const parent = await query(`SELECT id, role FROM business_team WHERE id = $1`, [parent_id]);
      if (parent.rows.length === 0) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parent.rows[0].role !== requiredParentRole) {
        return res.status(400).json({
          error: `${ROLE_LABELS[role]} must report to a ${ROLE_LABELS[requiredParentRole]}`
        });
      }
    }

    // Email uniqueness (excluding self)
    const emailCheck = await query(
      `SELECT id FROM business_team WHERE LOWER(email) = LOWER($1) AND id != $2`,
      [email, id]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email already exists in business team' });
    }

    // If role changed, validate that children are still valid
    if (current.role !== role) {
      const children = await query(`SELECT id, role FROM business_team WHERE parent_id = $1`, [id]);
      if (children.rows.length > 0) {
        for (const child of children.rows) {
          if (PARENT_ROLE[child.role] !== role) {
            return res.status(400).json({
              error: `Cannot change role: this member has children that require a ${ROLE_LABELS[PARENT_ROLE[child.role]]} as parent`
            });
          }
        }
      }
    }

    const result = await query(
      `UPDATE business_team
       SET name = $1, phone = $2, email = $3, role = $4, parent_id = $5,
           is_individual_contributor = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name.trim(), phone.trim(), email.toLowerCase().trim(), role, parent_id || null, isIC, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('businessTeam update error:', err);
    res.status(500).json({ error: 'Failed to update team member' });
  }
}

// DELETE /api/business-team/:id
async function remove(req, res) {
  try {
    const { id } = req.params;

    const existing = await query(`SELECT * FROM business_team WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Check for children
    const children = await query(`SELECT id FROM business_team WHERE parent_id = $1`, [id]);
    if (children.rows.length > 0) {
      return res.status(400).json({
        error: `Cannot delete: this member has ${children.rows.length} direct report(s). Reassign or remove them first.`
      });
    }

    await query(`DELETE FROM business_team WHERE id = $1`, [id]);
    res.json({ message: 'Team member deleted successfully' });
  } catch (err) {
    console.error('businessTeam delete error:', err);
    res.status(500).json({ error: 'Failed to delete team member' });
  }
}

module.exports = { getAll, getTree, create, update, remove };
