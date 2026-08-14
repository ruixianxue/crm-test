import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createColumn, deleteColumn, updateColumn, reorderColumns } from '../../api/columns';
import type { Column, ColumnType } from '../../types';
import './ColumnManager.css';

interface ColumnManagerProps {
  columns: Column[];
  onChange: () => void;
}

const COLUMN_TYPES: ColumnType[] = ['text', 'number', 'date', 'phone'];

function SortableColumnItem({
  column,
  onRename,
  onDelete,
}: {
  column: Column;
  onRename: (col: Column, label: string) => void;
  onDelete: (col: Column) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style} className="column-item">
      <span className="drag-handle" {...attributes} {...listeners}>
        ⠿
      </span>
      <input defaultValue={column.label} onBlur={(e) => onRename(column, e.target.value)} />
      <span className="column-type-badge">{column.type}</span>
      <button onClick={() => onDelete(column)}>Delete</button>
    </li>
  );
}

export function ColumnManager({ columns, onChange }: ColumnManagerProps) {
  const [open, setOpen] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<ColumnType>('text');
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  async function handleAdd() {
    setError(null);
    if (!newKey.trim() || !newLabel.trim()) {
      setError('Key and label are required');
      return;
    }
    try {
      await createColumn({ key: newKey.trim(), label: newLabel.trim(), type: newType });
      setNewKey('');
      setNewLabel('');
      setNewType('text');
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add column');
    }
  }

  async function handleRename(column: Column, newLabel: string) {
    if (!newLabel.trim() || newLabel === column.label) return;
    try {
      await updateColumn(column.id, newLabel.trim());
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename column');
    }
  }

  async function handleDelete(column: Column) {
    if (!confirm(`Delete column "${column.label}"? This cannot be undone.`)) return;
    try {
      await deleteColumn(column.id);
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete column');
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columns.findIndex((c) => c.id === active.id);
    const newIndex = columns.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(columns, oldIndex, newIndex);

    try {
      await reorderColumns(reordered.map((c, index) => ({ id: c.id, position: index })));
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder columns');
    }
  }

  if (!open) {
    return (
      <button className="column-manager-toggle" onClick={() => setOpen(true)}>
        Manage columns
      </button>
    );
  }

  return (
    <div className="column-manager">
      <div className="column-manager-header">
        <strong>Manage columns</strong>
        <button onClick={() => setOpen(false)}>Close</button>
      </div>

      {error && <div className="column-manager-error">{error}</div>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="column-list">
            {columns.map((col) => (
              <SortableColumnItem
                key={col.id}
                column={col}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <div className="column-add-form">
        <input
          placeholder="key (e.g. notes)"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
        />
        <input
          placeholder="Label (e.g. Notes)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <select value={newType} onChange={(e) => setNewType(e.target.value as ColumnType)}>
          {COLUMN_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button onClick={handleAdd}>Add column</button>
      </div>
    </div>
  );
}