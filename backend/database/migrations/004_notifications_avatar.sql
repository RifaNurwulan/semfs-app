-- ============================================================
-- SEMF - Notifikasi, Foto Profil, dan pendukung Reset Password
-- File ini AMAN dijalankan berulang (idempotent) dan tidak mengubah 001-003.
-- Jalankan setelah 001, 002, dan 003.
-- ============================================================

-- ------------------------------------------------------------
-- 1. USERS: kolom foto profil + pendukung reset password
-- ------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar             BYTEA;        -- isi foto (maks 512 KB, dicek di API)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime        VARCHAR(20);  -- image/png | image/jpeg | image/webp
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_updated_at  TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token        VARCHAR(255); -- (sudah ada di 001) isinya HASH token, bukan token asli
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMPTZ;
-- Token login (JWT) yang dibuat SEBELUM waktu ini dianggap tidak berlaku (dipakai saat reset password)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token) WHERE reset_token IS NOT NULL;

-- ------------------------------------------------------------
-- 2. NOTIFICATIONS (F-13): satu notifikasi untuk semua admin/operator,
--    status "sudah dibaca" disimpan per user
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    type        VARCHAR(30)  NOT NULL,   -- device_offline | device_online | device_error | anomaly | system
    severity    VARCHAR(10)  NOT NULL DEFAULT 'info'
                CHECK (severity IN ('info', 'warning', 'critical')),
    title       VARCHAR(150) NOT NULL,
    message     TEXT,
    device_id   VARCHAR(50)  REFERENCES power_meters(device_id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe  ON notifications (device_id, type, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id BIGINT      NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id         INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (notification_id, user_id)
);

-- ------------------------------------------------------------
-- 3. TRIGGER: kejadian device (dari maintenance_logs) -> notifikasi
--    Rantai: modbus_reader ubah power_meters.status
--            -> trigger 002 menulis maintenance_logs
--            -> trigger ini membuat notifikasi
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_device_event() RETURNS TRIGGER AS $$
DECLARE
    v_name  TEXT;
    v_type  TEXT;
    v_sev   TEXT;
    v_title TEXT;
BEGIN
    IF NEW.event_type NOT IN ('disconnect', 'error', 'reconnect') THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(device_name, device_id) INTO v_name
    FROM power_meters WHERE device_id = NEW.device_id;

    IF NEW.event_type = 'disconnect' THEN
        v_type := 'device_offline'; v_sev := 'warning';  v_title := v_name || ' offline';
    ELSIF NEW.event_type = 'error' THEN
        v_type := 'device_error';   v_sev := 'critical'; v_title := v_name || ' mengalami error';
    ELSE
        v_type := 'device_online';  v_sev := 'info';     v_title := v_name || ' kembali online';
    END IF;

    -- Anti-spam: kejadian yang sama pada device yang sama dalam 60 detik cukup satu notifikasi
    IF EXISTS (
        SELECT 1 FROM notifications
        WHERE device_id = NEW.device_id AND type = v_type
          AND created_at > now() - INTERVAL '60 seconds'
    ) THEN
        RETURN NEW;
    END IF;

    INSERT INTO notifications (type, severity, title, message, device_id)
    VALUES (
        v_type, v_sev, v_title,
        CASE v_type
            WHEN 'device_offline' THEN 'Device tidak merespons. Sistem mencoba menyambung ulang secara otomatis.'
            WHEN 'device_error'   THEN 'Device melaporkan error. Periksa koneksi dan konfigurasi device.'
            ELSE 'Koneksi device pulih dan data kembali masuk.'
        END,
        NEW.device_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_maintenance_logs_notify ON maintenance_logs;
CREATE TRIGGER trg_maintenance_logs_notify
    AFTER INSERT ON maintenance_logs
    FOR EACH ROW EXECUTE FUNCTION notify_device_event();

-- ------------------------------------------------------------
-- 4. TRIGGER: anomali baru (F-06) -> notifikasi, tandai is_notified = TRUE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_anomaly() RETURNS TRIGGER AS $$
DECLARE
    v_name TEXT;
    v_sev  TEXT;
BEGIN
    SELECT COALESCE(device_name, device_id) INTO v_name
    FROM power_meters WHERE device_id = NEW.device_id;

    v_sev := CASE NEW.severity WHEN 'high' THEN 'critical' WHEN 'medium' THEN 'warning' ELSE 'info' END;

    INSERT INTO notifications (type, severity, title, message, device_id)
    VALUES (
        'anomaly', v_sev, 'Anomali pada ' || v_name,
        COALESCE(NEW.anomaly_type, 'anomali') || COALESCE(': ' || NEW.description, ''),
        NEW.device_id
    );

    NEW.is_notified := TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_anomaly_notify ON anomaly_detections;
CREATE TRIGGER trg_anomaly_notify
    BEFORE INSERT ON anomaly_detections
    FOR EACH ROW EXECUTE FUNCTION notify_anomaly();

-- ------------------------------------------------------------
-- 5. SUPPORT_REQUESTS: pesan dari tombol "Hubungi Support" di halaman login
--    (disimpan di database supaya tidak hilang walau email belum dikonfigurasi)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_requests (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) NOT NULL,
    message     TEXT         NOT NULL,
    status      VARCHAR(12)  NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'resolved')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_support_requests_created ON support_requests (created_at DESC);

-- ============================================================
-- Cek hasil:  \d users     \dt     SELECT * FROM notifications;
-- ============================================================
