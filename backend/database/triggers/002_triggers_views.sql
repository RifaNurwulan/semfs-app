-- ------------------------------------------------------------
-- 1. TRIGGER: auto-update kolom updated_at di tabel users
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 2. TRIGGER: auto-update status & last_seen_at di power_meters
--    setiap kali ada data baru masuk ke energy_readings (F-02, F-03)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE power_meters
    SET status = 'online',
        last_seen_at = NEW.time
    WHERE device_id = NEW.device_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_energy_readings_last_seen ON energy_readings;
CREATE TRIGGER trg_energy_readings_last_seen
    AFTER INSERT ON energy_readings
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();

-- ------------------------------------------------------------
-- 3. TRIGGER: auto-catat log saat status device berubah
--    (mendukung Maintenance module F-02/F-03 di dokumen konstruksi)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_device_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO maintenance_logs (device_id, event_type, message)
        VALUES (
            NEW.device_id,
            CASE
                WHEN NEW.status = 'online' THEN 'reconnect'
                WHEN NEW.status = 'offline' THEN 'disconnect'
                ELSE 'error'
            END,
            'Status changed from ' || COALESCE(OLD.status, 'unknown') || ' to ' || NEW.status
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_power_meters_status_log ON power_meters;
CREATE TRIGGER trg_power_meters_status_log
    AFTER UPDATE ON power_meters
    FOR EACH ROW
    EXECUTE FUNCTION log_device_status_change();

-- ------------------------------------------------------------
-- 4. VIEW: data 1 jam terakhir per device (buat halaman Monitoring)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_energy_readings_last_hour AS
SELECT
    er.time,
    er.device_id,
    pm.device_name,
    pm.location,
    er.arus,
    er.tegangan,
    er.daya,
    er.energy
FROM energy_readings er
JOIN power_meters pm ON pm.device_id = er.device_id
WHERE er.time >= now() - INTERVAL '1 hour'
ORDER BY er.time DESC;

-- ------------------------------------------------------------
-- 5. VIEW: status device terkini (buat Dashboard & Maintenance page)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_device_status AS
SELECT
    device_id,
    device_name,
    location,
    status,
    last_seen_at,
    CASE
        WHEN last_seen_at IS NULL THEN 'never connected'
        WHEN now() - last_seen_at > INTERVAL '5 minutes' THEN 'stale'
        ELSE 'fresh'
    END AS data_freshness
FROM power_meters;

-- ------------------------------------------------------------
-- 6. MATERIALIZED VIEW: agregasi per jam (pakai TimescaleDB
--    continuous aggregate, auto-refresh, buat chart & forecasting
--    supaya query < 2 detik sesuai NF-01)
-- ------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_energy_hourly
WITH (timescaledb.continuous) AS
SELECT
    device_id,
    time_bucket('1 hour', time) AS bucket,
    AVG(arus)     AS avg_arus,
    AVG(tegangan) AS avg_tegangan,
    AVG(daya)     AS avg_daya,
    MAX(energy)   AS total_energy,
    COUNT(*)      AS jumlah_data
FROM energy_readings
GROUP BY device_id, bucket
WITH NO DATA;

-- Kebijakan auto-refresh continuous aggregate tiap 30 menit
SELECT add_continuous_aggregate_policy(
    'mv_energy_hourly',
    start_offset      => INTERVAL '3 hours',
    end_offset        => INTERVAL '1 hour',
    schedule_interval => INTERVAL '30 minutes',
    if_not_exists     => TRUE
);

-- ------------------------------------------------------------
-- 7. MATERIALIZED VIEW: agregasi harian (buat Export Laporan F-11
--    dan halaman Forecasting yang butuh data historis ringkas)
-- ------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_energy_daily
WITH (timescaledb.continuous) AS
SELECT
    device_id,
    time_bucket('1 day', time) AS bucket,
    AVG(arus)     AS avg_arus,
    AVG(tegangan) AS avg_tegangan,
    AVG(daya)     AS avg_daya,
    MAX(energy)   AS total_energy,
    COUNT(*)      AS jumlah_data
FROM energy_readings
GROUP BY device_id, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'mv_energy_daily',
    start_offset      => INTERVAL '3 days',
    end_offset        => INTERVAL '1 day',
    schedule_interval => INTERVAL '6 hours',
    if_not_exists     => TRUE
);

-- ============================================================
-- Selesai. Cek hasil dengan:
--   \dv                                  -> lihat semua view
--   SELECT * FROM v_device_status;       -> tes view biasa
--   SELECT * FROM mv_energy_hourly;      -> tes continuous aggregate (masih kosong sampai ada data)
-- ============================================================
