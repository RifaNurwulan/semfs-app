import { useEffect, useId, useRef, type ReactNode } from 'react'

/** Dialog modal memakai elemen <dialog> bawaan browser (fokus terkunci di dalam, Esc menutup). */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const trigger = useRef<Element | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) {
      trigger.current = document.activeElement // tombol yang membuka dialog
      dialog.showModal()
    }
    // PENTING: jangan memanggil dialog.close() di sini. Di mode dev, React menjalankan efek dua kali
    // (simulasi lepas-pasang); close() memicu event "close" yang langsung menutup dialog.
    // Saat komponen benar-benar dilepas, elemen <dialog> dihapus dan browser menutupnya sendiri.
    return () => {
      if (trigger.current instanceof HTMLElement) trigger.current.focus() // kembalikan fokus
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // klik di luar kartu
      }}
      className="m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-black/40"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  )
}
