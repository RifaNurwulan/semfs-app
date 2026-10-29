import { useState } from 'react'
import { useUser } from '../../auth/auth-context'
import { PageHeader } from '../../components/layout/PageHeader'
import { getFeature } from '../../lib/features'
import { cn } from '../../lib/utils'
import { AuditTab } from './AuditTab'
import { BackupTab } from './BackupTab'
import { DevicesTab } from './DevicesTab'
import { EnergyTariffTab } from './EnergyTariffTab'

const TABS = [
  { key: 'devices', label: 'Perangkat' },
  { key: 'audit', label: 'Log Aktivitas' },
  { key: 'backup', label: 'Backup & Restore' },
  { key: 'tariff', label: 'Tarif Energi' },
] as const
type TabKey = (typeof TABS)[number]['key']

/** Operator mengelola tarif energi; admin juga dapat mengelola perangkat dan konfigurasi. */
export default function MaintenancePage() {
  const f = getFeature('maintenance')
  const user = useUser()
  const visibleTabs = user.role === 'admin' ? TABS : TABS.filter((item) => item.key === 'tariff')
  const [tab, setTab] = useState<TabKey>(user.role === 'admin' ? 'devices' : 'tariff')

  return (
    <div className="min-h-screen">
      <PageHeader icon={f.icon} iconClassName={f.headerIconBg} title={f.title} subtitle={f.subtitle} />
      <main className="w-full space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div role="tablist" aria-label="Menu Maintenance" className="flex gap-1 overflow-x-auto border-b border-gray-200">
          {visibleTabs.map((t) => (
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
          {tab === 'tariff' && <EnergyTariffTab />}
        </div>
      </main>
    </div>
  )
}
