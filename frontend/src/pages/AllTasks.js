import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarCheck, CheckSquare,
  Clock, AlertCircle, ExternalLink, Check, Users, Download, X
} from 'lucide-react';
import Header from '../components/layout/Header';
import StoryDetailModal from '../components/kanban/StoryDetailModal';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { exportToExcel } from '../utils/exportExcel';
import './MyTasks.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getTaskCategory(task, today) {
  if (task.status === 'done') return 'completed';
  const due = parseLocalDate(task.due_date);
  const start = parseLocalDate(task.start_date || task.created_at);
  if (!due) return 'upcoming';
  if (due < today) return 'overdue';
  if (start && start <= today && today <= due) return 'active';
  if (start && start > today) return 'upcoming';
  return 'upcoming';
}

function assignLanes(bars) {
  const laneEnds = [];
  const result = bars.map(bar => {
    let lane = laneEnds.findIndex(end => end < bar.startCol);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = bar.endCol;
    return { ...bar, lane };
  });
  return { bars: result, laneCount: laneEnds.length };
}

// ── Week Row ──────────────────────────────────────────────────────────────────
function WeekRow({ weekDays, taskBars, today, onToggleComplete, onViewStory }) {
  const { bars, laneCount } = assignLanes(taskBars);
  const BAR_H = 24;
  const BAR_GAP = 3;
  const eventsHeight = laneCount > 0 ? laneCount * (BAR_H + BAR_GAP) + 8 : 32;

  return (
    <div className="cal-week-row">
      <div className="cal-week-days">
        {weekDays.map((day, i) => {
          const isToday = day && toLocalDateStr(day) === toLocalDateStr(today);
          return (
            <div key={i} className={`cal-day-cell${!day ? ' cal-day-empty' : ''}${isToday ? ' cal-day-today' : ''}`}>
              {day && (
                <span className={`cal-day-num${isToday ? ' cal-day-num-today' : ''}`}>
                  {day.getDate()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="cal-events-area" style={{ height: eventsHeight }}>
        {bars.map((bar, idx) => {
          const leftPct = (bar.startCol / 7) * 100;
          const widthPct = (bar.span / 7) * 100;
          const top = bar.lane * (BAR_H + BAR_GAP) + 4;
          const isDone = bar.category === 'completed';

          return (
            <div
              key={idx}
              className={`cal-task-bar cal-task-bar--${bar.category}`}
              style={{
                left: `calc(${leftPct}% + 3px)`,
                width: `calc(${widthPct}% - 6px)`,
                top: `${top}px`,
                height: `${BAR_H}px`,
              }}
            >
              <button
                className={`cal-task-toggle${isDone ? ' cal-task-toggle--done' : ''}`}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onToggleComplete(bar.task); }}
                title={isDone ? 'Mark incomplete' : 'Mark complete'}
              >
                {isDone ? <Check size={13} /> : <span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid white', display: 'inline-block' }} />}
              </button>
              <button
                className="cal-task-bar-body"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onViewStory(bar.task.story_id); }}
                title={`View story: ${bar.task.story_title}`}
              >
                <span className="cal-task-bar-title">{bar.task.title}</span>
                <span className="cal-task-bar-story"> · {bar.task.story_title}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AllTasks() {
  const { user } = useAuth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingStoryId, setViewingStoryId] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [completingTask, setCompletingTask] = useState(null);
  const [responseDetails, setResponseDetails] = useState('');
  const [storyFilter, setStoryFilter] = useState('');

  const storyOptions = useMemo(() => {
    const map = {};
    tasks.forEach(t => { if (t.story_id && t.story_title) map[t.story_id] = t.story_title; });
    return Object.entries(map).map(([id, title]) => ({ id, title }));
  }, [tasks]);

  const filteredTasks = storyFilter ? tasks.filter(t => t.story_id === storyFilter) : tasks;

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get('/users');
      setAllUsers(res.data.users || []);
    } catch {
      // not critical
    }
  }, []);

  const loadTasks = useCallback(async (assigneeId) => {
    try {
      const url = assigneeId ? `/tasks/my?assignee_id=${assigneeId}` : '/tasks/my';
      const res = await api.get(url);
      setTasks(res.data.tasks || []);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadTasks(selectedAssignee);
  }, [loadUsers, loadTasks, selectedAssignee]);

  const handleToggleComplete = async (task) => {
    if (task.status !== 'done') {
      setCompletingTask(task);
      setResponseDetails('');
      return;
    }
    try {
      await api.put(`/tasks/${task.id}`, { status: 'todo' });
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: 'todo', completed_at: null } : t
      ));
      toast.success('Task reopened!');
    } catch {
      toast.error('Failed to update task');
    }
  };

  const handleConfirmComplete = async () => {
    if (!responseDetails.trim() || !completingTask) return;
    try {
      await api.put(`/tasks/${completingTask.id}`, { status: 'done', response_details: responseDetails.trim() });
      setTasks(prev => prev.map(t =>
        t.id === completingTask.id
          ? { ...t, status: 'done', completed_at: new Date().toISOString(), response_details: responseDetails.trim() }
          : t
      ));
      toast.success('Task marked complete!');
      setCompletingTask(null);
      setResponseDetails('');
    } catch {
      toast.error('Failed to update task');
    }
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  // Build calendar grid
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const slots = [];
  for (let i = 0; i < firstDay; i++) slots.push(null);
  for (let d = 1; d <= daysInMonth; d++) slots.push(new Date(year, month, d));
  while (slots.length % 7 !== 0) slots.push(null);
  const weeks = [];
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));

  const getWeekBars = (weekDays) => {
    const weekStart = weekDays.find(d => d !== null);
    const weekEnd = [...weekDays].reverse().find(d => d !== null);
    if (!weekStart || !weekEnd) return [];

    const bars = [];
    filteredTasks.forEach(task => {
      const taskStart = parseLocalDate(task.start_date || task.created_at);
      const taskEnd = parseLocalDate(task.due_date);
      if (!taskStart || !taskEnd) return;
      if (taskEnd < weekStart || taskStart > weekEnd) return;

      const clampedStart = taskStart < weekStart ? weekStart : taskStart;
      const clampedEnd = taskEnd > weekEnd ? weekEnd : taskEnd;

      const startCol = weekDays.findIndex(d => d && toLocalDateStr(d) === toLocalDateStr(clampedStart));
      const endCol = weekDays.findIndex(d => d && toLocalDateStr(d) === toLocalDateStr(clampedEnd));
      if (startCol === -1 || endCol === -1) return;

      const category = getTaskCategory(task, today);
      const sortOrder = category === 'active' ? 0 : category === 'overdue' ? 1 : category === 'upcoming' ? 2 : 3;
      bars.push({ task, startCol, endCol, span: endCol - startCol + 1, category, sortOrder });
    });

    bars.sort((a, b) => a.sortOrder - b.sortOrder || a.startCol - b.startCol);
    return bars;
  };

  const totalTasks = filteredTasks.length;
  const completedCount = filteredTasks.filter(t => t.status === 'done').length;
  const overdueCount = filteredTasks.filter(t => getTaskCategory(t, today) === 'overdue').length;
  const activeCount = filteredTasks.filter(t => getTaskCategory(t, today) === 'active').length;

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
      <p>Loading tasks...</p>
    </div>
  );

  return (
    <>
      {/* Task Response Details mini-modal */}
      {completingTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setCompletingTask(null)}>
          <div style={{ background: 'white', borderRadius: 12, width: 420, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Complete Task</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }} onClick={() => setCompletingTask(null)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}><strong>{completingTask.title}</strong></p>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Task Response Details <span style={{ color: '#dc3545' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Describe what was done, outcomes, notes…"
                  value={responseDetails}
                  onChange={e => setResponseDetails(e.target.value)}
                  autoFocus
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
                {!responseDetails.trim() && (
                  <p style={{ fontSize: 11, color: '#dc3545', marginTop: 4, marginBottom: 0 }}>Response details are required before marking complete.</p>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 20px', borderTop: '1px solid var(--border-light)' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setCompletingTask(null)}>Cancel</button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConfirmComplete}
                disabled={!responseDetails.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Check size={14} /> Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingStoryId && (
        <StoryDetailModal
          storyId={viewingStoryId}
          columns={[]}
          users={allUsers}
          readOnly={false}
          onClose={() => setViewingStoryId(null)}
          onUpdated={() => loadTasks(selectedAssignee)}
        />
      )}
      <Header title="All Tasks" subtitle="All tasks across all user stories" />
      <div className="page-content mytasks-page">

        {/* Toolbar */}
        <div className="users-toolbar" style={{ marginBottom: 16 }}>
          <div className="users-search" style={{ minWidth: 200 }}>
            <Users size={15} />
            <select
              className="users-search-input"
              value={selectedAssignee}
              onChange={e => setSelectedAssignee(e.target.value)}
            >
              <option value="">All assignees</option>
              <option value="none">Not assigned to anyone</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>
          <div className="users-stats">
            <span className="stat-pill">{filteredTasks.length} tasks</span>
          </div>
          <select className="filter-select" value={storyFilter} onChange={e => setStoryFilter(e.target.value)}>
            <option value="">All Stories</option>
            {storyOptions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const data = tasks.map(t => ({
                'Title': t.title,
                'Story Title': t.story_title || '',
                'Status': t.status || '',
                'Priority': t.priority || '',
                'Assignees': (t.assignees || []).map(a => a.name).join(', '),
                'Start Date': t.start_date ? new Date(t.start_date).toLocaleDateString() : '',
                'Due Date': t.due_date ? new Date(t.due_date).toLocaleDateString() : '',
                'Created': t.created_at ? new Date(t.created_at).toLocaleDateString() : '',
              }));
              exportToExcel(data, 'all-tasks');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} /> Export Excel
          </button>
        </div>

        {/* Stats row */}
        <div className="mytasks-stats">
          <div className="mytasks-stat">
            <div className="mytasks-stat-icon mytasks-stat-icon--active"><Clock size={16} /></div>
            <div>
              <div className="mytasks-stat-value">{activeCount}</div>
              <div className="mytasks-stat-label">In Progress</div>
            </div>
          </div>
          <div className="mytasks-stat">
            <div className="mytasks-stat-icon mytasks-stat-icon--overdue"><AlertCircle size={16} /></div>
            <div>
              <div className="mytasks-stat-value">{overdueCount}</div>
              <div className="mytasks-stat-label">Overdue</div>
            </div>
          </div>
          <div className="mytasks-stat">
            <div className="mytasks-stat-icon mytasks-stat-icon--completed"><CheckSquare size={16} /></div>
            <div>
              <div className="mytasks-stat-value">{completedCount}</div>
              <div className="mytasks-stat-label">Completed</div>
            </div>
          </div>
          <div className="mytasks-stat">
            <div className="mytasks-stat-icon mytasks-stat-icon--total"><CalendarCheck size={16} /></div>
            <div>
              <div className="mytasks-stat-value">{totalTasks}</div>
              <div className="mytasks-stat-label">Total Tasks</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mytasks-legend">
          <span className="legend-item"><span className="legend-dot legend-active" /> Active</span>
          <span className="legend-item"><span className="legend-dot legend-upcoming" /> Upcoming</span>
          <span className="legend-item"><span className="legend-dot legend-overdue" /> Overdue</span>
          <span className="legend-item"><span className="legend-dot legend-completed" /> Completed</span>
          <span className="legend-hint">Click the circle on a task bar to mark complete / incomplete</span>
        </div>

        {/* Calendar */}
        <div className="cal-card">
          <div className="cal-nav">
            <button className="cal-nav-btn cal-nav-arrow" onClick={prevMonth} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <div className="cal-nav-title">
              <span className="cal-nav-month">{MONTH_NAMES[month]}</span>
              <span className="cal-nav-year">{year}</span>
            </div>
            <button className="cal-nav-btn cal-nav-today" onClick={goToday}>Today</button>
            <button className="cal-nav-btn cal-nav-arrow" onClick={nextMonth} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="cal-day-headers">
            {DAY_NAMES.map(d => (
              <div key={d} className="cal-day-header">{d}</div>
            ))}
          </div>

          <div className="cal-grid">
            {weeks.map((weekDays, wi) => (
              <WeekRow
                key={wi}
                weekDays={weekDays}
                taskBars={getWeekBars(weekDays)}
                today={today}
                onToggleComplete={handleToggleComplete}
                onViewStory={setViewingStoryId}
              />
            ))}
          </div>
        </div>

        {/* Task list below calendar */}
        {filteredTasks.length > 0 && (
          <div className="mytasks-list-section">
            <h3 className="mytasks-list-title">All Tasks</h3>
            <div className="mytasks-list">
              {filteredTasks.map(task => {
                const cat = getTaskCategory(task, today);
                const isDone = task.status === 'done';
                const startDate = parseLocalDate(task.start_date || task.created_at);
                const dueDate = parseLocalDate(task.due_date);
                return (
                  <div key={task.id} className={`mytasks-list-item mytasks-list-item--${cat}`}>
                    <button
                      className={`task-check${isDone ? ' checked' : ''}`}
                      onClick={() => handleToggleComplete(task)}
                      title={isDone ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {isDone && <Check size={11} />}
                    </button>
                    <div className="mytasks-list-info">
                      <span className={`mytasks-list-task-title${isDone ? ' mytasks-list-task-title--done' : ''}`}>
                        {task.title}
                      </span>
                      <span className="mytasks-list-story">{task.story_title}</span>
                      {task.assignees?.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {task.assignees.map(a => a.name).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="mytasks-list-right">
                      {(startDate || dueDate) && (
                        <span className={`mytasks-list-dates mytasks-list-dates--${cat}`}>
                          {startDate ? startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                          {' → '}
                          {dueDate ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date'}
                        </span>
                      )}
                      <span className={`mytasks-list-badge mytasks-list-badge--${cat}`}>
                        {cat === 'active' ? 'In Progress' : cat === 'overdue' ? 'Overdue' : cat === 'upcoming' ? 'Upcoming' : 'Completed'}
                      </span>
                      <button
                        className="mytasks-view-story-btn"
                        onClick={() => setViewingStoryId(task.story_id)}
                        title="View story"
                      >
                        <ExternalLink size={13} />
                        <span>Story</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
