import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { getFeature } from '../../lib/features'
import { cn } from '../../lib/utils'
import { AuditTab } from './AuditTab'
import { BackupTab } from './BackupTab'
import { DevicesTab } from './DevicesTab'

const TABS = [
  { key: 'devices', label: 'Perangkat' },
  { key: 'audit', label: 'Log Aktivitas' },
  { key: 'backup', label: 'Backup & Restore' },
] as const
type TabKey = (typeof TABS)[number]['key']

/** Halaman Maintenance (khusus admin): kelola device, log aktivitas, backup/restore konfigurasi. */
export default function MaintenancePage() {
  const f = getFeature('maintenance')
  const [tab, setTab] = useState<TabKey>('devices')

  return (
    <div className="min-h-screen">
      <PageHeader icon={f.icon} iconClassName={f.headerIconBg} title={f.title} subtitle={f.subtitle} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div role="tablist" aria-label="Menu Maintenance" className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={cn(
                '-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition',
                tab === t.key ? 'border-rose-600 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-800',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'devices' && <DevicesTab />}
          {tab === 'audit' && <AuditTab />}
          {tab === 'backup' && <BackupTab />}
        </div>
      </main>
    </div>
  )
}
