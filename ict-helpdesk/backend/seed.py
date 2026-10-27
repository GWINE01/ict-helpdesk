"""Fill an empty database with categories, demo accounts and a few sample requests.

Run once:  python seed.py
All demo accounts use the password below. Change them before real use.
"""
from database import get_connection, init_db
from security import hash_password

DEMO_PASSWORD = "password123"

CATEGORIES = [
    "Printer or scanner",
    "Computer hardware",
    "Network or internet",
    "Software or application",
    "Email or account access",
    "Other",
]

USERS = [
    # full name, email, role, department
    ("Ngozi Eze", "admin@helpdesk.local", "admin", "ICT"),
    ("Tunde Bakare", "tunde@helpdesk.local", "technician", "ICT"),
    ("Blessing Udoh", "blessing@helpdesk.local", "technician", "ICT"),
    ("Adaeze Okafor", "adaeze@helpdesk.local", "staff", "Accounts"),
    ("Ibrahim Musa", "ibrahim@helpdesk.local", "staff", "Registry"),
]


def seed(samples: bool = True) -> None:
    init_db()
    conn = get_connection()
    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] > 0:
        print("Database already has users. Nothing to do.")
        conn.close()
        return

    with conn:
        conn.executemany("INSERT INTO categories (name) VALUES (?)", [(c,) for c in CATEGORIES])
        for full_name, email, role, department in USERS:
            conn.execute(
                "INSERT INTO users (full_name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)",
                (full_name, email, hash_password(DEMO_PASSWORD), role, department),
            )
        if samples:
            add_samples(conn)
    conn.close()
    print("Database seeded. Sign in with any demo email and the password:", DEMO_PASSWORD)


def add_samples(conn) -> None:
    """Three sample requests at different stages, so every screen has something to show."""
    admin, tunde, adaeze, ibrahim = 1, 2, 4, 5

    # 1. Pending: waiting for the admin to assign it.
    conn.execute(
        """INSERT INTO requests (requester_id, category_id, title, description, location, priority, created_at)
           VALUES (?, 3, 'No internet in the Registry office',
                   'None of the computers in the office can open any website since this morning.',
                   'Registry, Ground floor', 'Urgent', datetime('now', '-1 hours'))""",
        (ibrahim,),
    )
    conn.execute(
        "INSERT INTO status_history (request_id, old_status, new_status, changed_by, changed_at) "
        "VALUES (1, NULL, 'Pending', ?, datetime('now', '-1 hours'))",
        (ibrahim,),
    )

    # 2. In Progress: assigned to Tunde, who has started work.
    conn.execute(
        """INSERT INTO requests (requester_id, category_id, title, description, location, priority, status, created_at)
           VALUES (?, 1, 'Printer in Accounts office not printing',
                   'Jobs stay in the queue and the printer shows a blinking orange light.',
                   'Admin Block, Room 14', 'Medium', 'In Progress', datetime('now', '-5 hours'))""",
        (adaeze,),
    )
    conn.execute("INSERT INTO assignments (request_id, technician_id, assigned_by, assigned_at) "
                 "VALUES (2, ?, ?, datetime('now', '-4 hours'))", (tunde, admin))
    conn.executemany(
        "INSERT INTO status_history (request_id, old_status, new_status, changed_by, note, changed_at) "
        "VALUES (2, ?, ?, ?, ?, datetime('now', ?))",
        [
            (None, "Pending", adaeze, None, "-5 hours"),
            ("Pending", "Assigned", admin, "Assigned to Tunde Bakare", "-4 hours"),
            ("Assigned", "In Progress", tunde, "On my way to Room 14 to inspect the printer.", "-3 hours"),
        ],
    )

    # 3. Closed: the full life cycle, finished two days ago.
    conn.execute(
        """INSERT INTO requests (requester_id, category_id, title, description, location, priority, status, created_at)
           VALUES (?, 5, 'Cannot log in to payroll application',
                   'The payroll application says my password has expired.',
                   'Admin Block, Room 14', 'High', 'Closed', datetime('now', '-3 days'))""",
        (adaeze,),
    )
    conn.execute("INSERT INTO assignments (request_id, technician_id, assigned_by, assigned_at) "
                 "VALUES (3, ?, ?, datetime('now', '-3 days', '+20 minutes'))", (tunde, admin))
    conn.execute(
        """INSERT INTO resolutions (request_id, technician_id, diagnosis, solution, resolved_at)
           VALUES (3, ?, 'Password expired under the 90-day policy.',
                   'Reset the password and guided the user through setting a new one.',
                   datetime('now', '-3 days', '+2 hours'))""",
        (tunde,),
    )
    conn.executemany(
        "INSERT INTO status_history (request_id, old_status, new_status, changed_by, note, changed_at) "
        "VALUES (3, ?, ?, ?, ?, datetime('now', '-3 days', ?))",
        [
            (None, "Pending", adaeze, None, "+0 minutes"),
            ("Pending", "Assigned", admin, "Assigned to Tunde Bakare", "+20 minutes"),
            ("Assigned", "In Progress", tunde, None, "+40 minutes"),
            ("In Progress", "Resolved", tunde, "Password reset. Please try again.", "+2 hours"),
            ("Resolved", "Closed", adaeze, "Fix confirmed by requester", "+3 hours"),
        ],
    )


if __name__ == "__main__":
    seed()
