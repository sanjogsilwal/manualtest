# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run init-db   # Initialize SQLite database with schema and seed data (run once)
npm run dev       # Start dev server with auto-reload via nodemon
npm start         # Start production server
```

No test suite or linter is configured. There is no build step — frontend is vanilla HTML/CSS/JS served as static files.

Before first run, copy `.env.example` to `.env` and set `JWT_SECRET`.

## Architecture

Single-server Express app with a SQLite database, serving both API endpoints and static HTML pages.

**Entry point**: `server.js` — mounts middleware, registers API routes under `/api/*`, and serves HTML pages at clean URLs (`/manuals`, `/notes`, `/admin`, etc.).

**Database**: `database.db` (SQLite via `better-sqlite3`, WAL mode, foreign keys on). Schema and seed data live in `init-db.js`. Key tables:
- `admins` — staff accounts with roles: `super_admin`, `admin`, `teacher`
- `manuals` — uploaded files with visibility (`is_public`), department/semester/subject metadata, and download tracking
- `student_notes` — student submissions with approval workflow (`pending` → `approved`/`rejected`)
- `subjects`, `categories`, `departments` — taxonomy tables
- `activity_log`, `login_log` — audit trails written on every mutating action

**Auth flow**: `POST /api/auth/login` validates bcrypt hash, issues a 7-day JWT stored as an HTTP-only cookie. Middleware in `middleware/auth.js` provides `authenticate` (required), `optionalAuth` (populates `req.admin` if token present), `requireSuperAdmin`, and `requireContentManager` (super_admin + admin + teacher).

**API routes** (`routes/`):
- `auth.js` — login, logout, `GET /me`, change-password
- `manuals.js` — CRUD + file upload (Multer, 50 MB, whitelisted extensions), download streaming, visibility toggle
- `notes.js` — student note submission + approval workflow; unauthenticated users only see approved notes
- `subjects.js` — subject CRUD (public GET, content-manager mutations)
- `admin.js` — categories, departments, users, dashboard stats, activity/login logs

**Visibility rule**: unauthenticated requests to `/api/manuals` return only `is_public=1` rows. Authenticated admins see all. Department filtering applies: records with `department='both'` are shown to all users.

**File uploads**: Multer stores files in `/uploads/` with randomized names (`timestamp + 12-byte hex`). Original filename and size are stored in the DB. Download endpoint streams the file and increments `download_count`.

**Frontend** (`public/`): Static HTML pages + shared `main.js` (header/footer generation, localStorage-based department/semester scope). `admin.js` (39 KB) drives the entire admin panel — auth check on load, then manages all CRUD via `fetch` with `credentials: 'include'`.

## Roles & Permissions

| Action | super_admin | admin/teacher | public |
|---|---|---|---|
| Upload/edit/delete manuals | ✓ | ✓ | — |
| Manage departments/users | ✓ | — | — |
| Approve student notes | ✓ | ✓ | — |
| View private manuals | ✓ | ✓ | — |
| View activity/login logs | ✓ | ✓ | — |

Default seeded super-admins: `dipendra/dipendra123`, `sanjog/sanjog123`. Legacy admin: `admin/admin123`.
