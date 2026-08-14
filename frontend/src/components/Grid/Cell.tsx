import { useState } from 'react';
import type { Column } from '../../types';

interface CellProps {
  value: string | number | null;
  column: Column;
  onSave: (newValue: string | number | null) => void;
}

export function Cell({ value, column, onSave }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));

  function startEditing() {
    setDraft(String(value ?? ''));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const finalValue = column.type === 'number' ? Number(draft) || null : draft || null;
    if (finalValue !== value) {
      onSave(finalValue);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  }

  if (!editing) {
    return (
      <td onClick={startEditing} className="cell">
        {String(value ?? '')}
      </td>
    );
  }

  const inputType =
    column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text';

  return (
    <td className="cell cell-editing">
      <input
        type={inputType}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    </td>
  );
}