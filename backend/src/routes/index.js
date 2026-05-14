const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const { authenticate, requireSystemAdmin, requireAdmin, requireManager } = require('../middleware/auth');
const { uploadFile, ALLOWED_TYPES, MAX_SIZE_BYTES } = require('../utils/storage');
const { getAllAdhocTasks, createAdhocTask, updateAdhocTask, deleteAdhocTask } = require('../controllers/adhocTaskController');
const {
  getAllPipelines, getPipeline, createPipeline, updatePipeline, deletePipeline,
  getPipelineLeads, createLead, updateLead, deleteLead,
  addLeadUpdate, deleteLeadUpdate,
  getPipelineAnalytics,
} = require('../controllers/pipelineController');
const {
  createShare, getShares, deactivateShare,
  getLeadAudit, getPipelineAudit,
  getSharedPipeline, updateSharedLead, addSharedLeadUpdate,
  getSharedPipelineAudit,
} = require('../controllers/pipelineShareController');

// Multer — memory storage, 10 MB limit, allowed types only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

// File upload endpoint — returns { url, key }
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    const folder = req.body.folder || 'uploads';
    const { url, key } = await uploadFile(
      req.file.buffer,
      folder,
      req.file.originalname,
      req.file.mimetype
    );
    res.json({ url, key });
  } catch (err) {
    console.error('[Upload]', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Auth
const { login, getMe, changePassword } = require('../controllers/authController');
router.post('/auth/login', login);
router.get('/auth/me', authenticate, getMe);
router.put('/auth/change-password', authenticate, changePassword);

// Users
const {
  getAllUsers, getUserById, createUser, updateUser,
  resetPassword, updatePermissions, getUserKPIs, getRoles, getAssignableUsers
} = require('../controllers/userController');
router.get('/users', authenticate, requireManager, getAllUsers);
router.get('/users/roles', authenticate, getRoles);
router.get('/users/assignable', authenticate, getAssignableUsers);
router.get('/users/:id', authenticate, getUserById);
router.post('/users', authenticate, requireSystemAdmin, createUser);
router.put('/users/:id', authenticate, updateUser);
router.post('/users/:id/reset-password', authenticate, requireSystemAdmin, resetPassword);
router.put('/users/:id/permissions', authenticate, requireSystemAdmin, updatePermissions);
router.get('/users/:id/kpis', authenticate, getUserKPIs);

// Dashboard
const { getDashboardStats } = require('../controllers/dashboardController');
router.get('/dashboard', authenticate, getDashboardStats);

// Kanban
const { getColumns, createSubStage, updateSubStage, deleteSubStage, updateColumnOrder, createColumn, updateColumn, deleteColumn } = require('../controllers/kanbanController');
router.get('/kanban/columns', authenticate, getColumns);
router.put('/kanban/columns/order', authenticate, requireManager, updateColumnOrder);
router.post('/kanban/sub-stages', authenticate, requireManager, createSubStage);
router.put('/kanban/sub-stages/:id', authenticate, requireManager, updateSubStage);
router.delete('/kanban/sub-stages/:id', authenticate, requireManager, deleteSubStage);

// Stories
const {
  getAllStories, getStoryById, createStory, updateStory, moveStory, deleteStory,
  getTasksByStory, createTask, updateTask, deleteTask, getMyTasks, addComment,
  getStoryAssignableUsers
} = require('../controllers/storyController');
router.get('/stories', authenticate, getAllStories);
router.post('/stories', authenticate, requireAdmin, createStory);
router.get('/stories/:id', authenticate, getStoryById);
router.put('/stories/:id', authenticate, updateStory);
router.patch('/stories/:id/move', authenticate, moveStory);
router.delete('/stories/:id', authenticate, requireManager, deleteStory);
router.get('/stories/:id/assignable-users', authenticate, getStoryAssignableUsers);

// Tasks
router.get('/stories/:storyId/tasks', authenticate, getTasksByStory);
router.post('/stories/:storyId/tasks', authenticate, createTask);
router.put('/tasks/:id', authenticate, updateTask);
router.delete('/tasks/:id', authenticate, deleteTask);

// My Tasks
router.get('/tasks/my', authenticate, getMyTasks);

// Comments
router.post('/stories/:storyId/comments', authenticate, addComment);

// Meetings
const { getMeetings, createMeeting, updateMeeting, deleteMeeting } = require('../controllers/meetingController');
router.get('/meetings', authenticate, getMeetings);
router.post('/meetings', authenticate, createMeeting);
router.put('/meetings/:id', authenticate, updateMeeting);
router.delete('/meetings/:id', authenticate, deleteMeeting);

// Settings & Integrations
const {
  getSettings, updateSettings, whatsappWebhook,
  getNotifications, getAllNotifications, markNotificationRead, markAllNotificationsRead
} = require('../controllers/settingsController');
router.get('/settings', authenticate, getSettings);
router.put('/settings', authenticate, updateSettings);
router.get('/notifications/all', authenticate, getAllNotifications);
router.get('/notifications', authenticate, getNotifications);
router.put('/notifications/read-all', authenticate, markAllNotificationsRead);
router.put('/notifications/:id/read', authenticate, markNotificationRead);

// WhatsApp webhook (no auth - verified by token)
router.get('/webhooks/whatsapp', whatsappWebhook);
router.post('/webhooks/whatsapp', whatsappWebhook);

// Seed admin (only usable once)
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
router.post('/setup/init', async (req, res) => {
  try {
    const existing = await query(
      "SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'system_admin') LIMIT 1"
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'System already initialized' });
    }

    const { email, password, first_name, last_name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    let roleResult = await query("SELECT id FROM roles WHERE name = 'system_admin'");

    // If roles haven't been seeded yet, seed them now
    if (roleResult.rows.length === 0) {
      console.log('[Setup] Roles table empty — seeding default roles...');
      await query(`
        INSERT INTO roles (name, display_name, description) VALUES
          ('system_admin',       'System Admin',         'Full system access'),
          ('pre_sales_manager',  'Pre-Sales Manager',    'Manages pre-sales team and stories'),
          ('pre_sales_executive','Pre-Sales Executive',  'Handles pre-sales stories and tasks'),
          ('viewer',             'Viewer',               'Read-only access')
        ON CONFLICT (name) DO NOTHING
      `);
      roleResult = await query("SELECT id FROM roles WHERE name = 'system_admin'");
    }

    if (roleResult.rows.length === 0) {
      console.error('[Setup] Failed to find or create system_admin role');
      return res.status(500).json({ error: 'Could not seed roles — check database migrations' });
    }

    const hash = await bcrypt.hash(password, 12);

    await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [email.toLowerCase(), hash, first_name || 'System', last_name || 'Admin', roleResult.rows[0].id]
    );

    res.json({ message: 'System admin created successfully' });
  } catch (error) {
    console.error('[Setup] Init error:', error);
    res.status(500).json({ error: 'Setup failed', detail: error.message });
  }
});

