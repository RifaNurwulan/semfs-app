
import { useEffect, useSyncExternalStore } from 'react'
import { getToken } from '../auth/tokenStorage'

export type Lang = 'id' | 'en'

const API_BASE: string =
  import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

const STORAGE_KEY = 'semfs-lang'

// ==========================================
// LANGUAGE STATE
// ==========================================

function readStored(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en'
      ? 'en'
      : 'id'
  } catch {
    return 'id'
  }
}

let current: Lang = readStored()
let loadedFromServer = false
let languageRevision = 0

const listeners = new Set<() => void>()

let serverLoadPromise: Promise<void> | null = null

if (typeof document !== 'undefined') {
  document.documentElement.lang = current
}

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

// ==========================================
// SET LANGUAGE
// ==========================================

export function setLanguage(lang: Lang) {
  if (lang !== 'id' && lang !== 'en') return

  current = lang
  languageRevision++

  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Browser storage unavailable
  }

  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang
  }

  notifyListeners()
}

export function getLanguage(): Lang {
  return current
}

// ==========================================
// BROWSER TAB SYNCHRONIZATION
// ==========================================

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return

    if (event.newValue !== 'id' && event.newValue !== 'en') {
      return
    }

    current = event.newValue
    languageRevision++

    if (typeof document !== 'undefined') {
      document.documentElement.lang = current
    }

    notifyListeners()
  })
}

// ==========================================
// LOAD LANGUAGE FROM SERVER
// ==========================================

export async function loadLanguageFromServer(): Promise<void> {
  if (loadedFromServer) return

  if (serverLoadPromise) {
    return serverLoadPromise
  }

  const token = getToken()

  if (!token) return

  const revisionAtStart = languageRevision

  serverLoadPromise = (async () => {
    try {
      const response = await fetch(
        `${API_BASE}/maintenance/settings`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        },
      )

      if (!response.ok) {
        throw new Error(
          `Failed to load language settings: ${response.status}`,
        )
      }

      const data = await response.json()

      loadedFromServer = true

      // Jangan menimpa perubahan bahasa terbaru pengguna
      if (
        (data.language === 'id' || data.language === 'en') &&
        languageRevision === revisionAtStart
      ) {
        setLanguage(data.language)
      }
    } catch (error) {
      console.error(
        'Failed to load language settings:',
        error,
      )
    } finally {
      serverLoadPromise = null
    }
  })()

  return serverLoadPromise
}

// ==========================================
// TRANSLATION DICTIONARY
// ==========================================

