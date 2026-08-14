import { useEffect, useState } from 'react';
import { fetchColumns } from '../../api/columns';
import { fetchContacts } from '../../api/contacts';
import type { Column, Contact } from '../../types';
import './Grid.css';

export function Grid() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [cols, contactsRes] = await Promise.all([
          fetchColumns(),
          fetchContacts({ offset: 0, limit: 50 }),
        ]);
        setColumns(cols);
        setContacts(contactsRes.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
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
              <td key={col.id}>{String(contact.data[col.key] ?? '')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}