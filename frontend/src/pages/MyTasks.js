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
  // Returns YYYY-MM-DD in local time
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(str) {
  if (!str) return null;
  // Parse YYYY-MM-DD without timezone shift
  const [y, m, d] = str.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Determine task color category
function getTaskCategory(task, today) {
  if (task.status === 'completed') return 'completed';
  const due = parseLocalDate(task.due_date);
  const start = parseLocalDate(task.created_at);
  if (!due) return 'upcoming';
  if (due < today) return 'overdue';
  if (start && start <= today && today <= due) return 'active';
  return 'upcoming';
}

// Assign lanes so bars don't overlap
function assignLanes(bars) {
  const lanes = []; // lanes[i] = last endCol used
  const result = bars.map(bar => {
    let lane = lanes.findIndex(end => end < bar.startCol);
    if (lane === -1) { lane = lanes.length; lanes.push(0); }
    lanes[lane] = bar.endCol;
    return { ...bar, lane };
  });
  return { bars: result, laneCount: lanes.length };
}

// ── Week Row ──────────────────────────────────────────────────────────────────
function WeekRow({ weekDays, taskBars, today, onMarkComplete }) {
  const { bars, laneCount } = assignLanes(taskBars);
  const BAR_H = 22; // px per lane
  const BAR_GAP = 3;
  const eventsHeight = laneCount > 0 ? laneCount * (BAR_H + BAR_GAP) + 6 : 28;

  return (
    <div className="cal-week-row">
      {/* Day cells */}
      <div className="cal-week-days">
        {weekDays.map((day, i) => {
          const isToday = day && toLocalDateStr(day) === toLocalDateStr(today);
          const isOtherMonth = false; // we don't show other-month days
          return (
            <div
              key={i}
              className={`cal-day-cell ${!day ? 'cal-day-empty' : ''} ${isToday ? 'cal-day-today' : ''}`}
            >
              {day && (
                <span className={`cal-day-num ${isToday ? 'cal-day-num-today' : ''}`}>
                  {day.getDate()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Event bars area */}
      <div className="cal-events-area" style={{ height: eventsHeight }}>
        {bars.map((bar, idx) => {
          const leftPct = (bar.startCol / 7) * 100;
          const widthPct = (bar.span / 7) * 100;
          const top = bar.lane * (BAR_H + BAR_GAP) + 3;

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
              title={`${bar.task.title}\n${bar.task.story_title}`}
            >
              <div className="cal-task-bar-inner">
                {bar.category !== 'completed' ? (
                  <button
                    className="cal-task-check"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onMarkComplete(bar.task); }}
                    title="Mark complete"
                  >
                    <Circle size={11} />
                  </button>
                ) : (
                  <CheckCircle2 size={11} className="cal-task-check-done" />
                )}
                <span className="cal-task-bar-title">{bar.task.title}</span>
                <span className="cal-task-bar-story">{bar.task.story_title}</span>
                {bar.task.created_by_name && (
                  <span className="cal-task-bar-by">by {bar.task.created_by_name}</span>
                )}
              </div>
            </div>
          );
        })}
        {laneCount === 0 && <div style={{ height: '100%' }} />}
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

  const handleMarkComplete = async (task) => {
    try {
      await api.put(`/tasks/${task.id}`, { status: 'completed' });
      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t
      ));
      toast.success('Task marked complete!');
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

  // Build flat array of day slots (null = padding), grouped into weeks
  const slots = [];
  for (let i = 0; i < firstDay; i++) slots.push(null);
  for (let d = 1; d <= daysInMonth; d++) slots.push(new Date(year, month, d));
  while (slots.length % 7 !== 0) slots.push(null);

  const weeks = [];
  for (let i = 0; i < slots.length; i += 7) {
    weeks.push(slots.slice(i, i + 7));
  }

  // For each week, compute which task bars appear
  const getWeekBars = (weekDays) => {
    const weekStart = weekDays.find(d => d !== null);
    const weekEnd = [...weekDays].reverse().find(d => d !== null);
    if (!weekStart || !weekEnd) return [];

    const bars = [];
    tasks.forEach(task => {
      const taskStart = parseLocalDate(task.created_at);
      const taskEnd = parseLocalDate(task.due_date);
      if (!taskStart || !taskEnd) return;

      // Does this task span any part of this week?
      if (taskEnd < weekStart || taskStart > weekEnd) return;

      // Clamp to week boundaries
      const clampedStart = taskStart < weekStart ? weekStart : taskStart;
      const clampedEnd = taskEnd > weekEnd ? weekEnd : taskEnd;

      // Find column indices
      const startCol = weekDays.findIndex(d => d && toLocalDateStr(d) === toLocalDateStr(clampedStart));
      const endCol = weekDays.findIndex(d => d && toLocalDateStr(d) === toLocalDateStr(clampedEnd));

      if (startCol === -1 || endCol === -1) return;

      const category = getTaskCategory(task, today);
      bars.push({
        task,
        startCol,
        endCol,
        span: endCol - startCol + 1,
        category,
        // sort so completed go last, active first
        sortOrder: category === 'active' ? 0 : category === 'overdue' ? 1 : category === 'upcoming' ? 2 : 3,
      });
    });

    bars.sort((a, b) => a.sortOrder - b.sortOrder || a.startCol - b.startCol);
    return bars;
  };

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const overdueTasks = tasks.filter(t => getTaskCategory(t, today) === 'overdue').length;
  const activeTasks = tasks.filter(t => getTaskCategory(t, today) === 'active').length;

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
            <div className="mytasks-stat-icon mytasks-stat-icon--active">
              <Clock size={16} />
            </div>
            <div>
              <div className="mytasks-stat-value">{activeTasks}</div>
              <div className="mytasks-stat-label">In Progress</div>
            </div>
          </div>
          <div className="mytasks-stat">
            <div className="mytasks-stat-icon mytasks-stat-icon--overdue">
              <AlertCircle size={16} />
            </div>
            <div>
              <div className="mytasks-stat-value">{overdueTasks}</div>
              <div className="mytasks-stat-label">Overdue</div>
            </div>
          </div>
          <div className="mytasks-stat">
            <div className="mytasks-stat-icon mytasks-stat-icon--completed">
              <CheckSquare size={16} />
            </div>
            <div>
              <div className="mytasks-stat-value">{completedTasks}</div>
              <div className="mytasks-stat-label">Completed</div>
            </div>
          </div>
          <div className="mytasks-stat">
            <div className="mytasks-stat-icon mytasks-stat-icon--total">
              <CalendarCheck size={16} />
            </div>
            <div>
              <div className="mytasks-stat-value">{totalTasks}</div>
              <div className="mytasks-stat-label">Total Tasks</div>
            </div>
          </div>
          <div className="mytasks-legend">
            <span className="legend-dot legend-active" /> Active
            <span className="legend-dot legend-upcoming" /> Upcoming
            <span className="legend-dot legend-overdue" /> Overdue
            <span className="legend-dot legend-completed" /> Completed
          </div>
        </div>

        {/* Calendar */}
        <div className="cal-card">
          {/* Navigation */}
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={prevMonth}><ChevronLeft size={16} /></button>
            <div className="cal-nav-center">
              <span className="cal-nav-month">{MONTH_NAMES[month]}</span>
              <span className="cal-nav-year">{year}</span>
            </div>
            <button className="cal-nav-btn" onClick={goToday}>Today</button>
            <button className="cal-nav-btn" onClick={nextMonth}><ChevronRight size={16} /></button>
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
                onMarkComplete={handleMarkComplete}
              />
            ))}
          </div>
        </div>

        {/* Task list below calendar */}
        {tasks.length > 0 && (
          <div className="mytasks-list-section">
            <h3 className="mytasks-list-title">All Tasks</h3>
            <div className="mytasks-list">
              {tasks.map(task => {
                const cat = getTaskCategory(task, today);
                return (
                  <div key={task.id} className={`mytasks-list-item mytasks-list-item--${cat}`}>
                    <div className="mytasks-list-left">
                      {cat !== 'completed' ? (
                        <button
                          className="mytasks-list-check"
                          onClick={() => handleMarkComplete(task)}
                          title="Mark complete"
                        >
                          <Circle size={16} />
                        </button>
                      ) : (
                        <CheckCircle2 size={16} className="mytasks-list-check-done" />
                      )}
                      <div className="mytasks-list-info">
                        <span className="mytasks-list-task-title">{task.title}</span>
                        <span className="mytasks-list-story">{task.story_title}</span>
                      </div>
                    </div>
                    <div className="mytasks-list-right">
                      {task.due_date && (
                        <span className={`mytasks-list-due mytasks-list-due--${cat}`}>
                          Due {parseLocalDate(task.due_date)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
