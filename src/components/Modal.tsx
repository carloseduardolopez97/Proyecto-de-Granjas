import type { ReactNode } from 'react'

export default function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <button className="absolute inset-0 cursor-default" aria-label="Cerrar" onClick={onClose} />
      <div className="surface relative z-10 w-full max-w-lg rounded-3xl p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl">{title}</h2>
          <button className="btn btn-ghost px-3 py-1" onClick={onClose}>
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
