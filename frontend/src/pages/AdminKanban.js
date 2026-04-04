import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check, GripVertical, ChevronDown, ChevronRight, Eye } from 'lucide-react';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './AdminKanban.css';

const DUMMY_CARDS = [
  { id: 1, title: 'Enterprise CRM Deal', company: 'TechCorp Ltd', value: '$45,000', priority: 'high' },
  { id: 2, title: 'SaaS Platform Migration', company: 'Innovate Inc', value: '$28,000', priority: 'critical' },
  { id: 3, title: 'Cloud Infrastructure', company: 'StartupXYZ', value: '$12,500', priority: 'medium' },
  { id: 4, title: 'Digital Transformation', company: 'BigCo Ltd', value: '$95,000', priority: 'high' },
  { id: 5, title: 'Analytics Dashboard', company: 'DataFirm', value: '$18,200', priority: 'low' },
  { id: 6, title: 'Security Audit', company: 'FinTech Co', value: '$31,000', priority: 'critical' },
];

const PRIORITY_COLORS = { critical: '#dc3545', high: '#e67e22', medium: '#f59e0b', low: '#28a745' };

const DEFAULT_COLORS = ['#3e72ae', '#27ae60', '#e74c3c', '#f39c12', '#8e44ad', '#16a085', '#2c3e50', '#d35400'];