// Roles & Access Controls
const { getRoles: getRolesList, getRoleAccessControls, createRole, updateRole, deleteRole, updateRoleAccessControls, getUserAccessOverrides, updateUserAccessOverride } = require('../controllers/roleController');
router.get('/roles', authenticate, requireSystemAdmin, getRolesList);
router.post('/roles', authenticate, requireSystemAdmin, createRole);
router.put('/roles/:id', authenticate, requireSystemAdmin, updateRole);
router.delete('/roles/:id', authenticate, requireSystemAdmin, deleteRole);
router.get('/roles/:id/access-controls', authenticate, requireSystemAdmin, getRoleAccessControls);
router.put('/roles/:id/access-controls', authenticate, requireSystemAdmin, updateRoleAccessControls);
router.get('/users/:id/access-overrides', authenticate, requireSystemAdmin, getUserAccessOverrides);
router.put('/users/:id/access-overrides', authenticate, requireSystemAdmin, updateUserAccessOverride);

// Teams
const { getTeams, createTeam, updateTeam, deleteTeam } = require('../controllers/teamController');
router.get('/teams', authenticate, getTeams);
router.post('/teams', authenticate, requireSystemAdmin, createTeam);
router.put('/teams/:id', authenticate, requireSystemAdmin, updateTeam);
router.delete('/teams/:id', authenticate, requireSystemAdmin, deleteTeam);

// Kanban Column Admin
router.post('/kanban/columns', authenticate, requireSystemAdmin, createColumn);
router.put('/kanban/columns/:id', authenticate, requireSystemAdmin, updateColumn);
router.delete('/kanban/columns/:id', authenticate, requireSystemAdmin, deleteColumn);

// Tags
const { getTags, createTag, updateTag, deleteTag } = require('../controllers/tagsController');
router.get('/tags', authenticate, getTags);
router.post('/tags', authenticate, requireSystemAdmin, createTag);
router.put('/tags/:id', authenticate, requireSystemAdmin, updateTag);
router.delete('/tags/:id', authenticate, requireSystemAdmin, deleteTag);

// Industries
const { getIndustries, createIndustry, updateIndustry, deleteIndustry } = require('../controllers/industriesController');
router.get('/industries', authenticate, getIndustries);
router.post('/industries', authenticate, requireSystemAdmin, createIndustry);
router.put('/industries/:id', authenticate, requireSystemAdmin, updateIndustry);
router.delete('/industries/:id', authenticate, requireSystemAdmin, deleteIndustry);

// Business Team
const { getAll: getBizTeam, getTree: getBizTree, create: createBizMember, update: updateBizMember, remove: deleteBizMember } = require('../controllers/businessTeamController');
router.get('/business-team', authenticate, getBizTeam);
router.get('/business-team/tree', authenticate, getBizTree);
router.post('/business-team', authenticate, requireSystemAdmin, createBizMember);
router.put('/business-team/:id', authenticate, requireSystemAdmin, updateBizMember);
router.delete('/business-team/:id', authenticate, requireSystemAdmin, deleteBizMember);

