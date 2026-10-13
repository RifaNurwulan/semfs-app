import { useAvatarUrl } from '../../auth/useAvatarUrl'
import type { User } from '../../lib/api'
import { cn } from '../../lib/utils'

const SIZES = { sm: 'size-9 text-sm', md: 'size-11 text-base', lg: 'size-24 text-3xl' }

/** Foto profil, atau huruf pertama username kalau belum punya foto. */
export function Avatar({ user, size = 'md', className }: { user: User; size?: keyof typeof SIZES; className?: string }) {
  const url = useAvatarUrl(user)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-600 font-semibold text-white',
        SIZES[size],
        className,
      )}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : user.username.charAt(0).toUpperCase()}
    </span>
  )
}
