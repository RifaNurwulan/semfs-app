import { Hammer } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/card'
import { getFeature, type FeatureKey } from '../lib/features'

/**
 * Halaman sementara untuk fitur yang belum dikerjakan. Header & hak akses sudah jadi,
 * jadi PIC tinggal mengganti <PlaceholderPage> di App.tsx dengan halaman aslinya.
 */
export default function PlaceholderPage({ feature }: { feature: FeatureKey }) {
  const f = getFeature(feature)
  return (
    <div className="min-h-screen">
      <PageHeader icon={f.icon} iconClassName={f.headerIconBg} title={f.title} subtitle={f.subtitle} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
            <Hammer className="size-7" aria-hidden />
          </span>
          <h2 className="mt-5 text-lg font-semibold text-gray-900">Halaman ini belum dikerjakan</h2>
          <p className="mt-2 max-w-md text-sm text-gray-500">
            {f.title} dikerjakan oleh {f.owner} ({f.task}, jadwal {f.schedule}).
          </p>
        </Card>
      </main>
    </div>
  )
}
