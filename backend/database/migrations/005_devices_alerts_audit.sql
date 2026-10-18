-- ============================================================
-- SEMF - Konfigurasi device, notifikasi batas konsumsi (F-13), audit trail (NF-08)
-- AMAN dijalankan berulang (idempotent). Jalankan setelah 001-004.
-- ============================================================

-- 1. POWER_METERS: batas daya per device + saklar aktif/nonaktif
ALTER TABLE power_meters ADD COLUMN IF NOT EXISTS power_limit_w DOUBLE PRECISION
    CHECK (power_limit_w IS NULL OR power_limit_w > 0);   -- batas daya (Watt); kosong = tanpa alert
ALTER TABLE power_meters ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;  -- FALSE = tidak dibaca pembaca Modbus

-- 2. AUDIT_LOGS (NF-08): jejak aktivitas pengguna, dibaca admin di halaman Maintenance
CREATE TABLE IF NOT EXISTS audit_logs (
    id        BIGSERIAL PRIMARY KEY,
    at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username  VARCHAR(50),          -- disimpan terpisah supaya log tetap terbaca walau akun dihapus
    action    VARCHAR(40) NOT NULL, -- login, logout, role_change, device_update, backup, ...
    entity    VARCHAR(40),
    entity_id VARCHAR(60),
    detail    TEXT,                 -- TIDAK PERNAH berisi password/token
    ip        VARCHAR(45)
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_at     ON audit_logs (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action, at DESC);

-- 3. TRIGGER (F-13): daya melebihi batas -> notifikasi. Maksimal satu per 10 menit per device.
CREATE OR REPLACE FUNCTION notify_over_limit() RETURNS TRIGGER AS $$
DECLARE
    v_limit DOUBLE PRECISION;
    v_name  TEXT;
BEGIN
    IF NEW.daya IS NULL THEN RETURN NEW; END IF;

    SELECT power_limit_w, COALESCE(device_name, device_id) INTO v_limit, v_name
    FROM power_meters WHERE device_id = NEW.device_id;

    IF v_limit IS NULL OR NEW.daya <= v_limit THEN RETURN NEW; END IF;

    IF EXISTS (
        SELECT 1 FROM notifications
        WHERE device_id = NEW.device_id AND type = 'consumption_limit'
          AND created_at > now() - INTERVAL '10 minutes'
    ) THEN
        RETURN NEW;
    END IF;

    INSERT INTO notifications (type, severity, title, message, device_id)
    VALUES (
        'consumption_limit',
        CASE WHEN NEW.daya > v_limit * 1.2 THEN 'critical' ELSE 'warning' END,
        v_name || ' melebihi batas daya',
        'Daya ' || round(NEW.daya::numeric, 0) || ' W melebihi batas ' || round(v_limit::numeric, 0) || ' W.',
        NEW.device_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_energy_readings_limit ON energy_readings;
CREATE TRIGGER trg_energy_readings_limit
    AFTER INSERT ON energy_readings
    FOR EACH ROW EXECUTE FUNCTION notify_over_limit();
