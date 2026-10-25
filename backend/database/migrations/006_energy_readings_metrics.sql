-- ============================================================
-- SEMF - Kolom tambahan pada energy_readings: frekuensi, power_factor,
-- temperatur, efisiensi (Ekspor & Laporan - 8 parameter).
-- AMAN dijalankan berulang (idempotent). Jalankan setelah 001-005.
--
-- Semua kolom DOUBLE PRECISION dan boleh NULL, sehingga data lama
-- tidak rusak dan INSERT lama tetap berjalan tanpa perubahan.
-- Aman untuk hypertable TimescaleDB: ADD COLUMN tanpa DEFAULT
-- (atau DEFAULT NULL) hanya merubah katalog (metadata-only), data
-- chunk tidak dipindahkan/ditulis ulang.
-- ============================================================

ALTER TABLE energy_readings ADD COLUMN IF NOT EXISTS frekuensi    DOUBLE PRECISION;  -- Hz
ALTER TABLE energy_readings ADD COLUMN IF NOT EXISTS power_factor DOUBLE PRECISION;  -- satuan 0.0 - 1.0
ALTER TABLE energy_readings ADD COLUMN IF NOT EXISTS temperatur   DOUBLE PRECISION;  -- derajat Celsius
ALTER TABLE energy_readings ADD COLUMN IF NOT EXISTS efisiensi    DOUBLE PRECISION;  -- persen (%)
