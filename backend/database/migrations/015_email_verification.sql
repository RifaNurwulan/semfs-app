-- ============================================================
-- SEMF - Verifikasi email saat registrasi (OTP 6 digit)
-- File ini AMAN dijalankan berulang.
-- Jalankan setelah 001-014.
-- ============================================================

-- ------------------------------------------------------------
-- 1. USERS: status verifikasi email + penyimpanan OTP
--    OTP disimpan sebagai hash (SHA-256), bukan teks biasa.
-- ------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'email_verified_at'
    ) THEN
        EXECUTE 'ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ';

        -- Akun yang sudah ada sebelum fitur ini dianggap sudah terverifikasi,
        -- supaya tidak terkunci. Registrasi baru tetap harus verifikasi OTP.
        EXECUTE 'UPDATE users SET email_verified_at = now()';
    END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_hash     VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_expiry   TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_sent_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email_otp_hash
    ON users (email_otp_hash)
    WHERE email_otp_hash IS NOT NULL;

-- ============================================================
-- Cek hasil:  \d users
-- ============================================================
