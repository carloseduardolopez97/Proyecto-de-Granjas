import type { ReactNode } from 'react'

export function inDateRange(date: string, from: string, to: string): boolean {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
}

export function HistoryFilterBar({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap items-end gap-3">{children}</div>
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-[9.5rem] flex-1">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}

export function ClearFiltersButton({
  disabled,
  onClick,
}: {
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button className="btn btn-ghost mb-0.5 shrink-0" type="button" disabled={disabled} onClick={onClick}>
      Limpiar filtros
    </button>
  )
}
