import { useCallback, useEffect, useState } from 'react';
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
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  fetchColumns,
  createColumn,
  deleteColumn,
  updateColumn,
  reorderColumns,
} from '../../api/columns';
import { fetchContacts, updateContact, createContact, deleteContact } from '../../api/contacts';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { Cell } from './Cell';
import { AddContactModal } from './AddContactModal';
import type { Column, ColumnType, Contact } from '../../types';
import './Grid.css';

const PAGE_SIZE = 50;
const COLUMN_TYPES: ColumnType[] = ['text', 'number', 'date', 'phone'];

type SortDir = 'ASC' | 'DESC' | null;

function SortableHeaderCell({
  column,
  sortBy,
  sortDir,
  onSort,
  onRename,
  onDelete,
}: {
  column: Column;
  sortBy: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  onRename: (col: Column, label: string) => void;
  onDelete: (col: Column) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: column.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(column.label);

  function commitRename() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== column.label) {
      onRename(column, draft.trim());
    } else {
      setDraft(column.label);
    }
  }

  return (
    <th ref={setNodeRef} style={style} className="header-cell">
      <div className="header-cell-inner">
        <span className="drag-handle" {...attributes} {...listeners}>
          ⠿
        </span>

        {editing ? (
          <input
            className="header-rename-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setDraft(column.label);
                setEditing(false);
              }
            }}
          />
        ) : (
          <span className="header-label" onClick={() => onSort(column.key)}>
            {column.label}
            {sortBy === column.key && (sortDir === 'ASC' ? ' \u2191' : ' \u2193')}
          </span>
        )}

        <span className="header-actions">
          <button
            type="button"
            className="header-icon-btn"
            title="Rename column"
            onClick={() => setEditing(true)}
          >
            &#9998;
          </button>
          <button
            type="button"
            className="header-icon-btn header-icon-btn-danger"
            title="Delete column"
            onClick={() => onDelete(column)}
          >
            &times;
          </button>
        </span>
      </div>
    </th>
  );
}

function AddColumnCell({
  onAdd,
}: {
  onAdd: (input: { key: string; label: string; type: ColumnType }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ColumnType>('text');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!key.trim() || !label.trim()) {
      setError('Key and label required');
      return;
    }
    try {
      await onAdd({ key: key.trim(), label: label.trim(), type });
      setKey('');
      setLabel('');
      setType('text');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add column');
    }
  }

  if (!open) {
    return (
      <th className="add-column-cell">
        <button
          type="button"
          className="add-column-btn"
          onClick={() => setOpen(true)}
          title="Add column"
        >
          +
        </button>
      </th>
    );
  }

  return (
    <th className="add-column-cell add-column-cell-open">
      <div className="add-column-form">
        {error && <div className="add-column-error">{error}</div>}
        <input placeholder="key" value={key} onChange={(e) => setKey(e.target.value)} />
        <input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value as ColumnType)}>
          {COLUMN_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="add-column-form-actions">
          <button type="button" onClick={handleSubmit}>
            Add
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </div>
    </th>
  );
}

