import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { currentSystemLanguage } from './systemSettings'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type SystemTimezone = 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura' | 'UTC'

const TIMEZONE_KEY = 'semfs-system-timezone'

export function setSystemTimezone(timezone: SystemTimezone) {
  localStorage.setItem(TIMEZONE_KEY, timezone)
}

export function getSystemTimezone(): SystemTimezone {
  const timezone = localStorage.getItem(TIMEZONE_KEY)
  return timezone === 'Asia/Makassar' || timezone === 'Asia/Jayapura' || timezone === 'UTC'
    ? timezone
    : 'Asia/Jakarta'
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat(currentSystemLanguage() === 'en' ? 'en-US' : 'id-ID', { dateStyle: 'long', timeZone: getSystemTimezone() }).format(
    new Date(iso),
  )
}

export function formatTime(date: Date) {
  return new Intl.DateTimeFormat(currentSystemLanguage() === 'en' ? 'en-US' : 'id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: getSystemTimezone(),
  }).format(date)
}


export function formatRelative(iso: string, now = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const abs = Math.abs(seconds)
  const relative = new Intl.RelativeTimeFormat(currentSystemLanguage() === 'en' ? 'en' : 'id', { numeric: 'auto' })
  if (abs < 60) return currentSystemLanguage() === 'en' ? 'just now' : 'baru saja'
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), 'day')
  return formatDate(iso)
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat(currentSystemLanguage() === 'en' ? 'en-US' : 'id-ID', { dateStyle: 'medium', timeStyle: 'medium', timeZone: getSystemTimezone() }).format(new Date(iso))
}


export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
