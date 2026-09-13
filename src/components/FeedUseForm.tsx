import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useFeed, type FeedUseInput } from '../context/FeedContext'
import { feedAvailableKg, feedStorageLabel, formatDop, formatDopUnit, formatKg, latestFeedPrice, todayIso, uid } from '../lib/calc'
import type { CostGroup } from '../lib/calc'
import type { FarmStage, FeedStorage, FeedUse } from '../lib/types'
import FeedStorageFields from './FeedStorageFields'
import Modal, { afterSaveReadyForNext, SavedNotice } from './Modal'

function cepaRows(groups: CostGroup[], allocations: FeedUse['allocations']) {
  const assigned = (allocations ?? []).filter((item) => item.cepaId && item.quantityKg > 0)
  if (assigned.length === 0) {
    return [{ key: uid(), cepaId: groups[0]?.id ?? '', quantity: '' }]
  }
  return assigned.map((item) => ({
    key: uid(),
    cepaId: item.cepaId,
    quantity: String(item.quantityKg),
  }))
}

export default function FeedUseForm({
  title,
  stage,
  groups,
  initial,
  onClose,
}: {
  title: string
  stage: FarmStage
  groups: CostGroup[]
  initial: FeedUse | null
  onClose: () => void
}) {
  const { state, addUse, updateUse } = useFeed()
  const products = state.products
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [feedId, setFeedId] = useState(initial?.feedId ?? products[0]?.id ?? '')
  const [storage, setStorage] = useState<FeedStorage>(initial?.storage ?? 'saco')
  const [placements, setPlacements] = useState(() => cepaRows(groups, initial?.allocations))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const qty = placements.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
  const filledCepas = placements.filter((row) => row.cepaId && (Number(row.quantity) || 0) > 0).length
  const priced = feedId ? latestFeedPrice(feedId, state.purchases, products, date, storage) : null
  const selected = products.find((item) => item.id === feedId)
  const sackWeightKg = selected?.sackWeightKg
  const available = feedId
    ? feedAvailableKg(state.purchases, state.uses ?? [], feedId, initial?.id, storage)
    : 0
  const pricePerKg =
    initial && initial.feedId === feedId && initial.storage === storage
      ? initial.pricePerKg
      : priced?.pricePerKg ?? 0
  const cost = qty * pricePerKg

  function submit(e: FormEvent) {
    e.preventDefault()
    const allocations = placements.flatMap((row) => {
      const amount = Number(row.quantity) || 0
      if (!row.cepaId || amount <= 0) return []
      const found = groups.find((item) => item.id === row.cepaId)
      return [
        {
          cepaId: row.cepaId,
          cepaName: found?.label ?? '',
          quantityKg: amount,
          locationId: found?.locationId,
          location: found?.location,
        },
      ]
    })
    if (allocations.length === 0) {
      setSaved(false)
      setError('Elige la cepa que se alimenta e indica los kilos.')
      return
    }
    const input: FeedUseInput = {
      date,
      stage,
      feedId,
      quantityKg: qty,
      storage,
      allocations,
    }
    const message = initial ? updateUse(initial.id, input) : addUse(input)
    if (message) {
      setSaved(false)
      setError(message)
      return
    }
    if (initial) {
      onClose()
      return
    }
    setPlacements(cepaRows(groups, []))
    setError(null)
    setSaved(true)
    afterSaveReadyForNext(e)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {products.length === 0 ? (
          <p className="text-sm text-[var(--danger)]">
            Primero crea un alimento en{' '}
            <Link className="font-semibold underline" to="/ajustes">
              Ajustes
            </Link>
            .
          </p>
        ) : null}
        {groups.length === 0 ? (
          <p className="text-sm text-[var(--danger)]">
            {stage === 'engorde'
              ? 'Primero traslada una cepa a engorde para poder alimentarla.'
              : 'Primero registra una cepa de destete para poder alimentarla.'}
          </p>
        ) : null}
        <label>
          <span className="label">Fecha</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          <span className="label">Alimento</span>
          <select className="field" value={feedId} onChange={(e) => setFeedId(e.target.value)} required>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {feedId ? (
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Disponibles {formatKg(available)} kg {storage === 'silo' ? 'en silo' : 'en sacos'}
              {pricePerKg > 0 ? ` · ${formatDopUnit(pricePerKg)} / kg` : ''}
              {sackWeightKg ? ` · saco de ${formatKg(sackWeightKg)} kg` : ''}
            </span>
          ) : null}
        </label>
        <FeedStorageFields value={storage} onChange={setStorage} />
        <div>
          <span className="label">Cepa</span>
          <p className="mb-2 text-xs text-[var(--muted)]">
            El costo queda en ese grupo de lechones, no en la jaula. Si alimentas varios lotes, añade otra cepa.
          </p>
          <div className="grid gap-2">
            {placements.map((row) => (
              <div
                key={row.key}
                className="grid gap-2 rounded-2xl border border-[var(--line)] p-3 sm:grid-cols-[1fr_8rem_auto]"
              >
                <select
                  className="field"
                  value={row.cepaId}
                  onChange={(e) =>
                    setPlacements((rows) =>
                      rows.map((item) => (item.key === row.key ? { ...item, cepaId: e.target.value } : item)),
                    )
                  }
                  required
                >
                  <option value="">Elegir cepa</option>
                  {groups.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input
                  className="field"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={row.quantity}
                  onChange={(e) =>
                    setPlacements((rows) =>
                      rows.map((item) => (item.key === row.key ? { ...item, quantity: e.target.value } : item)),
                    )
                  }
                  placeholder="kg"
                  required
                />
                {placements.length > 1 ? (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => setPlacements((rows) => rows.filter((item) => item.key !== row.key))}
                  >
                    Quitar
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
          <button
            className="btn btn-ghost mt-2"
            type="button"
            onClick={() =>
              setPlacements((rows) => [...rows, { key: uid(), cepaId: groups[0]?.id ?? '', quantity: '' }])
            }
          >
            Añadir otra cepa
          </button>
          {qty > 0 && (
            <p className="mt-2 text-sm text-[var(--muted)]">
              {filledCepas} {filledCepas === 1 ? 'cepa' : 'cepas'} · {formatKg(qty)} kg en total
              {sackWeightKg ? ` · ${formatKg(qty / sackWeightKg)} sacos` : ''}
            </p>
          )}
        </div>
        {cost > 0 && <p className="text-sm text-[var(--muted)]">Costo de esta ración: {formatDop(cost)}</p>}
        {saved && <SavedNotice />}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" disabled={!feedId || groups.length === 0} type="submit">
          {initial ? 'Guardar cambios' : 'Registrar alimentación'}
        </button>
      </form>
    </Modal>
  )
}

export function FeedUseHistory({
  rows,
  onEdit,
  onDelete,
}: {
  rows: FeedUse[]
  onEdit: (item: FeedUse) => void
  onDelete: (item: FeedUse) => void
}) {
  if (rows.length === 0) {
    return <p className="mt-3 text-[var(--muted)]">Todavía no hay alimentaciones registradas aquí.</p>
  }
  return (
    <ul className="mt-3 grid gap-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg)] px-4 py-3"
        >
          <div>
            <p className="font-semibold">
              {row.date} · {row.feedName} · {feedStorageLabel(row.storage)} · {formatKg(row.quantityKg)} kg
            </p>
            <p className="text-sm text-[var(--muted)]">
              {formatDop(row.cost)}
              {(row.allocations ?? []).length > 0
                ? ` · ${(row.allocations ?? [])
                    .map((item) => `${item.cepaName?.trim() || item.location || 'Cepa'} (${formatKg(item.quantityKg)} kg)`)
                    .join(', ')}`
                : ' · Sin cepa'}
            </p>
          </div>
          <div className="flex gap-1">
            <IconButton label="Editar" onClick={() => onEdit(row)}>
              <PencilIcon />
            </IconButton>
            <IconButton label="Eliminar" onClick={() => onDelete(row)}>
              <TrashIcon />
            </IconButton>
          </div>
        </li>
      ))}
    </ul>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button className="btn btn-ghost btn-icon" type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}
