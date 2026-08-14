import { apiFetch } from './client';
import type { Column } from '../types';

export function fetchColumns(): Promise<Column[]> {
  return apiFetch<Column[]>('/columns');
}

export function createColumn(input: {
  key: string;
  label: string;
  type: Column['type'];
  position?: number;
}): Promise<Column> {
  return apiFetch<Column>('/columns', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateColumn(id: string, label: string): Promise<Column> {
  return apiFetch<Column>(`/columns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ label }),
  });
}

export function deleteColumn(id: string): Promise<void> {
  return apiFetch<void>(`/columns/${id}`, { method: 'DELETE' });
}

export function reorderColumns(
  items: { id: string; position: number }[],
): Promise<Column[]> {
  return apiFetch<Column[]>('/columns/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ items }),
  });
}