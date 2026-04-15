import React, { useState, useEffect, useCallback, useRef } from 'react';
import Pagination from '../components/common/Pagination';
import {
  DndContext, rectIntersection, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay, useDroppable
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Search, X, Eye, Building, CheckSquare, MessageSquare, SlidersHorizontal, Download, LayoutGrid, List, User, Calendar, Tag, Users, Briefcase, CalendarRange, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import Header from '../components/layout/Header';
import StoryModal from '../components/kanban/StoryModal';
import StoryDetailModal from '../components/kanban/StoryDetailModal';
import TransitionFormModal from '../components/kanban/TransitionFormModal';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate, getInitials, getAvatarColor, getSourceIcon } from '../utils/helpers';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { exportToExcel } from '../utils/exportExcel';
import './Kanban.css';

const PRIORITY_COLORS = {
  critical: '#dc3545', high: '#e67e22', medium: '#f59e0b', low: '#28a745'
};

// Build a flat lookup: sub_stage_id -> sub_stage_name from all columns
function buildSubStageMap(columns) {
  const map = {};
  columns.forEach(col => {
    (col.sub_stages || []).forEach(ss => {
      map[ss.id] = ss.name;
    });
  });
  return map;
}

// ── Draggable Story Card ──────────────────────────────────────────────────────
function StoryCard({ story, subStageName, onView }) {
  const { user } = useAuth();
  const isSystemAdmin = user?.role_name === 'system_admin';
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging
  } = useSortable({ id: story.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const priorityColor = PRIORITY_COLORS[story.priority] || '#e2e8f0';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="story-card"
      {...attributes}
      {...listeners}
    >
      {/* Priority stripe */}
      <div className="story-card-priority-bar" style={{ background: priorityColor }} />

      <div className="story-card-inner">
        <div className="story-card-header">
          <span className="story-priority-label" style={{ color: priorityColor, background: `${priorityColor}18` }}>
            {story.priority ? story.priority.charAt(0).toUpperCase() + story.priority.slice(1) : ''}
          </span>
          <span className="story-source">{getSourceIcon(story.source)}</span>
          <button
            className="story-more-btn"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onView(story); }}
            title="View details"
          >
            <Eye size={12} />
          </button>
        </div>

        <div
          className="story-title"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onView(story)}
        >
          {story.title}
        </div>

        {story.client_company && (
          <div className="story-company">
            <Building size={9} />
            {story.client_company}
          </div>
        )}

        {story.client_name && (
          <div className="story-contact-name">
            <User size={9} />
            {story.client_name}
          </div>
        )}

        {subStageName && (
          <div className="story-stage-tags">
            <span className="story-substage-tag">{subStageName}</span>
          </div>
        )}

        {Array.isArray(story.tags) && story.tags.length > 0 && (
          <div className="story-card-tags">
            {story.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="story-card-tag" style={{ background: '#eef4fb', color: '#3e72ae', border: '1px solid #d4e4f4' }}>
                {tag.toUpperCase()}
              </span>
            ))}
            {story.tags.length > 3 && <span className="story-card-tag" style={{ background: '#f0f4ff', color: '#718096' }}>+{story.tags.length - 3}</span>}
          </div>
        )}

        {story.industry_assignments?.length > 0 && (
          <div className="story-card-industries">
            {story.industry_assignments.slice(0, 2).map((ind, i) => (
              <span key={i} className="story-card-industry">{ind.name}</span>
            ))}
            {story.industry_assignments.length > 2 && <span className="story-card-industry">+{story.industry_assignments.length - 2}</span>}
          </div>
        )}

        {isSystemAdmin ? (
          <div className={`story-card-meta-row story-card-esd${story.effective_start_date ? ' story-card-esd--set' : ' story-card-esd--empty'}`}>
            <Calendar size={9} />
            {story.effective_start_date
              ? new Date(story.effective_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'}
          </div>
        ) : story.effective_start_date ? (
          <div className="story-card-meta-row">
            <Calendar size={9} />
            {new Date(story.effective_start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        ) : null}

        {story.team_assignments?.length > 0 && (
          <div className="story-card-assignments">
            <Users size={9} style={{ display: 'inline', marginRight: 3 }} />
            {story.team_assignments.map(t => t.name).filter(Boolean).join(', ')}
          </div>
        )}

        {story.member_assignments?.length > 0 && (
          <div className="story-card-assignments">
            <User size={9} style={{ display: 'inline', marginRight: 3 }} />
            {story.member_assignments.map(m => m.name).filter(Boolean).join(', ')}
          </div>
        )}

        {story.business_team_member_name && (
          <div className="story-card-meta-row">
            <Briefcase size={9} />
            {story.business_team_member_name}
          </div>
        )}

        <div className="story-card-footer">
          <div className="story-footer-left">
            {story.assigned_to_name && (
              <div
                className="avatar"
                style={{
                  background: getAvatarColor(story.assigned_to_name),
                  color: 'white',
                  fontSize: '9px',
                  width: '22px',
                  height: '22px',
                  minWidth: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                }}
                title={story.assigned_to_name}
              >
                {getInitials(story.assigned_to_name)}
              </div>
            )}
            {story.estimated_value && (
              <span className="story-value">{formatCurrency(story.estimated_value)}</span>
            )}
          </div>
          <div className="story-footer-right">
            {story.task_count > 0 && (
              <span className="story-count-badge">
                <CheckSquare size={9} /> {story.completed_task_count}/{story.task_count}
              </span>
            )}
            {story.comment_count > 0 && (
              <span className="story-count-badge">
                <MessageSquare size={9} /> {story.comment_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Calendar helpers ──────────────────────────────────────────────────────────
const KCAL_MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
const KCAL_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function toKCalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Kanban Calendar View ──────────────────────────────────────────────────────
function StoryCalendarView({ stories, columns, onView }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [expandedDay, setExpandedDay] = useState(null); // dateStr of expanded day

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  // Group stories by effective_start_date
  const storiesByDate = {};
  const unscheduled = [];
  stories.forEach(s => {
    if (s.effective_start_date) {
      const dateStr = s.effective_start_date.slice(0, 10);
      if (!storiesByDate[dateStr]) storiesByDate[dateStr] = [];
      storiesByDate[dateStr].push(s);
    } else {
      unscheduled.push(s);
    }
  });

  const scheduledCount = stories.length - unscheduled.length;

  // Build calendar grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const slots = [];
  for (let i = 0; i < firstDay; i++) slots.push(null);
  for (let d = 1; d <= daysInMonth; d++) slots.push(new Date(year, month, d));
  while (slots.length % 7 !== 0) slots.push(null);
  const weeks = [];
  for (let i = 0; i < slots.length; i += 7) weeks.push(slots.slice(i, i + 7));

  const todayStr = toKCalDateStr(today);
  const SHOW_MAX = 3;

  return (
    <div className="kcal-wrapper">
      {/* Navigation bar */}
      <div className="kcal-nav">
        <button className="kcal-nav-btn" onClick={prevMonth} title="Previous month">
          <ChevronLeft size={16} />
        </button>
        <div className="kcal-nav-title">
          <span className="kcal-nav-month">{KCAL_MONTHS[month]}</span>
          <span className="kcal-nav-year">{year}</span>
        </div>
        <button className="kcal-nav-btn kcal-today-btn" onClick={goToday}>Today</button>
        <button className="kcal-nav-btn" onClick={nextMonth} title="Next month">
          <ChevronRight size={16} />
        </button>
        <div className="kcal-stats">
          <span className="kcal-stat-pill kcal-stat-scheduled">
            <CalendarDays size={12} /> {scheduledCount} scheduled
          </span>
          {unscheduled.length > 0 && (
            <span className="kcal-stat-pill kcal-stat-unscheduled">
              {unscheduled.length} unscheduled
            </span>
          )}
        </div>
      </div>

      {/* Stage legend */}
      {columns.length > 0 && (
        <div className="kcal-legend">
          {columns.map(col => (
            <span key={col.id} className="kcal-legend-item">
              <span className="kcal-legend-dot" style={{ background: col.color }} />
              {col.name}
            </span>
          ))}
        </div>
      )}

      {/* Day headers */}
      <div className="kcal-day-headers">
        {KCAL_DAYS.map(d => <div key={d} className="kcal-day-header">{d}</div>)}
      </div>

      {/* Calendar grid */}
      <div className="kcal-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="kcal-week">
            {week.map((day, di) => {
              if (!day) return <div key={di} className="kcal-cell kcal-cell--empty" />;
              const dateStr = toKCalDateStr(day);
              const dayStories = storiesByDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              const isExpanded = expandedDay === dateStr;
              const visible = isExpanded ? dayStories : dayStories.slice(0, SHOW_MAX);
              const overflow = !isExpanded && dayStories.length > SHOW_MAX ? dayStories.length - SHOW_MAX : 0;

              return (
                <div
                  key={di}
                  className={`kcal-cell${isToday ? ' kcal-cell--today' : ''}${dayStories.length > 0 ? ' kcal-cell--has-stories' : ''}`}
                >
                  <div className="kcal-date-num-row">
                    <span className={`kcal-date-num${isToday ? ' kcal-date-today' : ''}`}>
                      {day.getDate()}
                    </span>
                    {dayStories.length > 0 && (
                      <span className="kcal-day-count">{dayStories.length}</span>
                    )}
                  </div>
                  <div className="kcal-day-stories">
                    {visible.map(s => (
                      <button
                        key={s.id}
                        className={`kcal-story-chip kcal-story-chip--${s.priority || 'medium'}`}
                        style={{ borderLeftColor: s.column_color || '#3e72ae' }}
                        onClick={e => { e.stopPropagation(); onView(s); }}
                        title={`${s.title} · ${s.column_name}${s.client_company ? ' · ' + s.client_company : ''}`}
                      >
                        <span className="kcal-chip-stage-dot" style={{ background: s.column_color || '#3e72ae' }} />
                        <span className="kcal-chip-title">{s.title}</span>
                        {s.client_company && (
                          <span className="kcal-chip-company">{s.client_company}</span>
                        )}
                      </button>
                    ))}
                    {overflow > 0 && (
                      <button
                        className="kcal-overflow-btn"
                        onClick={e => { e.stopPropagation(); setExpandedDay(dateStr); }}
                      >
                        +{overflow} more
                      </button>
                    )}
                    {isExpanded && dayStories.length > SHOW_MAX && (
                      <button
                        className="kcal-collapse-btn"
                        onClick={e => { e.stopPropagation(); setExpandedDay(null); }}
                      >
                        Show less
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Unscheduled stories */}
      {unscheduled.length > 0 && (
        <div className="kcal-unscheduled">
          <h4 className="kcal-unscheduled-title">
            <Calendar size={14} /> Unscheduled Stories
            <span className="kcal-unscheduled-count">{unscheduled.length}</span>
          </h4>
          <div className="kcal-unscheduled-grid">
            {unscheduled.map(s => (
              <button
                key={s.id}
                className="kcal-unscheduled-chip"
                style={{ borderLeftColor: s.column_color || '#3e72ae' }}
                onClick={() => onView(s)}
                title={`${s.title} · ${s.column_name}`}
              >
                <span className="kcal-chip-stage-dot" style={{ background: s.column_color || '#3e72ae' }} />
                <span className="kcal-unscheduled-info">
                  <span className="kcal-chip-title">{s.title}</span>
                  {s.client_company && <span className="kcal-chip-company">{s.client_company}</span>}
                </span>
                <span className="kcal-us-stage-badge" style={{ background: `${s.column_color}20`, color: s.column_color }}>
                  {s.column_name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single droppable column for one stage ─────────────────────────────────────
function StageColumn({ column, stories, subStageMap, onAdd, onView }) {
  const droppableId = `col_${column.id}`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div className="kanban-status-group" style={{ '--group-color': column.color }}>
      {/* Column header */}
      <div className="status-group-header" style={{ borderTopColor: column.color }}>
        <div className="status-group-title">
          <div className="status-group-dot" style={{ background: column.color }} />
          <span className="status-group-name">{column.name}</span>
          <span className="status-group-count">{stories.length}</span>
        </div>
        <button className="add-story-btn" onClick={() => onAdd(column.id)} title="Add story">
          <Plus size={13} />
        </button>
      </div>

      {/* Drop area — entire column */}
      <div
        ref={setNodeRef}
        className={`stage-drop-area ${isOver ? 'drop-over' : ''}`}
      >
        <SortableContext items={stories.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {stories.map(story => (
            <StoryCard
              key={story.id}
              story={story}
              subStageName={story.sub_stage_name || null}
              onView={onView}
            />
          ))}
          {stories.length === 0 && (
            <div className="stage-drop-empty">Drop stories here</div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// ── Main Kanban Board ─────────────────────────────────────────────────────────
export default function KanbanBoard() {
  const { user, canDo, isManager } = useAuth();
  const canCreateContent = ['system_admin', 'super_admin'].includes(user?.role_name);
  const [columns, setColumns] = useState([]);
  const [stories, setStories] = useState({});    // { colId: [story, ...] }
  const [subStageMap, setSubStageMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeStory, setActiveStory] = useState(null);
  const [viewStory, setViewStory] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [defaultColumnId, setDefaultColumnId] = useState(null);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    priority: '',
    has_incomplete_tasks: false,
    assigned_team: [],
    assigned_member: [],
    created_from: '',
    created_to: '',
    effective_start_from: '',
    effective_start_to: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ teams: [], industries: [], tags: [] });
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'list'
  const [listPage, setListPage] = useState(1);
  const LIST_PAGE_SIZE = 25;
  const prevFilterKey = useRef('');
  const [pendingMove, setPendingMove] = useState(null);
  const [showTransitionForm, setShowTransitionForm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const loadData = useCallback(async () => {
    try {
      const [colRes, storyRes, userRes, teamsRes, indRes, tagsRes] = await Promise.all([
        api.get('/kanban/columns'),
        api.get('/stories?limit=500'),
        api.get('/users/assignable').catch(() => ({ data: { users: [] } })),
        api.get('/teams').catch(() => ({ data: { teams: [] } })),
        api.get('/industries').catch(() => ({ data: { industries: [] } })),
        api.get('/tags').catch(() => ({ data: { tags: [] } })),
      ]);

      const cols = colRes.data.columns || [];
      setColumns(cols);
      setSubStageMap(buildSubStageMap(cols));
      setUsers(userRes.data.users || []);
      setFilterOptions({
        teams: teamsRes.data.teams || [],
        industries: indRes.data.industries || [],
        tags: tagsRes.data.tags || [],
      });

      const grouped = {};
      cols.forEach(col => { grouped[col.id] = []; });
      (storyRes.data.stories || []).forEach(story => {
        if (grouped[story.column_id] !== undefined) {
          grouped[story.column_id].push(story);
        }
      });
      setStories(grouped);
    } catch {
      toast.error('Failed to load kanban board');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDragStart = (event) => {
    const story = Object.values(stories).flat().find(s => s.id === event.active.id);
    setActiveStory(story || null);
  };

  // Apply an already-validated column move (optimistic UI + API call)
  const applyColumnMove = async (activeId, sourceColId, destColId, overId, preBuiltStories) => {
    const storiesSnapshot = preBuiltStories || stories;
    const movingStory = (storiesSnapshot[sourceColId] || []).find(s => s.id === activeId);
    if (!movingStory) return;

    const newSubStage = destColId === sourceColId ? (movingStory.sub_stage_name || null) : null;

    const newStories = { ...storiesSnapshot };
    const sourceList = (newStories[sourceColId] || []).filter(s => s.id !== activeId);
    newStories[sourceColId] = sourceList;

    const destList = [...(newStories[destColId] || [])];
    const overIdx = typeof overId === 'string' && overId.startsWith('col_')
      ? destList.length
      : destList.findIndex(s => s.id === overId);
    destList.splice(overIdx >= 0 ? overIdx : destList.length, 0, {
      ...movingStory,
      column_id: destColId,
      sub_stage_name: newSubStage,
    });
    newStories[destColId] = destList;
    setStories(newStories);

    const targetList = newStories[destColId];
    const idx = targetList.findIndex(s => s.id === activeId);
    const before = idx > 0 ? (targetList[idx - 1].position || idx * 1000) : 0;
    const after = idx < targetList.length - 1
      ? (targetList[idx + 1].position || (idx + 2) * 1000)
      : (targetList.length + 1) * 1000;
    const position = (before + after) / 2;

    try {
      await api.patch(`/stories/${activeId}/move`, {
        column_id: destColId,
        sub_stage: newSubStage,
        position,
      });
    } catch {
      toast.error('Failed to move story');
      loadData();
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveStory(null);
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find source column
    let sourceColId = null;
    for (const [colId, colStories] of Object.entries(stories)) {
      if (colStories.find(s => s.id === activeId)) {
        sourceColId = parseInt(colId);
        break;
      }
    }
    if (sourceColId === null) return;

    // Determine destination column
    let destColId = sourceColId;
    if (typeof overId === 'string' && overId.startsWith('col_')) {
      destColId = parseInt(overId.replace('col_', ''));
    } else {
      for (const [colId, colStories] of Object.entries(stories)) {
        if (colStories.find(s => s.id === overId)) {
          destColId = parseInt(colId);
          break;
        }
      }
    }

    // Same-column reorder — no transition form needed
    if (destColId === sourceColId) {
      await applyColumnMove(activeId, sourceColId, destColId, overId);
      return;
    }

    // Cross-column move — check for transition form
    const sourceCol = columns.find(c => c.id === sourceColId);
    const destCol = columns.find(c => c.id === destColId);

    try {
      const formRes = await api.get(`/transition-forms/for-transition?from_column_id=${sourceColId}&to_column_id=${destColId}`);
      const form = formRes.data?.form;

      if (form && form.is_active !== false) {
        // Store pending move, show the form modal — do NOT apply the move yet
        setPendingMove({ activeId, overId, sourceColId, destColId, sourceCol, destCol, form, storiesSnapshot: { ...stories } });
        setShowTransitionForm(true);
        return;
      }
    } catch {
      // If the endpoint fails, proceed with the move anyway
    }

    // No form — apply the move directly
    await applyColumnMove(activeId, sourceColId, destColId, overId);
  };

  const handleTransitionFormSubmit = async () => {
    if (!pendingMove) return;
    const { activeId, overId, sourceColId, destColId, storiesSnapshot } = pendingMove;
    setShowTransitionForm(false);
    setPendingMove(null);
    await applyColumnMove(activeId, sourceColId, destColId, overId, storiesSnapshot);
    toast.success('Story moved');
  };

  const handleTransitionFormSkip = async () => {
    if (!pendingMove) return;
    const { activeId, overId, sourceColId, destColId, storiesSnapshot } = pendingMove;
    setShowTransitionForm(false);
    setPendingMove(null);
    await applyColumnMove(activeId, sourceColId, destColId, overId, storiesSnapshot);
  };

  const handleTransitionFormCancel = () => {
    if (!pendingMove) return;
    // Revert to the original stories state (move is cancelled)
    setStories(pendingMove.storiesSnapshot);
    setShowTransitionForm(false);
    setPendingMove(null);
  };

  const filteredStories = (colId) => {
    let colStories = stories[colId] || [];
    if (search) {
      const q = search.toLowerCase();
      colStories = colStories.filter(s =>
        s.title?.toLowerCase().includes(q) ||
        s.client_name?.toLowerCase().includes(q) ||
        s.client_company?.toLowerCase().includes(q)
      );
    }
    if (filters.priority) {
      colStories = colStories.filter(s => s.priority === filters.priority);
    }
    if (filters.has_incomplete_tasks) {
      colStories = colStories.filter(s => s.task_count > 0 && s.completed_task_count < s.task_count);
    }
    if (filters.assigned_team.length > 0) {
      colStories = colStories.filter(s => {
        const teamIds = (s.team_assignments || []).map(ta => String(ta.team_id));
        if (filters.assigned_team.includes('none') && teamIds.length === 0) return true;
        return filters.assigned_team.some(id => id !== 'none' && teamIds.includes(String(id)));
      });
    }
    if (filters.assigned_member.length > 0) {
      colStories = colStories.filter(s => {
        const memberIds = (s.member_assignments || []).map(ma => String(ma.user_id));
        if (filters.assigned_member.includes('none') && memberIds.length === 0) return true;
        return filters.assigned_member.some(id => id !== 'none' && memberIds.includes(String(id)));
      });
    }
    if (filters.created_from) {
      colStories = colStories.filter(s => new Date(s.created_at) >= new Date(filters.created_from));
    }
    if (filters.created_to) {
      const to = new Date(filters.created_to); to.setHours(23, 59, 59, 999);
      colStories = colStories.filter(s => new Date(s.created_at) <= to);
    }
    if (filters.effective_start_from) {
      colStories = colStories.filter(s => s.effective_start_date && new Date(s.effective_start_date) >= new Date(filters.effective_start_from));
    }
    if (filters.effective_start_to) {
      const to = new Date(filters.effective_start_to); to.setHours(23, 59, 59, 999);
      colStories = colStories.filter(s => s.effective_start_date && new Date(s.effective_start_date) <= to);
    }
    return colStories;
  };

  const toggleFilterChip = (field, value) => {
    setFilters(f => {
      const arr = f[field];
      return {
        ...f,
        [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
      };
    });
  };

  const activeFilterCount = [
    filters.priority,
    filters.has_incomplete_tasks,
    filters.assigned_team.length > 0,
    filters.assigned_member.length > 0,
    filters.created_from,
    filters.created_to,
    filters.effective_start_from,
    filters.effective_start_to,
  ].filter(Boolean).length;

  // All filtered stories across all columns (used in list view)
  const allFilteredStories = columns.flatMap(col =>
    filteredStories(col.id).map(s => ({ ...s, column_name: col.name }))
  );

  // Reset list page when filters change
  const filterKey = JSON.stringify(filters) + search;
  if (prevFilterKey.current !== filterKey) {
    prevFilterKey.current = filterKey;
    if (listPage !== 1) setListPage(1);
  }
  const listTotalPages = Math.ceil(allFilteredStories.length / LIST_PAGE_SIZE) || 1;
  const pagedListStories = allFilteredStories.slice((listPage - 1) * LIST_PAGE_SIZE, listPage * LIST_PAGE_SIZE);

  const handleListExport = () => {
    const data = allFilteredStories.map(s => ({
      'Title': s.title,
      'Company': s.client_company || '',
      'Contact Name': s.client_name || '',
      'Contact Email': s.client_email || '',
      'Contact Phone': s.client_phone || '',
      'Stage': s.column_name || '',
      'Sub Stage': s.sub_stage_name || '',
      'Priority': s.priority || '',
      'Estimated Value': s.estimated_value || '',
      'Effective Start Date': formatDate(s.effective_start_date),
      'Assigned Teams': (s.team_assignments || []).map(t => t.name).filter(Boolean).join(', '),
      'Assigned Members': (s.member_assignments || []).map(m => m.name).filter(Boolean).join(', '),
      'Industries': (s.industry_assignments || []).map(i => i.name).filter(Boolean).join(', '),
      'Tags': Array.isArray(s.tags) ? s.tags.join(', ') : (s.tags || ''),
      'BT Member': s.business_team_member_name || '',
      'Source': s.source || '',
      'Description': s.description || '',
      'Contact Email': s.client_email || '',
      'Contact Phone': s.client_phone || '',
      'Created By': s.created_by_name || '',
      'Created': formatDate(s.created_at),
    }));
    exportToExcel(data, 'kanban-stories');
  };

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
      <p>Loading kanban board...</p>
    </div>
  );

  return (
    <>
      <Header title="Kanban Board" subtitle="Drag and drop stories between stages" />
      <div className="page-content kanban-page">
        <div className="kanban-toolbar">
          <div className="kanban-search">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search stories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="kanban-search-input"
            />
            {search && (
              <button onClick={() => setSearch('')} className="search-clear">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="kanban-actions">
            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === 'board' ? 'active' : ''}`}
                onClick={() => setViewMode('board')}
                title="Board View"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <List size={16} />
              </button>
              <button
                className={`view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
                title="Calendar View"
              >
                <CalendarDays size={16} />
              </button>
            </div>
            <button
              className={`btn btn-sm ${showFilters || activeFilterCount > 0 ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setShowFilters(v => !v)}
              title="Toggle filters"
            >
              <SlidersHorizontal size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="filter-count-badge">{activeFilterCount}</span>
              )}
            </button>
            {canCreateContent && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setDefaultColumnId(columns[0]?.id); setShowCreateModal(true); }}
              >
                <Plus size={14} /> New Story
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="kanban-filter-panel">
            <div className="filter-group">
              <label className="filter-label">Priority</label>
              <div className="filter-chips">
                {['', 'critical', 'high', 'medium', 'low'].map(p => (
                  <button
                    key={p}
                    className={`filter-chip ${filters.priority === p ? 'active' : ''}`}
                    onClick={() => setFilters(f => ({ ...f, priority: p }))}
                  >
                    {p || 'All'}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group">
              <label className="filter-label">Tasks</label>
              <div className="filter-chips">
                <label className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.has_incomplete_tasks}
                    onChange={e => setFilters(f => ({ ...f, has_incomplete_tasks: e.target.checked }))}
                  />
                  Has incomplete tasks
                </label>
              </div>
            </div>
            {filterOptions.teams.length > 0 && (
              <div className="filter-group">
                <label className="filter-label">Assigned Team</label>
                <div className="filter-chips">
                  <button
                    className={`filter-chip ${filters.assigned_team.includes('none') ? 'active' : ''}`}
                    onClick={() => toggleFilterChip('assigned_team', 'none')}
                  >
                    Not Assigned
                  </button>
                  {filterOptions.teams.map(team => (
                    <button
                      key={team.id}
                      className={`filter-chip ${filters.assigned_team.includes(team.id) ? 'active' : ''}`}
                      onClick={() => toggleFilterChip('assigned_team', team.id)}
                    >
                      {team.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {users.length > 0 && (
              <div className="filter-group">
                <label className="filter-label">Assigned Member</label>
                <div className="filter-chips">
                  <button
                    className={`filter-chip ${filters.assigned_member.includes('none') ? 'active' : ''}`}
                    onClick={() => toggleFilterChip('assigned_member', 'none')}
                  >
                    Not Assigned
                  </button>
                  {users.filter(u => ['system_admin', 'pre_sales_manager', 'pre_sales_executive'].includes(u.role_name)).map(u => (
                    <button
                      key={u.id}
                      className={`filter-chip ${filters.assigned_member.includes(u.id) ? 'active' : ''}`}
                      onClick={() => toggleFilterChip('assigned_member', u.id)}
                    >
                      {u.first_name} {u.last_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="filter-group">
              <label className="filter-label"><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />Created Date</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 140, fontSize: 12 }}
                  value={filters.created_from}
                  onChange={e => setFilters(f => ({ ...f, created_from: e.target.value }))}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 140, fontSize: 12 }}
                  value={filters.created_to}
                  onChange={e => setFilters(f => ({ ...f, created_to: e.target.value }))}
                />
              </div>
            </div>
            <div className="filter-group">
              <label className="filter-label"><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />Effective Start Date</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 140, fontSize: 12 }}
                  value={filters.effective_start_from}
                  onChange={e => setFilters(f => ({ ...f, effective_start_from: e.target.value }))}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 140, fontSize: 12 }}
                  value={filters.effective_start_to}
                  onChange={e => setFilters(f => ({ ...f, effective_start_to: e.target.value }))}
                />
              </div>
            </div>
            {activeFilterCount > 0 && (
              <button
                className="btn btn-ghost btn-sm filter-clear-btn"
                onClick={() => setFilters({ priority: '', has_incomplete_tasks: false, assigned_team: [], assigned_member: [], created_from: '', created_to: '', effective_start_from: '', effective_start_to: '' })}
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        )}

        {viewMode === 'board' && (
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="kanban-board">
              {columns.map(column => (
                <StageColumn
                  key={column.id}
                  column={column}
                  stories={filteredStories(column.id)}
                  subStageMap={subStageMap}
                  onAdd={(colId) => { setDefaultColumnId(colId); setShowCreateModal(true); }}
                  onView={setViewStory}
                />
              ))}
            </div>

            <DragOverlay>
              {activeStory && (
                <div className="story-card drag-overlay">
                  <div className="story-title">{activeStory.title}</div>
                  {activeStory.client_company && (
                    <div className="story-company">{activeStory.client_company}</div>
                  )}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {viewMode === 'list' && (
          <div className="kanban-list-view">
            <div className="klv-toolbar">
              <span className="klv-count">{allFilteredStories.length} {allFilteredStories.length === 1 ? 'story' : 'stories'}</span>
              <button className="btn btn-secondary btn-sm klv-export-btn" onClick={handleListExport}>
                <Download size={15} /> Export Excel
              </button>
            </div>
            <div className="klv-table-wrapper">
            <table className="klv-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Stage</th>
                  <th>Sub Stage</th>
                  <th>Priority</th>
                  <th>Est. Value</th>
                  <th>Eff. Start Date</th>
                  <th>Assigned Teams</th>
                  <th>Assigned Members</th>
                  <th>Industries</th>
                  <th>Tags</th>
                  <th>BT Member</th>
                  <th>Source</th>
                  <th>Description</th>
                  <th>Contact Email</th>
                  <th>Contact Phone</th>
                  <th>Created By</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedListStories.map(story => (
                  <tr key={story.id} className="klv-row">
                    <td className="klv-title">{story.title}</td>
                    <td>{story.client_company || '—'}</td>
                    <td>{story.client_name || '—'}</td>
                    <td><span className="klv-stage-badge" style={story.column_color ? { background: `${story.column_color}20`, color: story.column_color, borderColor: `${story.column_color}50` } : {}}>{story.column_name}</span></td>
                    <td>{story.sub_stage_name ? <span className="klv-substage-badge">{story.sub_stage_name}</span> : '—'}</td>
                    <td><span className={`priority-badge priority-${story.priority}`}>{story.priority ? story.priority.charAt(0).toUpperCase() + story.priority.slice(1) : '—'}</span></td>
                    <td style={{ color: 'var(--success)', fontWeight: 600 }}>{story.estimated_value ? `$${parseFloat(story.estimated_value).toLocaleString()}` : '—'}</td>
                    <td>{formatDate(story.effective_start_date)}</td>
                    <td>{(story.team_assignments || []).map(t => t.name).filter(Boolean).join(', ') || '—'}</td>
                    <td>{(story.member_assignments || []).map(m => m.name).filter(Boolean).join(', ') || '—'}</td>
                    <td>{(story.industry_assignments || []).map(i => i.name).filter(Boolean).join(', ') || '—'}</td>
                    <td>{Array.isArray(story.tags) ? story.tags.map(t => t.toUpperCase()).join(', ') || '—' : (story.tags || '—')}</td>
                    <td>{story.business_team_member_name || '—'}</td>
                    <td>{getSourceIcon(story.source)}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{story.description || '—'}</td>
                    <td>{story.client_email || '—'}</td>
                    <td>{story.client_phone || '—'}</td>
                    <td>{story.created_by_name || '—'}</td>
                    <td>{formatDate(story.created_at)}</td>
                    <td>
                      <button
                        className="tbl-btn tbl-btn-view"
                        onClick={e => { e.stopPropagation(); setViewStory(story); }}
                        title="View"
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {listTotalPages > 1 && (
              <Pagination
                page={listPage}
                totalPages={listTotalPages}
                total={allFilteredStories.length}
                limit={LIST_PAGE_SIZE}
                onPageChange={setListPage}
              />
            )}
          </div>
        )}

        {viewMode === 'calendar' && (
          <StoryCalendarView
            stories={allFilteredStories}
            columns={columns}
            onView={setViewStory}
          />
        )}
      </div>

      {showCreateModal && (
        <StoryModal
          columnId={defaultColumnId}
          columns={columns}
          users={users}
          onClose={() => setShowCreateModal(false)}
          onSaved={(story) => {
            setStories(prev => ({
              ...prev,
              [story.column_id]: [...(prev[story.column_id] || []), story]
            }));
            setShowCreateModal(false);
            toast.success('Story created!');
          }}
        />
      )}

      {viewStory && (
        <StoryDetailModal
          storyId={viewStory.id}
          columns={columns}
          users={users}
          onClose={() => setViewStory(null)}
          onUpdated={() => { loadData(); setViewStory(null); }}
        />
      )}

      {showTransitionForm && pendingMove && (
        <TransitionFormModal
          form={pendingMove.form}
          fromColumnName={pendingMove.sourceCol?.name || ''}
          toColumnName={pendingMove.destCol?.name || ''}
          storyId={pendingMove.activeId}
          fromColumnId={pendingMove.sourceColId}
          toColumnId={pendingMove.destColId}
          onSubmit={handleTransitionFormSubmit}
          onSkip={handleTransitionFormSkip}
          onCancel={handleTransitionFormCancel}
        />
      )}
    </>
  );
}
