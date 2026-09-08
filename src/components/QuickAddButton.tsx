import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QUICK_ADD_GROUPS, QUICK_ADD_PARAM } from '../lib/quickAdd'

export default function QuickAddButton() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="pointer-events-none fixed right-auto bottom-5 left-5 z-40 md:bottom-6 md:left-6">
      {open && (
        <div className="pointer-events-auto mb-3 max-h-[min(70vh,28rem)] w-[min(calc(100vw-2.5rem),20rem)] overflow-y-auto rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-3 shadow-lg">
          <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
            Registrar
          </p>
          <div className="grid gap-3">
            {QUICK_ADD_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-2 text-xs font-semibold text-[var(--muted)]">{group.label}</p>
                <ul className="grid gap-1">
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <button
                        className="w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--bg-muted)]"
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          navigate(`${item.to}?${QUICK_ADD_PARAM}=${item.id}`)
                        }}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        className="fab pointer-events-auto"
        type="button"
        aria-label={open ? 'Cerrar registro' : 'Registrar entrada'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={`fab-plus ${open ? 'fab-plus-open' : ''}`} aria-hidden="true">
          +
        </span>
      </button>
    </div>
  )
}
