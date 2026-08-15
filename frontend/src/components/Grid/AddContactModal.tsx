import { useState } from 'react';
import type { Column } from '../../types';

interface AddContactModalProps {
  columns: Column[];
  onSubmit: (data: Record<string, string | number | null>) => Promise<void>;
  onClose: () => void;
}

export function AddContactModal({ columns, onSubmit, onClose }: AddContactModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const data: Record<string, string | number | null> = {};
      columns.forEach((col) => {
        const raw = values[col.key];
        if (!raw) {
          data[col.key] = null;
        } else if (col.type === 'number') {
          const num = Number(raw);
          data[col.key] = Number.isNaN(num) ? null : num;
        } else {
          data[col.key] = raw;
        }
      });
      await onSubmit(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <strong>New contact</strong>
          <button type="button" onClick={onClose}>
            &times;
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <div className="modal-body">
          {columns.map((col) => (
            <label key={col.id} className="modal-field">
              <span>{col.label}</span>
              <input
                type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
                value={values[col.key] ?? ''}
                onChange={(e) => handleChange(col.key, e.target.value)}
              />
            </label>
          ))}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="modal-submit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Adding...' : 'Add contact'}
          </button>
        </div>
      </div>
    </div>
  );
}