export function Grid() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [sortBy, setSortBy] = useState<string | null>(
    () => localStorage.getItem('rodium-crm-sortBy') || null,
  );
  const [sortDir, setSortDir] = useState<SortDir>(
    () => (localStorage.getItem('rodium-crm-sortDir') as SortDir) || null,
  );
  const [filterBy, setFilterBy] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const loadColumns = useCallback(() => {
    fetchColumns()
      .then(setColumns)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load columns'));
  }, []);

  useEffect(() => {
    loadColumns();
  }, [loadColumns]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setContacts([]);
      setHasMore(false);
      try {
        const res = await fetchContacts({
          offset: 0,
          limit: PAGE_SIZE,
          sortBy: sortBy ?? undefined,
          sortDir: sortDir ?? undefined,
          filterBy: filterBy ?? undefined,
          filterValue: filterBy ? filterValue : undefined,
        });
        if (cancelled) return;
        setContacts(res.items);
        setHasMore(res.hasMore);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load data';
        if (cancelled) return;
        if (message.includes('Unknown sort column') || message.includes('Unknown filter column')) {
          setSortBy(null);
          setSortDir(null);
          setFilterBy(null);
          setFilterValue('');
          localStorage.removeItem('rodium-crm-sortBy');
          localStorage.removeItem('rodium-crm-sortDir');
          return;
        }
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [sortBy, sortDir, filterBy, filterValue]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchContacts({
        offset: contacts.length,
        limit: PAGE_SIZE,
        sortBy: sortBy ?? undefined,
        sortDir: sortDir ?? undefined,
        filterBy: filterBy ?? undefined,
        filterValue: filterBy ? filterValue : undefined,
      });
      setContacts((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [contacts.length, hasMore, loadingMore, sortBy, sortDir, filterBy, filterValue]);

  const sentinelRef = useInfiniteScroll(loadMore, !loading && hasMore);

  async function handleCellSave(
    contact: Contact,
    columnKey: string,
    newValue: string | number | null,
  ) {
    const previousContacts = contacts;
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contact.id ? { ...c, data: { ...c.data, [columnKey]: newValue } } : c,
      ),
    );
    try {
      await updateContact(contact.id, { [columnKey]: newValue });
    } catch (err) {
      setContacts(previousContacts);
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleAddContact(data: Record<string, string | number | null>) {
    const newContact = await createContact(data);
    setContacts((prev) => [newContact, ...prev]);
  }

  async function handleDeleteContact(contact: Contact) {
    if (!confirm('Delete this contact? This cannot be undone.')) return;
    const previousContacts = contacts;
    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    try {
      await deleteContact(contact.id);
    } catch (err) {
      setContacts(previousContacts);
      setError(err instanceof Error ? err.message : 'Failed to delete contact');
    }
  }

  function handleSort(columnKey: string) {
    let newSortBy: string | null;
    let newSortDir: SortDir;

    if (sortBy !== columnKey) {
      newSortBy = columnKey;
      newSortDir = 'ASC';
    } else if (sortDir === 'ASC') {
      newSortBy = columnKey;
      newSortDir = 'DESC';
    } else {
      newSortBy = null;
      newSortDir = null;
    }

    setSortBy(newSortBy);
    setSortDir(newSortDir);

    if (newSortBy && newSortDir) {
      localStorage.setItem('rodium-crm-sortBy', newSortBy);
      localStorage.setItem('rodium-crm-sortDir', newSortDir);
    } else {
      localStorage.removeItem('rodium-crm-sortBy');
      localStorage.removeItem('rodium-crm-sortDir');
    }
  }

  async function handleRename(column: Column, newLabel: string) {
    try {
      await updateColumn(column.id, newLabel);
      loadColumns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename column');
    }
  }

  async function handleDelete(column: Column) {
    if (!confirm(`Delete column "${column.label}"? This cannot be undone.`)) return;
    try {
      await deleteColumn(column.id);
      if (sortBy === column.key) {
        setSortBy(null);
        setSortDir(null);
        localStorage.removeItem('rodium-crm-sortBy');
        localStorage.removeItem('rodium-crm-sortDir');
      }
      if (filterBy === column.key) {
        setFilterBy(null);
        setFilterValue('');
      }
      loadColumns();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete column');
    }
  }

  async function handleAddColumn(input: { key: string; label: string; type: ColumnType }) {
    await createColumn(input);
    loadColumns();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columns.findIndex((c) => c.id === active.id);
    const newIndex = columns.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(columns, oldIndex, newIndex);
    setColumns(reordered);
    try {
      await reorderColumns(reordered.map((c, index) => ({ id: c.id, position: index })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder columns');
      loadColumns();
    }
  }

  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <button type="button" className="add-contact-btn" onClick={() => setShowAddModal(true)}>
        + Add contact
      </button>

      <div className="grid-wrapper">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="grid">
            <thead>
              <tr>
                <SortableContext
                  items={columns.map((c) => c.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {columns.map((col) => (
                    <SortableHeaderCell
                      key={col.id}
                      column={col}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                      onRename={handleRename}
                      onDelete={handleDelete}
                    />
                  ))}
                </SortableContext>
                <AddColumnCell onAdd={handleAddColumn} />
              </tr>
              <tr>
                {columns.map((col) => (
                  <th key={col.id}>
                    <input
                      className="filter-input"
                      placeholder={`Filter ${col.label}...`}
                      value={filterBy === col.key ? filterValue : ''}
                      onChange={(e) => {
                        setFilterBy(col.key);
                        setFilterValue(e.target.value);
                      }}
                    />
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id}>
                  {columns.map((col) => (
                    <Cell
                      key={col.id}
                      value={contact.data[col.key] ?? null}
                      column={col}
                      onSave={(newValue) => handleCellSave(contact, col.key, newValue)}
                    />
                  ))}
                  <td className="delete-cell">
                    <button
                      type="button"
                      className="delete-contact-btn"
                      onClick={() => handleDeleteContact(contact)}
                      title="Delete contact"
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DndContext>
        {loading && <div className="grid-status">Loading...</div>}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {loadingMore && <div className="grid-status">Loading more...</div>}
        {!hasMore && !loading && contacts.length > 0 && (
          <div className="grid-status">All contacts loaded ({contacts.length})</div>
        )}
      </div>

      {showAddModal && (
        <AddContactModal
          columns={columns}
          onSubmit={handleAddContact}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}