"""
import_csv.py — Import INDOCEMENT.csv ke database SQLite
Jalankan sekali: python import_csv.py
"""
import csv, sqlite3, os

CSV_PATH = "INDOCEMENT.csv"
DB_PATH  = "indocement.db"

# Kolom CSV → kolom DB
# CSV: year,quarter,CFO,CFF,CFI,ending_cash_balance,net_change_in_cash,
#      revenue,cost_of_goods_sold,gross_profit,net_income,operating_expenses,
#      operating_income,accounts_receivable,inventory,accounts_payable,
#      tax_expense,interest_expense,date

def init_db(conn):
    c = conn.cursor()
    # Tabel utama dari CSV (lebih lengkap dari sebelumnya)
    c.execute("""
        CREATE TABLE IF NOT EXISTS data_keuangan (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            tahun               INTEGER NOT NULL,
            kuartal             TEXT    NOT NULL,
            bulan               TEXT,
            -- Arus Kas
            ocf                 REAL,   -- CFO
            cff                 REAL,   -- Cash Flow Financing
            cfi                 REAL,   -- Cash Flow Investing
            ending_cash         REAL,
            net_change_cash     REAL,
            fcf                 REAL,   -- OCF + CFI (kalkulasi)
            -- Laba Rugi
            revenue             REAL,
            cogs                REAL,
            gross_profit        REAL,
            net_income          REAL,
            laba_bersih         REAL,   -- alias net_income
            operating_expenses  REAL,
            operating_income    REAL,
            -- Neraca
            accounts_receivable REAL,
            inventory           REAL,
            accounts_payable    REAL,
            tax_expense         REAL,
            interest_expense    REAL,
            -- Balance Sheet
            total_assets        REAL,
            total_equity        REAL,
            total_liabilities   REAL,
            -- Tambahan
            da_expense          REAL,   -- Depreciation & Amortization
            ebitda              REAL,   -- Langsung dari CSV
            -- Meta
            capex               REAL,
            catatan             TEXT,
            dibuat_pada         TEXT DEFAULT (datetime('now','localtime'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS data_operasional (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            tahun           INTEGER NOT NULL,
            kuartal         TEXT    NOT NULL,
            bulan           TEXT,
            volume_produksi  REAL,
            volume_penjualan REAL,
            kapasitas_pabrik REAL,
            utilisasi_pct   REAL,
            harga_jual_avg  REAL,
            biaya_energi    REAL,
            catatan         TEXT,
            dibuat_pada     TEXT DEFAULT (datetime('now','localtime'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS notifikasi (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            pesan        TEXT NOT NULL,
            tipe         TEXT DEFAULT 'info',
            sudah_dibaca INTEGER DEFAULT 0,
            dibuat_pada  TEXT DEFAULT (datetime('now','localtime'))
        )
    """)
    conn.commit()


def import_csv(conn, path):
    c = conn.cursor()

    # Hapus data lama dari CSV agar tidak duplikat
    c.execute("DELETE FROM data_keuangan WHERE catatan = 'imported'")
    conn.commit()

    inserted = 0
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            tahun   = int(row['year'])
            kuartal = row['quarter'].strip()
            ocf     = float(row['CFO'])
            cff     = float(row['CFF'])
            cfi     = float(row['CFI'])
            fcf     = ocf + cfi          # FCF = OCF - CapEx (CFI sebagai proxy)
            capex   = abs(cfi)           # CapEx ≈ |CFI|

            c.execute("""
                INSERT INTO data_keuangan (
                    tahun, kuartal,
                    ocf, cff, cfi, ending_cash, net_change_cash, fcf, capex,
                    revenue, cogs, gross_profit, net_income, laba_bersih,
                    operating_expenses, operating_income,
                    accounts_receivable, inventory, accounts_payable,
                    tax_expense, interest_expense,
                    total_assets, total_equity, total_liabilities,
                    da_expense, ebitda,
                    catatan
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, (
                tahun, kuartal,
                ocf, cff, cfi,
                float(row['ending_cash_balance']),
                float(row['net_change_in_cash']),
                fcf, capex,
                float(row['revenue']),
                float(row['cost_of_goods_sold']),
                float(row['gross_profit']),
                float(row['net_income']),
                float(row['net_income']),   # laba_bersih alias
                float(row['operating_expenses']),
                float(row['operating_income']),
                float(row['accounts_receivable']),
                float(row['inventory']),
                float(row['accounts_payable']),
                float(row['tax_expense']),
                float(row['interest_expense']),
                float(row['total_assets']),
                float(row['total_equity']),
                float(row['total_liabilities']),
                float(row['da_expense']),
                float(row['EBITDA']),
                'imported'
            ))
            inserted += 1

    conn.commit()
    return inserted


if __name__ == "__main__":
    if not os.path.exists(CSV_PATH):
        print(f"❌  File '{CSV_PATH}' tidak ditemukan.")
        print(f"    Pastikan file CSV ada di folder yang sama dengan script ini.")
        exit(1)

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)
    n = import_csv(conn, CSV_PATH)
    conn.close()

    print(f"✅  Berhasil import {n} baris data ke '{DB_PATH}'")
    print(f"    Data siap digunakan oleh dashboard.")