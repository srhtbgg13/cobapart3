from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pymysql
import pymysql.cursors
from datetime import datetime, timedelta
import bcrypt
import jwt
import functools
import os

app = Flask(__name__)
CORS(app, origins="*", supports_credentials=False)

JWT_SECRET = "indocement_jwt_secret_ganti_ini_di_production"
JWT_EXPIRY_DAYS = 7

# ── KONFIGURASI MySQL ─────────────────────────────────────────────
MYSQL_CONFIG = {
    "host":     os.environ.get("MYSQLHOST", "127.0.0.1"),
    "port":     int(os.environ.get("MYSQLPORT", 3306)),
    "user":     os.environ.get("MYSQLUSER", "root"),
    "password": os.environ.get("MYSQLPASSWORD", ""),
    "database": os.environ.get("MYSQLDATABASE", "railway"),
    "cursorclass": pymysql.cursors.DictCursor,
    "charset":  "utf8mb4",
}

# Mapping nama kolom Flask → nama kolom MySQL
# Dipakai di semua query agar tidak ada typo
COL = {
    # periode
    "tahun":               "year",
    "kuartal":             "quarter",
    # arus kas
    "ocf":                 "CFO",
    "cfi":                 "CFI",
    "cff":                 "CFF",
    "ending_cash":         "ending_cash_balance",
    "net_change_cash":     "net_change_in_cash",
    # laba rugi
    "revenue":             "revenue",
    "cost_of_goods_sold":  "cost_of_goods_sold",
    "gross_profit":        "gross_profit",
    "net_income":          "net_income",
    "laba_bersih":         "net_income",       # alias → kolom yg sama
    "operating_expenses":  "operating_expenses",
    "operating_income":    "operating_income",
    "tax_expense":         "tax_expense",
    "interest_expense":    "interest_expense",
    "ebitda":              "EBITDA",
    "da_expense":          "da_expense",
    "capex":               "capex",
    "fcf":                 "fcf",
    # neraca
    "accounts_receivable": "accounts_receivable",
    "inventory":           "inventory",
    "accounts_payable":    "accounts_payable",
    "total_assets":        "total_assets",
    "total_equity":        "total_equity",
    "total_liabilities":   "total_liabilities",
}

# Field hapus data: nama dari frontend (query ?field=) → kolom MySQL di tabel indocement
DELETE_FIELD_MAP = {
    "ocf":                 "CFO",
    "cfi":                 "CFI",
    "cff":                 "CFF",
    "ending_cash":         "ending_cash_balance",
    "ending_cash_balance": "ending_cash_balance",
    "net_change_cash":     "net_change_in_cash",
    "net_change_in_cash":  "net_change_in_cash",
    "revenue":             "revenue",
    "cost_of_goods_sold":  "cost_of_goods_sold",
    "gross_profit":        "gross_profit",
    "net_income":          "net_income",
    "laba_bersih":         "net_income",
    "operating_expenses":  "operating_expenses",
    "operating_income":    "operating_income",
    "tax_expense":         "tax_expense",
    "interest_expense":    "interest_expense",
    "ebitda":              "EBITDA",
    "da_expense":          "da_expense",
    "capex":               "capex",
    "fcf":                 "fcf",
    "accounts_receivable": "accounts_receivable",
    "inventory":           "inventory",
    "accounts_payable":    "accounts_payable",
    "total_assets":        "total_assets",
    "total_equity":        "total_equity",
    "total_liabilities":   "total_liabilities",
}

DELETE_FIELD_LABELS = {
    "ocf":                 "Arus Kas Operasi (CFO)",
    "cfi":                 "Arus Kas Investasi (CFI)",
    "cff":                 "Arus Kas Pendanaan (CFF)",
    "ending_cash_balance": "Saldo Kas Akhir",
    "net_change_in_cash":  "Perubahan Kas Bersih",
    "revenue":             "Pendapatan (Revenue)",
    "cost_of_goods_sold":  "Harga Pokok Penjualan (COGS)",
    "gross_profit":        "Laba Kotor (Gross Profit)",
    "net_income":          "Laba Bersih (Net Income)",
    "operating_expenses":  "Beban Operasional",
    "operating_income":    "Laba Operasional",
    "tax_expense":         "Beban Pajak",
    "interest_expense":    "Beban Bunga",
    "ebitda":              "EBITDA",
    "da_expense":          "Depresiasi & Amortisasi (D&A)",
    "capex":               "Belanja Modal (CapEx)",
    "fcf":                 "Arus Kas Bebas (FCF)",
    "accounts_receivable": "Piutang Usaha",
    "inventory":           "Persediaan (Inventory)",
    "accounts_payable":    "Utang Usaha",
    "total_assets":        "Total Aset",
    "total_equity":        "Total Ekuitas",
    "total_liabilities":   "Total Liabilitas",
}


