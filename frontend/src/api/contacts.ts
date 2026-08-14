import { apiFetch } from './client';
import type { Contact, ContactsQuery, PaginatedContacts } from '../types';

export function fetchContacts(query: ContactsQuery): Promise<PaginatedContacts> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  return apiFetch<PaginatedContacts>(`/contacts?${params.toString()}`);
}

export function createContact(
  data: Record<string, string | number | null>,
): Promise<Contact> {
  return apiFetch<Contact>('/contacts', {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}

export function updateContact(
  id: string,
  data: Record<string, string | number | null>,
): Promise<Contact> {
  return apiFetch<Contact>(`/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ data }),
  });
}

export function deleteContact(id: string): Promise<void> {
  return apiFetch<void>(`/contacts/${id}`, { method: 'DELETE' });
}