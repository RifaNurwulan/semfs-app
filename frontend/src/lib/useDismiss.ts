import { useEffect, type RefObject } from 'react'

/** Menutup popup (setOpen(false)) saat klik di luar elemen atau menekan Escape. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  setOpen: (open: boolean) => void,
) {
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, open, setOpen])
}
