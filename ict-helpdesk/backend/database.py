"""Database connection helpers. The whole system uses one SQLite file."""
import os
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).parent


def db_path() -> str:
    # HELPDESK_DB lets the tests use a separate, throwaway database file.
    return os.environ.get("HELPDESK_DB", str(BASE_DIR / "helpdesk.db"))


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row            # rows behave like dictionaries
    conn.execute("PRAGMA foreign_keys = ON")  # SQLite needs this to enforce foreign keys
    return conn


def get_db():
    """FastAPI dependency: open a connection for one request, then close it."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    """Create the tables if they do not exist yet."""
    conn = get_connection()
    with open(BASE_DIR / "schema.sql", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.close()
