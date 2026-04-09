import React, { useState, useEffect } from 'react';
import {
  X, Plus, Send, Check, Pencil, Trash2,
  Calendar, User, DollarSign, Activity, MessageSquare,
  CheckSquare, ExternalLink, Clock, Building, Briefcase, Users,
  ArrowRight, Layers, Flag, CheckCircle2, Circle, ChevronDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatDateTime, timeAgo, getInitials, getAvatarColor } from '../../utils/helpers';
import StoryModal from './StoryModal';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import './StoryDetailModal.css';

const TABS = ['Details', 'Tasks', 'Comments', 'Meetings', 'Activity'];

const BT_ROLE_LABELS = {
  cgo: 'Chief Growth Officer',
  asd: 'Associate Sales Director',
  sales_manager: 'Sales Manager',
  sales_executive: 'Sales Executive',
};

const PRIORITY_COLORS = {
  critical: '#dc3545', high: '#e67e22', medium: '#f59e0b', low: '#28a745'
};

const ACTIVITY_ICONS = {
  created: '✦',
  moved: '→',
  update: '✎',
  meeting_added: '📅',
};

export default function StoryDetailModal({ storyId, columns, users, onClose, onUpdated }) {
  const { user, canDo } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Details');
  const [showEdit, setShowEdit] = useState(false);

  // Task state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  // Task edit state
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', start_date: '', due_date: '', assignee_ids: [] });
  // Task activity expansion
  const [expandedActivity, setExpandedActivity] = useState(new Set());

  // Comment state
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => { loadStory(); }, [storyId]);

  const loadStory = async () => {
    try {
      const res = await api.get(`/stories/${storyId}`);
      setData(res.data);
    } catch {
      toast.error('Failed to load story');
    } finally {
      setLoading(false);
    }
  };

  const assignableUsers = users.filter(u =>
    ['pre_sales_manager', 'pre_sales_executive'].includes(u.role_name)
  );

  const toggleTaskAssignee = (userId) => {
    setNewTaskAssignees(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      const res = await api.post(`/stories/${storyId}/tasks`, {
        title: newTaskTitle,
        start_date: newTaskStartDate || null,
        due_date: newTaskDueDate || null,
        assignee_ids: newTaskAssignees,
      });
      setData(prev => ({ ...prev, tasks: [...prev.tasks, res.data.task] }));
      setNewTaskTitle('');
      setNewTaskStartDate('');
      setNewTaskDueDate('');
      setNewTaskAssignees([]);
      setShowTaskForm(false);
    } catch {
      toast.error('Failed to add task');
    } finally {
      setAddingTask(false);
    }
  };

  const toggleTask = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
      setData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === task.id
          ? { ...t, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }
          : t)
      }));
    } catch { toast.error('Failed to update task'); }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));
    } catch { toast.error('Failed to delete task'); }
  };

  const startEditTask = (task) => {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title || '',
      start_date: task.start_date ? task.start_date.slice(0, 10) : '',
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      assignee_ids: task.assignees?.map(a => a.id) || [],
    });
  };

  const saveEditTask = async () => {
    if (!editForm.title.trim()) return;
    try {
      await api.put(`/tasks/${editingTaskId}`, {
        title: editForm.title,
        start_date: editForm.start_date || null,
        due_date: editForm.due_date || null,
        assignee_ids: editForm.assignee_ids,
      });
      setEditingTaskId(null);
      loadStory();
      toast.success('Task updated');
    } catch { toast.error('Failed to update task'); }
  };

  const toggleEditAssignee = (userId) => {
    setEditForm(prev => ({
      ...prev,
      assignee_ids: prev.assignee_ids.includes(userId)
        ? prev.assignee_ids.filter(id => id !== userId)
        : [...prev.assignee_ids, userId]
    }));
  };

  const toggleTaskActivity = (taskId) => {
    setExpandedActivity(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    setSendingComment(true);
    try {
      const res = await api.post(`/stories/${storyId}/comments`, { content: comment });
      setData(prev => ({
        ...prev,
        comments: [...prev.comments, {
          ...res.data.comment,
          user_name: `${user.first_name} ${user.last_name}`,
        }]
      }));
      setComment('');
    } catch { toast.error('Failed to send comment'); }
    finally { setSendingComment(false); }
  };

  const handleUpdated = () => {
    setShowEdit(false);
    loadStory();
    onUpdated?.();
  };

  if (loading) return (
    <div className="modal-overlay">
      <div className="modal modal-xl">
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <div className="page-spinner" />
        </div>
      </div>
    </div>
  );

  const {
    story,
    btHierarchy = [],
    teamAssignments = [],
    memberAssignments = [],
    industryAssignments = [],
    tasks = [],
    comments = [],
    changeLogs = [],
    meetings = []
  } = data || {};

  if (!story) return null;

  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const priorityColor = PRIORITY_COLORS[story.priority] || '#718096';

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-xl story-detail-modal">

          {/* Header */}
          <div className="story-detail-header">
            <div className="story-detail-title-row">
              <span
                className="story-priority-badge"
                style={{ background: `${priorityColor}22`, color: priorityColor, border: `1px solid ${priorityColor}44` }}
              >
                <Flag size={9} /> {story.priority?.toUpperCase()}
              </span>
              <span
                className="story-column-badge"
                style={{ background: story.column_color + '20', color: story.column_color }}
              >
                {story.column_name}
                {story.sub_stage_name && ` · ${story.sub_stage_name}`}
              </span>
              {industryAssignments.length > 0 && industryAssignments.slice(0, 2).map(ind => (
                <span key={ind.industry_id} className="story-industry-badge">{ind.industry_name}</span>
              ))}
            </div>
            <h2 className="story-detail-title">{story.title}</h2>
            <div className="story-detail-meta">
              {story.client_company && (
                <span className="detail-meta-item"><Building size={13} /> {story.client_company}</span>
              )}
              {story.assigned_to_name && (
                <span className="detail-meta-item"><User size={13} /> {story.assigned_to_name}</span>
              )}
              {story.estimated_value && (
                <span className="detail-meta-item text-success">
                  <DollarSign size={13} /> ${parseFloat(story.estimated_value).toLocaleString()}
                </span>
              )}
              {story.due_date && (
                <span className="detail-meta-item"><Calendar size={13} /> Due {formatDate(story.due_date)}</span>
              )}
              <span className="detail-meta-item text-muted">
                <Clock size={13} /> {timeAgo(story.created_at)}
              </span>
            </div>

            <div className="story-detail-actions">
              {canDo('user_stories', 'update') && (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowEdit(true)}>
                  <Pencil size={14} /> Edit
                </button>
              )}
              <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
            </div>
          </div>

          {/* Progress bar */}
          {tasks.length > 0 && (
            <div className="story-progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
              <span className="progress-label">{completedTasks}/{tasks.length} tasks · {progress}%</span>
            </div>
          )}

          {/* Tabs */}
          <div className="story-detail-tabs">
            {TABS.map(tab => (
              <button
                key={tab}
                className={`detail-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {tab === 'Tasks' && tasks.length > 0 && <span className="tab-count">{tasks.length}</span>}
                {tab === 'Comments' && comments.length > 0 && <span className="tab-count">{comments.length}</span>}
                {tab === 'Activity' && changeLogs.length > 0 && <span className="tab-count">{changeLogs.length}</span>}
              </button>
            ))}
          </div>

          <div className="story-detail-body">

            {/* ── DETAILS TAB ── */}
            {activeTab === 'Details' && (
              <div className="detail-content">
                <div className="detail-grid">
                  <div className="detail-main">
                    {story.description && (
                      <div className="detail-section">
                        <h4 className="detail-section-title">Description</h4>
                        <p className="detail-description">{story.description}</p>
                      </div>
                    )}

                    <div className="detail-section">
                      <h4 className="detail-section-title">Client Information</h4>
                      <div className="client-info-grid">
                        {story.client_name && (
                          <div className="client-info-item">
                            <span className="ci-label">Contact</span>
                            <span className="ci-value">{story.client_name}</span>
                          </div>
                        )}
                        {story.client_company && (
                          <div className="client-info-item">
                            <span className="ci-label">Company</span>
                            <span className="ci-value">{story.client_company}</span>
                          </div>
                        )}
                        {story.client_email && (
                          <div className="client-info-item">
                            <span className="ci-label">Email</span>
                            <a href={`mailto:${story.client_email}`} className="ci-value ci-link">{story.client_email}</a>
                          </div>
                        )}
                        {story.client_phone && (
                          <div className="client-info-item">
                            <span className="ci-label">Phone</span>
                            <a href={`tel:${story.client_phone}`} className="ci-value ci-link">{story.client_phone}</a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sales Hierarchy */}
                    {btHierarchy.length > 0 && (
                      <div className="detail-section">
                        <h4 className="detail-section-title">Sales Hierarchy</h4>
                        <div className="bt-hierarchy-chain">
                          {[...btHierarchy].reverse().map((node, i) => (
                            <div key={node.id} className="bt-hierarchy-node" style={{ paddingLeft: i * 14 }}>
                              {i > 0 && <span className="bt-hier-connector">└</span>}
                              <span className="bt-hier-role-badge">{BT_ROLE_LABELS[node.role] || node.role}</span>
                              <span className="bt-hier-name">{node.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Team & Member Assignments */}
                    {(teamAssignments.length > 0 || memberAssignments.length > 0) && (
                      <div className="detail-section">
                        <h4 className="detail-section-title">Assignments</h4>
                        {teamAssignments.length > 0 && (
                          <div className="assignment-group">
                            <span className="assignment-group-label">Teams</span>
                            <div className="assignment-chips">
                              {teamAssignments.map(t => (
                                <span key={t.team_id} className="assignment-chip team-chip">
                                  <span className="assignment-chip-dot" style={{ background: t.accent_color || '#3e72ae' }} />
                                  {t.team_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {memberAssignments.length > 0 && (
                          <div className="assignment-group">
                            <span className="assignment-group-label">Members</span>
                            <div className="assignment-chips">
                              {memberAssignments.map(m => (
                                <span key={m.user_id} className="assignment-chip member-chip">
                                  <span style={{
                                    width: 18, height: 18, borderRadius: '50%',
                                    background: getAvatarColor(m.user_name), color: 'white',
                                    fontSize: '9px', display: 'inline-flex',
                                    alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                  }}>{getInitials(m.user_name)}</span>
                                  {m.user_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Industries */}
                    {industryAssignments.length > 0 && (
                      <div className="detail-section">
                        <h4 className="detail-section-title"><Layers size={11} style={{ display: 'inline', marginRight: 4 }} />Industries</h4>
                        <div className="detail-tags">
                          {industryAssignments.map(ind => (
                            <span key={ind.industry_id} className="industry-chip">{ind.industry_name}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {story.tags?.length > 0 && (
                      <div className="detail-section">
                        <h4 className="detail-section-title">Tags</h4>
                        <div className="detail-tags">
                          {story.tags.map(tag => (
                            <span key={tag} className="tag-chip">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sidebar */}
                  <div className="detail-sidebar">
                    <div className="sidebar-stat">
                      <span className="ss-label">Priority</span>
                      <span className="ss-value" style={{ color: priorityColor }}>
                        {story.priority?.charAt(0).toUpperCase() + story.priority?.slice(1) || '—'}
                      </span>
                    </div>
                    <div className="sidebar-stat">
                      <span className="ss-label">Stage</span>
                      <span className="ss-value">{story.column_name || '—'}</span>
                    </div>
                    {story.sub_stage_name && (
                      <div className="sidebar-stat">
                        <span className="ss-label">Sub Stage</span>
                        <span className="ss-value">{story.sub_stage_name}</span>
                      </div>
                    )}
                    <div className="sidebar-stat">
                      <span className="ss-label">Assigned To</span>
                      <span className="ss-value">{story.assigned_to_name || 'Unassigned'}</span>
                    </div>
                    {story.estimated_value && (
                      <div className="sidebar-stat">
                        <span className="ss-label">Est. Value</span>
                        <span className="ss-value text-success">${parseFloat(story.estimated_value).toLocaleString()}</span>
                      </div>
                    )}
                    {story.due_date && (
                      <div className="sidebar-stat">
                        <span className="ss-label">Due Date</span>
                        <span className="ss-value">{formatDate(story.due_date)}</span>
                      </div>
                    )}
                    {story.business_team_member_name && (
                      <div className="sidebar-stat">
                        <span className="ss-label">Sales Manager</span>
                        <span className="ss-value">{story.business_team_member_name}</span>
                      </div>
                    )}
                    <div className="sidebar-stat">
                      <span className="ss-label">Source</span>
                      <span className="ss-value">{story.source || 'Manual'}</span>
                    </div>
                    <div className="sidebar-stat">
                      <span className="ss-label">Created By</span>
                      <span className="ss-value">{story.created_by_name || '—'}</span>
                    </div>
                    <div className="sidebar-stat">
                      <span className="ss-label">Last Updated</span>
                      <span className="ss-value">{timeAgo(story.updated_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TASKS TAB ── */}
            {activeTab === 'Tasks' && (
              <div className="detail-content">
                {showTaskForm ? (
                  <div className="task-add-form">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="What needs to be done?"
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addTask()}
                      autoFocus
                    />
                    <div className="task-form-row-dates">
                      <div className="task-form-field">
                        <label className="task-form-label"><Calendar size={11} /> Start Date</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={newTaskStartDate}
                          onChange={e => setNewTaskStartDate(e.target.value)}
                        />
                      </div>
                      <div className="task-form-field">
                        <label className="task-form-label"><Calendar size={11} /> Due Date</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={newTaskDueDate}
                          onChange={e => setNewTaskDueDate(e.target.value)}
                        />
                      </div>
                    </div>
                    {assignableUsers.length > 0 && (
                      <div className="task-form-field">
                        <label className="task-form-label"><User size={11} /> Assignees</label>
                        <div className="task-assignee-checklist">
                          {assignableUsers.map(u => (
                            <label key={u.id} className={`task-assignee-item ${newTaskAssignees.includes(u.id) ? 'selected' : ''}`}>
                              <input
                                type="checkbox"
                                checked={newTaskAssignees.includes(u.id)}
                                onChange={() => toggleTaskAssignee(u.id)}
                              />
                              <span className="task-assignee-avatar" style={{ background: getAvatarColor(`${u.first_name} ${u.last_name}`) }}>
                                {getInitials(`${u.first_name} ${u.last_name}`)}
                              </span>
                              <span>{u.first_name} {u.last_name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="task-form-actions">
                      <button className="btn btn-primary btn-sm" onClick={addTask} disabled={addingTask || !newTaskTitle.trim()}>
                        <Plus size={13} /> Add Task
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        setShowTaskForm(false);
                        setNewTaskTitle(''); setNewTaskStartDate(''); setNewTaskDueDate(''); setNewTaskAssignees([]);
                      }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="task-add-trigger" onClick={() => setShowTaskForm(true)}>
                    <Plus size={15} /> Add a task...
                  </button>
                )}

                <div className="task-list">
                  {tasks.length === 0 && !showTaskForm ? (
                    <div className="empty-state-sm">
                      <CheckSquare size={32} color="#e2e8f0" />
                      <p>No tasks yet. Break this story into actionable steps.</p>
                    </div>
                  ) : (
                    tasks.map(task => {
                      const isDone = task.status === 'done';
                      const isEditing = editingTaskId === task.id;
                      const isActivityExpanded = expandedActivity.has(task.id);
                      const activityLogs = task.activity_logs || [];

                      if (isEditing) {
                        return (
                          <div key={task.id} className="task-item task-item--editing">
                            <div className="task-edit-form">
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Task title"
                                value={editForm.title}
                                onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                autoFocus
                              />
                              <div className="task-form-row-dates">
                                <div className="task-form-field">
                                  <label className="task-form-label"><Calendar size={11} /> Start Date</label>
                                  <input type="date" className="form-control form-control-sm"
                                    value={editForm.start_date}
                                    onChange={e => setEditForm(prev => ({ ...prev, start_date: e.target.value }))} />
                                </div>
                                <div className="task-form-field">
                                  <label className="task-form-label"><Calendar size={11} /> Due Date</label>
                                  <input type="date" className="form-control form-control-sm"
                                    value={editForm.due_date}
                                    onChange={e => setEditForm(prev => ({ ...prev, due_date: e.target.value }))} />
                                </div>
                              </div>
                              {assignableUsers.length > 0 && (
                                <div className="task-form-field">
                                  <label className="task-form-label"><User size={11} /> Assignees</label>
                                  <div className="task-assignee-checklist">
                                    {assignableUsers.map(u => (
                                      <label key={u.id} className={`task-assignee-item ${editForm.assignee_ids.includes(u.id) ? 'selected' : ''}`}>
                                        <input type="checkbox" checked={editForm.assignee_ids.includes(u.id)}
                                          onChange={() => toggleEditAssignee(u.id)} />
                                        <span className="task-assignee-avatar" style={{ background: getAvatarColor(`${u.first_name} ${u.last_name}`) }}>
                                          {getInitials(`${u.first_name} ${u.last_name}`)}
                                        </span>
                                        <span>{u.first_name} {u.last_name}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="task-form-actions">
                                <button className="btn btn-primary btn-sm" onClick={saveEditTask} disabled={!editForm.title.trim()}>
                                  <Check size={13} /> Save
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditingTaskId(null)}>Cancel</button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={task.id} className={`task-item ${isDone ? 'done' : ''}`}>
                          <button
                            className={`task-complete-btn ${isDone ? 'task-complete-btn--done' : ''}`}
                            onClick={() => toggleTask(task)}
                            title={isDone ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {isDone ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                          </button>
                          <div className="task-content">
                            <div className="task-main-row">
                              <span className="task-title">{task.title}</span>
                              {(task.start_date || task.due_date) && (
                                <span className="task-date-range">
                                  <Calendar size={9} />
                                  {task.start_date ? formatDate(task.start_date) : '—'}
                                  {' → '}
                                  {task.due_date ? formatDate(task.due_date) : 'No due date'}
                                </span>
                              )}
                            </div>
                            {task.assignees?.length > 0 && (
                              <div className="task-assignees-row">
                                {task.assignees.map(a => (
                                  <span key={a.id} className="task-assignee-chip">
                                    <span style={{
                                      width: 14, height: 14, borderRadius: '50%',
                                      background: getAvatarColor(a.name), color: 'white',
                                      fontSize: '7px', display: 'inline-flex',
                                      alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                    }}>{getInitials(a.name)}</span>
                                    {a.name}
                                  </span>
                                ))}
                              </div>
                            )}
                            {activityLogs.length > 0 && (
                              <div className="task-activity-section">
                                <button className="task-activity-toggle" onClick={() => toggleTaskActivity(task.id)}>
                                  <ChevronDown size={10} style={{ transform: isActivityExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                  {activityLogs.length} {activityLogs.length === 1 ? 'change' : 'changes'}
                                </button>
                                {isActivityExpanded && (
                                  <div className="task-activity-log">
                                    {activityLogs.map((log, i) => (
                                      <div key={i} className="task-activity-item">
                                        <span className={`task-activity-dot task-activity-dot--${log.change_type}`} />
                                        <span className="task-activity-text">
                                          <strong>{log.changed_by_name}</strong>
                                          {log.change_type === 'created' && <> created this task</>}
                                          {log.change_type === 'completed' && <> marked as <em className="tl-new">Completed</em></>}
                                          {log.change_type === 'reopened' && <> reopened this task</>}
                                          {log.change_type === 'update' && log.field_name && (
                                            <> updated <em className="tl-field">{log.field_name}</em>
                                              {log.old_value && log.new_value && <> from <em className="tl-old">{log.old_value}</em> to <em className="tl-new">{log.new_value}</em></>}
                                            </>
                                          )}
                                        </span>
                                        <span className="task-activity-time">{timeAgo(log.created_at)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="task-actions">
                            <button className="task-edit-btn" onClick={() => startEditTask(task)} title="Edit task">
                              <Pencil size={12} />
                            </button>
                            <button className="task-delete" onClick={() => deleteTask(task.id)} title="Delete task">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ── COMMENTS TAB ── */}
            {activeTab === 'Comments' && (
              <div className="detail-content comments-tab">
                <div className="comment-list">
                  {comments.length === 0 ? (
                    <div className="empty-state-sm">
                      <MessageSquare size={36} color="#e2e8f0" />
                      <p>No comments yet — start a discussion about this story.</p>
                    </div>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} className="comment-item">
                        <div
                          className="comment-avatar"
                          style={{ background: getAvatarColor(c.user_name) }}
                          title={c.user_name}
                        >
                          {getInitials(c.user_name)}
                        </div>
                        <div className="comment-bubble">
                          <div className="comment-bubble-header">
                            <strong className="comment-author">{c.user_name}</strong>
                            <span className="comment-time">{timeAgo(c.created_at)}</span>
                          </div>
                          <p className="comment-body">{c.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="comment-compose">
                  <div
                    className="comment-avatar comment-avatar-mine"
                    style={{ background: getAvatarColor(`${user.first_name} ${user.last_name}`) }}
                  >
                    {getInitials(`${user.first_name} ${user.last_name}`)}
                  </div>
                  <div className="comment-compose-box">
                    <textarea
                      className="comment-compose-input"
                      placeholder="Add a comment… (Enter to send, Shift+Enter for new line)"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      rows={comment.split('\n').length > 1 ? 3 : 1}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); }
                      }}
                    />
                    <div className="comment-compose-footer">
                      <span className="comment-hint">Shift+Enter for new line</span>
                      <button
                        className="btn btn-primary btn-sm comment-send-btn"
                        onClick={sendComment}
                        disabled={sendingComment || !comment.trim()}
                      >
                        <Send size={13} /> Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── MEETINGS TAB ── */}
            {activeTab === 'Meetings' && (
              <div className="detail-content">
                {meetings.length === 0 ? (
                  <div className="empty-state-sm">
                    <Calendar size={32} color="#e2e8f0" />
                    <p>No meetings linked to this story.</p>
                  </div>
                ) : (
                  <div className="meeting-list-detail">
                    {meetings.map(m => (
                      <div key={m.id} className="meeting-detail-item">
                        <div className="meeting-detail-time">
                          <div className="mdt-date">{formatDate(m.start_time, 'MMM d, yyyy')}</div>
                          <div className="mdt-time">{formatDate(m.start_time, 'h:mm a')}</div>
                        </div>
                        <div className="meeting-detail-info">
                          <div className="mdi-title">{m.title}</div>
                          {m.location && <div className="mdi-loc">{m.location}</div>}
                        </div>
                        {(m.meeting_link || m.ms_teams_join_url) && (
                          <a href={m.ms_teams_join_url || m.meeting_link} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                            <ExternalLink size={13} /> Join
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── ACTIVITY TAB ── */}
            {activeTab === 'Activity' && (
              <div className="detail-content">
                {changeLogs.length === 0 ? (
                  <div className="empty-state-sm">
                    <Activity size={32} color="#e2e8f0" />
                    <p>No activity recorded yet.</p>
                  </div>
                ) : (
                  <div className="timeline">
                    {changeLogs.map((log, idx) => (
                      <div key={log.id} className={`timeline-item ${idx === changeLogs.length - 1 ? 'last' : ''}`}>
                        <div className="timeline-indicator">
                          <span className={`timeline-dot tl-${log.change_type}`}>
                            {ACTIVITY_ICONS[log.change_type] || '·'}
                          </span>
                        </div>
                        <div className="timeline-content">
                          <div className="timeline-sentence">
                            <strong>{log.changed_by_name}</strong>
                            {log.change_type === 'created' && <> created this story</>}
                            {log.change_type === 'moved' && (
                              <> moved the story from <em className="tl-old">{log.old_value}</em> to <em className="tl-new">{log.new_value}</em></>
                            )}
                            {log.change_type === 'update' && log.field_name && (
                              <> updated <em className="tl-field">{log.field_name}</em>
                                {log.old_value && log.new_value && (
                                  <> from <em className="tl-old">{log.old_value}</em> to <em className="tl-new">{log.new_value}</em></>
                                )}
                              </>
                            )}
                            {log.change_type === 'update' && !log.field_name && log.comment && (
                              <> — <span className="tl-comment">{log.comment}</span></>
                            )}
                          </div>
                          <div className="timeline-time">{formatDateTime(log.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEdit && (
        <StoryModal
          story={story}
          columns={columns}
          users={users}
          existingTeamIds={teamAssignments.map(t => t.team_id)}
          existingMemberIds={memberAssignments.map(m => m.user_id)}
          existingIndustryIds={industryAssignments.map(i => i.industry_id)}
          onClose={() => setShowEdit(false)}
          onSaved={handleUpdated}
        />
      )}
    </>
  );
}
