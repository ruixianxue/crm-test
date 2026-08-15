# Rodium CRM — Tabular View

Full-stack CRM contact management app built as a technical test for Rodium (Full Stack Development Internship). Spreadsheet-style grid with dynamic columns, inline editing, infinite scroll, sorting/filtering, and drag-and-drop column management.

## Video walkthrough

[Presentation video](https://www.loom.com/share/52e5576b83e6430286e090234d85d479)

## Stack

- **Backend**: NestJS + TypeORM + PostgreSQL, REST API
- **Frontend**: React + Vite + TypeScript, no CSS framework (Tailwind excluded per requirements)
- **Infra**: Docker Compose (db + backend + frontend)

## How to run

```bash
git clone https://github.com/ruixianxue/crm-test.git
cd rodium-crm
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

The database, backend, and frontend all start with this single command. On first boot, the backend automatically seeds the database with 5 default columns (text, number, date, phone types) and 500 fake contacts.

## How to initialize / reset the demo data

Data is seeded automatically on container startup (idempotent — running it again won't duplicate data). To force a completely fresh reset:

```bash
docker compose down -v
docker compose up --build
```

To re-run the seed manually against a running stack:

```bash
docker compose exec backend npm run seed
```

## How to run tests

A backend acceptance test script is included at the project root:

```bash
chmod +x test.sh
./test.sh
```

It runs 20+ checks against a live backend instance (columns/contacts CRUD, pagination, sort correctness, filter correctness and robustness against invalid input, duplicate key rejection, reorder persistence, etc.) with pass/fail output.

## Main technical choices

- **Dynamic columns via JSONB**: instead of rigid database columns, contacts store their field values in a single `data JSONB` column. A separate `columns` table holds column metadata (key, label, type, position). This lets columns be added/renamed/removed/reordered at runtime without schema migrations, while still allowing PostgreSQL to sort and filter on JSONB fields directly.
- **Sorting/filtering happen server-side**, on the full filtered dataset (not just already-loaded rows), via dynamic `ORDER BY` / `WHERE` clauses built from validated column metadata. Column keys are whitelisted against the `columns` table before being interpolated into SQL to avoid injection; filter values are always passed as parameterized query values.
- **Type-aware behavior**: sorting/filtering cast JSONB text values according to the column's declared type (`::numeric`, `::date`, or plain text `LIKE`/`ILIKE`), so a number column sorts numerically and a date column filters by date prefix (e.g. typing "2024" matches all 2024 dates).
- **A stable tie-breaker** (`ORDER BY <sort field>, id`) guarantees consistent ordering across repeated requests, since PostgreSQL doesn't guarantee row order for ties.
- **Pagination** uses offset/limit rather than cursor-based pagination — simpler to implement correctly within the time budget, sufficient at this data scale.
- **Optimistic UI updates** on cell edits, contact/column reordering: the UI reflects changes immediately and rolls back if the backend request fails.
- Column `key` and `type` are immutable after creation (only `label` can be renamed) to avoid breaking already-stored contact data.

## Completed features

- Contact grid with infinite scroll (server-paginated)
- Add / edit (inline cell editing) / delete contacts
- Add / rename / delete / drag-and-drop reorder columns, inline in the table header
- 4 required column types (text, number, date, phone) with type-consistent display, editing, sorting, and filtering
- Sorting (click header, cycles ASC → DESC → none) and filtering (per-column input), both server-side and applied to the full dataset
- Data, values, columns, and column order all persist across reloads (PostgreSQL)
- Full Docker Compose setup (db + backend + frontend), one command to start
- Seed script for 500 demo contacts

## Known limitations / incomplete

- **Single-column filter at a time**: the UI only supports filtering by one column simultaneously, not combined multi-column filters. This was a deliberate scope cut given the time budget.
- **Sort state is session-local** (persisted in `localStorage`, not the database) — matches how most spreadsheet tools treat "current sort" as a UI preference rather than stored data; column structure/order (the part explicitly required) is persisted server-side.
- No automated frontend tests (only the backend acceptance script); given the time constraint, priority was placed on backend correctness (the sort/filter logic being the most failure-prone part).
- No multi-cell selection, copy/paste, undo/redo, CSV import/export, authentication — all explicitly out of scope per the test brief.

## Priority improvements if continuing

1. Multi-column simultaneous filtering
2. Debounce filter input (currently fires a request on every keystroke)
3. Frontend component tests (React Testing Library) for Grid/Cell/column management interactions
4. Cursor-based pagination for better performance at larger scale
5. A custom confirm dialog to match the app's visual style (currently uses the browser's native `confirm()`)

## AI tools used

Claude (Anthropic) was used throughout as a guided, step-by-step coding assistant: I asked for explanations before writing each piece, typed the code myself, and tested before moving on — rather than having code generated and pasted wholesale.

**Example prompt**: after the core features were implemented, I asked:
> "Based on the requirements, walk me through checking and testing everything one by one and build a test script."

This led to writing `test.sh`, a backend acceptance test script covering CRUD, pagination, sort correctness, filter robustness against invalid input, and reorder persistence. Running it caught real bugs that casual manual testing had missed (see below).

**Example of a rejected/corrected AI suggestion**: my first version of column management used a separate collapsible panel (open it, edit columns in a list, close it) to keep the implementation simple. After trying it, I found the extra click and separation from the table itself made it feel clunky, so I rejected that design and asked for column management (rename, delete, drag-to-reorder, add) to be built directly into the table header instead — closer to how spreadsheet tools actually work. This was a larger rewrite of the `Grid` component, but produced a noticeably better result.

**Corrected generated code**: the same test pass (`test.sh`) caught a real bug — `POST /columns` returned 500 because PostgreSQL's raw `MAX(position)` aggregate came back as a string, so `"4" + 1` concatenated into `"41"` instead of adding to `5`. Fixed by explicitly casting with `Number(...)` before the arithmetic. The same pass also caught a DELETE response with an empty body crashing the frontend's `res.json()` call, and unstable default sort order across identical requests due to a missing `id` tie-breaker.

## Time spent

Approximately 6 hours, spread across backend architecture/API, frontend implementation, styling, and a systematic bug-hunting/testing pass at the end.
