ALTER TABLE system_settings
    ADD COLUMN IF NOT EXISTS poll_interval_seconds INTEGER
    CHECK (poll_interval_seconds BETWEEN 1 AND 3600);