def get_db():
    """Buka koneksi MySQL baru."""
    conn = pymysql.connect(**MYSQL_CONFIG)
    return conn


def tambah_notifikasi(conn, pesan, tipe="success"):
    """Simpan notifikasi ke tabel notifikasi di MySQL."""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO notifikasi (pesan, tipe) VALUES (%s, %s)",
            (pesan, tipe)
        )


def build_where(tahun, kuartal, prev=False):
    """Helper: buat klausa WHERE + params untuk MySQL (%s)."""
    where, params = [], []
    t = (tahun - 1) if (prev and tahun) else tahun
    if t:
        where.append("`year` = %s");    params.append(t)
    if kuartal:
        where.append("`quarter` = %s"); params.append(kuartal)
    w = ("WHERE " + " AND ".join(where)) if where else ""
    return w, tuple(params)


def agg_sum(conn, col_mysql, where_clause, params):
    """SUM satu kolom dari tabel indocement."""
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT SUM(`{col_mysql}`) AS v FROM indocement {where_clause}",
            params or ()
        )
        row = cur.fetchone()
    v = row["v"] if row else None
    return float(v) if v is not None else 0.0


def agg_avg(conn, col_mysql, where_clause, params):
    """AVG satu kolom dari tabel indocement."""
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT AVG(`{col_mysql}`) AS v FROM indocement {where_clause}",
            params or ()
        )
        row = cur.fetchone()
    v = row["v"] if row else None
    return float(v) if v is not None else 0


def count_rows(conn, where_clause, params):
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT COUNT(*) AS n FROM indocement {where_clause}",
            params or ()
        )
        row = cur.fetchone()
    return row["n"] if row else 0


def fmt_rupiah(val_juta):
    """
    Format nilai dalam JUTAAN RUPIAH → tampilkan dalam T atau M.
    Data di MySQL disimpan dalam satuan juta (misal 256786 = 256.786 juta = 0.257 T).
      >= 1.000.000 juta (= 1 T) → X.XX T
      <  1.000.000 juta         → X.XX M
    Tidak ada satuan Jt karena unit minimum tampilan adalah M (miliar).
    """
    if val_juta is None:
        return "—"
    v = float(val_juta)
    abs_v = abs(v)
    if abs_v == 0:
        return "0.00 M"
    if abs_v >= 1_000_000:      # >= 1 triliun
        return f"{v / 1_000_000:.2f} T"
    else:                       # < 1 triliun → miliar
        return f"{v / 1_000:.2f} M"




