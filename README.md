# SEMF - Smart Energy Monitoring & Forecasting

Panduan setup project dari nol sampai bisa jalan. Ikuti urutannya dari atas ke bawah.

**Stack:** Python (FastAPI) + PostgreSQL 17 + TimescaleDB untuk backend, React + TypeScript + Vite + Tailwind untuk frontend.

---

## 0. Prasyarat

Pastikan sudah terinstall di laptop kamu:

| Tool | Versi minimal | Cek dengan |
|---|---|---|
| Python | 3.9+ | `python --version` |
| Node.js | 18+ | `node --version` |
| PostgreSQL | **17** (bukan 18, lihat catatan di bawah) | `psql --version` |
| Git | apa saja | `git --version` |

> ⚠️ **Kenapa PostgreSQL 17, bukan versi terbaru?**
> TimescaleDB (ekstensi yang kita pakai) belum menyediakan installer resmi untuk Windows di PostgreSQL 18 per saat dokumen ini ditulis. Kalau sudah terlanjur install PG18, uninstall dulu lewat Control Panel, lalu install PG17 dari https://www.postgresql.org/download/windows/

> ⚠️ **Windows: `python` mengarah ke Python 2 / tidak ketemu?**
> Beberapa laptop punya Python 2.7 bawaan yang bentrok. Gunakan `py -3` sebagai gantinya, atau install Python 3 terbaru dari https://www.python.org/downloads/ dan **centang "Add python.exe to PATH"** saat instalasi.

> ⚠️ **Node versi lama (v14 dst)?**
> Install [NVM for Windows](https://github.com/coreybutler/nvm-windows/releases), lalu:
> ```powershell
> nvm install 22
> nvm use 22
> ```
> Perlu diulang tiap buka terminal baru kalau versi default belum diatur ke versi baru.

---

## 1. Clone repo

```powershell
git clone <url-repo-ini>
cd semfs-app
```

Struktur folder yang akan kamu lihat:
```
semfs-app/
├── backend/          <- Python (FastAPI)
│   └── database/
│       ├── migrations/   <- skema tabel & sample data
│       └── triggers/     <- trigger & view
└── frontend/         <- React + TypeScript + Vite + Tailwind
```

---

## 2. Setup Database (PostgreSQL + TimescaleDB)

### 2a. Install PostgreSQL 17
Download dari https://www.postgresql.org/download/windows/, jalankan installer.
- Port: biarkan default **5432**
- Password superuser `postgres`: buat sendiri, **catat baik-baik**
- Locale: biarkan default

Setelah selesai, kalau muncul jendela **Stack Builder**, klik **Cancel** saja (tidak perlu tools tambahan dari situ).

Tambahkan PostgreSQL ke PATH kalau `psql --version` belum dikenali:
```powershell
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\PostgreSQL\17\bin", "User")
```
Lalu **tutup dan buka ulang terminal/VS Code**.

### 2b. Install TimescaleDB
1. Download installer Windows untuk **PostgreSQL 17** dari [GitHub releases TimescaleDB](https://github.com/timescale/timescaledb/releases) — cari file `timescaledb-postgresql-17-windows-amd64.zip`
2. Ekstrak, masuk ke folder `timescaledb`, klik kanan `setup.exe` → **Run as Administrator**
3. Saat ditanya path `postgresql.conf`, isi:
   ```
   C:\Program Files\PostgreSQL\17\data\postgresql.conf
   ```
4. Saat ditanya jalankan `timescaledb-tune`, `shared_preload_libraries`, dan rekomendasi tuning lainnya → jawab **`y` (yes)** untuk semua
5. Setelah selesai, restart service PostgreSQL:
   ```powershell
   Restart-Service postgresql-x64-17
   ```

### 2c. Buat database & jalankan migration

```powershell
psql -U postgres
```
Di dalam psql:
```sql
CREATE DATABASE semfs_db;
\c semfs_db
CREATE EXTENSION IF NOT EXISTS timescaledb;
\q
```

Jalankan file migration secara berurutan (masuk ke folder tempat file-file ini disimpan):
```powershell
psql -U postgres -d semfs_db -f backend/database/migrations/001_init_schema.sql
psql -U postgres -d semfs_db -f backend/database/triggers/002_triggers_views.sql
psql -U postgres -d semfs_db -f backend/database/migrations/003_sample_data.sql
```

Verifikasi:
```powershell
psql -U postgres -d semfs_db -c "\dt"
```
Harus muncul 6 tabel: `users`, `power_meters`, `energy_readings`, `forecast_results`, `anomaly_detections`, `maintenance_logs`.

---

## 3. Setup Backend (Python/FastAPI)

```powershell
cd backend
py -3 -m venv venv
.\venv\Scripts\Activate.ps1
```

> Kalau muncul error `execution policy` saat mengaktifkan venv, jalankan sekali:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
> ```

Install semua dependency:
```powershell
pip install -r requirements.txt
```

Buat file `.env` (isi sesuai punyamu — **jangan commit file ini ke GitHub**):
```
DATABASE_URL=postgresql://postgres:<password_kamu>@localhost:5432/semfs_db
DB_USER=postgres
DB_PASSWORD=<password_kamu>
DB_HOST=localhost
DB_PORT=5432
DB_NAME=semfs_db
JWT_SECRET=<isi_string_rahasia_bebas>
```

### Tes koneksi Modbus + database (simulator, tanpa device fisik)

Buka **2 terminal**, keduanya di folder `backend` dengan venv aktif.

Terminal 1 — jalankan simulator power meter:
```powershell
python mock_power_meter.py
```

Terminal 2 — jalankan service pembaca data:
```powershell
python modbus_reader.py
```

Kalau berhasil, terminal 2 akan terus mencetak log `Tersimpan -> device=PM-001 ...` tiap 5 detik. Coba matikan (`Ctrl+C`) terminal 1 untuk menguji auto-reconnect — terminal 2 akan otomatis mencoba reconnect terus dan tersambung lagi begitu simulator dinyalakan ulang.

---

## 4. Setup Frontend (React + TypeScript + Tailwind)

Buka terminal baru:
```powershell
cd frontend
nvm use 22   # kalau pakai NVM, pastikan versi Node yang aktif benar
npm install
npm run dev
```

Buka `http://localhost:5173` di browser.

---

## 5. Troubleshooting umum

| Masalah | Solusi |
|---|---|
| `psql` tidak dikenali | Tutup-buka ulang terminal setelah setting PATH (lihat poin 2a) |
| `python -m venv` error "module could not be loaded" | Python yang aktif masih versi 2, pakai `py -3 -m venv venv` |
| Tailwind class tidak berefek di browser | Pastikan edit file `frontend/src/App.tsx` yang benar (bukan file nyasar di folder lain), dan `vite.config.ts` sudah include plugin `tailwindcss()` |
| `password authentication failed` saat `psql -U postgres` | Password salah ketik, atau reset lewat `pg_hba.conf` (ubah method jadi `trust` sementara, reset password, kembalikan ke `scram-sha-256`) |
| `ImportError` di `pymodbus` | Gunakan versi yang sudah di-pin di `requirements.txt` (`pymodbus==3.7.4`), jangan install versi pymodbus terbaru secara manual karena API-nya sering berubah |
| Node version lama padahal sudah install baru | Jalankan `nvm use <versi>` tiap buka terminal baru |

---

## 6. Catatan keamanan

- **Jangan pernah commit file `.env`** ke GitHub — sudah masuk `.gitignore`, tapi selalu double-check dengan `git status` sebelum push
- Password dummy di panduan ini (`semfs2026`, dll) hanya contoh untuk development lokal — ganti dengan password sendiri