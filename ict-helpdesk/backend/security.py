"""Password hashing, login sessions and role checks."""
import hashlib
import hmac
import secrets

from fastapi import Depends, Header, HTTPException

from database import get_db


def hash_password(password: str) -> str:
    """Return 'salt$hash'. The plain password is never stored."""
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    salt, expected = stored.split("$")
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return hmac.compare_digest(digest.hex(), expected)


def create_session(conn, user_id: int) -> str:
    token = secrets.token_hex(32)  # long random string, impossible to guess
    with conn:
        conn.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    return token


def current_user(authorization: str = Header(default=""), conn=Depends(get_db)) -> dict:
    """Find the logged-in user from the 'Authorization: Bearer <token>' header."""
    token = authorization.removeprefix("Bearer ").strip()
    row = conn.execute(
        """
        SELECT u.id, u.full_name, u.email, u.role, u.department
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
        """,
        (token,),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Please sign in.")
    return dict(row)


def require_role(*roles: str):
    """Dependency factory: only let the listed roles use an endpoint."""

    def checker(user: dict = Depends(current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="You are not allowed to do this.")
        return user

    return checker