def generate_token(user_id, username, role):
    payload = {
        "user_id": user_id,
        "username": username,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRY_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def decode_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

def require_auth(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Token tidak ditemukan"}), 401
        token = auth_header.split(" ", 1)[1]
        payload = decode_token(token)
        if not payload:
            return jsonify({"error": "Token tidak valid atau sudah kadaluarsa"}), 401
        request.current_user = payload
        return f(*args, **kwargs)
    return wrapper

def require_admin(f):
    @functools.wraps(f)
    @require_auth
    def wrapper(*args, **kwargs):
        if request.current_user.get("role") != "admin":
            return jsonify({"error": "Akses ditolak"}), 403
        return f(*args, **kwargs)
    return wrapper


# ── ENDPOINT: REGISTER ───────────────────────────────────────────
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Data tidak boleh kosong"}), 400

    username      = (data.get("username") or "").strip()
    password      = data.get("password") or ""
    nama_depan    = (data.get("nama_depan") or "").strip()
    nama_belakang = (data.get("nama_belakang") or "").strip()
    email         = (data.get("email") or "").strip()
    divisi        = (data.get("divisi") or "").strip()
    role          = data.get("role") or "user"

    if not username:
        return jsonify({"error": "Username wajib diisi"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username minimal 3 karakter"}), 400
    if not username.replace("_", "").isalnum():
        return jsonify({"error": "Username hanya boleh huruf, angka, dan underscore"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password minimal 6 karakter"}), 400
    if not nama_depan:
        return jsonify({"error": "Nama depan wajib diisi"}), 400
    if role not in ("admin", "user"):
        role = "user"

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    nama_lengkap  = f"{nama_depan} {nama_belakang}".strip()

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username = %s", (username,))
            if cur.fetchone():
                return jsonify({"error": "Username sudah digunakan."}), 409
            cur.execute(
                """INSERT INTO users (username, password_hash, nama_lengkap, email, divisi, role)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (username, password_hash, nama_lengkap, email or None, divisi or None, role)
            )
            user_id = cur.lastrowid
        conn.commit()
        token = generate_token(user_id, username, role)
        return jsonify({
            "status": "ok",
            "token": token,
            "user": {"id": user_id, "username": username, "nama": nama_lengkap, "role": role}
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ── ENDPOINT: LOGIN ──────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Data tidak boleh kosong"}), 400

    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username dan password wajib diisi"}), 400

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, password_hash, nama_lengkap, role, divisi FROM users WHERE username = %s",
                (username,)
            )
            user = cur.fetchone()

        if not user:
            return jsonify({"error": "Username atau password salah"}), 401
        if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
            return jsonify({"error": "Username atau password salah"}), 401

        now = datetime.utcnow()
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET last_login = %s WHERE id = %s", (now, user["id"]))
        conn.commit()

        token = generate_token(user["id"], user["username"], user["role"])
        initials = "".join(w[0].upper() for w in (user["nama_lengkap"] or username).split()[:2]) or username[:2].upper()
        return jsonify({
            "status": "ok",
            "token": token,
            "user": {
                "id":       user["id"],
                "username": user["username"],
                "nama":     user["nama_lengkap"] or user["username"],
                "role":     user["role"],
                "divisi":   user["divisi"] or "",
                "initials": initials,
                "last_login": now.strftime("%d %b %Y, %H:%M")
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# ── ENDPOINT: LOGOUT ─────────────────────────────────────────────
@app.route("/api/logout", methods=["POST"])
@require_auth
def logout():
    return jsonify({"status": "ok"})


# ── ENDPOINT: VERIFY TOKEN ───────────────────────────────────────
@app.route("/api/auth/me", methods=["GET"])
@require_auth
def auth_me():
    payload = request.current_user
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, nama_lengkap, role, divisi FROM users WHERE id = %s",
                (payload["user_id"],)
            )
            user = cur.fetchone()
        if not user:
            return jsonify({"error": "User tidak ditemukan"}), 404
        initials = "".join(w[0].upper() for w in (user["nama_lengkap"] or user["username"]).split()[:2])
        return jsonify({
            "status": "ok",
            "user": {
                "id":       user["id"],
                "username": user["username"],
                "nama":     user["nama_lengkap"] or user["username"],
                "role":     user["role"],
                "divisi":   user["divisi"] or "",
                "initials": initials
            }
        })
    finally:
        conn.close()


# ── ENDPOINT: GANTI PASSWORD ─────────────────────────────────────
@app.route("/api/auth/change-password", methods=["POST"])
@require_auth
def change_password():
    data = request.get_json()
    old_password = data.get("old_password") or ""
    new_password = data.get("new_password") or ""
    if len(new_password) < 6:
        return jsonify({"error": "Password baru minimal 6 karakter"}), 400
    user_id = request.current_user["user_id"]
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "User tidak ditemukan"}), 404
        if not bcrypt.checkpw(old_password.encode("utf-8"), row["password_hash"].encode("utf-8")):
            return jsonify({"error": "Password saat ini tidak sesuai"}), 401
        new_hash = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hash, user_id))
        conn.commit()
        return jsonify({"status": "ok", "pesan": "Password berhasil diperbarui."})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# ── ENDPOINT: TAMBAH DATA KEUANGAN ───────────────────────────────
@app.route("/api/keuangan", methods=["POST"])
def tambah_keuangan():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Data tidak boleh kosong"}), 400

    for f in ["tahun", "kuartal"]:
        if not data.get(f):
            return jsonify({"error": f"Field '{f}' wajib diisi"}), 400

    try:
        tahun   = int(data["tahun"])
    except (TypeError, ValueError):
        return jsonify({
            "error": "Tahun tidak valid",
            "message": "Pilih tahun yang valid.",
        }), 400

    kuartal = data["kuartal"]
    if kuartal not in ("Q1", "Q2", "Q3", "Q4"):
        return jsonify({
            "error": "Kuartal tidak valid",
            "message": "Pilih kuartal Q1, Q2, Q3, atau Q4.",
        }), 400

    conn = get_db()
    try:
        # Cek apakah periode sudah ada → UPDATE, belum ada → INSERT
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM indocement WHERE `year`=%s AND `quarter`=%s",
                (tahun, kuartal)
            )
            exists = cur.fetchone()["n"] > 0

        # Map payload → kolom MySQL (hanya kolom yang dikirim / tidak None)
        payload_map = {
            "revenue":             data.get("revenue"),
            "cost_of_goods_sold":  data.get("cost_of_goods_sold"),
            "gross_profit":        data.get("gross_profit"),
            "operating_expenses":  data.get("operating_expenses"),
            "operating_income":    data.get("operating_income"),
            "net_income":          data.get("net_income") or data.get("laba_bersih"),
            "EBITDA":              data.get("ebitda"),
            "da_expense":          data.get("da_expense"),
            "tax_expense":         data.get("tax_expense"),
            "interest_expense":    data.get("interest_expense"),
            "CFO":                 data.get("ocf"),
            "CFI":                 data.get("cfi"),
            "CFF":                 data.get("cff"),
            "capex":               data.get("capex"),
            "fcf":                 data.get("fcf"),
            "ending_cash_balance": data.get("ending_cash"),
            "net_change_in_cash":  data.get("net_change_cash"),
            "total_assets":        data.get("total_assets"),
            "total_equity":        data.get("total_equity"),
            "total_liabilities":   data.get("total_liabilities"),
            "accounts_receivable": data.get("accounts_receivable"),
            "inventory":           data.get("inventory"),
            "accounts_payable":    data.get("accounts_payable"),
        }

        # Minimal satu nilai field (selain tahun/kuartal) harus diisi
        if not any(v is not None for v in payload_map.values()):
            return jsonify({
                "error": "Tidak ada nilai data",
                "message": "Isi minimal satu field angka sebelum menyimpan.",
            }), 400

        if exists:
            # UPDATE — hanya timpa kolom yang dikirim (tidak None)
            set_parts = []
            set_vals  = []
            for col_mysql, val in payload_map.items():
                if val is not None:
                    set_parts.append(f"`{col_mysql}` = %s")
                    set_vals.append(val)
            if not set_parts:
                return jsonify({
                    "error": "Tidak ada nilai data",
                    "message": "Isi minimal satu field angka sebelum menyimpan.",
                }), 400
            set_vals.extend([tahun, kuartal])
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE indocement SET {', '.join(set_parts)} "
                    f"WHERE `year`=%s AND `quarter`=%s",
                    set_vals
                )
            aksi = "diperbarui"
        else:
            # INSERT baru — sertakan kolom yang tidak None saja
            cols_to_insert = ["`year`", "`quarter`"]
            vals_to_insert = [tahun, kuartal]
            for col_mysql, val in payload_map.items():
                if val is not None:
                    cols_to_insert.append(f"`{col_mysql}`")
                    vals_to_insert.append(val)
            placeholders = ", ".join(["%s"] * len(vals_to_insert))
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO indocement ({', '.join(cols_to_insert)}) "
                    f"VALUES ({placeholders})",
                    vals_to_insert
                )
            aksi = "ditambahkan"

        tambah_notifikasi(
            conn,
            f"Data keuangan {kuartal} {tahun} berhasil {aksi}",
            tipe="success"
        )
        conn.commit()
        pesan = f"Data keuangan {kuartal} {tahun} berhasil {aksi}"
        return jsonify({"status": "ok", "pesan": pesan, "message": pesan}), 201

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e), "message": str(e)}), 500
    finally:
        conn.close()


# ── ENDPOINT: HAPUS DATA (set field ke NULL) ─────────────────────
@app.route("/api/data/field", methods=["DELETE"])
def hapus_field():
    """
    Hapus nilai satu field keuangan dengan meng-set kolom ke NULL.
    Query params:
      field   (wajib) — nama field API, mis. ocf, revenue, total_assets
      tahun   (opsional) — filter tahun; kosong = semua tahun
      kuartal (opsional) — filter Q1–Q4; kosong = semua kuartal
    """
    field   = (request.args.get("field") or "").strip()
    tahun   = request.args.get("tahun", type=int)
    kuartal = (request.args.get("kuartal") or "").strip() or None

    if not field:
        return jsonify({
            "error": "Parameter 'field' wajib diisi",
            "message": "Pilih jenis data yang ingin dihapus.",
        }), 400

    col_mysql = DELETE_FIELD_MAP.get(field)
    if not col_mysql:
        return jsonify({
            "error": f"Field '{field}' tidak dikenali",
            "message": f"Jenis data '{field}' tidak valid.",
        }), 400

    if kuartal and kuartal not in ("Q1", "Q2", "Q3", "Q4"):
        return jsonify({
            "error": "Kuartal tidak valid",
            "message": "Kuartal harus Q1, Q2, Q3, atau Q4.",
        }), 400

    where, params = build_where(tahun, kuartal)
    label = DELETE_FIELD_LABELS.get(field, field)

    if tahun and kuartal:
        periode = f"{kuartal} {tahun}"
    elif tahun:
        periode = f"tahun {tahun} (semua kuartal)"
    elif kuartal:
        periode = f"{kuartal} (semua tahun)"
    else:
        periode = "semua periode"

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE indocement SET `{col_mysql}` = NULL {where}",
                params or (),
            )
            affected = cur.rowcount

        if affected == 0:
            return jsonify({
                "error": "Data tidak ditemukan",
                "message": (
                    f"Tidak ada baris data untuk {label} "
                    f"pada periode yang dipilih ({periode})."
                ),
            }), 404

        tambah_notifikasi(
            conn,
            f'{label} pada {periode} di-set ke NULL ({affected} baris terpengaruh)',
            tipe="warning",
        )
        conn.commit()

        return jsonify({
            "status": "ok",
            "pesan": f'"{label}" berhasil dihapus untuk {periode}.',
            "message": f'"{label}" berhasil dihapus untuk {periode}.',
            "affected_rows": affected,
            "field": field,
            "column": col_mysql,
            "filter": {"tahun": tahun, "kuartal": kuartal},
        })

    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e), "message": str(e)}), 500
    finally:
        conn.close()


# ── ENDPOINT: NOTIFIKASI ─────────────────────────────────────────
@app.route("/api/notifikasi", methods=["GET"])
def get_notifikasi():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            # Pastikan tabel ada sebelum query
            cur.execute("""
                CREATE TABLE IF NOT EXISTS notifikasi (
                    id           INT AUTO_INCREMENT PRIMARY KEY,
                    pesan        TEXT NOT NULL,
                    tipe         VARCHAR(20) DEFAULT 'info',
                    sudah_dibaca TINYINT(1)  DEFAULT 0,
                    dibuat_pada  DATETIME    DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("SELECT * FROM notifikasi ORDER BY id DESC LIMIT 20")
            rows = cur.fetchall()
            cur.execute("SELECT COUNT(*) AS n FROM notifikasi WHERE sudah_dibaca = 0")
            belum_dibaca = cur.fetchone()["n"]
        conn.commit()
        return jsonify({"belum_dibaca": belum_dibaca, "notifikasi": rows})
    except Exception as e:
        return jsonify({"belum_dibaca": 0, "notifikasi": [], "error": str(e)})
    finally:
        conn.close()


@app.route("/api/notifikasi/baca-semua", methods=["POST"])
def tandai_sudah_dibaca():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE notifikasi SET sudah_dibaca = 1")
        conn.commit()
        return jsonify({"status": "ok"})
    finally:
        conn.close()


# ── ENDPOINT: DAFTAR TAHUN TERSEDIA ─────────────────────────────
@app.route("/api/tahun-tersedia", methods=["GET"])
def tahun_tersedia():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT `year` AS tahun FROM indocement ORDER BY `year` DESC")
            rows = cur.fetchall()
        return jsonify({"tahun": [r["tahun"] for r in rows]})
    finally:
        conn.close()


# ── ENDPOINT: KPI PAGE 1 — FINANCIAL OVERVIEW ───────────────────
@app.route("/api/kpi/keuangan", methods=["GET"])
def kpi_keuangan():
    tahun   = request.args.get("tahun",   type=int)
    kuartal = request.args.get("kuartal", type=str)

    conn = get_db()
    try:
        w,  params   = build_where(tahun, kuartal, prev=False)
        wp, params_p = build_where(tahun, kuartal, prev=True)

        mysql_cols = ["CFO","CFI","CFF","net_income","revenue","gross_profit",
                      "operating_income","ending_cash_balance",
                      "net_change_in_cash","operating_expenses","cost_of_goods_sold",
                      "accounts_receivable","inventory","accounts_payable",
                      "interest_expense","EBITDA","da_expense","tax_expense",
                      "total_assets","total_equity","total_liabilities"]

        cur_vals  = {c: agg_sum(conn, c, w,  params)   for c in mysql_cols}
        prev_vals = {c: agg_sum(conn, c, wp, params_p) for c in mysql_cols}
        ada_data  = count_rows(conn, w, params) > 0

    finally:
        conn.close()

    def pct(c, p):
        if p and p != 0:
            return round((c - p) / abs(p) * 100, 2)
        return None

    def fmt(val):
        return fmt_rupiah(val)

    def kpi(mysql_col):
        cv = float(cur_vals[mysql_col])
        pv = float(prev_vals[mysql_col])
        return {"nilai": fmt(cv), "nilai_raw": cv, "pct": pct(cv, pv),
                "naik": (cv >= pv) if pv != 0 else None}

    def kpi_derived(cur_val, prev_val):
        cv, pv = float(cur_val), float(prev_val)
        return {"nilai": fmt(cv), "nilai_raw": cv, "pct": pct(cv, pv),
                "naik": (cv >= pv) if pv != 0 else None}

    # FCF = CFO + CFI (CFI negatif), CapEx = abs(CFI)
    fcf_cur   = float(cur_vals["CFO"])  + float(cur_vals["CFI"])
    fcf_prev  = float(prev_vals["CFO"]) + float(prev_vals["CFI"])
    capex_cur  = abs(float(cur_vals["CFI"]))
    capex_prev = abs(float(prev_vals["CFI"]))

    return jsonify({
        "ada_data":         ada_data,
        "filter":           {"tahun": tahun, "kuartal": kuartal},
        "ocf":              kpi("CFO"),
        "net":              kpi("net_income"),
        "fcf":              kpi_derived(fcf_cur,   fcf_prev),
        "revenue":          kpi("revenue"),
        "gross_profit":     kpi("gross_profit"),
        "operating_income": kpi("operating_income"),
        "capex":            kpi_derived(capex_cur, capex_prev),
        "ending_cash":      kpi("ending_cash_balance"),
        "net_change_cash":  kpi("net_change_in_cash"),
    })


# ── ENDPOINT: KPI PAGE 2 — CASH FLOW (OPERASIONAL) ──────────────
@app.route("/api/kpi/operasional", methods=["GET"])
def kpi_operasional():
    tahun   = request.args.get("tahun",   type=int)
    kuartal = request.args.get("kuartal", type=str)

    conn = get_db()
    try:
        w,  params   = build_where(tahun, kuartal, prev=False)
        wp, params_p = build_where(tahun, kuartal, prev=True)

        ocf_cur  = agg_sum(conn, "CFO", w,  params)
        cfi_cur  = agg_sum(conn, "CFI", w,  params)
        cff_cur  = agg_sum(conn, "CFF", w,  params)
        ocf_prev = agg_sum(conn, "CFO", wp, params_p)
        cfi_prev = agg_sum(conn, "CFI", wp, params_p)
        cff_prev = agg_sum(conn, "CFF", wp, params_p)

        inflow_cur   = agg_sum(conn, "ending_cash_balance", w,  params)
        outflow_cur  = abs(float(cfi_cur))   # CapEx = abs(CFI)
        inflow_prev  = agg_sum(conn, "ending_cash_balance", wp, params_p)
        outflow_prev = abs(float(cfi_prev))  # CapEx = abs(CFI)
        ada_data     = count_rows(conn, w, params) > 0
    finally:
        conn.close()

    def pct_change(c, p):
        if p and p != 0: return round((c - p) / abs(p) * 100, 2)
        return None

    def fmt_t(val):
        return fmt_rupiah(val)

    def pct_kontribusi(val, total):
        if total and total != 0: return round(abs(val) / abs(total) * 100, 2)
        return 0

    total_abs = abs(ocf_cur) + abs(cfi_cur) + abs(cff_cur)

    def build(cur, prev, is_pct=False, total=None):
        nilai = pct_kontribusi(cur, total) if (is_pct and total is not None) else (round(cur, 2) if is_pct else fmt_t(cur))
        return {"nilai": nilai, "pct": pct_change(cur, prev), "naik": (cur >= prev) if prev != 0 else None}

    return jsonify({
        "ada_data": ada_data,
        "filter":   {"tahun": tahun, "kuartal": kuartal},
        "operating": build(ocf_cur,     ocf_prev,    is_pct=True, total=total_abs),
        "investing": build(cfi_cur,     cfi_prev,    is_pct=True, total=total_abs),
        "financing": build(cff_cur,     cff_prev,    is_pct=True, total=total_abs),
        "inflow":    build(inflow_cur,  inflow_prev,  is_pct=False),
        "outflow":   build(outflow_cur, outflow_prev, is_pct=False),
    })


# ── ENDPOINT: KPI CASH FLOW HEALTH (EQR) ────────────────────────
@app.route("/api/kpi/cashflow", methods=["GET"])
def kpi_cashflow():
    tahun   = request.args.get("tahun",   type=int)
    kuartal = request.args.get("kuartal", type=str)

    conn = get_db()
    try:
        w,  params   = build_where(tahun, kuartal, prev=False)
        wp, params_p = build_where(tahun, kuartal, prev=True)

        ocf_cur  = agg_sum(conn, "CFO",        w,  params)
        net_cur  = agg_sum(conn, "net_income",  w,  params)
        ocf_prev = agg_sum(conn, "CFO",        wp, params_p)
        net_prev = agg_sum(conn, "net_income",  wp, params_p)
        ada_data = count_rows(conn, w, params) > 0
    finally:
        conn.close()

    def calc_eqr(ocf, net):
        return round(ocf / net, 2) if (net and net != 0) else None

    def pct_change(c, p):
        if p and p != 0: return round((c - p) / abs(p) * 100, 2)
        return None

    def fmt_t(val):
        return fmt_rupiah(val)

    eqr_cur  = calc_eqr(ocf_cur,  net_cur)
    eqr_prev = calc_eqr(ocf_prev, net_prev)

    return jsonify({
        "ada_data": ada_data,
        "filter":   {"tahun": tahun, "kuartal": kuartal},
        "eqr": {
            "nilai": eqr_cur,
            "pct":   pct_change(eqr_cur, eqr_prev) if (eqr_cur and eqr_prev) else None,
            "naik":  (eqr_cur >= eqr_prev) if (eqr_cur is not None and eqr_prev) else None,
        },
        "net_income": {"nilai": fmt_t(net_cur), "pct": pct_change(net_cur, net_prev),
                       "naik": (net_cur >= net_prev) if net_prev != 0 else None},
        "ocf":        {"nilai": fmt_t(ocf_cur),  "pct": pct_change(ocf_cur, ocf_prev),
                       "naik": (ocf_cur >= ocf_prev) if ocf_prev != 0 else None},
    })


# ── ENDPOINT: KPI MARGIN TRENDS ─────────────────────────────────
@app.route("/api/kpi/margin", methods=["GET"])
def kpi_margin():
    tahun   = request.args.get("tahun",   type=int)
    kuartal = request.args.get("kuartal", type=str)

    conn = get_db()
    try:
        w,  params   = build_where(tahun, kuartal, prev=False)
        wp, params_p = build_where(tahun, kuartal, prev=True)

        rev_cur     = agg_sum(conn, "revenue",      w,  params)
        gp_cur      = agg_sum(conn, "gross_profit", w,  params)
        ebitda_cur  = agg_sum(conn, "EBITDA",       w,  params)
        ni_cur      = agg_sum(conn, "net_income",   w,  params)
        rev_prev    = agg_sum(conn, "revenue",      wp, params_p)
        gp_prev     = agg_sum(conn, "gross_profit", wp, params_p)
        ebitda_prev = agg_sum(conn, "EBITDA",       wp, params_p)
        ni_prev     = agg_sum(conn, "net_income",   wp, params_p)
        ada_data    = count_rows(conn, w, params) > 0
    finally:
        conn.close()

    def margin_pct(num, den):
        return round(num / den * 100, 2) if (den and den != 0) else None

    def pct_change(c, p):
        return round(c - p, 2) if (c is not None and p is not None) else None

    gm_cur   = margin_pct(gp_cur,     rev_cur)
    em_cur   = margin_pct(ebitda_cur, rev_cur)
    nm_cur   = margin_pct(ni_cur,     rev_cur)
    gm_prev  = margin_pct(gp_prev,    rev_prev)
    em_prev  = margin_pct(ebitda_prev,rev_prev)
    nm_prev  = margin_pct(ni_prev,    rev_prev)

    def build_kpi(cur, prev):
        delta = pct_change(cur, prev)
        return {
            "nilai": cur,
            "nilai_fmt": f"{cur:.1f}" if cur is not None else "—",
            "delta": delta,
            "delta_fmt": (f"{'+' if delta >= 0 else ''}{delta:.1f} pp" if delta is not None else "—"),
            "naik": (delta >= 0) if delta is not None else None,
        }

    return jsonify({
        "ada_data":      ada_data,
        "filter":        {"tahun": tahun, "kuartal": kuartal},
        "gross_margin":  build_kpi(gm_cur,  gm_prev),
        "ebitda_margin": build_kpi(em_cur,  em_prev),
        "net_margin":    build_kpi(nm_cur,  nm_prev),
    })


# ── ENDPOINT: KPI BALANCE SHEET TRENDS ──────────────────────────
@app.route("/api/kpi/balance", methods=["GET"])
def kpi_balance():
    tahun   = request.args.get("tahun",   type=int)
    kuartal = request.args.get("kuartal", type=str)

    conn = get_db()
    try:
        w,  params   = build_where(tahun, kuartal, prev=False)
        wp, params_p = build_where(tahun, kuartal, prev=True)

        assets_cur   = agg_sum(conn, "total_assets",        w,  params)
        equity_cur   = agg_sum(conn, "total_equity",        w,  params)
        cash_cur     = agg_sum(conn, "ending_cash_balance", w,  params)
        assets_prev  = agg_sum(conn, "total_assets",        wp, params_p)
        equity_prev  = agg_sum(conn, "total_equity",        wp, params_p)
        cash_prev    = agg_sum(conn, "ending_cash_balance", wp, params_p)
        ada_data     = count_rows(conn, w, params) > 0
    finally:
        conn.close()

    def pct_change(c, p):
        if p and p != 0: return round((c - p) / abs(p) * 100, 2)
        return None

    def fmt_t(val):
        return fmt_rupiah(val)

    def build(cur, prev):
        return {"nilai": fmt_t(cur), "nilai_raw": cur,
                "pct": pct_change(cur, prev),
                "naik": (cur >= prev) if prev != 0 else None}

    if tahun and kuartal:   periode_label = f"{kuartal} {tahun}"
    elif tahun:             periode_label = f"FY {tahun}"
    else:                   periode_label = "All Years"

    return jsonify({
        "ada_data":     ada_data,
        "filter":       {"tahun": tahun, "kuartal": kuartal},
        "periode_label": periode_label,
        "total_assets": build(assets_cur,  assets_prev),
        "total_equity": build(equity_cur,  equity_prev),
        "kas_setara":   build(cash_cur,    cash_prev),
    })


# ── ENDPOINT: KPI KEY FINANCIAL INDICATORS ───────────────────────
@app.route("/api/kpi/kfi", methods=["GET"])
def kpi_kfi():
    tahun   = request.args.get("tahun",   type=int)
    kuartal = request.args.get("kuartal", type=str)

    conn = get_db()
    try:
        # Jika tidak ada filter tahun → ambil tahun terbaru
        if not tahun:
            with conn.cursor() as cur:
                cur.execute("SELECT MAX(`year`) AS y FROM indocement")
                row = cur.fetchone()
            tahun_query = row["y"] if row and row["y"] else None
        else:
            tahun_query = tahun

        w,  params   = build_where(tahun_query, kuartal, prev=False)
        wp, params_p = build_where(tahun_query, kuartal, prev=True)

        def avg(col): return agg_avg(conn, col, w,  params)
        def avg_p(col): return agg_avg(conn, col, wp, params_p)
        def s(col): return agg_sum(conn, col, w,  params)
        def s_p(col): return agg_sum(conn, col, wp, params_p)

        liab_cur   = avg("total_liabilities");   liab_prev   = avg_p("total_liabilities")
        eq_cur     = avg("total_equity");         eq_prev     = avg_p("total_equity")
        cash_cur   = avg("ending_cash_balance");  cash_prev   = avg_p("ending_cash_balance")
        ebitda_cur = avg("EBITDA");               ebitda_prev = avg_p("EBITDA")
        ar_cur     = avg("accounts_receivable");  ar_prev     = avg_p("accounts_receivable")
        inv_cur    = avg("inventory");            inv_prev    = avg_p("inventory")
        ap_cur     = avg("accounts_payable");     ap_prev     = avg_p("accounts_payable")
        assets_cur = avg("total_assets");         assets_prev = avg_p("total_assets")
        oi_cur     = s("operating_income");       oi_prev     = s_p("operating_income")
        ni_cur     = s("net_income");             ni_prev     = s_p("net_income")

        ada_data = count_rows(conn, w, params) > 0
    finally:
        conn.close()

    def safe_div(num, den):
        try:
            n = float(num) if num is not None else 0.0
            d = float(den) if den is not None else 0.0
            return n / d if d != 0 else None
        except (TypeError, ValueError):
            return None

    de_cur   = safe_div(liab_cur,  eq_cur)
    de_prev  = safe_div(liab_prev, eq_prev)
    nd_cur   = safe_div((liab_cur  - cash_cur),  ebitda_cur)
    nd_prev  = safe_div((liab_prev - cash_prev), ebitda_prev)
    wc_cur   = safe_div((ar_cur  + inv_cur),  ap_cur)
    wc_prev  = safe_div((ar_prev + inv_prev), ap_prev)
    roa_cur  = safe_div(ni_cur,  assets_cur)
    roa_prev = safe_div(ni_prev, assets_prev)
    if roa_cur  is not None: roa_cur  *= 100
    if roa_prev is not None: roa_prev *= 100
    roe_cur  = safe_div(ni_cur,  eq_cur)
    roe_prev = safe_div(ni_prev, eq_prev)
    if roe_cur  is not None: roe_cur  *= 100
    if roe_prev is not None: roe_prev *= 100
    ce_cur    = assets_cur  - liab_cur
    ce_prev   = assets_prev - liab_prev
    roce_cur  = safe_div(oi_cur,  ce_cur)
    roce_prev = safe_div(oi_prev, ce_prev)
    if roce_cur  is not None: roce_cur  *= 100
    if roce_prev is not None: roce_prev *= 100

    def build_ratio(cur, prev, unit="x", higher_is_better=True, decimals=2):
        if cur is None:
            return {"nilai": "—", "nilai_raw": None, "delta": None, "delta_fmt": "—", "naik": None, "baik": None}
        delta = round(cur - prev, 4) if prev is not None else None
        if delta is not None:
            is_rising = delta >= 0
            is_good   = is_rising if higher_is_better else not is_rising
            sign      = "+" if delta >= 0 else ""
            delta_fmt = f"{sign}{delta:.2f}{unit} YoY"
        else:
            is_rising = is_good = None
            delta_fmt = "—"
        return {"nilai": f"{cur:.{decimals}f}", "nilai_raw": round(cur, 4),
                "delta": delta, "delta_fmt": delta_fmt, "naik": is_rising, "baik": is_good}

    if tahun_query and kuartal: periode_label = f"{kuartal} {tahun_query}"
    elif tahun_query:           periode_label = f"FY {tahun_query}"
    else:                       periode_label = "All Years"

    return jsonify({
        "ada_data":        ada_data,
        "filter":          {"tahun": tahun_query, "kuartal": kuartal},
        "periode_label":   periode_label,
        "debt_equity":     build_ratio(de_cur,   de_prev,   unit="x", higher_is_better=False),
        "net_debt_ebitda": build_ratio(nd_cur,   nd_prev,   unit="x", higher_is_better=False),
        "working_capital": build_ratio(wc_cur,   wc_prev,   unit="x", higher_is_better=True),
        "roa":             build_ratio(roa_cur,  roa_prev,  unit="%", higher_is_better=True),
        "roe":             build_ratio(roe_cur,  roe_prev,  unit="%", higher_is_better=True),
        "roce":            build_ratio(roce_cur, roce_prev, unit="%", higher_is_better=True),
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
