import { useCallback } from 'react'
import * as i18n from './i18n'
import { useTranslation } from './i18n'

export type SystemLanguage = 'id' | 'en'

type I18nModule = {
  setLanguage?: (lang: SystemLanguage) => void
  getLanguage?: () => SystemLanguage
  setSystemLanguage?: (lang: SystemLanguage) => void
  getSystemLanguage?: () => SystemLanguage
  applySystemLanguageSetting?: (lang: SystemLanguage) => void
  saveSystemLanguage?: (lang: SystemLanguage) => void
}

type TranslationHook = {
  language?: SystemLanguage
  lang?: SystemLanguage
}

const i18nModule = i18n as unknown as I18nModule

const LANGUAGE_KEYS = ['semfs-lang', 'semfs-system-language'] as const
const OVERRIDE_KEY = 'semfs-system-language-override'

const SETTINGS_TRANSLATIONS: Record<string, string> = {
  'Pengaturan Sistem': 'System Settings',
  'Konfigurasi zona waktu, bahasa, dan interval polling': 'Configure time zone, language, and polling interval',
  'Sesi login tidak tersedia. Silakan login kembali.': 'Login session unavailable. Please log in again.',
  'Backend API belum mendukung interval polling. Restart API dari folder backend.': 'Backend API does not support the polling interval. Restart the API from the backend folder.',
  'Pengaturan sistem belum tersedia': 'System settings are not available',
  'Gagal memuat pengaturan.': 'Failed to load settings.',
  'Gagal menyimpan pengaturan.': 'Failed to save settings.',
  'Pengaturan berhasil disimpan.': 'Settings saved successfully.',
  'Interval polling harus berupa bilangan bulat antara 1 dan 3600 detik.': 'Polling interval must be an integer between 1 and 3600 seconds.',
  'Memuat pengaturan...': 'Loading settings...',
  'Zona Waktu': 'Time Zone',
  'Universal Time Coordinated': 'Coordinated Universal Time',
  'Waktu Indonesia Barat (GMT+7)': 'Western Indonesia Time (GMT+7)',
  'Waktu Indonesia Tengah (GMT+8)': 'Central Indonesia Time (GMT+8)',
  'Waktu Indonesia Timur (GMT+9)': 'Eastern Indonesia Time (GMT+9)',
  'Bahasa': 'Language',
  'Bahasa Indonesia': 'Indonesian',
  'Interval Polling': 'Polling Interval',
  'Jeda pembacaan semua power meter. Perubahan berlaku otomatis setelah konfigurasi reader diperbarui.': 'Interval for reading all power meters. Changes apply automatically after the reader configuration is updated.',
  'detik': 'seconds',
  'Simpan Pengaturan': 'Save Settings',
  'Hanya Admin yang dapat mengubah pengaturan sistem.': 'Only admins can change system settings.',
  'Preview': 'Preview',
  'Waktu Saat Ini': 'Current Time',
  'Bahasa Aktif': 'Active Language',
  'Pratinjau tersedia setelah pengaturan dimuat.': 'Preview is available once settings are loaded.',
}

function readStoredLanguage(): SystemLanguage {
  if (typeof window === 'undefined') return 'id'
  return LANGUAGE_KEYS.some((key) => window.localStorage.getItem(key) === 'en') ? 'en' : 'id'
}

export function currentSystemLanguage(): SystemLanguage {
  return i18nModule.getLanguage?.() ?? i18nModule.getSystemLanguage?.() ?? readStoredLanguage()
}

function applyLanguage(lang: SystemLanguage, persist: boolean) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('semfs-lang', lang)
    window.localStorage.setItem('semfs-system-language', lang)
    if (persist) window.localStorage.removeItem(OVERRIDE_KEY)
    else window.localStorage.setItem(OVERRIDE_KEY, 'true')
  }
  i18nModule.setLanguage?.(lang)
  i18nModule.applySystemLanguageSetting?.(lang)
  if (!i18nModule.setLanguage && !i18nModule.applySystemLanguageSetting) {
    i18nModule.setSystemLanguage?.(lang)
  }
}

export function applySystemLanguage(lang: SystemLanguage) {
  applyLanguage(lang, false)
}

export function saveSystemLanguageSetting(lang: SystemLanguage) {
  applyLanguage(lang, true)
}

/**
 * Terjemahan halaman pengaturan yang bekerja baik dengan i18n versi lokal
 * (berbasis teks Indonesia) maupun versi remote (berbasis key semantik).
 */
export function useSettingsI18n() {
  const base = useTranslation() as TranslationHook
  const language = base.language ?? base.lang ?? currentSystemLanguage()
  const t = useCallback(
    (text: string) => (language === 'en' ? SETTINGS_TRANSLATIONS[text] ?? text : text),
    [language],
  )
  return { language, t }
}
