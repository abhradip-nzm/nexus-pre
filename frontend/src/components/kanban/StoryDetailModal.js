import React, { useState, useEffect } from 'react';
import {
  X, Plus, Send, Check, Pencil, Trash2,
  Calendar, User, DollarSign, Activity, MessageSquare,
  CheckSquare, ExternalLink, Clock, Building, Briefcase, Users
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

export default function StoryDetailModal({ storyId, columns, users, onClose, onUpdated }) {
  const { user, canDo } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Details');
  const [showEdit, setShowEdit] = useState(false);

  // Task state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskAssignees, setNewTaskAssignees] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

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

  // Assignable users for tasks (managers + executives from users prop)
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
        due_date: newTaskDueDate || null,
        assignee_ids: newTaskAssignees,
      });
      setData(prev => ({ ...prev, tasks: [...prev.tasks, res.data.task] }));
      setNewTaskTitle('');
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
        tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
      }));
    } catch { toast.error('Failed to update task'); }
  };

  const deleteTask = async (taskId) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== taskId) }));
    } catch { toast.error('Failed to delete task'); }
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    setSendingComment(true);
    try {
      const res = await api.post(`/stories/${storyId}/comments`, { content: comment });
      const newComment = {
        ...res.data.comment,
        user_name: `${user.first_name} ${user.last_name}`,
      };
      setData(prev => ({ ...prev, comments: [...prev.comments, newComment] }));
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
    tasks = [],
    comments = [],
    changeLogs = [],
    meetings = []
  } = data || {};

  if (!story) return null;

  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const priorityColor = {
    critical: '#dc3545', high: '#e67e22', medium: '#f59e0b', low: '#28a745'
  }[story.priority] || '#718096';

  // Build a human-readable activity sentence
  const formatActivityText = (log) => {
    const who = log.changed_by_name;
    if (log.change_type === 'created') return `${who} created this story`;
    if (log.change_type === 'moved') return `${who} moved the story`;
    if (log.change_type === 'update' && log.field_name) {
      return `${who} updated ${log.field_name}`;
    }
    if (log.comment) return `${who} — ${log.comment}`;
    return `${who} made a change`;
  };

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-xl story-detail-modal">
          <div className="story-detail-header">
            <div className="story-detail-title-row">
              <div className="story-priority-badge" style={{ background: `${priorityColor}20`, color: priorityColor }}>
                {story.priority?.toUpperCase()}
              </div>
              <div className="story-column-badge" style={{ background: story.column_color + '20', color: story.column_color }}>
                {story.column_name}
                {story.sub_stage_name && ` · ${story.sub_stage_name}`}
              </div>
            </div>
            <h2 className="story-detail-title">{story.title}</h2>
            <div className="story-detail-meta">
              {story.client_company && (
                <span className="detail-meta-item">
                  <Building size={13} /> {story.client_company}
                </span>
              )}
              {story.assigned_to_name && (
                <span className="detail-meta-item">
                  <User size={13} /> {story.assigned_to_name}
                </span>
              )}
              {story.due_date && (
                <span className="detail-meta-item">
                  <Calendar size={13} /> Due {formatDate(story.due_date)}
                </span>
              )}
              <span className="detail-meta-item text-muted">
                <Clock size={13} /> Created {timeAgo(story.created_at)}
              </span>
            </div>

            <div className="story-detail-actions">
              {canDo('user_stories', 'update') && (
                <button className="btn btn-secondary btn-sm" onClick={() => setShowEdit(true)}>
                  <Pencil size={14} /> Edit
                </button>
              )}
              <button className="btn btn-ghost btn-icon" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
          </div>

          {tasks.length > 0 && (
            <div className="story-progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
              <span className="progress-label">{completedTasks}/{tasks.length} tasks · {progress}%</span>
            </div>
          )}

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
            {/* ── Details Tab ── */}
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

                    {/* Sales Manager Hierarchy */}
                    {btHierarchy.length > 0 && (
                      <div className="detail-section">
                        <h4 className="detail-section-title"><Briefcase size={11} style={{ display: 'inline', marginRight: 4 }} />Sales Hierarchy</h4>
                        <div className="bt-hierarchy-chain">
                          {[...btHierarchy].reverse().map((node, i) => (
                            <div key={node.id} className="bt-hierarchy-node" style={{ paddingLeft: i * 16 }}>
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
                        <h4 className="detail-section-title"><Users size={11} style={{ display: 'inline', marginRight: 4 }} />Assignments</h4>
                        {teamAssignments.length > 0 && (
                          <div className="assignment-group">
                            <span className="assignment-group-label">Teams</span>
                            <div className="assignment-chips">
                              {teamAssignments.map(t => (
                                <span key={t.team_id} className="assignment-chip team-chip">
                                  <span
                                    className="assignment-chip-dot"
                                    style={{ background: t.accent_color || '#3e72ae' }}
                                  />
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
                                  <span
                                    className="avatar"
                                    style={{
                                      background: getAvatarColor(m.user_name),
                                      color: 'white',
                                      fontSize: '9px',
                                      width: '18px',
                                      height: '18px',
                                      minWidth: '18px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      borderRadius: '50%'
                                    }}
                                  >
                                    {getInitials(m.user_name)}
                                  </span>
                                  {m.user_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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

                  <div className="detail-sidebar">
                    {story.estimated_value && (
                      <div className="sidebar-stat">
                        <span className="ss-label">Est. Value</span>
                        <span className="ss-value text-success">
                          ${parseFloat(story.estimated_value).toLocaleString()}
                        </span>
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
                    {story.business_team_member_name && (
                      <div className="sidebar-stat">
                        <span className="ss-label">Sales Manager</span>
                        <span className="ss-value">{story.business_team_member_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tasks Tab ── */}
            {activeTab === 'Tasks' && (
              <div className="detail-content">
                {/* Add task form */}
                {showTaskForm ? (
                  <div className="task-add-form">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Task title..."
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addTask()}
                      autoFocus
                    />
                    <div className="task-form-row">
                      <div className="task-form-field">
                        <label className="task-form-label"><Calendar size={11} /> Due Date</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={newTaskDueDate}
                          onChange={e => setNewTaskDueDate(e.target.value)}
                        />
                      </div>
                      {assignableUsers.length > 0 && (
                        <div className="task-form-field task-form-assignees">
                          <label className="task-form-label"><User size={11} /> Assignees</label>
                          <div className="task-assignee-checklist">
                            {assignableUsers.map(u => (
                              <label key={u.id} className="task-assignee-item">
                                <input
                                  type="checkbox"
                                  checked={newTaskAssignees.includes(u.id)}
                                  onChange={() => toggleTaskAssignee(u.id)}
                                />
                                <span>{u.first_name} {u.last_name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="task-form-actions">
                      <button className="btn btn-primary btn-sm" onClick={addTask} disabled={addingTask || !newTaskTitle.trim()}>
                        <Plus size={13} /> Add Task
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setShowTaskForm(false); setNewTaskTitle(''); setNewTaskDueDate(''); setNewTaskAssignees([]); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="task-add-trigger" onClick={() => setShowTaskForm(true)}>
                    <Plus size={14} /> Add Task
                  </button>
                )}

                <div className="task-list">
                  {tasks.length === 0 ? (
                    <div className="empty-state-sm">
                      <CheckSquare size={32} color="#e2e8f0" />
                      <p>No tasks yet. Add tasks to track progress.</p>
                    </div>
                  ) : (
                    tasks.map(task => (
                      <div key={task.id} className={`task-item ${task.status === 'done' ? 'done' : ''}`}>
                        <button
                          className={`task-check ${task.status === 'done' ? 'checked' : ''}`}
                          onClick={() => toggleTask(task)}
                        >
                          {task.status === 'done' && <Check size={12} />}
                        </button>
                        <div className="task-content">
                          <div className="task-main-row">
                            <span className="task-title">{task.title}</span>
                            {task.due_date && (
                              <span className="task-due-badge">
                                <Calendar size={10} /> {formatDate(task.due_date, 'MMM d')}
                              </span>
                            )}
                          </div>
                          {task.assignees?.length > 0 && (
                            <div className="task-assignees-row">
                              {task.assignees.map(a => (
                                <span key={a.id} className="task-assignee-chip">
                                  <span
                                    style={{
                                      width: 16, height: 16, borderRadius: '50%',
                                      background: getAvatarColor(a.name), color: 'white',
                                      fontSize: '8px', display: 'inline-flex',
                                      alignItems: 'center', justifyContent: 'center',
                                      flexShrink: 0
                                    }}
                                  >
                                    {getInitials(a.name)}
                                  </span>
                                  {a.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button className="task-delete" onClick={() => deleteTask(task.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ── Comments Tab ── */}
            {activeTab === 'Comments' && (
              <div className="detail-content">
                <div className="comment-list">
                  {comments.length === 0 ? (
                    <div className="empty-state-sm">
                      <MessageSquare size={32} color="#e2e8f0" />
                      <p>No comments yet. Start the conversation.</p>
                    </div>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} className="comment-item">
                        <div
                          className="avatar avatar-sm"
                          style={{ background: getAvatarColor(c.user_name), color: 'white', fontSize: '10px' }}
                        >
                          {getInitials(c.user_name)}
                        </div>
                        <div className="comment-content">
                          <div className="comment-meta">
                            <strong>{c.user_name}</strong>
                            <span>{timeAgo(c.created_at)}</span>
                          </div>
                          <p className="comment-text">{c.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="comment-input-row">
                  <div
                    className="avatar avatar-sm"
                    style={{ background: getAvatarColor(`${user.first_name} ${user.last_name}`), color: 'white', fontSize: '10px' }}
                  >
                    {getInitials(`${user.first_name} ${user.last_name}`)}
                  </div>
                  <div className="comment-input-wrapper">
                    <textarea
                      className="form-control comment-textarea"
                      placeholder="Write a comment..."
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      rows={2}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendComment();
                        }
                      }}
                    />
                    <button
                      className="btn btn-primary btn-sm comment-send"
                      onClick={sendComment}
                      disabled={sendingComment || !comment.trim()}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Meetings Tab ── */}
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
                          <a
                            href={m.ms_teams_join_url || m.meeting_link}
                            target="_blank" rel="noreferrer"
                            className="btn btn-primary btn-sm"
                          >
                            <ExternalLink size={13} /> Join
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Activity Tab ── */}
            {activeTab === 'Activity' && (
              <div className="detail-content">
                {changeLogs.length === 0 ? (
                  <div className="empty-state-sm">
                    <Activity size={32} color="#e2e8f0" />
                    <p>No activity recorded yet.</p>
                  </div>
                ) : (
                  <div className="changelog-list">
                    {changeLogs.map(log => (
                      <div key={log.id} className="changelog-item">
                        <div
                          className="avatar avatar-sm"
                          style={{ background: getAvatarColor(log.changed_by_name), color: 'white', fontSize: '10px' }}
                        >
                          {getInitials(log.changed_by_name)}
                        </div>
                        <div className="changelog-content">
                          <div className="changelog-text">
                            <strong>{log.changed_by_name}</strong>
                            {' '}
                            {log.change_type === 'created' && 'created this story'}
                            {log.change_type === 'moved' && (
                              <>moved the story from <em>{log.old_value}</em> to <em>{log.new_value}</em></>
                            )}
                            {log.change_type === 'update' && log.field_name && (
                              <>updated <em>{log.field_name}</em></>
                            )}
                            {log.change_type === 'update' && !log.field_name && log.comment && (
                              <> — {log.comment}</>
                            )}
                          </div>
                          {log.change_type === 'update' && log.old_value && log.new_value && (
                            <div className="changelog-diff">
                              <span className="diff-old">{log.old_value}</span>
                              <span className="diff-arrow">→</span>
                              <span className="diff-new">{log.new_value}</span>
                            </div>
                          )}
                          <div className="changelog-time">{formatDateTime(log.created_at)}</div>
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
          onClose={() => setShowEdit(false)}
          onSaved={handleUpdated}
        />
      )}
    </>
  );
}
