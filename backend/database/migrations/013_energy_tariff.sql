-- Harga listrik global untuk menghitung biaya pada dashboard Monitoring Energy.
-- Aman dijalankan berulang.

ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS price_per_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (price_per_kwh >= 0);
