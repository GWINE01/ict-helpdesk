-- ICT Help Desk database schema (SQLite).
-- Run automatically when the backend starts. Safe to run more than once.

CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name     TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('staff', 'technician', 'admin')),
    department    TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per logged-in browser. The token is sent with every request.
CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS requests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL REFERENCES users(id),
    category_id  INTEGER NOT NULL REFERENCES categories(id),
    title        TEXT NOT NULL,
    description  TEXT NOT NULL,
    location     TEXT NOT NULL,
    priority     TEXT NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status       TEXT NOT NULL DEFAULT 'Pending'
                 CHECK (status IN ('Pending', 'Assigned', 'In Progress', 'Resolved', 'Closed')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Who was given which request. A reassignment adds a new row,
-- so the latest row for a request is the current technician.
CREATE TABLE IF NOT EXISTS assignments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id    INTEGER NOT NULL REFERENCES requests(id),
    technician_id INTEGER NOT NULL REFERENCES users(id),
    assigned_by   INTEGER NOT NULL REFERENCES users(id),
    assigned_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The technician's diagnosis and solution. One per request.
CREATE TABLE IF NOT EXISTS resolutions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id    INTEGER NOT NULL UNIQUE REFERENCES requests(id),
    technician_id INTEGER NOT NULL REFERENCES users(id),
    diagnosis     TEXT NOT NULL DEFAULT '',
    solution      TEXT NOT NULL DEFAULT '',
    resolved_at   TEXT
);

-- Audit trail: one row every time a request changes status.
CREATE TABLE IF NOT EXISTS status_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by INTEGER NOT NULL REFERENCES users(id),
    note       TEXT,
    changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_requests_requester ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_assignments_request ON assignments(request_id);
CREATE INDEX IF NOT EXISTS idx_history_request ON status_history(request_id);
