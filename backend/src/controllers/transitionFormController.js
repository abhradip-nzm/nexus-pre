const { query } = require('../config/database');

// ─── Admin: List all forms ───────────────────────────────────────────────────

const getForms = async (req, res) => {
  try {
    const result = await query(`
      SELECT tf.*,
        fc_from.name AS from_column_name,
        fc_to.name AS to_column_name,
        COUNT(tff.id) AS field_count
      FROM transition_forms tf
      LEFT JOIN kanban_columns fc_from ON fc_from.id = tf.from_column_id
      LEFT JOIN kanban_columns fc_to ON fc_to.id = tf.to_column_id
      LEFT JOIN transition_form_fields tff ON tff.form_id = tf.id
      GROUP BY tf.id, fc_from.name, fc_to.name
      ORDER BY tf.created_at DESC
    `);
    res.json({ forms: result.rows });
  } catch (error) {
    console.error('getForms error:', error);
    res.status(500).json({ error: 'Failed to fetch transition forms' });
  }
};

// ─── Admin: Create a form ────────────────────────────────────────────────────

const createForm = async (req, res) => {
  try {
    const { name, from_column_id, to_column_id, is_mandatory } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const result = await query(
      `INSERT INTO transition_forms (name, from_column_id, to_column_id, is_mandatory)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, from_column_id || null, to_column_id || null, is_mandatory || false]
    );
    res.status(201).json({ form: result.rows[0] });
  } catch (error) {
    console.error('createForm error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A form already exists for this column transition' });
    }
    res.status(500).json({ error: 'Failed to create transition form' });
  }
};

// ─── Admin: Update a form ────────────────────────────────────────────────────

const updateForm = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, is_mandatory, is_active } = req.body;
    const result = await query(
      `UPDATE transition_forms
       SET name = COALESCE($1, name),
           is_mandatory = COALESCE($2, is_mandatory),
           is_active = COALESCE($3, is_active)
       WHERE id = $4
       RETURNING *`,
      [name, is_mandatory, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.json({ form: result.rows[0] });
  } catch (error) {
    console.error('updateForm error:', error);
    res.status(500).json({ error: 'Failed to update transition form' });
  }
};

// ─── Admin: Delete a form ────────────────────────────────────────────────────

const deleteForm = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      'DELETE FROM transition_forms WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.json({ message: 'Form deleted successfully' });
  } catch (error) {
    console.error('deleteForm error:', error);
    res.status(500).json({ error: 'Failed to delete transition form' });
  }
};

// ─── Admin: Get fields for a form ────────────────────────────────────────────

const getFormFields = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT * FROM transition_form_fields
       WHERE form_id = $1
       ORDER BY position ASC, id ASC`,
      [id]
    );
    res.json({ fields: result.rows });
  } catch (error) {
    console.error('getFormFields error:', error);
    res.status(500).json({ error: 'Failed to fetch form fields' });
  }
};

// ─── Admin: Add a field to a form ────────────────────────────────────────────

