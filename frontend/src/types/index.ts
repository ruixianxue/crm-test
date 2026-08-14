export type ColumnType = 'text' | 'number' | 'date' | 'phone';

export interface Column {
  id: string;
  key: string;
  label: string;
  type: ColumnType;
  position: number;
  createdAt: string;
}

export interface Contact {
  id: string;
  data: Record<string, string | number | null>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedContacts {
  items: Contact[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface ContactsQuery {
  offset?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  filterBy?: string;
  filterValue?: string;
}