"""
audit.py
--------
Jejak aktivitas pengguna (NF-08). Dipanggil dari route tepat SEBELUM conn.commit(),
sehingga catatan audit dan perubahan datanya tersimpan bersama-sama.
JANGAN pernah memasukkan password, token, atau isi file ke parameter `detail`.
"""

from fastapi import Request


def client_ip(request: Request | None) -> str | None:
    return request.client.host if request is not None and request.client else None


def record(conn, action: str, *, user: dict | None = None, username: str | None = None,
           entity: str | None = None, entity_id=None, detail: str | None = None,
           request: Request | None = None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO audit_logs (user_id, username, action, entity, entity_id, detail, ip)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user["id"] if user else None,
                username or (user["username"] if user else None),
                action, entity,
                None if entity_id is None else str(entity_id),
                detail, client_ip(request),
            ),
        )
