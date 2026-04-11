import React, { useState } from 'react';
import { X, ArrowRight, AlertTriangle, Info } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function TransitionFormModal({
  form,
  fromColumnName,
  toColumnName,
  storyId,
  fromColumnId,
  toColumnId,
  onSubmit,
  onSkip,
  onCancel,
}) {
  const [values, setValues] = useState(() => {
    const init = {};
    (form.fields || []).forEach(f => {
      init[f.id] = f.field_type === 'checkbox' ? [] : '';
    });
    return init;
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const setValue = (fieldId, value) => {
    setValues(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
    }
  };

  const handleCheckbox = (fieldId, optVal, checked) => {
    setValues(prev => {
      const current = Array.isArray(prev[fieldId]) ? prev[fieldId] : [];
      const next = checked
        ? [...current, optVal]
        : current.filter(v => v !== optVal);
      return { ...prev, [fieldId]: next };
    });
    if (errors[fieldId]) {
      setErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
    }
  };

  const validate = () => {
    const newErrors = {};
    (form.fields || []).forEach(f => {
      if (!f.is_required) return;
      const val = values[f.id];
      if (f.field_type === 'checkbox') {
        if (!Array.isArray(val) || val.length === 0) {
          newErrors[f.id] = 'This field is required.';
        }
      } else {
        if (!val || String(val).trim() === '') {
          newErrors[f.id] = 'This field is required.';
        }
      }
    });
    return newErrors;
  };

  const handleSubmit = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const responses = (form.fields || []).map(f => ({
      field_id: f.id,
      field_label: f.label,
      field_type: f.field_type,
      value: f.field_type === 'checkbox'
        ? (Array.isArray(values[f.id]) ? values[f.id].join(', ') : '')
        : (values[f.id] ?? ''),
    }));

    setSubmitting(true);
    try {
      await api.post(`/transition-forms/${form.id}/responses`, {
        story_id: storyId,
        from_column_id: fromColumnId,
        to_column_id: toColumnId,
        from_column_name: fromColumnName,
        to_column_name: toColumnName,
        responses,
      });
      onSubmit(responses);
    } catch {
      toast.error('Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const val = values[field.id];
    const error = errors[field.id];

    return (
      <div key={field.id} className="form-group">
        <label className="form-label">
          {field.label}
          {field.is_required && <span style={{ color: 'var(--error)', marginLeft: 3 }}>*</span>}
        </label>

        {field.field_type === 'text' && (
          <input
            type="text"
            className={`form-control${error ? ' is-invalid' : ''}`}
            placeholder={field.placeholder || ''}
            value={val}
            onChange={e => setValue(field.id, e.target.value)}
          />
        )}

        {field.field_type === 'textarea' && (
          <textarea
            className={`form-control${error ? ' is-invalid' : ''}`}
            placeholder={field.placeholder || ''}
            value={val}
            rows={3}
            onChange={e => setValue(field.id, e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
          />
        )}

        {field.field_type === 'number' && (
          <input
            type="number"
            className={`form-control${error ? ' is-invalid' : ''}`}
            placeholder={field.placeholder || ''}
            value={val}
            onChange={e => setValue(field.id, e.target.value)}
          />
        )}

        {field.field_type === 'date' && (
          <input
            type="date"
            className={`form-control${error ? ' is-invalid' : ''}`}
            value={val}
            onChange={e => setValue(field.id, e.target.value)}
          />
        )}

        {field.field_type === 'select' && (
          <select
            className={`form-control${error ? ' is-invalid' : ''}`}
            value={val}
            onChange={e => setValue(field.id, e.target.value)}
          >
            <option value="">— Select —</option>
            {(field.options || []).map((opt, i) => (
              <option key={i} value={opt.value ?? opt}>{opt.label ?? opt}</option>
            ))}
          </select>
        )}

        {field.field_type === 'radio' && (
          <div className="tfm-option-group">
            {(field.options || []).map((opt, i) => {
              const optVal = opt.value ?? opt;
              const optLabel = opt.label ?? opt;
              return (
                <label key={i} className="tfm-option-label">
                  <input
                    type="radio"
                    name={`field_${field.id}`}
                    value={optVal}
                    checked={val === optVal}
                    onChange={() => setValue(field.id, optVal)}
                  />
                  <span>{optLabel}</span>
                </label>
              );
            })}
          </div>
        )}

        {field.field_type === 'checkbox' && (
          <div className="tfm-option-group">
            {(field.options || []).map((opt, i) => {
              const optVal = opt.value ?? opt;
              const optLabel = opt.label ?? opt;
              const checked = Array.isArray(val) && val.includes(optVal);
              return (
                <label key={i} className="tfm-option-label">
                  <input
                    type="checkbox"
                    value={optVal}
                    checked={checked}
                    onChange={e => handleCheckbox(field.id, optVal, e.target.checked)}
                  />
                  <span>{optLabel}</span>
                </label>
              );
            })}
          </div>
        )}

        {error && (
          <p className="tfm-field-error">{error}</p>
        )}
      </div>
    );
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Transition Form
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{fromColumnName}</span>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{toColumnName}</span>
              </span>
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{form.name}</p>
          </div>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: 0 }}>
          {/* Mandatory / optional badge */}
          <div style={{ marginBottom: 18 }}>
            {form.is_mandatory ? (
              <div className="tfm-badge tfm-badge--warning">
                <AlertTriangle size={13} />
                This form must be completed to proceed
              </div>
            ) : (
              <div className="tfm-badge tfm-badge--info">
                <Info size={13} />
                Optional — you can skip this form
              </div>
            )}
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(form.fields || []).map(renderField)}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
          {!form.is_mandatory && (
            <button className="btn btn-secondary btn-sm" onClick={onSkip}>
              Skip
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit Form'}
          </button>
        </div>
      </div>

      <style>{`
        .tfm-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          width: 100%;
          box-sizing: border-box;
        }
        .tfm-badge--warning {
          background: #fffbeb;
          color: #92400e;
          border: 1px solid #fde68a;
        }
        .tfm-badge--info {
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
        }
        .tfm-option-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 4px 0;
        }
        .tfm-option-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--text-primary);
          cursor: pointer;
          padding: 2px 0;
        }
        .tfm-option-label input {
          accent-color: var(--primary);
          width: 15px;
          height: 15px;
          flex-shrink: 0;
          cursor: pointer;
        }
        .tfm-field-error {
          margin: 4px 0 0;
          font-size: 11px;
          color: var(--error, #dc3545);
        }
        .form-control.is-invalid {
          border-color: var(--error, #dc3545);
        }
      `}</style>
    </div>
  );
}
