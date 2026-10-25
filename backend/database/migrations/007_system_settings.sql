-- ============================================================
-- SEMF - Pengaturan sistem global (Poin 8b): zona waktu & bahasa.
-- Tabel single-row (hanya id = 1) sehingga tidak perlu join/kondisi
-- "baris mana yang aktif". Nilai awal: Asia/Jakarta (WIB) + bahasa id.
-- AMAN dijalankan berulang (idempotent). Jalankan setelah 001-006.
--
-- Zona waktu berlaku GLOBAL untuk semua pengguna: menentukan cara
-- frontend memformat tanggal/jam (lihat frontend/src/lib/utils.ts).
-- Bahasa saat ini hanya menentukan preferensi teks di halaman
-- Pengaturan (penerjemahan penuh UI = cakupan terpisah).
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
    id         SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    timezone   VARCHAR(30)  NOT NULL DEFAULT 'Asia/Jakarta'
               CHECK (timezone IN ('Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'UTC')),
    language   VARCHAR(2)   NOT NULL DEFAULT 'id'
               CHECK (language IN ('id', 'en')),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Seed baris tunggal; ON CONFLICT membuatnya idempotent.
INSERT INTO system_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;
