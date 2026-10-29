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
psql -U postgres -d semfs_db -f backend/database/migrations/004_notifications_avatar.sql
psql -U postgres -d semfs_db -f backend/database/migrations/005_devices_alerts_audit.sql
psql -U postgres -d semfs_db -f backend/database/migrations/006_energy_readings_metrics.sql
psql -U postgres -d semfs_db -f backend/database/migrations/007_system_settings.sql
psql -U postgres -d semfs_db -f backend/database/migrations/008_missing_tables.sql
psql -U postgres -d semfs_db -f backend/database/migrations/009_power_meter_measurements.sql
psql -U postgres -d semfs_db -f backend/database/migrations/010_power_meter_register_maps.sql
psql -U postgres -d semfs_db -f backend/database/migrations/011_configurable_modbus_parameters.sql
psql -U postgres -d semfs_db -f backend/database/migrations/012_energy_readings_frequency.sql
psql -U postgres -d semfs_db -f backend/database/migrations/013_energy_tariff.sql
```

Jalankan juga migration `006`-`013` berurutan; `009` menambahkan kolom pengukuran tiga fasa, `010` menambahkan peta alamat lama, `011` menyimpan konfigurasi parameter serta hasil pembacaan per meter, `012` menambahkan kolom frekuensi yang dipakai reader, dan `013` menambahkan tarif listrik per kWh untuk estimasi biaya. Migration `004`-`013` aman dijalankan berulang.

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

### Membaca data device (Modbus) -- paralel, konfigurasi dari database

Konfigurasi device (IP, port, Virtual ID, parameter, satuan, jenis register, format/panjang data, alamat register, dan batas daya) diatur admin di halaman **Maintenance**.
`modbus_reader.py` membaca semua device aktif dari database secara paralel; perubahan konfigurasi terdeteksi otomatis (tanpa restart).

Konfigurasi di Maintenance dapat menunjuk ke IP meter asli atau ke simulator di bawah ini. Alamat `localhost` dinormalisasi menjadi `127.0.0.1` dan menunjuk ke komputer tempat `modbus_reader.py` berjalan. Simulator menerima koneksi melalui `localhost`, `127.0.0.1`, maupun alamat IP jaringan laptop.

Tanpa alat asli, pakai simulator. Buka 2 terminal (keduanya venv aktif, di folder `backend`):

```powershell
# Terminal 1: 3 meter (PM-001..PM-003) berbagi port standar 502
python mock_power_meter.py

# Terminal 2: pembaca data
python modbus_reader.py
```

Default simulator membuat tiga meter pada `0.0.0.0:502`: Virtual ID `1`, `2`, dan `3`, semua mulai dari alamat register `0`. Beban, arus, tegangan, faktor daya, dan frekuensi berubah bertahap dengan pola waktu serta variasi kecil yang saling berkaitan; nilai energi merupakan totalizer yang terus bertambah selama simulator hidup. Di Maintenance, atur PM-001..PM-003 ke IP `localhost` (atau IP laptop), port `502`, Virtual ID `1`/`2`/`3`, dan register `0`. IP Address boleh sama untuk banyak device. Hanya jika IP dan port keduanya sama, Virtual ID harus berbeda; port atau ID yang berbeda dapat dipakai pada IP yang sama. ID `1`-`247` digunakan untuk meter/gateway; `255` dapat dipakai untuk server TCP langsung. ID `0` (broadcast) dan `248`-`254` dicadangkan. Simulator listen pada semua interface jaringan; gunakan hanya pada jaringan tepercaya dan pastikan firewall membatasi akses. Jika port `502` tidak dapat dibuka di Windows, jalankan terminal dengan hak administrator atau pilih port lain.

Edit device untuk mengubah, menambah, atau menghapus parameter. Untuk tiap parameter isi nama, satuan, Holding/Input Register, format data (`int16`, `uint16`, `int32`, `uint32`, `float32`, atau `float64`), dan alamat awal. Panjang otomatis mengikuti format (1, 2, atau 4 register); alamat PDU berbasis nol dan rentang parameter tidak boleh bertumpang tindih pada jenis register yang sama. Nilai awal tabel tetap cocok dengan simulator: 20 parameter float32 big-endian pada Holding Register, mulai dari alamat `0` sampai `38`. Simulator mengubah bacaan setiap dua detik dengan pola beban yang halus dan nilai fasa yang saling konsisten, bukan nilai tetap atau lonjakan acak independen. Total energi berjalan sejak simulator dijalankan dan akan mulai lagi dari nol jika proses simulator dimulai ulang.

| Offset | Tag | Satuan |
|---:|---|---|
| 0, 2, 4 | V_R (V_L1), V_S (V_L2), V_T (V_L3) | V |
| 6, 8, 10 | V_RN (V_L1N), V_SN (V_L2N), V_TN (V_L3N) | V |
| 12, 14, 16, 18 | I_R (I_L1), I_S (I_L2), I_T (I_L3), I_N | A |
| 20, 22, 24 | P_Total (kW_Total), Q_Total (kVAR_Total), S_Total (kVA_Total) | kW, kVAR, kVA |
| 26, 28 | PF (Power_Factor), Freq (Frequency) | rasio, Hz |
| 30, 32, 34, 36, 38 | kWh_Del (E_Act_Del / Import), kWh_Rec (E_Act_Rec / Export), kVARh_Del (E_React_Del), kVARh_Rec (E_React_Rec), kVAh_Del (E_App_Del) | kWh, kWh, kVARh, kVARh, kVAh |

Alamat register mengikuti alamat PDU Modbus berbasis nol. Contoh menjalankan dua meter di port sama tetapi port register awal berbeda: `python mock_power_meter.py 502:1:0 502:2:100`.
Gunakan tombol **Uji koneksi** untuk memastikan koneksi dan pembacaan register sesaat. Status **Online** dan Last Sync diperbarui oleh proses `modbus_reader.py` hanya setelah pembacaan berkala berhasil disimpan; jika tes koneksi berhasil tetapi status tetap Offline atau Last Sync lama, jalankan/restart pembaca data di Terminal 2 dan periksa log terminal tersebut.
Matikan simulator untuk melihat status berubah offline + notifikasi. Isi **Batas daya** kecil (mis. 100 W) untuk melihat notifikasi batas konsumsi.

### Menjalankan API (login, akun, notifikasi, support)

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m app.seed_demo_users      # sekali saja: beri password ke 3 akun demo
uvicorn app.main:app --reload
```

Dokumentasi API otomatis: http://127.0.0.1:8000/docs

| Akun demo | Password | Role |
|---|---|---|
| `admin_rifa` | `Admin123!` | admin |
| `operator_demo` | `Operator123!` | operator |
| `viewer_demo` | `Viewer123!` | viewer |

**Reset password & Hubungi Support** mengirim email lewat SMTP. Kalau `SMTP_HOST` di `.env` kosong (mode dev),
tautan reset dan pesan support dicetak di terminal tempat `uvicorn` berjalan. Variabel `.env` lengkap ada di `backend/.env.example`.

**Hak akses per role** (sesuai SRS): Monitoring dan Forecasting untuk semua role; Export Laporan untuk semua role;
Pengaturan Sistem, Maintenance, dan Kelola Pengguna khusus admin; Notifikasi untuk admin dan operator.
Pengaturannya ada di `frontend/src/lib/features.ts` (satu baris per fitur).

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
- Password dummy di panduan ini (`semfs2026`, dll) hanya contoh untuk development lokal — ganti dengan password sendiri.
