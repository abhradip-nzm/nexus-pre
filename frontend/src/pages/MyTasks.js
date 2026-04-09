import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, CalendarCheck, CheckSquare,
  CheckCircle2, Circle, Clock, AlertCircle
} from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './MyTasks.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
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

// Determine task color category using start_date (fallback created_at) and due_date
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

// Greedy lane assignment so bars don't overlap
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
function WeekRow({ weekDays, taskBars, today, onToggleComplete }) {
  const { bars, laneCount } = assignLanes(taskBars);
  const BAR_H = 24;
  const BAR_GAP = 3;
  const eventsHeight = laneCount > 0 ? laneCount * (BAR_H + BAR_GAP) + 8 : 32;

  return (
    <div className="cal-week-row">
      {/* Day number cells */}
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

      {/* Event bars */}
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
              title={`${bar.task.title}\n${bar.task.story_title}\n${isDone ? 'Completed' : 'Click circle to toggle complete'}`}
            >
              <button
                className={`cal-task-toggle${isDone ? ' cal-task-toggle--done' : ''}`}
                onMouseDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onToggleComplete(bar.task); }}
                title={isDone ? 'Mark incomplete' : 'Mark complete'}
              >
                {isDone ? <CheckCircle2 size={13} /> : <Circle size={13} />}
              </button>
              <div className="cal-task-bar-text">
                <span className="cal-task-bar-title">{bar.task.title}</span>
                <span className="cal-task-bar-story"> · {bar.task.story_title}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyTasks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    try {
      const res = await api.get('/tasks/my');
      setTasks(res.data.tasks || []);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleToggleComplete = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus });
      setTasks(prev => prev.map(t =>
        t.id === task.id
          ? { ...t, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }
          : t
      ));
      toast.success(newStatus === 'done' ? 'Task marked complete!' : 'Task reopened!');
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

  // Compute task bars for a week
  const getWeekBars = (weekDays) => {
    const weekStart = weekDays.find(d => d !== null);
    const weekEnd = [...weekDays].reverse().find(d => d !== null);
    if (!weekStart || !weekEnd) return [];

    const bars = [];
    tasks.forEach(task => {
      // Use start_date if available, else created_at
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

  // Stats
  const totalTasks = tasks.length;
  const completedCount = tasks.filter(t => t.status === 'done').length;
  const overdueCount = tasks.filter(t => getTaskCategory(t, today) === 'overdue').length;
  const activeCount = tasks.filter(t => getTaskCategory(t, today) === 'active').length;

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
      <p>Loading your tasks...</p>
    </div>
  );

  return (
    <>
      <Header title="My Tasks" subtitle="Your assigned tasks across all user stories" />
      <div className="page-content mytasks-page">

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
          {/* Navigation */}
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

          {/* Day headers */}
          <div className="cal-day-headers">
            {DAY_NAMES.map(d => (
              <div key={d} className="cal-day-header">{d}</div>
            ))}
          </div>

          {/* Weeks */}
          <div className="cal-grid">
            {weeks.map((weekDays, wi) => (
              <WeekRow
                key={wi}
                weekDays={weekDays}
                taskBars={getWeekBars(weekDays)}
                today={today}
                onToggleComplete={handleToggleComplete}
              />
            ))}
          </div>
        </div>

        {/* Task list below calendar */}
        {tasks.length > 0 && (
          <div className="mytasks-list-section">
            <h3 className="mytasks-list-title">All Assigned Tasks</h3>
            <div className="mytasks-list">
              {tasks.map(task => {
                const cat = getTaskCategory(task, today);
                const isDone = task.status === 'done';
                const startDate = parseLocalDate(task.start_date || task.created_at);
                const dueDate = parseLocalDate(task.due_date);
                return (
                  <div key={task.id} className={`mytasks-list-item mytasks-list-item--${cat}`}>
                    <button
                      className={`mytasks-list-toggle${isDone ? ' mytasks-list-toggle--done' : ''}`}
                      onClick={() => handleToggleComplete(task)}
                      title={isDone ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <div className="mytasks-list-info">
                      <span className={`mytasks-list-task-title${isDone ? ' mytasks-list-task-title--done' : ''}`}>
                        {task.title}
                      </span>
                      <span className="mytasks-list-story">{task.story_title}</span>
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