// Probable Prospects
const { getProspects, createProspect, updateProspect, deleteProspect, promoteProspect, getProspectTasks, createProspectTask, updateProspectTask, deleteProspectTask, getProspectAssignableUsers } = require('../controllers/prospectController');
router.get('/prospects', authenticate, getProspects);
router.post('/prospects', authenticate, requireAdmin, createProspect);
router.put('/prospects/:id', authenticate, updateProspect);
router.delete('/prospects/:id', authenticate, deleteProspect);
router.post('/prospects/:id/promote', authenticate, promoteProspect);
router.get('/prospects/:id/tasks', authenticate, getProspectTasks);
router.post('/prospects/:id/tasks', authenticate, createProspectTask);
router.put('/prospect-tasks/:taskId', authenticate, updateProspectTask);
router.delete('/prospect-tasks/:taskId', authenticate, deleteProspectTask);
router.get('/prospects/:id/assignable-users', authenticate, getProspectAssignableUsers);

// Transition Forms (Admin management)
const { getForms, createForm, updateForm, deleteForm, getFormFields, addField, updateField, deleteField, reorderFields, getFormForTransition, submitFormResponse, getStoryFormResponses } = require('../controllers/transitionFormController');
router.get('/transition-forms/for-transition', authenticate, getFormForTransition);
router.get('/transition-forms', authenticate, requireAdmin, getForms);
router.post('/transition-forms', authenticate, requireAdmin, createForm);
router.put('/transition-forms/fields/:fieldId', authenticate, requireAdmin, updateField);
router.delete('/transition-forms/fields/:fieldId', authenticate, requireAdmin, deleteField);
router.put('/transition-forms/:id', authenticate, requireAdmin, updateForm);
router.delete('/transition-forms/:id', authenticate, requireAdmin, deleteForm);
router.get('/transition-forms/:id/fields', authenticate, requireAdmin, getFormFields);
router.post('/transition-forms/:id/fields', authenticate, requireAdmin, addField);
router.put('/transition-forms/:id/fields/reorder', authenticate, requireAdmin, reorderFields);
router.post('/transition-forms/:id/responses', authenticate, submitFormResponse);
router.get('/stories/:storyId/form-responses', authenticate, getStoryFormResponses);

// ── Public share routes (no auth) ────────────────────────────────────────────
router.get('/public/pipeline-share/:token',                        getSharedPipeline);
router.get('/public/pipeline-share/:token/audit',                  getSharedPipelineAudit);
router.put('/public/pipeline-share/:token/leads/:leadId',          updateSharedLead);
router.post('/public/pipeline-share/:token/leads/:leadId/updates', addSharedLeadUpdate);

// Pipelines (system_admin only)
router.get('/pipelines',                          authenticate, requireSystemAdmin, getAllPipelines);
router.get('/pipelines/:id',                      authenticate, requireSystemAdmin, getPipeline);
router.post('/pipelines',                         authenticate, requireSystemAdmin, createPipeline);
router.put('/pipelines/:id',                      authenticate, requireSystemAdmin, updatePipeline);
router.delete('/pipelines/:id',                   authenticate, requireSystemAdmin, deletePipeline);
router.get('/pipelines/:id/leads',                authenticate, requireSystemAdmin, getPipelineLeads);
router.post('/pipelines/:id/leads',               authenticate, requireSystemAdmin, createLead);
router.put('/pipeline-leads/:leadId',             authenticate, requireSystemAdmin, updateLead);
router.delete('/pipeline-leads/:leadId',          authenticate, requireSystemAdmin, deleteLead);
router.post('/pipeline-leads/:leadId/updates',    authenticate, requireSystemAdmin, addLeadUpdate);
router.delete('/pipeline-lead-updates/:updateId', authenticate, requireSystemAdmin, deleteLeadUpdate);
router.get('/pipelines/:id/analytics',            authenticate, requireSystemAdmin, getPipelineAnalytics);
// Pipeline shares (system_admin only)
router.post('/pipelines/:id/shares',              authenticate, requireSystemAdmin, createShare);
router.get('/pipelines/:id/shares',               authenticate, requireSystemAdmin, getShares);
router.delete('/pipeline-shares/:shareId',        authenticate, requireSystemAdmin, deactivateShare);
router.get('/pipelines/:id/audit',                authenticate, requireSystemAdmin, getPipelineAudit);
router.get('/pipeline-leads/:leadId/audit',       authenticate, requireSystemAdmin, getLeadAudit);

// Ad-Hoc Tasks (system_admin only)
router.get('/adhoc-tasks',      authenticate, requireSystemAdmin, getAllAdhocTasks);
router.post('/adhoc-tasks',     authenticate, requireSystemAdmin, createAdhocTask);
router.put('/adhoc-tasks/:id',  authenticate, requireSystemAdmin, updateAdhocTask);
router.delete('/adhoc-tasks/:id', authenticate, requireSystemAdmin, deleteAdhocTask);

// Global error handler middleware
router.use((err, req, res, next) => {
  console.error('Unhandled route error:', err);
  res.status(500).json({ error: 'An unexpected error occurred', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

module.exports = router;
