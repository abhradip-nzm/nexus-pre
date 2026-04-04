const { query } = require('../config/database');

const getSettings = async (req, res) => {
  try {
    const result = await query('SELECT key, value, description FROM app_settings ORDER BY key');
    const settings = result.rows.reduce((acc, row) => {
      acc[row.key] = { value: row.value, description: row.description };
      return acc;
    }, {});
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get settings' });
  }
};

const updateSettings = async (req, res) => {
  try {
    if (req.user.role_name !== 'system_admin') {
      return res.status(403).json({ error: 'Only system admins can update settings' });
    }

    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await query(
        `UPDATE app_settings SET value = $1, updated_by = $2, updated_at = NOW() WHERE key = $3`,
        [String(value), req.user.id, key]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

// WhatsApp webhook handler
const whatsappWebhook = async (req, res) => {
  try {
    // Verify webhook
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
      }
      return res.status(403).json({ error: 'Verification failed' });
    }

    // Process incoming message
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          const value = change.value;
          if (value.messages) {
            for (const message of value.messages) {
              await processWhatsAppMessage(message, value);
            }
          }
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

const processWhatsAppMessage = async (message, value) => {
  try {
    const content = message.text?.body || '';
    const senderId = message.from;
    const groupId = value.metadata?.phone_number_id;

    // Check if this group is monitored
    const settingsResult = await query(
      'SELECT value FROM app_settings WHERE key = $1',
      ['whatsapp_group_ids']
    );
    const monitoredGroups = JSON.parse(settingsResult.rows[0]?.value || '[]');

    if (!monitoredGroups.includes(groupId)) return;

    // Find if any manager was tagged
    const mentionRegex = /@(\+?[\d\s-]+)/g;
    const mentions = content.match(mentionRegex);

    if (!mentions) return;

    for (const mention of mentions) {
      const phoneNumber = mention.replace('@', '').trim();
      const userResult = await query(
        'SELECT id, first_name, last_name FROM users WHERE whatsapp_number = $1',
        [phoneNumber]
      );

      if (userResult.rows.length > 0) {
        const taggedUser = userResult.rows[0];

        // Save the WhatsApp message
        await query(
          `INSERT INTO whatsapp_messages 
           (wa_message_id, group_id, sender_number, content, tagged_user_id, processed)
           VALUES ($1, $2, $3, $4, $5, false)
           ON CONFLICT (wa_message_id) DO NOTHING`,
          [message.id, groupId, senderId, content, taggedUser.id]
        );

        // Auto-create user story
        const firstColumn = await query(
          'SELECT id FROM kanban_columns ORDER BY position LIMIT 1'
        );

        if (firstColumn.rows.length > 0) {
          const posResult = await query(
            'SELECT COALESCE(MAX(position), 0) as max_pos FROM user_stories WHERE column_id = $1',
            [firstColumn.rows[0].id]
          );

          const storyResult = await query(
            `INSERT INTO user_stories 
             (title, description, column_id, assigned_to, source, whatsapp_thread_id, position)
             VALUES ($1, $2, $3, $4, 'whatsapp', $5, $6) RETURNING id`,
            [
              `WhatsApp Lead - ${new Date().toLocaleDateString()}`,
              content,
              firstColumn.rows[0].id,
              taggedUser.id,
              message.id,
              parseFloat(posResult.rows[0].max_pos) + 1000
            ]
          );

          // Update WhatsApp message with story id
          await query(
            'UPDATE whatsapp_messages SET user_story_id = $1, processed = true WHERE wa_message_id = $2',
            [storyResult.rows[0].id, message.id]
          );

          // Create notification
          await query(
            `INSERT INTO notifications (user_id, title, message, type, link)
             VALUES ($1, 'New WhatsApp Lead', $2, 'whatsapp', $3)`,
            [
              taggedUser.id,
              `You were tagged in a WhatsApp group. A new lead has been created.`,
              `/stories/${storyResult.rows[0].id}`
            ]
          );
        }
      }
    }
  } catch (error) {
    console.error('Process WhatsApp message error:', error);
  }
};

const getNotifications = async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.user.id]
    );
    res.json({ notifications: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get notifications' });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notifications' });
  }
};

module.exports = {
  getSettings, updateSettings, whatsappWebhook,
  getNotifications, markNotificationRead, markAllNotificationsRead
};