const dict: Record<Lang, Record<string, string>> = {
  id: {
    // --------------------------------------
    // GENERAL
    // --------------------------------------

    'app.name': 'SEMFS',
    'app.loading': 'Memuat aplikasi...',
    'app.welcome': 'Selamat Datang',
    'app.back': 'Kembali',
    'app.next': 'Selanjutnya',
    'app.cancel': 'Batal',
    'app.save': 'Simpan',
    'app.delete': 'Hapus',
    'app.edit': 'Ubah',
    'app.search': 'Cari',
    'app.filter': 'Filter',
    'app.refresh': 'Muat Ulang',
    'app.close': 'Tutup',
    'app.confirm': 'Konfirmasi',
    'app.submit': 'Kirim',
    'app.reset': 'Reset',
    'app.actions': 'Aksi',
    'app.status': 'Status',
    'app.date': 'Tanggal',
    'app.time': 'Waktu',
    'app.nameLabel': 'Nama',
    'app.description': 'Deskripsi',
    'app.noData': 'Tidak ada data.',
    'app.success': 'Berhasil',
    'app.failed': 'Gagal',
    'app.online': 'Online',
    'app.offline': 'Offline',
    'app.enabled': 'Aktif',
    'app.disabled': 'Nonaktif',

    // --------------------------------------
    // SETTINGS
    // --------------------------------------

    'settings.title': 'Pengaturan Sistem',
    'settings.subtitle': 'Atur zona waktu dan bahasa yang dipakai sistem.',
    'settings.readOnly': 'Hanya admin yang dapat mengubah pengaturan. Kamu hanya bisa melihatnya.',
    'settings.loading': 'Memuat pengaturan...',
    'settings.section': 'Wilayah dan bahasa',
    'settings.timezone': 'Zona waktu',
    'settings.timezoneHint': 'Dipakai untuk menampilkan waktu data dan laporan.',
    'settings.language': 'Bahasa',
    'settings.lastChanged': 'Terakhir diubah',
    'settings.neverChanged': 'Belum pernah diubah.',
    'settings.save': 'Simpan perubahan',
    'settings.saving': 'Menyimpan...',
    'settings.saved': 'Pengaturan sistem berhasil disimpan.',
    'settings.indonesian': 'Bahasa Indonesia',
    'settings.english': 'Bahasa Inggris',

    // --------------------------------------
    // ERRORS
    // --------------------------------------

    'err.noSession': 'Sesi login tidak tersedia. Silakan login kembali.',
    'err.connect': 'Tidak dapat terhubung ke server. Pastikan API sudah berjalan.',
    'err.request': 'Permintaan gagal (kode {code}).',
    'err.load': 'Gagal memuat pengaturan sistem.',
    'err.save': 'Gagal menyimpan pengaturan sistem.',
    'err.generic': 'Terjadi kesalahan. Silakan coba lagi.',
    'err.unauthorized': 'Anda tidak memiliki izin untuk mengakses halaman ini.',
    'err.notFound': 'Data tidak ditemukan.',
    'err.required': 'Bagian ini wajib diisi.',

    // --------------------------------------
    // DASHBOARD
    // --------------------------------------

    'welcomeDashboard': 'Selamat Datang di Dashboard',
    'dashboardSubtitle': 'Overview sistem monitoring dan forecasting energi Anda',
    'statOnlineDevices': 'Perangkat Online',
    'statPowerMeterStatus': 'Status power meter',
    'statTotalDevices': 'Total Perangkat',
    'statRegisteredInSystem': 'Terdaftar di sistem',
    'statSystemHealth': 'Kesehatan Sistem',
    'statApiDatabase': 'API & database',
    'statActiveNotifications': 'Notifikasi Aktif',
    'unreadText': 'Belum dibaca',
    'alertText': 'Alert',
    'mainMenu': 'Menu Utama',
    'checkingSystemStatus': 'Memeriksa status sistem...',
    'systemOperational': 'Sistem Operasional',
    'serverDisconnected': 'Server tidak terhubung',
    'lastChecked': 'Pemeriksaan terakhir',
    'connected': 'Terhubung',
    'disconnected': 'Tidak terhubung',
    'accountLabel': 'Akun',
    'systemNormal': 'Sistem Normal',
    'devicesHavingIssues': 'perangkat bermasalah',

    // --------------------------------------
    // DASHBOARD MENU
    // --------------------------------------

    'feature_monitoring_title': 'Monitoring Energy',
    'feature_monitoring_desc': 'Pantau konsumsi energi real-time dengan visualisasi interaktif',

    'feature_forecasting_title': 'Forecasting Energy',
    'feature_forecasting_desc': 'Prediksi dan analisis tren konsumsi energi menggunakan AI',

    'feature_pengaturan_title': 'Pengaturan Sistem',
    'feature_pengaturan_desc': 'Konfigurasi sistem',

    'feature_ekspor_title': 'Ekspor & Laporan',
    'feature_ekspor_desc': 'Buat dan unduh laporan',

    'feature_maintenance_title': 'Maintenance',
    'feature_maintenance_desc': 'Kelola tarif energi dan perangkat power meter',

    'feature_pengguna_title': 'Kelola Pengguna',
    'feature_pengguna_desc': 'Atur akun, role, dan pesan support',

    // --------------------------------------
    // NAVIGATION
    // --------------------------------------

    'nav.dashboard': 'Dashboard',
    'nav.monitoring': 'Monitoring Energy',
    'nav.forecasting': 'Forecasting Energy',
    'nav.settings': 'Pengaturan Sistem',
    'nav.export': 'Ekspor & Laporan',
    'nav.maintenance': 'Maintenance',
    'nav.users': 'Kelola Pengguna',
    'nav.logout': 'Keluar',
    'nav.profile': 'Profil',

    // --------------------------------------
    // MONITORING
    // --------------------------------------

    'monitoring.title': 'Monitoring Energi',
    'monitoring.subtitle': 'Pantau konsumsi energi secara real-time.',
    'monitoring.power': 'Daya',
    'monitoring.voltage': 'Tegangan',
    'monitoring.current': 'Arus',
    'monitoring.energy': 'Energi',
    'monitoring.frequency': 'Frekuensi',
    'monitoring.powerFactor': 'Faktor Daya',
    'monitoring.totalConsumption': 'Total Konsumsi',
    'monitoring.deviceStatus': 'Status Perangkat',
    'monitoring.selectDevice': 'Pilih Perangkat',
    'monitoring.allDevices': 'Semua Perangkat',
    'monitoring.liveData': 'Data Real-time',
    'monitoring.history': 'Riwayat Konsumsi',
    'monitoring.noData': 'Belum ada data monitoring.',

    // --------------------------------------
    // FORECASTING
    // --------------------------------------

    'forecasting.title': 'Peramalan Energi',
    'forecasting.subtitle': 'Prediksi dan analisis tren konsumsi energi menggunakan AI.',
    'forecasting.prediction': 'Prediksi Konsumsi',
    'forecasting.actual': 'Konsumsi Aktual',
    'forecasting.forecast': 'Hasil Peramalan',
    'forecasting.period': 'Periode',
    'forecasting.daily': 'Harian',
    'forecasting.weekly': 'Mingguan',
    'forecasting.monthly': 'Bulanan',
    'forecasting.accuracy': 'Akurasi Model',
    'forecasting.generate': 'Buat Prediksi',
    'forecasting.loading': 'Sedang membuat prediksi...',
    'forecasting.noData': 'Belum ada data peramalan.',
    'forecasting.analysis': 'Analisis Tren',
    'forecasting.result': 'Hasil Prediksi',

    // --------------------------------------
    // MAINTENANCE
    // --------------------------------------

    'maintenance.title': 'Maintenance',
    'maintenance.subtitle': 'Kelola tarif energi dan perangkat power meter.',
    'maintenance.devices': 'Perangkat',
    'maintenance.tariffs': 'Tarif Energi',
    'maintenance.addDevice': 'Tambah Perangkat',
    'maintenance.editDevice': 'Ubah Perangkat',
    'maintenance.deleteDevice': 'Hapus Perangkat',
    'maintenance.deviceName': 'Nama Perangkat',
    'maintenance.deviceId': 'ID Perangkat',
    'maintenance.deviceOnline': 'Perangkat Online',
    'maintenance.deviceOffline': 'Perangkat Offline',
    'maintenance.tariff': 'Tarif Listrik',
    'maintenance.currency': 'Rupiah',
    'maintenance.save': 'Simpan Perubahan',
    'maintenance.noDevices': 'Belum ada perangkat terdaftar.',

    // --------------------------------------
    // EXPORT & REPORTS
    // --------------------------------------

    'export.title': 'Ekspor & Laporan',
    'export.subtitle': 'Buat dan unduh laporan konsumsi energi.',
    'export.generate': 'Buat Laporan',
    'export.download': 'Unduh Laporan',
    'export.format': 'Format File',
    'export.startDate': 'Tanggal Mulai',
    'export.endDate': 'Tanggal Akhir',
    'export.reportType': 'Jenis Laporan',
    'export.excel': 'Excel',
    'export.pdf': 'PDF',
    'export.csv': 'CSV',
    'export.noData': 'Tidak ada laporan tersedia.',
    'export.success': 'Laporan berhasil dibuat.',

    // --------------------------------------
    // USER MANAGEMENT
    // --------------------------------------

    'users.title': 'Kelola Pengguna',
    'users.subtitle': 'Atur akun, role, dan pesan support.',
    'users.name': 'Nama Pengguna',
    'users.email': 'Email',
    'users.role': 'Role',
    'users.admin': 'Administrator',
    'users.operator': 'Operator',
    'users.user': 'Pengguna',
    'users.add': 'Tambah Pengguna',
    'users.edit': 'Ubah Pengguna',
    'users.delete': 'Hapus Pengguna',
    'users.password': 'Kata Sandi',
    'users.confirmPassword': 'Konfirmasi Kata Sandi',
    'users.noUsers': 'Belum ada pengguna.',
    'users.support': 'Pesan Support',

    // --------------------------------------
    // NOTIFICATIONS
    // --------------------------------------

    'notifications.title': 'Notifikasi',
    'notifications.empty': 'Tidak ada notifikasi.',
    'notifications.unread': 'Belum dibaca',
    'notifications.read': 'Sudah dibaca',
    'notifications.markRead': 'Tandai sudah dibaca',
    'notifications.markAllRead': 'Tandai semua sudah dibaca',
    'notifications.delete': 'Hapus notifikasi',

    // --------------------------------------
    // AUTHENTICATION
    // --------------------------------------

    'auth.login': 'Masuk',
    'auth.logout': 'Keluar',
    'auth.email': 'Alamat Email',
    'auth.password': 'Kata Sandi',
    'auth.forgotPassword': 'Lupa Kata Sandi?',
    'auth.rememberMe': 'Ingat Saya',
    'auth.loginSuccess': 'Berhasil masuk.',
    'auth.loginFailed': 'Gagal masuk. Periksa email dan kata sandi Anda.',
  },

  en: {
    // --------------------------------------
    // GENERAL
    // --------------------------------------

    'app.name': 'SEMFS',
    'app.loading': 'Loading application...',
    'app.welcome': 'Welcome',
    'app.back': 'Back',
    'app.next': 'Next',
    'app.cancel': 'Cancel',
    'app.save': 'Save',
    'app.delete': 'Delete',
    'app.edit': 'Edit',
    'app.search': 'Search',
    'app.filter': 'Filter',
    'app.refresh': 'Refresh',
    'app.close': 'Close',
    'app.confirm': 'Confirm',
    'app.submit': 'Submit',
    'app.reset': 'Reset',
    'app.actions': 'Actions',
    'app.status': 'Status',
    'app.date': 'Date',
    'app.time': 'Time',
    'app.nameLabel': 'Name',
    'app.description': 'Description',
    'app.noData': 'No data available.',
    'app.success': 'Success',
    'app.failed': 'Failed',
    'app.online': 'Online',
    'app.offline': 'Offline',
    'app.enabled': 'Enabled',
    'app.disabled': 'Disabled',

    // --------------------------------------
    // SETTINGS
    // --------------------------------------

    'settings.title': 'System Settings',
    'settings.subtitle': 'Set the time zone and language used by the system.',
    'settings.readOnly': 'Only admins can change settings. You can view them only.',
    'settings.loading': 'Loading settings...',
    'settings.section': 'Region and language',
    'settings.timezone': 'Time zone',
    'settings.timezoneHint': 'Used to display data and report times.',
    'settings.language': 'Language',
    'settings.lastChanged': 'Last changed',
    'settings.neverChanged': 'Never changed.',
    'settings.save': 'Save changes',
    'settings.saving': 'Saving...',
    'settings.saved': 'System settings saved successfully.',
    'settings.indonesian': 'Indonesian',
    'settings.english': 'English',

    // --------------------------------------
    // ERRORS
    // --------------------------------------

    'err.noSession': 'No active session. Please sign in again.',
    'err.connect': 'Cannot reach the server. Make sure the API is running.',
    'err.request': 'Request failed (code {code}).',
    'err.load': 'Failed to load system settings.',
    'err.save': 'Failed to save system settings.',
    'err.generic': 'An error occurred. Please try again.',
    'err.unauthorized': 'You do not have permission to access this page.',
    'err.notFound': 'Data not found.',
    'err.required': 'This field is required.',

    // --------------------------------------
    // DASHBOARD
    // --------------------------------------

    'welcomeDashboard': 'Welcome to the Dashboard',
    'dashboardSubtitle': 'Overview of your energy monitoring and forecasting system',
    'statOnlineDevices': 'Online Devices',
    'statPowerMeterStatus': 'Power meter status',
    'statTotalDevices': 'Total Devices',
    'statRegisteredInSystem': 'Registered in system',
    'statSystemHealth': 'System Health',
    'statApiDatabase': 'API & database',
    'statActiveNotifications': 'Active Notifications',
    'unreadText': 'Unread',
    'alertText': 'Alerts',
    'mainMenu': 'Main Menu',
    'checkingSystemStatus': 'Checking system status...',
    'systemOperational': 'System Operational',
    'serverDisconnected': 'Server disconnected',
    'lastChecked': 'Last checked',
    'connected': 'Connected',
    'disconnected': 'Disconnected',
    'accountLabel': 'Account',
    'systemNormal': 'System Normal',
    'devicesHavingIssues': 'devices having issues',

    // --------------------------------------
    // DASHBOARD MENU
    // --------------------------------------

    'feature_monitoring_title': 'Energy Monitoring',
    'feature_monitoring_desc': 'Monitor real-time energy consumption with interactive visualizations',

    'feature_forecasting_title': 'Energy Forecasting',
    'feature_forecasting_desc': 'Predict and analyze energy consumption trends using AI',

    'feature_pengaturan_title': 'System Settings',
    'feature_pengaturan_desc': 'System configuration',

    'feature_ekspor_title': 'Exports & Reports',
    'feature_ekspor_desc': 'Generate and download reports',

    'feature_maintenance_title': 'Maintenance',
    'feature_maintenance_desc': 'Manage energy tariffs and power meter devices',

    'feature_pengguna_title': 'User Management',
    'feature_pengguna_desc': 'Manage accounts, roles, and support messages',

    // --------------------------------------
    // NAVIGATION
    // --------------------------------------

    'nav.dashboard': 'Dashboard',
    'nav.monitoring': 'Energy Monitoring',
    'nav.forecasting': 'Energy Forecasting',
    'nav.settings': 'System Settings',
    'nav.export': 'Exports & Reports',
    'nav.maintenance': 'Maintenance',
    'nav.users': 'User Management',
    'nav.logout': 'Logout',
    'nav.profile': 'Profile',

    // --------------------------------------
    // MONITORING
    // --------------------------------------

    'monitoring.title': 'Energy Monitoring',
    'monitoring.subtitle': 'Monitor energy consumption in real time.',
    'monitoring.power': 'Power',
    'monitoring.voltage': 'Voltage',
    'monitoring.current': 'Current',
    'monitoring.energy': 'Energy',
    'monitoring.frequency': 'Frequency',
    'monitoring.powerFactor': 'Power Factor',
    'monitoring.totalConsumption': 'Total Consumption',
    'monitoring.deviceStatus': 'Device Status',
    'monitoring.selectDevice': 'Select Device',
    'monitoring.allDevices': 'All Devices',
    'monitoring.liveData': 'Real-time Data',
    'monitoring.history': 'Consumption History',
    'monitoring.noData': 'No monitoring data available.',

    // --------------------------------------
    // FORECASTING
    // --------------------------------------

    'forecasting.title': 'Energy Forecasting',
    'forecasting.subtitle': 'Predict and analyze energy consumption trends using AI.',
    'forecasting.prediction': 'Consumption Prediction',
    'forecasting.actual': 'Actual Consumption',
    'forecasting.forecast': 'Forecast Results',
    'forecasting.period': 'Period',
    'forecasting.daily': 'Daily',
    'forecasting.weekly': 'Weekly',
    'forecasting.monthly': 'Monthly',
    'forecasting.accuracy': 'Model Accuracy',
    'forecasting.generate': 'Generate Forecast',
    'forecasting.loading': 'Generating forecast...',
    'forecasting.noData': 'No forecasting data available.',
    'forecasting.analysis': 'Trend Analysis',
    'forecasting.result': 'Prediction Results',

    // --------------------------------------
    // MAINTENANCE
    // --------------------------------------

    'maintenance.title': 'Maintenance',
    'maintenance.subtitle': 'Manage energy tariffs and power meter devices.',
    'maintenance.devices': 'Devices',
    'maintenance.tariffs': 'Energy Tariffs',
    'maintenance.addDevice': 'Add Device',
    'maintenance.editDevice': 'Edit Device',
    'maintenance.deleteDevice': 'Delete Device',
    'maintenance.deviceName': 'Device Name',
    'maintenance.deviceId': 'Device ID',
    'maintenance.deviceOnline': 'Device Online',
    'maintenance.deviceOffline': 'Device Offline',
    'maintenance.tariff': 'Electricity Tariff',
    'maintenance.currency': 'Indonesian Rupiah',
    'maintenance.save': 'Save Changes',
    'maintenance.noDevices': 'No registered devices.',

    // --------------------------------------
    // EXPORT & REPORTS
    // --------------------------------------

    'export.title': 'Exports & Reports',
    'export.subtitle': 'Generate and download energy consumption reports.',
    'export.generate': 'Generate Report',
    'export.download': 'Download Report',
    'export.format': 'File Format',
    'export.startDate': 'Start Date',
    'export.endDate': 'End Date',
    'export.reportType': 'Report Type',
    'export.excel': 'Excel',
    'export.pdf': 'PDF',
    'export.csv': 'CSV',
    'export.noData': 'No reports available.',
    'export.success': 'Report generated successfully.',

    // --------------------------------------
    // USER MANAGEMENT
    // --------------------------------------

    'users.title': 'User Management',
    'users.subtitle': 'Manage accounts, roles, and support messages.',
    'users.name': 'User Name',
    'users.email': 'Email',
    'users.role': 'Role',
    'users.admin': 'Administrator',
    'users.operator': 'Operator',
    'users.user': 'User',
    'users.add': 'Add User',
    'users.edit': 'Edit User',
    'users.delete': 'Delete User',
    'users.password': 'Password',
    'users.confirmPassword': 'Confirm Password',
    'users.noUsers': 'No users available.',
    'users.support': 'Support Messages',

    // --------------------------------------
    // NOTIFICATIONS
    // --------------------------------------

    'notifications.title': 'Notifications',
    'notifications.empty': 'No notifications.',
    'notifications.unread': 'Unread',
    'notifications.read': 'Read',
    'notifications.markRead': 'Mark as read',
    'notifications.markAllRead': 'Mark all as read',
    'notifications.delete': 'Delete notification',

    // --------------------------------------
    // AUTHENTICATION
    // --------------------------------------

    'auth.login': 'Login',
    'auth.logout': 'Logout',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Forgot Password?',
    'auth.rememberMe': 'Remember Me',
    'auth.loginSuccess': 'Successfully logged in.',
    'auth.loginFailed': 'Login failed. Please check your email and password.',
  },
}

