import type { ReactNode } from 'react'

export default function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} type="button" aria-label="Cerrar" />
      <div className="surface relative z-10 max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-3xl p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl">{title}</h3>
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
