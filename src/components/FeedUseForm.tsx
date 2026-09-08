import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useFeed, type FeedUseInput } from '../context/FeedContext'
import { feedAvailableQq, feedStorageLabel, formatDop, formatDopUnit, formatQq, latestFeedPrice, todayIso } from '../lib/calc'
import type { CepaLocation, FarmStage, FeedStorage, FeedUse, FeedUseAllocation } from '../lib/types'
import FeedStorageFields from './FeedStorageFields'
import Modal, { afterSaveReadyForNext, SavedNotice } from './Modal'

function cageRows(locations: CepaLocation[], allocations: FeedUseAllocation[]) {
  const byId = new Map(allocations.map((item) => [item.locationId, item]))
  const rows = locations.map((item) => ({
    key: item.id,
    locationId: item.id,
    quantity: byId.has(item.id) ? String(byId.get(item.id)?.quantityQq) : '',
  }))
  for (const item of allocations) {
    if (rows.some((row) => row.locationId === item.locationId)) continue
    rows.push({ key: item.locationId, locationId: item.locationId, quantity: String(item.quantityQq) })
  }
  return rows
}

export default function FeedUseForm({
  title,
  stage,
  locations,
  initial,
  onClose,
}: {
  title: string
  stage: FarmStage
  locations: CepaLocation[]
  initial: FeedUse | null
  onClose: () => void
}) {
  const { state, addUse, updateUse } = useFeed()
  const products = state.products
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [feedId, setFeedId] = useState(initial?.feedId ?? products[0]?.id ?? '')
  const [storage, setStorage] = useState<FeedStorage>(initial?.storage ?? 'saco')
  const [quantity, setQuantity] = useState(initial && (initial.allocations ?? []).length === 0 ? String(initial.quantityQq) : '')
  const [byCage, setByCage] = useState((initial?.allocations ?? []).length > 0)
  const [sameQty, setSameQty] = useState('')
  const [placements, setPlacements] = useState(() => cageRows(locations, initial?.allocations ?? []))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const placed = placements.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
  const filledCages = placements.filter((row) => row.locationId && (Number(row.quantity) || 0) > 0).length
  const qty = byCage ? placed : Number(quantity) || 0
  const priced = feedId ? latestFeedPrice(feedId, state.purchases, products, date, storage) : null
  const available = feedId
    ? feedAvailableQq(state.purchases, state.uses ?? [], feedId, initial?.id, storage)
    : 0
  const pricePerQq =
    initial && initial.feedId === feedId && initial.storage === storage
      ? initial.pricePerQq
      : priced?.pricePerQq ?? 0
  const cost = qty * pricePerQq

  function applySameQty() {
    const amount = Number(sameQty)
    if (!(amount > 0)) return
    setPlacements((rows) => rows.map((row) => ({ ...row, quantity: String(amount) })))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const allocations = byCage
      ? placements.flatMap((row) => {
          const amount = Number(row.quantity) || 0
          if (!row.locationId || amount <= 0) return []
          const found = locations.find((item) => item.id === row.locationId)
          return [{ locationId: row.locationId, location: found?.name ?? '', quantityQq: amount }]
        })
      : []
    if (byCage && allocations.length === 0) {
      setSaved(false)
      setError('Indica la cantidad en al menos una jaula.')
      return
    }
    const input: FeedUseInput = {
      date,
      stage,
      feedId,
      quantityQq: qty,
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
    setQuantity('')
    setSameQty('')
    setPlacements(cageRows(locations, []))
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
              Disponibles {formatQq(available)} QQ {storage === 'silo' ? 'en silo' : 'en sacos'}
              {pricePerQq > 0 ? ` · ${formatDopUnit(pricePerQq)} / QQ` : ''}
            </span>
          ) : null}
        </label>
        <FeedStorageFields value={storage} onChange={setStorage} />
        <fieldset>
          <legend className="label">Asignación</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            <label className="btn btn-ghost">
              <input className="mr-2" type="radio" checked={!byCage} onChange={() => setByCage(false)} />
              General
            </label>
            <label className="btn btn-ghost">
              <input
                className="mr-2"
                type="radio"
                checked={byCage}
                onChange={() => {
                  setByCage(true)
                  setPlacements((rows) => (rows.length ? rows : cageRows(locations, [])))
                }}
              />
              Varias jaulas
            </label>
          </div>
        </fieldset>
        {!byCage && (
          <label>
            <span className="label">Cantidad usada (QQ)</span>
            <input
              className="field"
              type="number"
              min={0.01}
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </label>
        )}
        {byCage && (
          <div>
            <p className="mb-2 text-xs text-[var(--muted)]">
              Pon la cantidad en todas las jaulas que alimentaste. Las vacías no se guardan. El total es la
              suma.
            </p>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="min-w-[8rem] flex-1">
                <span className="label">Misma cantidad en todas (QQ)</span>
                <input
                  className="field"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={sameQty}
                  onChange={(e) => setSameQty(e.target.value)}
                  placeholder="Ej. 2"
                />
              </label>
              <button className="btn btn-ghost" type="button" onClick={applySameQty}>
                Aplicar a todas
              </button>
            </div>
            <div className="grid gap-2">
              {placements.map((row) => {
                const location = locations.find((item) => item.id === row.locationId)
                return (
                  <label
                    key={row.key}
                    className="grid grid-cols-[1fr_8rem] items-center gap-2 rounded-2xl border border-[var(--line)] px-3 py-2"
                  >
                    <span className="font-semibold">{location?.name ?? 'Jaula'}</span>
                    <input
                      className="field"
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.quantity}
                      onChange={(e) =>
                        setPlacements((rows) =>
                          rows.map((item) => (item.key === row.key ? { ...item, quantity: e.target.value } : item)),
                        )
                      }
                      placeholder="QQ"
                    />
                  </label>
                )
              })}
            </div>
            {qty > 0 && (
              <p className="mt-2 text-sm text-[var(--muted)]">
                {filledCages} {filledCages === 1 ? 'jaula' : 'jaulas'} · {formatQq(qty)} QQ en total
              </p>
            )}
          </div>
        )}
        {cost > 0 && <p className="text-sm text-[var(--muted)]">Costo de esta ración: {formatDop(cost)}</p>}
        {saved && <SavedNotice />}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {locations.length === 0 && byCage && (
          <p className="text-sm text-[var(--danger)]">No hay jaulas para asignar. Créalas en Ajustes.</p>
        )}
        <button className="btn btn-primary" disabled={!feedId} type="submit">
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
              {row.date} · {row.feedName} · {feedStorageLabel(row.storage)} · {formatQq(row.quantityQq)} QQ
            </p>
            <p className="text-sm text-[var(--muted)]">
              {formatDop(row.cost)}
              {(row.allocations ?? []).length > 0
                ? ` · ${(row.allocations ?? []).map((item) => `${item.location} (${formatQq(item.quantityQq)})`).join(', ')}`
                : ' · General'}
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
