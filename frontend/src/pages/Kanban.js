import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay, useDroppable
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Search, X, Eye
} from 'lucide-react';
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

// Draggable Story Card
function StoryCard({ story, onView }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging
  } = useSortable({ id: story.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="story-card"
      {...attributes}
      {...listeners}
    >
      <div className="story-card-header">
        <div className="story-priority-dot" style={{ background: PRIORITY_COLORS[story.priority] || '#e2e8f0' }} />
        <span className="story-source">{getSourceIcon(story.source)}</span>
        <button className="story-more-btn" onClick={(e) => { e.stopPropagation(); onView(story); }}>
          <Eye size={12} />
        </button>
      </div>

      <div className="story-title" onClick={() => onView(story)}>
        {story.title}
      </div>

      {story.client_company && (
        <div className="story-company">
          <span className="company-dot" />
          {story.client_company}
        </div>
      )}

      <div className="story-card-footer">
        {story.assigned_to_name && (
          <div
            className="avatar avatar-sm"
            style={{
              background: getAvatarColor(story.assigned_to_name),
              color: 'white',
              fontSize: '10px',
              width: '22px',
              height: '22px'
            }}
            title={story.assigned_to_name}
          >
            {getInitials(story.assigned_to_name)}
          </div>
        )}
        <div className="story-meta">
          {story.estimated_value && (
            <span className="story-value">{formatCurrency(story.estimated_value)}</span>
          )}
          {story.due_date && (
            <span className="story-due">{formatDate(story.due_date, 'MMM d')}</span>
          )}
        </div>
        <div className="story-counts">
          {story.task_count > 0 && (
            <span className="story-count-badge">✓ {story.completed_task_count}/{story.task_count}</span>
          )}
          {story.comment_count > 0 && (
            <span className="story-count-badge">💬 {story.comment_count}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-stage column (droppable + sortable)
function SubStageColumn({ colId, subStage, stories, onAdd, onView }) {
  const droppableId = subStage ? `${colId}_${subStage.id}` : `${colId}_null`;
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-substage-col ${isOver ? 'drop-over' : ''}`}
    >
      <div className="substage-col-header">
        <span className="substage-col-name">{subStage ? subStage.name : 'General'}</span>
        <span className="substage-col-count">{stories.length}</span>
      </div>
      <SortableContext items={stories.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="substage-col-cards">
          {stories.map(story => (
            <StoryCard key={story.id} story={story} onView={onView} />
          ))}
          {stories.length === 0 && (
            <div className="substage-col-empty">Drop here</div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// Status group (one per column)
function StatusGroup({ column, stories, onAdd, onView }) {
  const subStages = column.sub_stages || [];
  const totalCount = stories.length;

  const getStoriesForSubStage = (ssId) => {
    if (!ssId) {
      return stories.filter(s => !s.sub_stage_id || !subStages.find(ss => ss.id === s.sub_stage_id));
    }
    return stories.filter(s => s.sub_stage_id === ssId);
  };

  return (
    <div className="kanban-status-group" style={{ '--group-color': column.color }}>
      <div className="status-group-header" style={{ borderTopColor: column.color }}>
        <div className="status-group-title">
          <div className="status-group-dot" style={{ background: column.color }} />
          <span className="status-group-name">{column.name}</span>
          <span className="status-group-count">{totalCount}</span>
        </div>
        <button className="add-story-btn" onClick={() => onAdd(column.id)} title="Add story">
          <Plus size={13} />
        </button>
      </div>

      <div className="status-group-body">
        {subStages.length === 0 ? (
          <SubStageColumn
            colId={column.id}
            subStage={null}
            stories={stories}
            onAdd={onAdd}
            onView={onView}
          />
        ) : (
          subStages.map(ss => (
            <SubStageColumn
              key={ss.id}
              colId={column.id}
              subStage={ss}
              stories={getStoriesForSubStage(ss.id)}
              onAdd={onAdd}
              onView={onView}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard() {
  const { canDo, isManager } = useAuth();
  const [columns, setColumns] = useState([]);
  const [stories, setStories] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeStory, setActiveStory] = useState(null);
  const [viewStory, setViewStory] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [defaultColumnId, setDefaultColumnId] = useState(null);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [colRes, storyRes, userRes] = await Promise.all([
        api.get('/kanban/columns'),
        api.get('/stories?limit=500'),
        api.get('/users').catch(() => ({ data: { users: [] } }))
      ]);

      const cols = colRes.data.columns;
      setColumns(cols);
      setUsers(userRes.data.users || []);

      const grouped = {};
      cols.forEach(col => { grouped[col.id] = []; });
      (storyRes.data.stories || []).forEach(story => {
        if (grouped[story.column_id] !== undefined) {
          grouped[story.column_id].push(story);
        }
      });
      setStories(grouped);
    } catch (err) {
      toast.error('Failed to load kanban board');
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event) => {
    const allStories = Object.values(stories).flat();
    const story = allStories.find(s => s.id === event.active.id);
    setActiveStory(story);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveStory(null);
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find source info
    let sourceColId = null;
    for (const [colId, colStories] of Object.entries(stories)) {
      if (colStories.find(s => s.id === activeId)) {
        sourceColId = parseInt(colId);
        break;
      }
    }
    if (!sourceColId) return;

    // Determine dest column and sub_stage from overId
    let destColId = sourceColId;
    let destSubStageId = null;

    // Check if dropped on a droppable key like "colId_subStageId" or "colId_null"
    if (typeof overId === 'string' && overId.includes('_')) {
      const parts = overId.split('_');
      destColId = parseInt(parts[0]);
      destSubStageId = parts[1] === 'null' ? null : parseInt(parts[1]);
    } else {
      // Dropped on another story
      for (const [colId, colStories] of Object.entries(stories)) {
        if (colStories.find(s => s.id === overId)) {
          destColId = parseInt(colId);
          const overStory = colStories.find(s => s.id === overId);
          destSubStageId = overStory?.sub_stage_id || null;
          break;
        }
      }
    }

    // Update UI optimistically
    const newStories = { ...stories };
    const sourceList = [...(newStories[sourceColId] || [])];
    const movingStory = sourceList.find(s => s.id === activeId);
    if (!movingStory) return;

    newStories[sourceColId] = sourceList.filter(s => s.id !== activeId);

    const destList = [...(newStories[destColId] || [])];
    const overIdx = typeof overId === 'string' ? destList.length : destList.findIndex(s => s.id === overId);
    destList.splice(overIdx >= 0 ? overIdx : destList.length, 0, {
      ...movingStory,
      column_id: destColId,
      sub_stage_id: destSubStageId
    });
    newStories[destColId] = destList;
    setStories(newStories);

    // Calculate position
    const targetList = newStories[destColId];
    const idx = targetList.findIndex(s => s.id === activeId);
    const before = idx > 0 ? targetList[idx - 1].position || (idx * 1000) : 0;
    const after = idx < targetList.length - 1 ? targetList[idx + 1].position || ((idx + 2) * 1000) : (targetList.length + 1) * 1000;
    const position = (before + after) / 2;

    try {
      await api.patch(`/stories/${activeId}/move`, {
        column_id: destColId,
        sub_stage_id: destSubStageId,
        position,
      });
    } catch (err) {
      toast.error('Failed to move story');
      loadData();
    }
  };

  const handleAddStory = (columnId) => {
    setDefaultColumnId(columnId);
    setShowCreateModal(true);
  };

  const handleStoryCreated = (story) => {
    setStories(prev => ({
      ...prev,
      [story.column_id]: [...(prev[story.column_id] || []), story]
    }));
    setShowCreateModal(false);
    toast.success('Story created!');
  };

  const handleStoryUpdated = () => {
    loadData();
    setViewStory(null);
  };

  const filteredStories = (colId) => {
    const colStories = stories[colId] || [];
    if (!search) return colStories;
    const q = search.toLowerCase();
    return colStories.filter(s =>
      s.title?.toLowerCase().includes(q) ||
      s.client_name?.toLowerCase().includes(q) ||
      s.client_company?.toLowerCase().includes(q)
    );
  };

  if (loading) return (
    <div className="page-loading">
      <div className="page-spinner" />
      <p>Loading kanban board...</p>
    </div>
  );

  return (
    <>
      <Header title="Kanban Board" subtitle="Drag and drop stories to update their stage" />
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
              className="btn btn-primary btn-sm"
              onClick={() => handleAddStory(columns[0]?.id)}
            >
              <Plus size={14} /> New Story
            </button>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="kanban-board">
            {columns.map(column => (
              <StatusGroup
                key={column.id}
                column={column}
                stories={filteredStories(column.id)}
                onAdd={handleAddStory}
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
          onSaved={handleStoryCreated}
        />
      )}

      {viewStory && (
        <StoryDetailModal
          storyId={viewStory.id}
          columns={columns}
          users={users}
          onClose={() => setViewStory(null)}
          onUpdated={handleStoryUpdated}
        />
      )}
    </>
  );
}
