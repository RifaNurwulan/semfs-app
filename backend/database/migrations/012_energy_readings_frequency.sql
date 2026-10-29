-- The reader stores the frequency_hz measurement in the legacy frekuensi column.
ALTER TABLE energy_readings
    ADD COLUMN IF NOT EXISTS frekuensi DOUBLE PRECISION;
