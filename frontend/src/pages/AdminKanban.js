import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check, Eye } from 'lucide-react';
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

export default function AdminKanban() {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingColumn, setEditingColumn] = useState(null);
  const [newColumnForm, setNewColumnForm] = useState({ name: '', color: '#3e72ae' });
  const [showNewColumn, setShowNewColumn] = useState(false);

  useEffect(() => { loadColumns(); }, []);

  const loadColumns = async () => {
    try {
      const res = await api.get('/kanban/columns');
      setColumns(res.data.columns || []);
    } catch {
      toast.error('Failed to load columns');
    } finally {
      setLoading(false);
    }
  };

  const createColumn = async () => {
    if (!newColumnForm.name.trim()) return;
    try {
      const res = await api.post('/kanban/columns', {
        ...newColumnForm,
        position: columns.length * 1000,
      });
      setColumns(prev => [...prev, { ...res.data.column, sub_stages: [] }]);
      setNewColumnForm({ name: '', color: '#3e72ae' });
      setShowNewColumn(false);
      toast.success('Stage added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add stage');
    }
  };

  const updateColumn = async (col) => {
    try {
      await api.put(`/kanban/columns/${col.id}`, { name: col.name, color: col.color });
      setColumns(prev => prev.map(c => c.id === col.id ? { ...c, name: col.name, color: col.color } : c));
      setEditingColumn(null);
      toast.success('Stage updated');
    } catch {
      toast.error('Failed to update stage');
    }
  };

  const deleteColumn = async (colId) => {
    if (!window.confirm('Delete this stage? This cannot be undone.')) return;
    try {
      await api.delete(`/kanban/columns/${colId}`);
      setColumns(prev => prev.filter(c => c.id !== colId));
      toast.success('Stage deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete stage');
    }
  };

  if (loading) return (
    <div className="page-loading"><div className="page-spinner" /><p>Loading kanban config...</p></div>
  );

  return (
    <>
      <Header title="Kanban Board Setup" subtitle="Configure pipeline stages for your board" />
      <div className="page-content admin-kanban-page">
        <div className="kanban-config-layout">

          {/* Left: Stage Config Panel */}
          <div className="config-panel">
            <div className="config-panel-header">
              <h3>Pipeline Stages</h3>
              <span className="config-col-count">{columns.length} stages</span>
            </div>

            <div className="config-columns">
              {columns.map((col) => {
                const isEditing = editingColumn?.id === col.id;
                return (
                  <div key={col.id} className="config-column">
                    <div className="config-col-header">
                      {isEditing ? (
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
                          <div className="col-actions">
                            <button className="icon-btn" onClick={() => setEditingColumn({ ...col })} title="Edit"><Pencil size={13} /></button>
                            <button className="icon-btn danger" onClick={() => deleteColumn(col.id)} title="Delete"><Trash2 size={13} /></button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Stage */}
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
                      placeholder="Stage name..."
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
                  <Plus size={14} /> Add Stage
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
                const cards = DUMMY_CARDS.filter((_, i) => i % columns.length === colIdx % columns.length);
                return (
                  <div key={col.id} className="preview-col-group">
                    <div className="preview-col-title" style={{ borderTopColor: col.color }}>
                      <div className="preview-col-dot" style={{ background: col.color }} />
                      <span>{col.name}</span>
                      <span className="preview-col-count">{cards.length}</span>
                    </div>
                    <div className="preview-cards">
                      {cards.slice(0, 2).map(card => (
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
              {columns.length === 0 && (
                <div className="preview-empty">
                  <p>No stages configured yet</p>
                  <p>Add stages on the left to see preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
