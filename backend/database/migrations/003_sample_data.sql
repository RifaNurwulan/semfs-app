-- ------------------------------------------------------------
-- 1. Dummy Power Meter (3 device pura-pura)
-- ------------------------------------------------------------
INSERT INTO power_meters (device_id, device_name, ip_address, port, location, status)
VALUES
    ('PM-001', 'Power Meter Lobby',  '192.168.1.101', 502, 'Lobby Gedung A', 'offline'),
    ('PM-002', 'Power Meter Server Room', '192.168.1.102', 502, 'Ruang Server', 'offline'),
    ('PM-003', 'Power Meter Kantin', '192.168.1.103', 502, 'Kantin Lt.1', 'offline')
ON CONFLICT (device_id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Dummy user -- 3 role sesuai SRS (F-10: admin, operator, viewer)
--    Password masih placeholder teks biasa -- WAJIB diganti pakai
--    bcrypt hash asli waktu modul Auth (backend, PIC: Ilham) sudah jadi.
--    Jangan pernah simpan password asli/plain text di production.
-- ------------------------------------------------------------
INSERT INTO users (username, email, password_hash, role)
VALUES
    ('admin_rifa',    'admin@semf.test',    'placeholder_hash_ganti_nanti', 'admin'),
    ('operator_demo', 'operator@semf.test', 'placeholder_hash_ganti_nanti', 'operator'),
    ('viewer_demo',   'viewer@semf.test',   'placeholder_hash_ganti_nanti', 'viewer')
ON CONFLICT (username) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Dummy energy_readings -- generate data tiap 1 menit,
--    untuk 3 device, selama 6 jam terakhir (otomatis pakai loop)
-- ------------------------------------------------------------
DO $$
DECLARE
    device RECORD;
    t TIMESTAMPTZ;
    base_arus DOUBLE PRECISION;
    base_tegangan DOUBLE PRECISION := 220;
    running_energy DOUBLE PRECISION;
BEGIN
    FOR device IN SELECT device_id FROM power_meters LOOP
        running_energy := 0;
        base_arus := 5 + random() * 10;  -- arus dasar acak per device (5-15 A)

        t := now() - INTERVAL '6 hours';
        WHILE t <= now() LOOP
            running_energy := running_energy + (base_arus * base_tegangan / 1000.0 / 60.0); -- kWh per menit

            INSERT INTO energy_readings (time, device_id, arus, tegangan, daya, energy)
            VALUES (
                t,
                device.device_id,
                round((base_arus + (random() - 0.5) * 2)::numeric, 2),        -- arus fluktuatif
                round((base_tegangan + (random() - 0.5) * 4)::numeric, 2),    -- tegangan fluktuatif
                round((base_arus * base_tegangan + (random() - 0.5) * 50)::numeric, 2), -- daya (P = V x I, + noise)
                round(running_energy::numeric, 4)
            );

            t := t + INTERVAL '1 minute';
        END LOOP;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 4. Update status device jadi 'online' (simulasi baru saja terhubung)
--    (Trigger sudah otomatis melakukan ini tiap INSERT, tapi
--     dipanggil eksplisit untuk mastiin last_seen_at ter-update)
-- ------------------------------------------------------------
-- (Tidak perlu manual -- trigger trg_energy_readings_last_seen
--  di poin 1c sudah otomatis menjalankan ini tiap ada data masuk)

-- ------------------------------------------------------------
-- 5. Refresh continuous aggregate manual (biar mv_energy_hourly
--    langsung keisi tanpa perlu nunggu jadwal 30 menit)
-- ------------------------------------------------------------
CALL refresh_continuous_aggregate('mv_energy_hourly', NULL, NULL);
CALL refresh_continuous_aggregate('mv_energy_daily', NULL, NULL);

-- ============================================================
-- Selesai. Cek hasil dengan:
--   SELECT COUNT(*) FROM energy_readings;
--   SELECT * FROM v_device_status;
--   SELECT * FROM v_energy_readings_last_hour LIMIT 10;
--   SELECT * FROM mv_energy_hourly ORDER BY bucket DESC LIMIT 10;
--   SELECT * FROM maintenance_logs;   -> cek trigger status log jalan
--   SELECT username, email, role FROM users;  -> cek 3 user dengan role berbeda
-- ============================================================
