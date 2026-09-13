import type { FeedQtyMode } from '../lib/types'

export default function FeedQtyModeFields({
  mode,
  onMode,
  sackWeight,
  onSackWeight,
  sackCount,
  onSackCount,
  showCount,
}: {
  mode: FeedQtyMode
  onMode: (value: FeedQtyMode) => void
  sackWeight: string
  onSackWeight: (value: string) => void
  sackCount?: string
  onSackCount?: (value: string) => void
  showCount?: boolean
}) {
  return (
    <>
      <fieldset>
        <legend className="label">Cantidad</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          <label className="btn btn-ghost">
            <input className="mr-2" type="radio" checked={mode === 'kg'} onChange={() => onMode('kg')} />
            Por kilos
          </label>
          <label className="btn btn-ghost">
            <input className="mr-2" type="radio" checked={mode === 'saco'} onChange={() => onMode('saco')} />
            Por saco
          </label>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {mode === 'saco'
            ? 'Indica el peso de un saco. El inventario y la alimentación se llevan en kilos.'
            : 'Registra la cantidad directo en kilos.'}
        </p>
      </fieldset>
      {mode === 'saco' && showCount && onSackCount ? (
        <label>
          <span className="label">Cantidad de sacos</span>
          <input
            className="field"
            type="number"
            min={0.01}
            step="any"
            value={sackCount ?? ''}
            onChange={(e) => onSackCount(e.target.value)}
            placeholder="Ej. 40"
            required
          />
        </label>
      ) : null}
      {mode === 'saco' ? (
        <label>
          <span className="label">Peso de un saco (kg)</span>
          <input
            className="field"
            type="number"
            min={0.01}
            step="any"
            value={sackWeight}
            onChange={(e) => onSackWeight(e.target.value)}
            placeholder="Ej. 50"
            required
          />
        </label>
      ) : null}
    </>
  )
}
