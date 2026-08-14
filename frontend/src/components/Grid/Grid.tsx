import { useCallback, useEffect, useState } from 'react';
import { fetchColumns } from '../../api/columns';
import { fetchContacts, updateContact } from '../../api/contacts';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { Cell } from './Cell';
import { ColumnManager } from '../ColumnManager/ColumnManager';
import type { Column, Contact } from '../../types';
import './Grid.css';

const PAGE_SIZE = 50;

type SortDir = 'ASC' | 'DESC' | null;

export function Grid() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [filterBy, setFilterBy] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');

  // Load columns; exposed so ColumnManager can trigger a refetch after changes
  const loadColumns = useCallback(() => {
    fetchColumns()
      .then(setColumns)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load columns'));
  }, []);

  useEffect(() => {
    loadColumns();
  }, [loadColumns]);

  // Reload contacts from the start whenever sort/filter changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setContacts([]); // clear immediately so loadMore can't append stale data mid-transition
      setHasMore(false); // block loadMore until the new query result is in
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
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
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

  function handleHeaderClick(columnKey: string) {
    if (sortBy !== columnKey) {
      setSortBy(columnKey);
      setSortDir('ASC');
    } else if (sortDir === 'ASC') {
      setSortDir('DESC');
    } else {
      setSortBy(null);
      setSortDir(null);
    }
  }

  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <ColumnManager columns={columns} onChange={loadColumns} />

      <div className="grid-wrapper">
        <table className="grid">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.id} onClick={() => handleHeaderClick(col.key)} className="sortable">
                  {col.label}
                  {sortBy === col.key && (sortDir === 'ASC' ? ' \u2191' : ' \u2193')}
                </th>
              ))}
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
        {loading && <div className="grid-status">Loading...</div>}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {loadingMore && <div className="grid-status">Loading more...</div>}
        {!hasMore && !loading && contacts.length > 0 && (
          <div className="grid-status">All contacts loaded ({contacts.length})</div>
        )}
      </div>
    </div>
  );
}