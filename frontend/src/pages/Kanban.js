import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext, rectIntersection, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay, useDroppable
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Search, X, Eye, Building, CheckSquare, MessageSquare, SlidersHorizontal } from 'lucide-react';
import Header from '../components/layout/Header';
import StoryModal from '../components/kanban/StoryModal';
import StoryDetailModal from '../components/kanban/StoryDetailModal';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, formatDate, getInitials, getAvatarColor, getPriorityColor, getSourceIcon } from '../utils/helpers';
import api from '../utils/api';
import toast from 'react-hot-toast';
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
            {story.priority}
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

        {subStageName && (
          <div className="story-stage-tags">
            <span className="story-substage-tag">{subStageName}</span>
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
            {story.due_date && (
              <span className="story-due">{formatDate(story.due_date, 'MMM d')}</span>
            )}
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
              subStageName={story.sub_stage_id ? subStageMap[story.sub_stage_id] : null}
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
  const { canDo, isManager } = useAuth();
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
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ teams: [], industries: [], tags: [] });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const loadData = useCallback(async () => {
    try {
      const [colRes, storyRes, userRes, teamsRes, indRes, tagsRes] = await Promise.all([
        api.get('/kanban/columns'),
        api.get('/stories?limit=500'),
        api.get('/users').catch(() => ({ data: { users: [] } })),
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
      // Dropped directly on a column drop area
      destColId = parseInt(overId.replace('col_', ''));
    } else {
      // Dropped on another story — find which column it belongs to
      for (const [colId, colStories] of Object.entries(stories)) {
        if (colStories.find(s => s.id === overId)) {
          destColId = parseInt(colId);
          break;
        }
      }
    }

    // When moving to a different column, clear sub_stage_id
    // When reordering within the same column, preserve it
    const movingStory = (stories[sourceColId] || []).find(s => s.id === activeId);
    if (!movingStory) return;
    const newSubStageId = destColId === sourceColId ? (movingStory.sub_stage_id || null) : null;

    // Optimistic UI update
    const newStories = { ...stories };
    const sourceList = (newStories[sourceColId] || []).filter(s => s.id !== activeId);
    newStories[sourceColId] = sourceList;

    const destList = [...(newStories[destColId] || [])];
    const overIdx = typeof overId === 'string' && overId.startsWith('col_')
      ? destList.length
      : destList.findIndex(s => s.id === overId);
    destList.splice(overIdx >= 0 ? overIdx : destList.length, 0, {
      ...movingStory,
      column_id: destColId,
      sub_stage_id: newSubStageId,
    });
    newStories[destColId] = destList;
    setStories(newStories);

    // Compute position
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
        sub_stage_id: newSubStageId,
        position,
      });
    } catch {
      toast.error('Failed to move story');
      loadData();
    }
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
    return colStories;
  };

  const activeFilterCount = [
    filters.priority,
    filters.has_incomplete_tasks,
  ].filter(Boolean).length;

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
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setDefaultColumnId(columns[0]?.id); setShowCreateModal(true); }}
            >
              <Plus size={14} /> New Story
            </button>
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
            {activeFilterCount > 0 && (
              <button
                className="btn btn-ghost btn-sm filter-clear-btn"
                onClick={() => setFilters({ priority: '', has_incomplete_tasks: false })}
              >
                <X size={12} /> Clear filters
              </button>
            )}
          </div>
        )}

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
    </>
  );
}