const addField = async (req, res) => {
  try {
    const { id } = req.params;
    const { field_type, label, placeholder, is_required, options, position } = req.body;
    if (!field_type || !label) {
      return res.status(400).json({ error: 'field_type and label are required' });
    }
    const result = await query(
      `INSERT INTO transition_form_fields
         (form_id, field_type, label, placeholder, is_required, options, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        field_type,
        label,
        placeholder || '',
        is_required || false,
        options ? JSON.stringify(options) : '[]',
        position || 0
      ]
    );
    res.status(201).json({ field: result.rows[0] });
  } catch (error) {
    console.error('addField error:', error);
    res.status(500).json({ error: 'Failed to add field' });
  }
};

// ─── Admin: Update a field ───────────────────────────────────────────────────

const updateField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { field_type, label, placeholder, is_required, options, position } = req.body;
    const result = await query(
      `UPDATE transition_form_fields
       SET field_type  = COALESCE($1, field_type),
           label       = COALESCE($2, label),
           placeholder = COALESCE($3, placeholder),
           is_required = COALESCE($4, is_required),
           options     = COALESCE($5, options),
           position    = COALESCE($6, position)
       WHERE id = $7
       RETURNING *`,
      [
        field_type,
        label,
        placeholder,
        is_required,
        options !== undefined ? JSON.stringify(options) : undefined,
        position,
        fieldId
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }
    res.json({ field: result.rows[0] });
  } catch (error) {
    console.error('updateField error:', error);
    res.status(500).json({ error: 'Failed to update field' });
  }
};

// ─── Admin: Delete a field ───────────────────────────────────────────────────

const deleteField = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const result = await query(
      'DELETE FROM transition_form_fields WHERE id = $1 RETURNING id',
      [fieldId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Field not found' });
    }
    res.json({ message: 'Field deleted successfully' });
  } catch (error) {
    console.error('deleteField error:', error);
    res.status(500).json({ error: 'Failed to delete field' });
  }
};

// ─── Admin: Reorder fields ───────────────────────────────────────────────────

const reorderFields = async (req, res) => {
  try {
    const { id } = req.params;
    const { fields } = req.body; // [{ id, position }]
    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ error: 'fields array is required' });
    }
    // Update each field's position in a single transaction using multiple queries
    for (const field of fields) {
      await query(
        'UPDATE transition_form_fields SET position = $1 WHERE id = $2 AND form_id = $3',
        [field.position, field.id, id]
      );
    }
    const result = await query(
      `SELECT * FROM transition_form_fields WHERE form_id = $1 ORDER BY position ASC, id ASC`,
      [id]
    );
    res.json({ fields: result.rows });
  } catch (error) {
    console.error('reorderFields error:', error);
    res.status(500).json({ error: 'Failed to reorder fields' });
  }
};

// ─── User: Get form for a specific transition ────────────────────────────────

const getFormForTransition = async (req, res) => {
  try {
    const { from_column_id, to_column_id } = req.query;
    if (!from_column_id || !to_column_id) {
      return res.status(400).json({ error: 'from_column_id and to_column_id are required' });
    }
    const formResult = await query(
      `SELECT * FROM transition_forms
       WHERE from_column_id = $1
         AND to_column_id = $2
         AND is_active = true
       LIMIT 1`,
      [from_column_id, to_column_id]
    );
    if (formResult.rows.length === 0) {
      return res.json({ form: null });
    }
    const form = formResult.rows[0];
    const fieldsResult = await query(
      `SELECT * FROM transition_form_fields
       WHERE form_id = $1
       ORDER BY position ASC, id ASC`,
      [form.id]
    );
    form.fields = fieldsResult.rows;
    res.json({ form });
  } catch (error) {
    console.error('getFormForTransition error:', error);
    res.status(500).json({ error: 'Failed to fetch transition form' });
  }
};

// ─── User: Submit a form response ────────────────────────────────────────────

const submitFormResponse = async (req, res) => {
  try {
    const { id } = req.params; // form_id
    const {
      story_id,
      from_column_id,
      to_column_id,
      from_column_name,
      to_column_name,
      responses
    } = req.body;

    if (!story_id) {
      return res.status(400).json({ error: 'story_id is required' });
    }

    const submitted_by = req.user.id;

    // Insert the top-level response record
    const responseResult = await query(
      `INSERT INTO transition_form_responses
         (form_id, story_id, submitted_by, from_column_id, to_column_id, from_column_name, to_column_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, story_id, submitted_by, from_column_id || null, to_column_id || null, from_column_name || null, to_column_name || null]
    );
    const formResponse = responseResult.rows[0];

    // Insert individual field responses
    if (Array.isArray(responses) && responses.length > 0) {
      for (const r of responses) {
        await query(
          `INSERT INTO transition_form_field_responses
             (response_id, field_id, field_label, field_type, value)
           VALUES ($1, $2, $3, $4, $5)`,
          [formResponse.id, r.field_id || null, r.field_label || null, r.field_type || null, r.value || null]
        );
      }
    }

    res.status(201).json({ response: formResponse });
  } catch (error) {
    console.error('submitFormResponse error:', error);
    res.status(500).json({ error: 'Failed to submit form response' });
  }
};

// ─── User: Get all form responses for a story ────────────────────────────────

const getStoryFormResponses = async (req, res) => {
  try {
    const { storyId } = req.params;

    const responsesResult = await query(
      `SELECT
         tfr.id,
         tfr.form_id,
         tfr.submitted_at,
         tfr.from_column_name,
         tfr.to_column_name,
         (u.first_name || ' ' || u.last_name) AS submitted_by_name
       FROM transition_form_responses tfr
       LEFT JOIN users u ON u.id = tfr.submitted_by
       WHERE tfr.story_id = $1
       ORDER BY tfr.submitted_at DESC`,
      [storyId]
    );

    const responses = responsesResult.rows;

    // Fetch field responses for each form response
    for (const response of responses) {
      const fieldResponsesResult = await query(
        `SELECT
           field_id,
           field_label,
           field_type,
           value
         FROM transition_form_field_responses
         WHERE response_id = $1
         ORDER BY id ASC`,
        [response.id]
      );
      response.field_responses = fieldResponsesResult.rows;
    }

    res.json({ responses });
  } catch (error) {
    console.error('getStoryFormResponses error:', error);
    res.status(500).json({ error: 'Failed to fetch story form responses' });
  }
};

module.exports = {
  getForms,
  createForm,
  updateForm,
  deleteForm,
  getFormFields,
  addField,
  updateField,
  deleteField,
  reorderFields,
  getFormForTransition,
  submitFormResponse,
  getStoryFormResponses
};
