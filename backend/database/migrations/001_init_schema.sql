-- Pastikan ekstensi TimescaleDB aktif (harusnya sudah, tapi jaga-jaga)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ------------------------------------------------------------
-- 1. USERS -- Login multi-role (F-10)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                   SERIAL PRIMARY KEY,
    username             VARCHAR(50) UNIQUE NOT NULL,
    email                VARCHAR(100) UNIQUE NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,   -- simpan hash, JANGAN plain text
    role                 VARCHAR(20) NOT NULL DEFAULT 'viewer'
                         CHECK (role IN ('admin', 'operator', 'viewer')),
    reset_token          VARCHAR(255),             -- token untuk use case Reset Password
    reset_token_expiry   TIMESTAMPTZ,               -- masa berlaku token (mis. 1 jam)
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. POWER_METERS -- Data device Modbus (F-01, F-02)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS power_meters (
    id               SERIAL PRIMARY KEY,
    device_id        VARCHAR(50) UNIQUE NOT NULL,
    device_name      VARCHAR(100),
    ip_address       VARCHAR(45) NOT NULL,     -- cukup untuk IPv4 & IPv6
    port             INTEGER NOT NULL DEFAULT 502,  -- port default Modbus TCP
    virtual_id       INTEGER,                  -- Modbus Unit/Slave ID, use case Maintenance
    register_address INTEGER,                  -- alamat register Modbus yang dibaca, use case Maintenance
    location         VARCHAR(150),
    status           VARCHAR(20) NOT NULL DEFAULT 'offline'
                     CHECK (status IN ('online', 'offline', 'error')),
    last_seen_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3. ENERGY_READINGS -- Data time-series utama (F-01, F-02, F-03)
--    Ini yang akan diubah jadi HYPERTABLE (>=1000 data point/menit, NF-02)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS energy_readings (
    time          TIMESTAMPTZ NOT NULL,     -- kolom waktu, wajib untuk hypertable
    device_id     VARCHAR(50) NOT NULL REFERENCES power_meters(device_id),
    arus          DOUBLE PRECISION,          -- Ampere
    tegangan      DOUBLE PRECISION,          -- Volt
    daya          DOUBLE PRECISION,          -- Watt
    energy        DOUBLE PRECISION,          -- kWh (akumulasi)
    PRIMARY KEY (time, device_id)
);

-- Ubah jadi hypertable (partisi otomatis berdasarkan waktu)
SELECT create_hypertable(
    'energy_readings',
    'time',
    if_not_exists => TRUE,
    chunk_time_interval => INTERVAL '1 day'
);

-- Index tambahan untuk query per device (mempercepat filter by device_id)
CREATE INDEX IF NOT EXISTS idx_energy_readings_device
    ON energy_readings (device_id, time DESC);

-- ------------------------------------------------------------
-- 4. FORECAST_RESULTS -- Hasil prediksi AI (F-04, F-07)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forecast_results (
    id               SERIAL PRIMARY KEY,
    device_id        VARCHAR(50) NOT NULL REFERENCES power_meters(device_id),
    forecast_time    TIMESTAMPTZ NOT NULL,   -- waktu yang diprediksi
    predicted_energy DOUBLE PRECISION NOT NULL,
    confidence       DOUBLE PRECISION,       -- 0.0 - 1.0
    model_used       VARCHAR(30),            -- 'ARIMA' / 'Prophet' / 'LSTM'
    generated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 5. ANOMALY_DETECTIONS -- Deteksi anomali (F-04, F-06, F-13)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anomaly_detections (
    id            SERIAL PRIMARY KEY,
    device_id     VARCHAR(50) NOT NULL REFERENCES power_meters(device_id),
    detected_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    anomaly_type  VARCHAR(50),             -- misal: 'spike', 'drop', 'outlier'
    severity      VARCHAR(20) DEFAULT 'medium'
                  CHECK (severity IN ('low', 'medium', 'high')),
    description   TEXT,
    is_notified   BOOLEAN NOT NULL DEFAULT FALSE   -- F-13: sudah dikirim notif atau belum
);

-- ------------------------------------------------------------
-- 6. MAINTENANCE_LOGS -- Log status & maintenance device
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id            SERIAL PRIMARY KEY,
    device_id     VARCHAR(50) NOT NULL REFERENCES power_meters(device_id),
    logged_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    event_type    VARCHAR(50),   -- 'connect', 'disconnect', 'reconnect', 'error'
    message       TEXT
);

-- ------------------------------------------------------------
-- 7. RETENTION POLICY -- Arsip/hapus data lama otomatis (F-05: 6 bulan)
-- ------------------------------------------------------------
SELECT add_retention_policy(
    'energy_readings',
    INTERVAL '6 months',
    if_not_exists => TRUE
);

-- ============================================================
-- Selesai. Cek hasil dengan: \dt  (lihat semua tabel)
-- ============================================================