// ==========================================
// TRANSLATION FUNCTION
// ==========================================

export function tr(
  key: string,
  vars?: Record<string, string | number>,
): string {
  let result =
    dict[current][key] ??
    dict.id[key] ??
    key

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      result = result.split(`{${name}}`).join(String(value))
    }
  }

  return result
}

// ==========================================
// REACT SUBSCRIPTION
// ==========================================

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

// ==========================================
// GLOBAL I18N HOOK
// ==========================================

export function useI18n() {
  const lang = useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  )

  useEffect(() => {
    void loadLanguageFromServer()
  }, [])

  const t = (
    key: string,
    vars?: Record<string, string | number>,
  ): string => {
    let result =
      dict[lang][key] ??
      dict.id[key] ??
      key

    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        result = result.split(`{${name}}`).join(String(value))
      }
    }

    return result
  }

  return {
    lang,
    t,
    setLanguage,
  }
}


// ==========================================
// BACKWARD COMPATIBILITY
// ==========================================

export function useTranslation(_namespace?: string) {
  const { lang, t, setLanguage } = useI18n()

  return {
    lang,
    t,
    setLanguage,

    // Compatibility with react-i18next style
    i18n: {
      language: lang,

      changeLanguage: (newLang: Lang) => {
        setLanguage(newLang)
        return Promise.resolve()
      },
    },
  }
}