"""
seed_demo_users.py — Buat/perbarui akun demo untuk portofolio (role: admin, manajemen, user)
Aman dijalankan berkali-kali (idempotent) — kalau username sudah ada, password & datanya di-update.

Cara pakai:
    python seed_demo_users.py

Environment variables yang dibutuhkan (sama seperti app.py / reset_demo_db.py):
    DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
"""
import os
import bcrypt
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "host": os.environ["DB_HOST"],
    "port": int(os.environ.get("DB_PORT", "3306")),
    "user": os.environ["DB_USER"],
    "password": os.environ["DB_PASSWORD"],
    "database": os.environ.get("DB_NAME", "indocement"),
    "cursorclass": pymysql.cursors.DictCursor,
    "charset": "utf8mb4",
}

# Ganti username/password di sini sesuai yang mau kamu tampilkan di halaman login demo.
# role harus salah satu dari: 'admin', 'manajemen', 'user'
DEMO_USERS = [
    {
        "username": "demo_admin",
        "password": "DemoAdmin123!",
        "nama_lengkap": "Demo Admin",
        "email": "demo.admin@example.com",
        "divisi": "IT",
        "role": "admin",
    },
    {
        "username": "demo_manajemen",
        "password": "DemoManajemen123!",
        "nama_lengkap": "Demo Manajemen",
        "email": "demo.manajemen@example.com",
        "divisi": "Manajemen",
        "role": "manajemen",
    },
    {
        "username": "demo_user",
        "password": "DemoUser123!",
        "nama_lengkap": "Demo User",
        "email": "demo.user@example.com",
        "divisi": "Umum",
        "role": "user",
    },
]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def main():
    conn = pymysql.connect(**DB_CONFIG)
    try:
        with conn.cursor() as cur:
            for u in DEMO_USERS:
                password_hash = hash_password(u["password"])
                cur.execute(
                    """
                    INSERT INTO users (username, password_hash, nama_lengkap, email, divisi, role)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        password_hash = VALUES(password_hash),
                        nama_lengkap  = VALUES(nama_lengkap),
                        email         = VALUES(email),
                        divisi        = VALUES(divisi),
                        role          = VALUES(role)
                    """,
                    (u["username"], password_hash, u["nama_lengkap"], u["email"], u["divisi"], u["role"]),
                )
                print(f"[users] '{u['username']}' (role: {u['role']}) siap dipakai.")
        conn.commit()
        print("Semua akun demo berhasil dibuat/diperbarui.")
    except Exception as e:
        conn.rollback()
        print(f"Gagal membuat akun demo: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
