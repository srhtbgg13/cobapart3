"""
reset_demo_db.py — Reset database DEMO ke kondisi awal (re-import dari CSV)
Dipakai khusus untuk instance demo portofolio, BUKAN untuk database tugas akhir asli.

Cara pakai manual:
    python reset_demo_db.py

Environment variables yang dibutuhkan (sama seperti app.py):
    DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
Opsional:
    CSV_PATH        (default: "INDOCEMENT.csv")
    RESET_EXTRA_TABLES  (default: "perubahan_pending,notifikasi")
        -> daftar tabel lain yang ikut dikosongkan tiap reset (dipisah koma).
           Tabel 'users' TIDAK pernah disentuh script ini supaya akun demo tetap ada.
"""
import csv
import os
import sys
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

load_dotenv()

CSV_PATH = os.environ.get("CSV_PATH", "INDOCEMENT.csv")
EXTRA_TABLES = [
    t.strip() for t in os.environ.get("RESET_EXTRA_TABLES", "perubahan_pending,notifikasi").split(",")
    if t.strip()
]

DB_CONFIG = {
    "host": os.environ["DB_HOST"],
    "port": int(os.environ.get("DB_PORT", "3306")),
    "user": os.environ["DB_USER"],
    "password": os.environ["DB_PASSWORD"],
    "database": os.environ.get("DB_NAME", "indocement"),
    "cursorclass": pymysql.cursors.DictCursor,
    "charset": "utf8mb4",
}

MAIN_TABLE = "indocement"


def get_table_columns(conn, table):
    with conn.cursor() as cur:
        cur.execute(f"DESCRIBE `{table}`")
        rows = cur.fetchall()
    # Buang kolom auto-increment (biasanya 'id') dari daftar yang akan diisi manual
    return [r["Field"] for r in rows if r["Field"].lower() != "id"]


def read_csv_rows(path):
    if not os.path.exists(path):
        print(f"CSV tidak ditemukan di '{path}'.")
        sys.exit(1)
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return list(reader), reader.fieldnames


# Kolom yang memang berisi teks (bukan angka), jangan coba dikonversi ke float
TEXT_COLUMNS = {"quarter", "kuartal", "catatan", "date", "bulan"}


def to_float_or_none(value, col_name, row_num, errors):
    if value is None or value.strip() == "":
        return None
    raw = value.strip()
    # Bersihkan format angka umum: koma ribuan, spasi, kurung untuk minus
    cleaned = raw.replace(",", "").replace(" ", "")
    is_negative = cleaned.startswith("(") and cleaned.endswith(")")
    if is_negative:
        cleaned = cleaned[1:-1]
    try:
        result = float(cleaned)
        return -result if is_negative else result
    except ValueError:
        errors.append(f"Baris {row_num}, kolom '{col_name}': nilai '{raw}' bukan angka yang valid")
        return None


def reset_main_table(conn, csv_rows, csv_headers, db_columns):
    # Hanya pakai kolom yang memang ada di CSV maupun di tabel DB
    usable_cols = [c for c in db_columns if c in csv_headers]
    if not usable_cols:
        print("Tidak ada kolom yang cocok antara CSV dan tabel indocement. Cek nama header CSV.")
        sys.exit(1)

    errors = []
    values = []
    for i, row in enumerate(csv_rows, start=2):  # baris 1 = header CSV
        parsed_row = []
        for c in usable_cols:
            if c.lower() in TEXT_COLUMNS:
                parsed_row.append(row.get(c) or None)
            else:
                parsed_row.append(to_float_or_none(row.get(c), c, i, errors))
        values.append(parsed_row)

    if errors:
        print("Ditemukan nilai yang tidak bisa dibaca sebagai angka — proses DIHENTIKAN, database belum diubah:")
        for e in errors[:20]:
            print(f"  - {e}")
        if len(errors) > 20:
            print(f"  ...dan {len(errors) - 20} error lainnya")
        sys.exit(1)

    with conn.cursor() as cur:
        cur.execute(f"TRUNCATE TABLE `{MAIN_TABLE}`")

    placeholders = ", ".join(["%s"] * len(usable_cols))
    col_list = ", ".join(f"`{c}`" for c in usable_cols)
    insert_sql = f"INSERT INTO `{MAIN_TABLE}` ({col_list}) VALUES ({placeholders})"

    with conn.cursor() as cur:
        cur.executemany(insert_sql, values)

    print(f"[{MAIN_TABLE}] {len(values)} baris di-import ulang. Kolom dipakai: {usable_cols}")


def reset_extra_tables(conn, tables):
    with conn.cursor() as cur:
        for t in tables:
            cur.execute(f"TRUNCATE TABLE `{t}`")
            print(f"[{t}] dikosongkan.")


def main():
    csv_rows, csv_headers = read_csv_rows(CSV_PATH)

    conn = pymysql.connect(**DB_CONFIG)
    try:
        db_columns = get_table_columns(conn, MAIN_TABLE)
        reset_main_table(conn, csv_rows, csv_headers, db_columns)
        if EXTRA_TABLES:
            reset_extra_tables(conn, EXTRA_TABLES)
        conn.commit()
        print("Reset database demo selesai.")
    except Exception as e:
        conn.rollback()
        print(f"Gagal reset database demo: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()