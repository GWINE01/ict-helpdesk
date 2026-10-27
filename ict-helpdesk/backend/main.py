"""ICT Help Desk API.

Every route lives in this file. Each one follows the same pattern:
  1. check who is calling (role and ownership),
  2. validate the input,
  3. run SQL,
  4. return JSON.
"""
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from database import get_db, init_db
from security import create_session, current_user, hash_password, require_role, verify_password

app = FastAPI(title="ICT Help Desk API")
init_db()

# ---------------------------------------------------------------------------
# Status rules: the only moves a request is allowed to make.
# ---------------------------------------------------------------------------
ALLOWED_TRANSITIONS = {
    ("Pending", "Assigned"),
    ("Assigned", "In Progress"),
    ("In Progress", "Resolved"),
    ("Resolved", "Closed"),
}


def change_status(conn, request: dict, new_status: str, user_id: int, note: Optional[str] = None):
    """Update the status and write the audit trail. Rejects illegal moves."""
    old_status = request["status"]
    if (old_status, new_status) not in ALLOWED_TRANSITIONS:
        raise HTTPException(
            status_code=409,
            detail=f"A request cannot move from {old_status} to {new_status}.",
        )
    conn.execute(
        "UPDATE requests SET status = ?, updated_at = datetime('now') WHERE id = ?",
        (new_status, request["id"]),
    )
    conn.execute(
        """
        INSERT INTO status_history (request_id, old_status, new_status, changed_by, note)
        VALUES (?, ?, ?, ?, ?)
        """,
        (request["id"], old_status, new_status, user_id, note or None),
    )


# ---------------------------------------------------------------------------
# Input shapes. FastAPI rejects anything that does not match (HTTP 422).
# ---------------------------------------------------------------------------
Priority = Literal["Low", "Medium", "High", "Urgent"]


class LoginIn(BaseModel):
    email: str
    password: str


class RequestIn(BaseModel):
    category_id: int
    title: str = Field(min_length=5, max_length=150)
    description: str = Field(min_length=10, max_length=2000)
    location: str = Field(min_length=2, max_length=100)
    priority: Priority


class AssignIn(BaseModel):
    technician_id: int


class NoteIn(BaseModel):
    note: str = Field(default="", max_length=300)


class WorkIn(BaseModel):
    diagnosis: str = Field(default="", max_length=2000)
    solution: str = Field(default="", max_length=2000)


class ResolveIn(BaseModel):
    diagnosis: str = Field(min_length=5, max_length=2000)
    solution: str = Field(min_length=5, max_length=2000)
    note: str = Field(default="", max_length=300)


class UserIn(BaseModel):
    full_name: str = Field(min_length=3, max_length=100)
    email: str = Field(min_length=5, max_length=120, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=100)
    role: Literal["staff", "technician", "admin"]
    department: str = Field(min_length=2, max_length=100)


# ---------------------------------------------------------------------------
# Shared query: a request joined with its category, requester and technician.
# ---------------------------------------------------------------------------
REQUEST_SELECT = """
    SELECT r.id, r.title, r.description, r.location, r.priority, r.status,
           r.created_at, r.updated_at, r.requester_id,
           c.name       AS category,
           u.full_name  AS requester,
           u.department AS requester_department,
           t.id         AS technician_id,
           t.full_name  AS technician
    FROM requests r
    JOIN categories c ON c.id = r.category_id
    JOIN users u      ON u.id = r.requester_id
    LEFT JOIN assignments a
           ON a.id = (SELECT MAX(id) FROM assignments WHERE request_id = r.id)
    LEFT JOIN users t ON t.id = a.technician_id
"""


