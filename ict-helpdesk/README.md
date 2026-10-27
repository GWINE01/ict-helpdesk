# ICT Help Desk & Service Request Management System

Staff report ICT problems online, the ICT admin assigns a technician, the
technician records the diagnosis and solution, and staff confirm the fix.

- `frontend/` - Next.js (React) user interface
- `backend/` - Python (FastAPI) API with a SQLite database

## What you need

- Python 3.10 or newer
- Node.js 20.9 or newer

## Run it on your computer

Open two terminals.

**Terminal 1: backend**

```bash
cd backend
pip install -r requirements.txt
python seed.py                      # creates helpdesk.db with demo data (run once)
python -m uvicorn main:app --port 8000
```

**Terminal 2: frontend**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Demo accounts

All use the password `password123`.

| Role       | Email                   |
|------------|-------------------------|
| Admin      | admin@helpdesk.local    |
| Technician | tunde@helpdesk.local    |
| Technician | blessing@helpdesk.local |
| Staff      | adaeze@helpdesk.local   |
| Staff      | ibrahim@helpdesk.local  |

## Run the automated tests

```bash
cd backend
python -m pytest -v
```

## Put it on the office network

On the computer that will act as the server:

```bash
# backend
cd backend
python -m uvicorn main:app --port 8000

# frontend (second terminal)
cd frontend
npm run build
npm run start -- -H 0.0.0.0 -p 3000
```

Staff then open `http://<server-ip-address>:3000` in their browser.
Only port 3000 needs to be reachable; the frontend forwards `/api` calls to
the backend on the same machine.

Before real use:

1. Delete `backend/helpdesk.db`, then create real accounts (edit `seed.py` or
   sign in as admin and use the Users page) with strong passwords.
2. Back up the database by copying `backend/helpdesk.db` to a safe place.

## Where things are

| File | Purpose |
|------|---------|
| `backend/schema.sql` | The database tables |
| `backend/database.py` | Opens the database connection |
| `backend/security.py` | Password hashing, login sessions, role checks |
| `backend/main.py` | Every API route and the SQL it runs |
| `backend/seed.py` | Demo data |
| `backend/tests/test_api.py` | Automated tests |
| `frontend/app/page.js` | Login page |
| `frontend/app/requests/` | Staff pages: new request, my requests, track a request |
| `frontend/app/dashboard/page.js` | Admin: all requests, assign technicians |
| `frontend/app/jobs/page.js` | Technician: my jobs, record work |
| `frontend/app/reports/page.js` | Admin: statistics |
| `frontend/app/users/page.js` | Admin: create accounts |
| `frontend/components/Shell.js` | Top bar and page protection |
| `frontend/lib/api.js` | Helper that calls the backend |
