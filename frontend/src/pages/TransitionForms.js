import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, X, Settings, GripVertical, FileText, ChevronRight,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Header from '../components/layout/Header';
import api from '../utils/api';
import toast from 'react-hot-toast';
import './TransitionForms.css';

// ── Constants ────────────────────────────────────────────────────────────────

const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'radio', 'checkbox'];

const FIELD_TYPE_LABELS = {
  text: 'Text',
  textarea: 'Textarea',
  number: 'Number',
  date: 'Date',
  select: 'Select',
  radio: 'Radio',
  checkbox: 'Checkbox',
};

const TYPES_WITH_OPTIONS = ['select', 'radio', 'checkbox'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  return (
    <span className={`tf-type-badge tf-type-badge--${type}`}>
      {FIELD_TYPE_LABELS[type] || type}
    </span>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label className="tf-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="tf-toggle-slider" />
    </label>
  );
}

// ── Sortable field item ───────────────────────────────────────────────────────

function SortableFieldItem({ field, onEdit, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tf-field-item${isDragging ? ' dragging' : ''}`}
    >
      <span className="tf-drag-handle" {...attributes} {...listeners}>
        <GripVertical size={15} />
      </span>
      <span className="tf-field-position">{field.position}</span>
      <TypeBadge type={field.field_type} />
      <div className="tf-field-info">
        <span className="tf-field-label">{field.label || <em style={{ color: 'var(--text-light)' }}>Untitled</em>}</span>
        {field.placeholder && (
          <span className="tf-field-placeholder">"{field.placeholder}"</span>
        )}
      </div>
      {field.is_required && <span className="tf-required-badge">Required</span>}
      <div className="tf-field-actions">
        <button
          className="tbl-btn tbl-btn-edit"
          title="Edit field"
          onClick={() => onEdit(field)}
        >
          <Pencil size={12} />
        </button>
        <button
          className="tbl-btn tbl-btn-delete"
          title="Delete field"
          onClick={() => onDelete(field)}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Options builder ───────────────────────────────────────────────────────────

function OptionsBuilder({ options, onChange }) {
  const addOption = () => onChange([...options, '']);
  const removeOption = (idx) => onChange(options.filter((_, i) => i !== idx));
  const updateOption = (idx, val) => onChange(options.map((o, i) => i === idx ? val : o));

  return (
    <div className="tf-options-section">
      <div className="tf-options-label">Options</div>
      <div className="tf-options-list">
        {options.map((opt, idx) => (
          <div key={idx} className="tf-option-row">
            <input
              className="form-control"
              placeholder={`Option ${idx + 1}`}
              value={opt}
              onChange={e => updateOption(idx, e.target.value)}
            />
            <button className="tf-option-remove" type="button" onClick={() => removeOption(idx)} title="Remove option">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button className="tf-add-option-btn" type="button" onClick={addOption}>
        <Plus size={12} /> Add Option
      </button>
    </div>
  );
}

// ── Field Sub-Modal (Add/Edit Field) ─────────────────────────────────────────

const BLANK_FIELD = {
  field_type: 'text',
  label: '',
  placeholder: '',
  is_required: false,
  options: [],
};

function FieldModal({ editingField, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => {
    if (editingField) {
      return {
        field_type: editingField.field_type || 'text',
        label: editingField.label || '',
        placeholder: editingField.placeholder || '',
        is_required: !!editingField.is_required,
        options: Array.isArray(editingField.options) ? [...editingField.options] : [],
      };
    }
    return { ...BLANK_FIELD, options: [] };
  });

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleTypeChange = (val) => {
    setForm(p => ({
      ...p,
      field_type: val,
      options: TYPES_WITH_OPTIONS.includes(val) ? (p.options.length ? p.options : ['']) : [],
    }));
  };

  const handleSave = () => {
    if (!form.label.trim()) { toast.error('Field label is required'); return; }
    if (TYPES_WITH_OPTIONS.includes(form.field_type)) {
      const cleaned = form.options.map(o => o.trim()).filter(Boolean);
      if (cleaned.length === 0) { toast.error('At least one option is required'); return; }
      onSave({ ...form, options: cleaned });
    } else {
      onSave({ ...form, options: [] });
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <h2 className="modal-title">{editingField ? 'Edit Field' : 'Add Field'}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Field Type</label>
            <select
              className="form-control"
              value={form.field_type}
              onChange={e => handleTypeChange(e.target.value)}
            >
              {FIELD_TYPES.map(t => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Label <span style={{ color: 'var(--error)' }}>*</span></label>
            <input
              className="form-control"
              placeholder="e.g. Customer Name"
              value={form.label}
              onChange={e => set('label', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Placeholder</label>
            <input
              className="form-control"
              placeholder="e.g. Enter customer name..."
              value={form.placeholder}
              onChange={e => set('placeholder', e.target.value)}
            />
          </div>

          <div className="tf-toggle-row" style={{ marginBottom: 16 }}>
            <div>
              <div className="tf-toggle-label">Required</div>
              <div className="tf-toggle-desc">User must fill this field before moving the stage</div>
            </div>
            <Toggle checked={form.is_required} onChange={val => set('is_required', val)} />
          </div>

          {TYPES_WITH_OPTIONS.includes(form.field_type) && (
            <OptionsBuilder
              options={form.options}
              onChange={opts => set('options', opts)}
            />
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="btn-spinner" /> Saving...</> : editingField ? 'Update Field' : 'Add Field'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field Builder Modal ───────────────────────────────────────────────────────

function FieldBuilderModal({ form: tfForm, onClose }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const loadFields = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/transition-forms/${tfForm.id}/fields`);
      const sorted = (res.data.fields || []).sort((a, b) => a.position - b.position);
      setFields(sorted);
    } catch {
      toast.error('Failed to load fields');
    } finally {
      setLoading(false);
    }
  }, [tfForm.id]);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex(f => f.id === active.id);
    const newIndex = fields.findIndex(f => f.id === over.id);
    const reordered = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
      ...f,
      position: i + 1,
    }));
    setFields(reordered);

    try {
      await api.put(`/transition-forms/${tfForm.id}/fields/reorder`, {
        fields: reordered.map(f => ({ id: f.id, position: f.position })),
      });
    } catch {
      toast.error('Failed to save order');
      loadFields();
    }
  };

  const openAddField = () => {
    setEditingField(null);
    setShowFieldModal(true);
  };

  const openEditField = (field) => {
    setEditingField(field);
    setShowFieldModal(true);
  };

  const saveField = async (fieldData) => {
    setSaving(true);
    try {
      if (editingField) {
        await api.put(`/transition-forms/fields/${editingField.id}`, fieldData);
        toast.success('Field updated');
      } else {
        const position = fields.length + 1;
        await api.post(`/transition-forms/${tfForm.id}/fields`, { ...fieldData, position });
        toast.success('Field added');
      }
      setShowFieldModal(false);
      setEditingField(null);
      loadFields();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save field');
    } finally {
      setSaving(false);
    }
  };

  const deleteField = async (field) => {
    if (!window.confirm(`Delete field "${field.label}"?`)) return;
    try {
      await api.delete(`/transition-forms/fields/${field.id}`);
      toast.success('Field deleted');
      loadFields();
    } catch {
      toast.error('Failed to delete field');
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-lg">
          <div className="modal-header">
            <div>
              <h2 className="modal-title">Manage Fields</h2>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {tfForm.name}
                {tfForm.from_column_name && (
                  <span style={{ marginLeft: 8 }}>
                    <span className="tf-stage-name">{tfForm.from_column_name}</span>
                    <span style={{ margin: '0 4px', color: 'var(--text-light)' }}>→</span>
                    <span className="tf-stage-name">{tfForm.to_column_name}</span>
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={openAddField}>
                <Plus size={14} /> Add Field
              </button>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
            </div>
          </div>

          <div className="modal-body">
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <div className="page-spinner" />
              </div>
            ) : fields.length === 0 ? (
              <div className="tf-field-list-empty">
                <FileText size={36} color="#e2e8f0" />
                <p>No fields yet. Click "Add Field" to create the first one.</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={fields.map(f => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="tf-field-list">
                    {fields.map(field => (
                      <SortableFieldItem
                        key={field.id}
                        field={field}
                        onEdit={openEditField}
                        onDelete={deleteField}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {fields.length} field{fields.length !== 1 ? 's' : ''} — drag to reorder
            </span>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {showFieldModal && (
        <FieldModal
          editingField={editingField}
          onSave={saveField}
          onClose={() => { setShowFieldModal(false); setEditingField(null); }}
          saving={saving}
        />
      )}
    </>
  );
}

// ── Create/Edit Form Modal ────────────────────────────────────────────────────

const BLANK_FORM = {
  name: '',
  from_column_id: '',
  to_column_id: '',
  is_mandatory: false,
  is_active: true,
};

function FormModal({ editingForm, columns, onSave, onClose, saving }) {
  const [form, setForm] = useState(() => {
    if (editingForm) {
      return {
        name: editingForm.name || '',
        from_column_id: String(editingForm.from_column_id || ''),
        to_column_id: String(editingForm.to_column_id || ''),
        is_mandatory: !!editingForm.is_mandatory,
        is_active: editingForm.is_active !== false,
      };
    }
    return { ...BLANK_FORM };
  });

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Form name is required'); return; }
    if (!form.from_column_id) { toast.error('From stage is required'); return; }
    if (!form.to_column_id) { toast.error('To stage is required'); return; }
    if (form.from_column_id === form.to_column_id) {
      toast.error('From and To stages must be different');
      return;
    }
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <h2 className="modal-title">{editingForm ? 'Edit Transition Form' : 'New Transition Form'}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Form Name <span style={{ color: 'var(--error)' }}>*</span></label>
            <input
              className="form-control"
              placeholder="e.g. Qualification to Demo"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">From Stage <span style={{ color: 'var(--error)' }}>*</span></label>
              <select
                className="form-control"
                value={form.from_column_id}
                onChange={e => set('from_column_id', e.target.value)}
                disabled={!!editingForm}
              >
                <option value="">Select stage…</option>
                {columns.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">To Stage <span style={{ color: 'var(--error)' }}>*</span></label>
              <select
                className="form-control"
                value={form.to_column_id}
                onChange={e => set('to_column_id', e.target.value)}
                disabled={!!editingForm}
              >
                <option value="">Select stage…</option>
                {columns.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {editingForm && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius)',
                padding: '8px 12px',
                marginBottom: 16,
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              <span style={{ color: 'var(--text-light)' }}>ℹ</span>
              Stage columns cannot be changed after creation. Delete and recreate if needed.
            </div>
          )}

          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: '4px 0',
              border: '1px solid var(--border-light)',
            }}
          >
            <div className="tf-toggle-row" style={{ padding: '12px 16px' }}>
              <div>
                <div className="tf-toggle-label">Mandatory</div>
                <div className="tf-toggle-desc">Form must be submitted when moving between these stages</div>
              </div>
              <Toggle checked={form.is_mandatory} onChange={val => set('is_mandatory', val)} />
            </div>

            {editingForm && (
              <div className="tf-toggle-row" style={{ padding: '12px 16px' }}>
                <div>
                  <div className="tf-toggle-label">Active</div>
                  <div className="tf-toggle-desc">Inactive forms are ignored during stage transitions</div>
                </div>
                <Toggle checked={form.is_active} onChange={val => set('is_active', val)} />
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving
              ? <><span className="btn-spinner" /> Saving...</>
              : editingForm ? 'Update Form' : 'Create Form'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TransitionForms() {
  const [forms, setForms] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form CRUD modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // Field builder modal
  const [builderForm, setBuilderForm] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [formsRes, colsRes] = await Promise.all([
        api.get('/transition-forms'),
        api.get('/kanban/columns'),
      ]);
      setForms(formsRes.data.forms || []);
      setColumns(colsRes.data.columns || []);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadForms = async () => {
    try {
      const res = await api.get('/transition-forms');
      setForms(res.data.forms || []);
    } catch {
      toast.error('Failed to reload forms');
    }
  };

  const openCreate = () => {
    setEditingForm(null);
    setShowFormModal(true);
  };

  const openEdit = (form) => {
    setEditingForm(form);
    setShowFormModal(true);
  };

  const saveForm = async (formData) => {
    setSaving(true);
    try {
      if (editingForm) {
        await api.put(`/transition-forms/${editingForm.id}`, {
          name: formData.name,
          is_mandatory: formData.is_mandatory,
          is_active: formData.is_active,
        });
        toast.success('Form updated');
      } else {
        await api.post('/transition-forms', {
          name: formData.name,
          from_column_id: Number(formData.from_column_id),
          to_column_id: Number(formData.to_column_id),
          is_mandatory: formData.is_mandatory,
        });
        toast.success('Form created');
      }
      setShowFormModal(false);
      setEditingForm(null);
      loadForms();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  const deleteForm = async (form) => {
    if (!window.confirm(`Delete transition form "${form.name}"? This will also delete all its fields.`)) return;
    try {
      await api.delete(`/transition-forms/${form.id}`);
      toast.success('Form deleted');
      loadForms();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete form');
    }
  };

  if (loading) return <div className="page-loading"><div className="page-spinner" /></div>;

  return (
    <>
      <Header
        title="Transition Forms"
        subtitle="Configure forms that appear when moving stories between pipeline stages"
      />

      <div className="page-content tf-page">
        {/* Toolbar */}
        <div className="tf-toolbar">
          <div className="tf-toolbar-left">
            <span className="tf-count">{forms.length} form{forms.length !== 1 ? 's' : ''}</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} /> New Form
          </button>
        </div>

        {/* Table */}
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Form Name</th>
                  <th>Stage Transition</th>
                  <th>Fields</th>
                  <th>Mandatory</th>
                  <th>Status</th>
                  <th style={{ width: 160, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {forms.length === 0 ? (
                  <tr className="table-empty-row">
                    <td colSpan={6}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <FileText size={32} color="#e2e8f0" />
                        <span>No transition forms yet. Click "New Form" to create one.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  forms.map(form => (
                    <tr key={form.id}>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                          {form.name}
                        </span>
                      </td>
                      <td>
                        <div className="tf-stage-flow">
                          <span className="tf-stage-name">{form.from_column_name || '—'}</span>
                          <ChevronRight size={13} color="var(--text-light)" />
                          <span className="tf-stage-name">{form.to_column_name || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-full)',
                            padding: '2px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {form.field_count ?? 0}
                        </span>
                      </td>
                      <td>
                        {form.is_mandatory
                          ? <span className="tf-badge-yes">Yes</span>
                          : <span className="tf-badge-no">No</span>}
                      </td>
                      <td>
                        {form.is_active
                          ? <span className="badge badge-success">Active</span>
                          : <span className="badge badge-muted">Inactive</span>}
                      </td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: 'flex-end', width: '100%' }}>
                          <button
                            className="tbl-btn tbl-btn-manage"
                            title="Manage Fields"
                            onClick={() => setBuilderForm(form)}
                          >
                            <Settings size={13} />
                          </button>
                          <button
                            className="tbl-btn tbl-btn-edit"
                            title="Edit Form"
                            onClick={() => openEdit(form)}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="tbl-btn tbl-btn-delete"
                            title="Delete Form"
                            onClick={() => deleteForm(form)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showFormModal && (
        <FormModal
          editingForm={editingForm}
          columns={columns}
          onSave={saveForm}
          onClose={() => { setShowFormModal(false); setEditingForm(null); }}
          saving={saving}
        />
      )}

      {/* Field Builder Modal */}
      {builderForm && (
        <FieldBuilderModal
          form={builderForm}
          onClose={() => setBuilderForm(null)}
        />
      )}
    </>
  );
}
