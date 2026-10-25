-- ============================================================
-- SEMF - Tabel pendukung (riwayat backup/restore, riwayat ekspor, registri model forecasting)
-- AMAN dijalankan berulang (idempotent). Jalankan setelah 001-007.
-- Hanya menambah tabel baru; tidak mengubah migrasi lama.
-- ============================================================

-- ------------------------------------------------------------
-- 1. BACKUP_HISTORY (riwayat backup/restore konfigurasi)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backup_history (
    id           BIGSERIAL PRIMARY KEY,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action       VARCHAR(12)  NOT NULL CHECK (action IN ('backup', 'restore')),
    status       VARCHAR(12)  NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
    filename     VARCHAR(150),
    device_count INTEGER      DEFAULT 0,
    detail       TEXT,
    ip           VARCHAR(45),
    performed_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_backup_history_performed_at ON backup_history (performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_action ON backup_history (action, performed_at DESC);

-- ------------------------------------------------------------
-- 2. EXPORT_HISTORY (riwayat ekspor laporan)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS export_history (
    id           BIGSERIAL PRIMARY KEY,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    format       VARCHAR(10)  NOT NULL CHECK (format IN ('csv', 'json', 'pdf')),
    period_start TIMESTAMPTZ,
    period_end   TIMESTAMPTZ,
    device_id    VARCHAR(50) REFERENCES power_meters(device_id) ON DELETE SET NULL,
    filename     VARCHAR(150),
    row_count    INTEGER      DEFAULT 0,
    status       VARCHAR(12)  NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
    detail       TEXT,
    ip           VARCHAR(45),
    exported_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_export_history_exported_at ON export_history (exported_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_history_format ON export_history (format, exported_at DESC);

-- ------------------------------------------------------------
-- 3. FORECAST_MODELS (registri model AI untuk forecasting)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forecast_models (
    id            SERIAL PRIMARY KEY,
    model_name    VARCHAR(50)  NOT NULL UNIQUE,
    model_type    VARCHAR(30)  NOT NULL CHECK (model_type IN ('ARIMA', 'Prophet', 'LSTM', 'SARIMA', 'Other')),
    version       VARCHAR(20),
    description   TEXT,
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
    trained_at    TIMESTAMPTZ,
    trained_by    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    hyperparams   JSONB,
    metrics       JSONB,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_forecast_models_active ON forecast_models (is_active, model_type);