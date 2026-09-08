import type { StageAction } from '../lib/calc'

export default function StageActionHistory({ rows }: { rows: StageAction[] }) {
  if (rows.length === 0) {
    return <p className="mt-3 text-[var(--muted)]">Aún no hay acciones registradas en esta etapa.</p>
  }
  return (
    <ul className="mt-3 grid gap-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3"
        >
          <p className="font-semibold">
            {row.date} · {row.title}
          </p>
          <p className="text-sm text-[var(--muted)]">{row.detail}</p>
        </li>
      ))}
    </ul>
  )
}
