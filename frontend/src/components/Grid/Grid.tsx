import { useCallback, useEffect, useState } from 'react';
import { fetchColumns } from '../../api/columns';
import { fetchContacts, updateContact } from '../../api/contacts';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { Cell } from './Cell';
import type { Column, Contact } from '../../types';
import './Grid.css';

const PAGE_SIZE = 50;

export function Grid() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [cols, contactsRes] = await Promise.all([
          fetchColumns(),
          fetchContacts({ offset: 0, limit: PAGE_SIZE }),
        ]);
        setColumns(cols);
        setContacts(contactsRes.items);
        setHasMore(contactsRes.hasMore);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchContacts({ offset: contacts.length, limit: PAGE_SIZE });
      setContacts((prev) => [...prev, ...res.items]);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setLoadingMore(false);
    }
  }, [contacts.length, hasMore, loadingMore]);

  const sentinelRef = useInfiniteScroll(loadMore, !loading && hasMore);

  // Save an edited cell: optimistic update, then confirm with backend
  async function handleCellSave(
    contact: Contact,
    columnKey: string,
    newValue: string | number | null,
  ) {
    const previousContacts = contacts;
    // Optimistic update: reflect the change immediately in the UI
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contact.id ? { ...c, data: { ...c.data, [columnKey]: newValue } } : c,
      ),
    );
    try {
      await updateContact(contact.id, { [columnKey]: newValue });
    } catch (err) {
      // Roll back on failure
      setContacts(previousContacts);
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <table className="grid">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.id}>{col.label}</th>
            ))}
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
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={sentinelRef} style={{ height: 1 }} />
      {loadingMore && <div>Loading more...</div>}
      {!hasMore && contacts.length > 0 && <div>All contacts loaded ({contacts.length})</div>}
    </div>
  );
}