export default function AdminKanban() {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editingColumn, setEditingColumn] = useState(null);
  const [editingSubStage, setEditingSubStage] = useState(null);
  const [newColumnForm, setNewColumnForm] = useState({ name: '', color: '#3e72ae', position: 0 });
  const [showNewColumn, setShowNewColumn] = useState(false);
  const [newSubStageNames, setNewSubStageNames] = useState({});
  const [addingSubStage, setAddingSubStage] = useState(null);
  const [selectedSS, setSelectedSS] = useState({}); // { colId: Set<ssId> }

  useEffect(() => {
    loadColumns();
  }, []);

  const loadColumns = async () => {
    try {
      const res = await api.get('/kanban/columns');
      const cols = res.data.columns || [];
      setColumns(cols);
      // Expand first column by default
      if (cols.length > 0) setExpanded({ [cols[0].id]: true });
    } catch (err) {
      toast.error('Failed to load columns');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // Column CRUD
  const createColumn = async () => {
    if (!newColumnForm.name.trim()) return;
    try {
      const res = await api.post('/kanban/columns', {
        ...newColumnForm,
        position: columns.length * 1000,
      });
      setColumns(prev => [...prev, { ...res.data.column, sub_stages: [] }]);
      setNewColumnForm({ name: '', color: '#3e72ae', position: 0 });
      setShowNewColumn(false);
      toast.success('Column created');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create column');
    }
  };

  const updateColumn = async (col) => {
    try {
      await api.put(`/kanban/columns/${col.id}`, {
        name: col.name,
        color: col.color,
      });
      setColumns(prev => prev.map(c => c.id === col.id ? { ...c, name: col.name, color: col.color } : c));
      setEditingColumn(null);
      toast.success('Column updated');
    } catch (err) {
      toast.error('Failed to update column');
    }
  };

  const deleteColumn = async (colId) => {
    if (!window.confirm('Delete this column? This cannot be undone.')) return;
    try {
      await api.delete(`/kanban/columns/${colId}`);
      setColumns(prev => prev.filter(c => c.id !== colId));
      toast.success('Column deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete column');
    }
  };

  // Sub-stage CRUD
  const createSubStage = async (colId) => {
    const name = newSubStageNames[colId]?.trim();
    if (!name) return;
    try {
      const col = columns.find(c => c.id === colId);
      const res = await api.post('/kanban/sub-stages', {
        column_id: colId,
        name,
        position: (col?.sub_stages?.length || 0) * 1000,
      });
      setColumns(prev => prev.map(c =>
        c.id === colId ? { ...c, sub_stages: [...(c.sub_stages || []), res.data.subStage] } : c
      ));
      setNewSubStageNames(p => ({ ...p, [colId]: '' }));
      setAddingSubStage(null);
      toast.success('Sub-stage added');
    } catch (err) {
      toast.error('Failed to add sub-stage');
    }
  };

  const updateSubStage = async (ss) => {
    try {
      await api.put(`/kanban/sub-stages/${ss.id}`, { name: ss.name });
      setColumns(prev => prev.map(c => ({
        ...c,
        sub_stages: (c.sub_stages || []).map(s => s.id === ss.id ? { ...s, name: ss.name } : s)
      })));
      setEditingSubStage(null);
      toast.success('Sub-stage updated');
    } catch (err) {
      toast.error('Failed to update sub-stage');
    }
  };

  const deleteSubStage = async (ssId, colId) => {
    if (!window.confirm('Delete this sub-stage?')) return;
    try {
      await api.delete(`/kanban/sub-stages/${ssId}`);
      setColumns(prev => prev.map(c =>
        c.id === colId ? { ...c, sub_stages: (c.sub_stages || []).filter(s => s.id !== ssId) } : c
      ));
      toast.success('Sub-stage deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete sub-stage');
    }
  };

  const toggleSelectSS = (colId, ssId) => {
    setSelectedSS(prev => {
      const colSet = new Set(prev[colId] || []);
      colSet.has(ssId) ? colSet.delete(ssId) : colSet.add(ssId);
      return { ...prev, [colId]: colSet };
    });
  };

  const toggleSelectAllSS = (colId, subStages) => {
    setSelectedSS(prev => {
      const colSet = prev[colId] || new Set();
      const allSelected = subStages.every(ss => colSet.has(ss.id));
      return { ...prev, [colId]: allSelected ? new Set() : new Set(subStages.map(s => s.id)) };
    });
  };

  const bulkDeleteSS = async (colId) => {
    const ids = [...(selectedSS[colId] || [])];
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} sub-stage${ids.length > 1 ? 's' : ''}?`)) return;
    try {
      await Promise.all(ids.map(id => api.delete(`/kanban/sub-stages/${id}`)));
      setColumns(prev => prev.map(c =>
        c.id === colId ? { ...c, sub_stages: (c.sub_stages || []).filter(s => !ids.includes(s.id)) } : c
      ));
      setSelectedSS(prev => ({ ...prev, [colId]: new Set() }));
      toast.success(`Deleted ${ids.length} sub-stage${ids.length > 1 ? 's' : ''}`);
    } catch (err) {
      toast.error('Failed to delete some sub-stages');
    }
  };

  if (loading) return (
    <div className="page-loading"><div className="page-spinner" /><p>Loading kanban config...</p></div>
  );

  return (
    <>
      <Header title="Kanban Board Setup" subtitle="Configure columns and sub-stages for your pipeline" />
      <div className="page-content admin-kanban-page">
        <div className="kanban-config-layout">

          {/* Left: Config Panel */}
          <div className="config-panel">
            <div className="config-panel-header">
              <h3>Pipeline Stages</h3>
              <span className="config-col-count">{columns.length} stages</span>
            </div>

            <div className="config-columns">
              {columns.map((col, idx) => {
                const isExpanded = !!expanded[col.id];
                const isEditingCol = editingColumn?.id === col.id;

                return (
                  <div key={col.id} className="config-column">
                    {/* Column Header Row */}
                    <div className="config-col-header">
                      <button className="expand-btn" onClick={() => toggleExpand(col.id)}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>

                      {isEditingCol ? (
                        <div className="col-edit-row">
                          <input
                            type="color"
                            value={editingColumn.color}
                            onChange={e => setEditingColumn(p => ({ ...p, color: e.target.value }))}
                            className="col-color-picker"
                          />
                          <input
                            className="col-name-input"
                            value={editingColumn.name}
                            onChange={e => setEditingColumn(p => ({ ...p, name: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && updateColumn(editingColumn)}
                            autoFocus
                          />
                          <button className="icon-btn success" onClick={() => updateColumn(editingColumn)}><Check size={13} /></button>
                          <button className="icon-btn" onClick={() => setEditingColumn(null)}><X size={13} /></button>
                        </div>
                      ) : (
                        <>
                          <div className="col-color-dot" style={{ background: col.color }} />
                          <span className="col-name">{col.name}</span>
                          <span className="col-substage-count">{(col.sub_stages || []).length} stages</span>
                          <div className="col-actions">
                            <button className="icon-btn" onClick={() => setEditingColumn({ ...col })} title="Edit"><Pencil size={13} /></button>
                            <button className="icon-btn danger" onClick={() => deleteColumn(col.id)} title="Delete"><Trash2 size={13} /></button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Sub-stages */}
                    {isExpanded && (
                      <div className="config-substages">
                        {(col.sub_stages || []).length > 0 && (
                          <div className="ss-bulk-bar">
                            <label className="ss-select-all">
                              <input
                                type="checkbox"
                                checked={(col.sub_stages || []).length > 0 && (col.sub_stages || []).every(ss => (selectedSS[col.id] || new Set()).has(ss.id))}
                                onChange={() => toggleSelectAllSS(col.id, col.sub_stages || [])}
                              />
                              <span>Select all</span>
                            </label>
                            {(selectedSS[col.id]?.size > 0) && (
                              <button className="ss-bulk-delete-btn" onClick={() => bulkDeleteSS(col.id)}>
                                <Trash2 size={11} /> Delete {selectedSS[col.id].size} selected
                              </button>
                            )}
                          </div>
                        )}
                        {(col.sub_stages || []).map(ss => {
                          const isEditingSS = editingSubStage?.id === ss.id;
                          const isChecked = (selectedSS[col.id] || new Set()).has(ss.id);
                          return (
                            <div key={ss.id} className={`config-substage ${isChecked ? 'selected' : ''}`}>
                              {isEditingSS ? (
                                <div className="ss-edit-row">
                                  <input
                                    className="ss-name-input"
                                    value={editingSubStage.name}
                                    onChange={e => setEditingSubStage(p => ({ ...p, name: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && updateSubStage(editingSubStage)}
                                    autoFocus
                                  />
                                  <button className="icon-btn success" onClick={() => updateSubStage(editingSubStage)}><Check size={12} /></button>
                                  <button className="icon-btn" onClick={() => setEditingSubStage(null)}><X size={12} /></button>
                                </div>
                              ) : (
                                <>
                                  <input
                                    type="checkbox"
                                    className="ss-checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleSelectSS(col.id, ss.id)}
                                  />
                                  <div className="ss-dot" />
                                  <span className="ss-name">{ss.name}</span>
                                  <div className="ss-actions">
                                    <button className="icon-btn sm" onClick={() => setEditingSubStage({ ...ss })}><Pencil size={11} /></button>
                                    <button className="icon-btn sm danger" onClick={() => deleteSubStage(ss.id, col.id)}><Trash2 size={11} /></button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}

                        {/* Add sub-stage */}
                        {addingSubStage === col.id ? (
                          <div className="add-ss-row">
                            <input
                              className="ss-name-input"
                              placeholder="Sub-stage name..."
                              value={newSubStageNames[col.id] || ''}
                              onChange={e => setNewSubStageNames(p => ({ ...p, [col.id]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && createSubStage(col.id)}
                              autoFocus
                            />
                            <button className="icon-btn success" onClick={() => createSubStage(col.id)}><Check size={12} /></button>
                            <button className="icon-btn" onClick={() => setAddingSubStage(null)}><X size={12} /></button>
                          </div>
                        ) : (
                          <button className="add-ss-btn" onClick={() => setAddingSubStage(col.id)}>
                            <Plus size={12} /> Add Sub-Stage
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Column */}
              {showNewColumn ? (
                <div className="add-col-form">
                  <div className="add-col-row">
                    <input
                      type="color"
                      value={newColumnForm.color}
                      onChange={e => setNewColumnForm(p => ({ ...p, color: e.target.value }))}
                      className="col-color-picker"
                    />
                    <input
                      className="col-name-input"
                      placeholder="Column name..."
                      value={newColumnForm.name}
                      onChange={e => setNewColumnForm(p => ({ ...p, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && createColumn()}
                      autoFocus
                    />
                    <button className="icon-btn success" onClick={createColumn}><Check size={13} /></button>
                    <button className="icon-btn" onClick={() => setShowNewColumn(false)}><X size={13} /></button>
                  </div>
                </div>
              ) : (
                <button className="add-col-btn" onClick={() => setShowNewColumn(true)}>
                  <Plus size={14} /> Add Column
                </button>
              )}
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="preview-panel">
            <div className="preview-panel-header">
              <Eye size={15} />
              <h3>Live Preview</h3>
              <span className="preview-hint">Dummy data — reflects your configuration</span>
            </div>
            <div className="preview-board">
              {columns.map((col, colIdx) => {
                const subStages = col.sub_stages || [];
                const cardsForCol = DUMMY_CARDS.filter((_, i) => i % columns.length === colIdx % columns.length);

                if (subStages.length === 0) {
                  return (
                    <div key={col.id} className="preview-col-group">
                      <div className="preview-col-title" style={{ borderTopColor: col.color }}>
                        <div className="preview-col-dot" style={{ background: col.color }} />
                        <span>{col.name}</span>
                        <span className="preview-col-count">{cardsForCol.length}</span>
                      </div>
                      <div className="preview-substage-cols">
                        <div className="preview-substage-col">
                          <div className="preview-substage-header">—</div>
                          <div className="preview-cards">
                            {cardsForCol.slice(0, 2).map(card => (
                              <div key={card.id} className="preview-card">
                                <div className="preview-card-dot" style={{ background: PRIORITY_COLORS[card.priority] }} />
                                <div className="preview-card-title">{card.title}</div>
                                <div className="preview-card-meta">
                                  <span>{card.company}</span>
                                  <span className="preview-card-value">{card.value}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={col.id} className="preview-col-group">
                    <div className="preview-col-title" style={{ borderTopColor: col.color }}>
                      <div className="preview-col-dot" style={{ background: col.color }} />
                      <span>{col.name}</span>
                      <span className="preview-col-count">{cardsForCol.length}</span>
                    </div>
                    <div className="preview-substage-cols">
                      {subStages.map((ss, ssIdx) => {
                        const ssCards = cardsForCol.filter((_, i) => i % subStages.length === ssIdx % subStages.length);
                        return (
                          <div key={ss.id} className="preview-substage-col">
                            <div className="preview-substage-header">{ss.name}</div>
                            <div className="preview-cards">
                              {ssCards.slice(0, 2).map(card => (
                                <div key={card.id} className="preview-card">
                                  <div className="preview-card-dot" style={{ background: PRIORITY_COLORS[card.priority] }} />
                                  <div className="preview-card-title">{card.title}</div>
                                  <div className="preview-card-meta">
                                    <span>{card.company}</span>
                                    <span className="preview-card-value">{card.value}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {columns.length === 0 && (
                <div className="preview-empty">
                  <p>No columns configured yet</p>
                  <p>Add columns on the left to see preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
