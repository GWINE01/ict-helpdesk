"""Automated tests for the API.  Run from the backend folder:  pytest -v

Each test starts with a fresh database that contains only the demo users.
"""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


@pytest.fixture()
def client(tmp_path):
    os.environ["HELPDESK_DB"] = str(tmp_path / "test.db")
    from fastapi.testclient import TestClient
    from main import app
    from seed import seed

    seed(samples=False)
    return TestClient(app)


def login(client, email, password="password123"):
    response = client.post("/api/login", json={"email": email, "password": password})
    assert response.status_code == 200
    return {"Authorization": "Bearer " + response.json()["token"]}


@pytest.fixture()
def staff(client):
    return login(client, "adaeze@helpdesk.local")


@pytest.fixture()
def other_staff(client):
    return login(client, "ibrahim@helpdesk.local")


@pytest.fixture()
def admin(client):
    return login(client, "admin@helpdesk.local")


@pytest.fixture()
def tech(client):
    return login(client, "tunde@helpdesk.local")


VALID_REQUEST = {
    "category_id": 1,
    "title": "Printer not printing",
    "description": "The printer shows a blinking orange light.",
    "location": "Room 14",
    "priority": "Medium",
}


def new_request(client, staff):
    response = client.post("/api/requests", json=VALID_REQUEST, headers=staff)
    assert response.status_code == 201
    return response.json()["id"]


# --- Authentication -------------------------------------------------------

def test_login_with_wrong_password_is_rejected(client):
    response = client.post("/api/login", json={"email": "adaeze@helpdesk.local", "password": "wrong"})
    assert response.status_code == 401


def test_sql_injection_in_login_does_not_work(client):
    response = client.post("/api/login", json={"email": "' OR '1'='1", "password": "' OR '1'='1"})
    assert response.status_code == 401


def test_requests_need_a_login(client):
    assert client.get("/api/requests").status_code == 401


def test_passwords_are_not_stored_in_plain_text(client):
    from database import get_connection
    stored = get_connection().execute("SELECT password_hash FROM users").fetchone()[0]
    assert "password123" not in stored


# --- Submitting requests --------------------------------------------------

def test_staff_can_submit_a_request(client, staff):
    request_id = new_request(client, staff)
    detail = client.get(f"/api/requests/{request_id}", headers=staff).json()
    assert detail["status"] == "Pending"
    assert detail["history"][0]["new_status"] == "Pending"


def test_empty_description_is_rejected(client, staff):
    bad = dict(VALID_REQUEST, description="")
    assert client.post("/api/requests", json=bad, headers=staff).status_code == 422


def test_invalid_priority_is_rejected(client, staff):
    bad = dict(VALID_REQUEST, priority="Whenever")
    assert client.post("/api/requests", json=bad, headers=staff).status_code == 422


# --- Roles and ownership --------------------------------------------------

def test_staff_only_see_their_own_requests(client, staff, other_staff):
    request_id = new_request(client, staff)
    assert client.get("/api/requests", headers=other_staff).json() == []
    assert client.get(f"/api/requests/{request_id}", headers=other_staff).status_code == 403


def test_staff_cannot_use_admin_endpoints(client, staff):
    request_id = new_request(client, staff)
    assert client.get("/api/reports", headers=staff).status_code == 403
    assert client.get("/api/users", headers=staff).status_code == 403
    response = client.post(f"/api/requests/{request_id}/assign", json={"technician_id": 2}, headers=staff)
    assert response.status_code == 403


def test_technician_cannot_touch_a_job_assigned_to_someone_else(client, staff, admin, tech):
    request_id = new_request(client, staff)
    client.post(f"/api/requests/{request_id}/assign", json={"technician_id": 3}, headers=admin)
    assert client.post(f"/api/requests/{request_id}/start", json={}, headers=tech).status_code == 403


# --- Status workflow ------------------------------------------------------

def test_statuses_cannot_be_skipped(client, staff, admin, tech):
    request_id = new_request(client, staff)
    client.post(f"/api/requests/{request_id}/assign", json={"technician_id": 2}, headers=admin)
    # Assigned -> Resolved skips "In Progress", so it must fail.
    body = {"diagnosis": "Spooler stalled", "solution": "Restarted the spooler"}
    assert client.post(f"/api/requests/{request_id}/resolve", json=body, headers=tech).status_code == 409
    # Pending/Assigned -> Closed must fail too.
    assert client.post(f"/api/requests/{request_id}/close", headers=staff).status_code == 409


def test_resolving_needs_diagnosis_and_solution(client, staff, admin, tech):
    request_id = new_request(client, staff)
    client.post(f"/api/requests/{request_id}/assign", json={"technician_id": 2}, headers=admin)
    client.post(f"/api/requests/{request_id}/start", json={}, headers=tech)
    body = {"diagnosis": "Spooler stalled", "solution": ""}
    assert client.post(f"/api/requests/{request_id}/resolve", json=body, headers=tech).status_code == 422


def test_full_life_cycle(client, staff, admin, tech):
    request_id = new_request(client, staff)

    assert client.post(f"/api/requests/{request_id}/assign", json={"technician_id": 2}, headers=admin).status_code == 200
    assert client.post(f"/api/requests/{request_id}/start", json={"note": "On my way"}, headers=tech).status_code == 200
    body = {"diagnosis": "Spooler stalled", "solution": "Restarted the spooler", "note": "Please test"}
    assert client.post(f"/api/requests/{request_id}/resolve", json=body, headers=tech).status_code == 200
    assert client.post(f"/api/requests/{request_id}/close", headers=staff).status_code == 200

    detail = client.get(f"/api/requests/{request_id}", headers=staff).json()
    assert detail["status"] == "Closed"
    assert detail["technician"] == "Tunde Bakare"
    assert detail["resolution"]["solution"] == "Restarted the spooler"
    statuses = [h["new_status"] for h in reversed(detail["history"])]
    assert statuses == ["Pending", "Assigned", "In Progress", "Resolved", "Closed"]


# --- Reports and users ----------------------------------------------------

def test_reports_count_requests(client, staff, admin):
    new_request(client, staff)
    new_request(client, staff)
    report = client.get("/api/reports", headers=admin).json()
    assert report["total"] == 2
    assert report["open"] == 2
    assert report["by_status"] == {"Pending": 2}
    assert report["by_category"][0] == {"category": "Printer or scanner", "total": 2}


def test_admin_can_create_a_user_who_can_then_log_in(client, admin):
    body = {"full_name": "Funmi Adeyemi", "email": "funmi@helpdesk.local",
            "password": "secret-pass-1", "role": "staff", "department": "HR"}
    assert client.post("/api/users", json=body, headers=admin).status_code == 201
    assert client.post("/api/users", json=body, headers=admin).status_code == 409  # duplicate email
    login(client, "funmi@helpdesk.local", "secret-pass-1")