def load_request(conn, request_id: int, user: dict) -> dict:
    """Fetch one request and make sure this user is allowed to see it."""
    row = conn.execute(REQUEST_SELECT + " WHERE r.id = ?", (request_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Request not found.")
    request = dict(row)
    allowed = (
        user["role"] == "admin"
        or (user["role"] == "staff" and request["requester_id"] == user["id"])
        or (user["role"] == "technician" and request["technician_id"] == user["id"])
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="You are not allowed to view this request.")
    return request


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
@app.post("/api/login")
def login(body: LoginIn, conn=Depends(get_db)):
    row = conn.execute(
        "SELECT * FROM users WHERE email = ?", (body.email.strip().lower(),)
    ).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    token = create_session(conn, row["id"])
    user = {k: row[k] for k in ("id", "full_name", "email", "role", "department")}
    return {"token": token, "user": user}


@app.post("/api/logout")
def logout(user: dict = Depends(current_user), conn=Depends(get_db)):
    with conn:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
    return {"ok": True}


@app.get("/api/me")
def me(user: dict = Depends(current_user)):
    return user


# ---------------------------------------------------------------------------
# Lookups
# ---------------------------------------------------------------------------
@app.get("/api/categories")
def list_categories(user: dict = Depends(current_user), conn=Depends(get_db)):
    rows = conn.execute("SELECT id, name FROM categories ORDER BY id").fetchall()
    return [dict(r) for r in rows]


@app.get("/api/technicians")
def list_technicians(user: dict = Depends(require_role("admin")), conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT id, full_name FROM users WHERE role = 'technician' ORDER BY full_name"
    ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------
@app.post("/api/requests", status_code=201)
def create_request(body: RequestIn, user: dict = Depends(require_role("staff")), conn=Depends(get_db)):
    category = conn.execute("SELECT id FROM categories WHERE id = ?", (body.category_id,)).fetchone()
    if category is None:
        raise HTTPException(status_code=422, detail="Choose a valid category.")
    with conn:  # one transaction: both inserts succeed or neither does
        cur = conn.execute(
            """
            INSERT INTO requests (requester_id, category_id, title, description, location, priority)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user["id"], body.category_id, body.title.strip(), body.description.strip(),
             body.location.strip(), body.priority),
        )
        request_id = cur.lastrowid
        conn.execute(
            "INSERT INTO status_history (request_id, old_status, new_status, changed_by) VALUES (?, NULL, 'Pending', ?)",
            (request_id, user["id"]),
        )
    return {"id": request_id}


@app.get("/api/requests")
def list_requests(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category_id: Optional[int] = None,
    q: Optional[str] = None,
    user: dict = Depends(current_user),
    conn=Depends(get_db),
):
    """Staff see their own requests, technicians see their jobs, admins see everything."""
    conditions, params = [], []

    if user["role"] == "staff":
        conditions.append("r.requester_id = ?")
        params.append(user["id"])
    elif user["role"] == "technician":
        conditions.append("a.technician_id = ?")
        params.append(user["id"])

    if status == "open":
        conditions.append("r.status != 'Closed'")
    elif status:
        conditions.append("r.status = ?")
        params.append(status)
    if priority:
        conditions.append("r.priority = ?")
        params.append(priority)
    if category_id:
        conditions.append("r.category_id = ?")
        params.append(category_id)
    if q:
        conditions.append("(r.title LIKE ? OR u.full_name LIKE ? OR ('REQ-' || printf('%04d', r.id)) LIKE ?)")
        params += [f"%{q}%"] * 3

    where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
    rows = conn.execute(REQUEST_SELECT + where + " ORDER BY r.id DESC", params).fetchall()
    return [dict(r) for r in rows]


@app.get("/api/requests/{request_id}")
def get_request(request_id: int, user: dict = Depends(current_user), conn=Depends(get_db)):
    request = load_request(conn, request_id, user)
    history = conn.execute(
        """
        SELECT h.old_status, h.new_status, h.note, h.changed_at, u.full_name AS changed_by
        FROM status_history h
        JOIN users u ON u.id = h.changed_by
        WHERE h.request_id = ?
        ORDER BY h.id DESC
        """,
        (request_id,),
    ).fetchall()
    resolution = conn.execute(
        "SELECT diagnosis, solution, resolved_at FROM resolutions WHERE request_id = ?",
        (request_id,),
    ).fetchone()
    request["history"] = [dict(h) for h in history]
    request["resolution"] = dict(resolution) if resolution else None
    return request


@app.post("/api/requests/{request_id}/assign")
def assign_request(request_id: int, body: AssignIn,
                   user: dict = Depends(require_role("admin")), conn=Depends(get_db)):
    request = load_request(conn, request_id, user)
    technician = conn.execute(
        "SELECT id, full_name FROM users WHERE id = ? AND role = 'technician'", (body.technician_id,)
    ).fetchone()
    if technician is None:
        raise HTTPException(status_code=422, detail="Choose a valid technician.")
    if request["status"] not in ("Pending", "Assigned"):
        raise HTTPException(status_code=409, detail="Work has already started on this request.")

    with conn:  # assignment, status and history change together or not at all
        conn.execute(
            "INSERT INTO assignments (request_id, technician_id, assigned_by) VALUES (?, ?, ?)",
            (request_id, technician["id"], user["id"]),
        )
        if request["status"] == "Pending":
            change_status(conn, request, "Assigned", user["id"], f"Assigned to {technician['full_name']}")
        else:  # reassignment keeps the status but is still logged
            conn.execute(
                """
                INSERT INTO status_history (request_id, old_status, new_status, changed_by, note)
                VALUES (?, 'Assigned', 'Assigned', ?, ?)
                """,
                (request_id, user["id"], f"Reassigned to {technician['full_name']}"),
            )
    return {"ok": True}


@app.post("/api/requests/{request_id}/start")
def start_work(request_id: int, body: NoteIn,
               user: dict = Depends(require_role("technician")), conn=Depends(get_db)):
    request = load_request(conn, request_id, user)
    with conn:
        change_status(conn, request, "In Progress", user["id"], body.note.strip())
    return {"ok": True}


def save_work(conn, request_id: int, technician_id: int, diagnosis: str, solution: str):
    """Insert the resolution row, or update it if it already exists."""
    conn.execute(
        """
        INSERT INTO resolutions (request_id, technician_id, diagnosis, solution)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(request_id) DO UPDATE SET
            diagnosis = excluded.diagnosis,
            solution = excluded.solution,
            technician_id = excluded.technician_id
        """,
        (request_id, technician_id, diagnosis.strip(), solution.strip()),
    )


@app.put("/api/requests/{request_id}/work")
def save_progress(request_id: int, body: WorkIn,
                  user: dict = Depends(require_role("technician")), conn=Depends(get_db)):
    request = load_request(conn, request_id, user)
    if request["status"] != "In Progress":
        raise HTTPException(status_code=409, detail="Start work on this request first.")
    with conn:
        save_work(conn, request_id, user["id"], body.diagnosis, body.solution)
    return {"ok": True}


@app.post("/api/requests/{request_id}/resolve")
def resolve_request(request_id: int, body: ResolveIn,
                    user: dict = Depends(require_role("technician")), conn=Depends(get_db)):
    request = load_request(conn, request_id, user)
    with conn:
        change_status(conn, request, "Resolved", user["id"], body.note.strip())
        save_work(conn, request_id, user["id"], body.diagnosis, body.solution)
        conn.execute(
            "UPDATE resolutions SET resolved_at = datetime('now') WHERE request_id = ?", (request_id,)
        )
    return {"ok": True}


@app.post("/api/requests/{request_id}/close")
def close_request(request_id: int,
                  user: dict = Depends(require_role("staff", "admin")), conn=Depends(get_db)):
    request = load_request(conn, request_id, user)
    note = "Fix confirmed by requester" if user["role"] == "staff" else "Closed by ICT admin"
    with conn:
        change_status(conn, request, "Closed", user["id"], note)
    return {"ok": True}


# ---------------------------------------------------------------------------
# Reports (admin only). Every number comes from an aggregate SQL query.
# ---------------------------------------------------------------------------
@app.get("/api/reports")
def reports(days: Optional[int] = None,
            user: dict = Depends(require_role("admin")), conn=Depends(get_db)):
    # Optional period filter, e.g. days=30 means "created in the last 30 days".
    period = "r.created_at >= datetime('now', ?)" if days else "1 = 1"
    params = [f"-{int(days)} days"] if days else []

    totals = conn.execute(
        f"""
        SELECT COUNT(*) AS total,
               COALESCE(SUM(CASE WHEN r.status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END), 0) AS resolved,
               COALESCE(SUM(CASE WHEN r.status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END), 0) AS open
        FROM requests r
        WHERE {period}
        """,
        params,
    ).fetchone()

    average = conn.execute(
        f"""
        SELECT AVG((julianday(res.resolved_at) - julianday(r.created_at)) * 24) AS hours
        FROM requests r
        JOIN resolutions res ON res.request_id = r.id
        WHERE res.resolved_at IS NOT NULL AND {period}
        """,
        params,
    ).fetchone()

    by_category = conn.execute(
        f"""
        SELECT c.name AS category, COUNT(r.id) AS total
        FROM categories c
        LEFT JOIN requests r ON r.category_id = c.id AND {period}
        GROUP BY c.id
        ORDER BY total DESC, c.name
        """,
        params,
    ).fetchall()

    by_status = conn.execute(
        f"SELECT r.status, COUNT(*) AS total FROM requests r WHERE {period} GROUP BY r.status",
        params,
    ).fetchall()

    by_priority = conn.execute(
        f"SELECT r.priority, COUNT(*) AS total FROM requests r WHERE {period} GROUP BY r.priority",
        params,
    ).fetchall()

    workload = conn.execute(
        f"""
        SELECT t.full_name AS technician,
               COUNT(r.id) AS assigned,
               COALESCE(SUM(CASE WHEN r.status IN ('Resolved', 'Closed') THEN 1 ELSE 0 END), 0) AS resolved,
               COALESCE(SUM(CASE WHEN r.status IN ('Assigned', 'In Progress') THEN 1 ELSE 0 END), 0) AS open,
               AVG(CASE WHEN res.resolved_at IS NOT NULL
                        THEN (julianday(res.resolved_at) - julianday(r.created_at)) * 24 END) AS avg_hours
        FROM users t
        LEFT JOIN assignments a
               ON a.technician_id = t.id
              AND a.id = (SELECT MAX(id) FROM assignments WHERE request_id = a.request_id)
        LEFT JOIN requests r ON r.id = a.request_id AND {period}
        LEFT JOIN resolutions res ON res.request_id = r.id
        WHERE t.role = 'technician'
        GROUP BY t.id
        ORDER BY assigned DESC, t.full_name
        """,
        params,
    ).fetchall()

    return {
        "total": totals["total"],
        "resolved": totals["resolved"],
        "open": totals["open"],
        "avg_resolution_hours": average["hours"],
        "by_category": [dict(r) for r in by_category],
        "by_status": {r["status"]: r["total"] for r in by_status},
        "by_priority": {r["priority"]: r["total"] for r in by_priority},
        "workload": [dict(r) for r in workload],
    }


# ---------------------------------------------------------------------------
# User management (admin only)
# ---------------------------------------------------------------------------
@app.get("/api/users")
def list_users(user: dict = Depends(require_role("admin")), conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT id, full_name, email, role, department, created_at FROM users ORDER BY full_name"
    ).fetchall()
    return [dict(r) for r in rows]


@app.post("/api/users", status_code=201)
def create_user(body: UserIn, user: dict = Depends(require_role("admin")), conn=Depends(get_db)):
    email = body.email.strip().lower()
    exists = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if exists:
        raise HTTPException(status_code=409, detail="A user with this email already exists.")
    with conn:
        cur = conn.execute(
            "INSERT INTO users (full_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)",
            (body.full_name.strip(), email, hash_password(body.password), body.role, body.department.strip()),
        )
    return {"id": cur.lastrowid}
