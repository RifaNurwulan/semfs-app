import * as i18n from './i18n'

export type SystemLanguage = 'id' | 'en'

type I18nModule = {
  setLanguage?: (lang: SystemLanguage) => void
  getLanguage?: () => SystemLanguage
  setSystemLanguage?: (lang: SystemLanguage) => void
  getSystemLanguage?: () => SystemLanguage
  applySystemLanguageSetting?: (lang: SystemLanguage) => void
  saveSystemLanguage?: (lang: SystemLanguage) => void
}

const i18nModule = i18n as unknown as I18nModule

const LANGUAGE_KEYS = ['semfs-lang', 'semfs-system-language'] as const
const OVERRIDE_KEY = 'semfs-system-language-override'

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
