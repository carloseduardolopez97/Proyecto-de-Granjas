import { type FormEvent, type ReactNode } from 'react'

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
      <div
        data-modal-panel
        className="surface relative z-10 max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-3xl p-5"
      >
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

export function afterSaveReadyForNext(event: FormEvent) {
  const form = event.currentTarget as HTMLFormElement
  const panel = form.closest('[data-modal-panel]')
  panel?.scrollTo({ top: 0 })
  window.requestAnimationFrame(() => {
    const first = form.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea')
    first?.focus()
  })
}

export function SavedNotice() {
  return <p className="text-sm text-[var(--ok)]">Guardado. El formulario está listo para el siguiente.</p>
}
