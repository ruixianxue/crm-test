const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed: ${res.status}`);
  }

  // Some responses (e.g. DELETE) may return 200/204 with an empty body.
  // Reading as text first avoids "Unexpected end of JSON input" on empty responses.
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}