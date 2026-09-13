import { useState, type FormEvent, type ReactNode } from 'react'
import type { CepaDeathInput } from '../context/CepaContext'
import {
  cepaAgeOnDate,
  cepaLiveOnDate,
  deathStage,
  engordeLotLiveOnDate,
  formatAgeDays,
  todayIso,
  type HeadMovement,
} from '../lib/calc'
import type { Cepa, CepaDeath, EngordeLot, FarmStage } from '../lib/types'
import Modal, { afterSaveReadyForNext, SavedNotice } from './Modal'

export default function DeathForm({
  stage,
  cepas,
  lots = [],
  deaths,
  transfers = [],
  initialCepa,
  initialLot,
  initialDeath,
  onClose,
  onSave,
  onEditDeath,
  onDeleteDeath,
}: {
  stage: FarmStage
  cepas: Cepa[]
  lots?: EngordeLot[]
  deaths: CepaDeath[]
  transfers?: HeadMovement[]
  initialCepa?: Cepa | null
  initialLot?: EngordeLot | null
  initialDeath: CepaDeath | null
  onClose: () => void
  onSave: (input: CepaDeathInput) => string | null
  onEditDeath: (item: CepaDeath) => void
  onDeleteDeath: (id: string) => void
}) {
  const isEngorde = stage === 'engorde'
  const orderedCepas = [...cepas].sort(
    (a, b) => b.date.localeCompare(a.date) || a.location.localeCompare(b.location, 'es'),
  )
  const orderedLots = [...lots].sort(
    (a, b) => b.date.localeCompare(a.date) || a.location.localeCompare(b.location, 'es'),
  )
  const [cepaId, setCepaId] = useState(initialDeath?.cepaId ?? initialCepa?.id ?? orderedCepas[0]?.id ?? '')
  const [lotId, setLotId] = useState(initialDeath?.lotId ?? initialLot?.id ?? orderedLots[0]?.id ?? '')
  const cepa = cepas.find((item) => item.id === cepaId) ?? null
  const lot = lots.find((item) => item.id === lotId) ?? null
  const lotCepa = lot ? cepas.find((item) => item.id === lot.sourceCepaId) ?? null : null
  const [date, setDate] = useState(initialDeath?.date ?? todayIso())
  const live = isEngorde
    ? lot
      ? engordeLotLiveOnDate(lot, deaths, date, initialDeath?.id)
      : 0
    : cepa
      ? cepaLiveOnDate(cepa, deaths, date, initialDeath?.id, transfers)
      : 0
  const [count, setCount] = useState(initialDeath ? String(initialDeath.count) : '')
  const [note, setNote] = useState(initialDeath?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const qty = Number.parseInt(count, 10) || 0
  const ageSource = isEngorde ? lotCepa : cepa
  const age = ageSource && date ? cepaAgeOnDate(ageSource, date) : null
  const minDate = isEngorde ? lot?.date : cepa?.date
  const bought = isEngorde ? lot?.pigCount : cepa?.pigletCount

  function submit(e: FormEvent) {
    e.preventDefault()
    const message = onSave({
      cepaId: isEngorde ? lot?.sourceCepaId ?? '' : cepaId,
      lotId: isEngorde ? lotId : undefined,
      stage,
      date,
      count: qty,
      note,
    })
    if (message) {
      setSaved(false)
      setError(message)
      return
    }
    if (initialDeath) {
      onClose()
      return
    }
    setCount('')
    setNote('')
    setDate(todayIso())
    setError(null)
    setSaved(true)
    afterSaveReadyForNext(e)
  }

  const history = deaths
    .filter((item) => deathStage(item) === stage)
    .filter((item) => (isEngorde ? item.lotId === lotId : item.cepaId === cepaId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  return (
    <Modal title={initialDeath ? 'Editar muerte' : 'Registrar muerte'} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {isEngorde ? (
          <label>
            <span className="label">Traslado</span>
            <select className="field" value={lotId} onChange={(e) => setLotId(e.target.value)} required>
              {orderedLots.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.location} · {item.sourceSupplierName} · {item.date}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            <span className="label">Cepa</span>
            <select className="field" value={cepaId} onChange={(e) => setCepaId(e.target.value)} required>
              {orderedCepas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.location} · {item.supplierName} · {item.date}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className="label">Fecha</span>
          <input
            className="field"
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          <span className="label">{isEngorde ? 'Cerdos muertos' : 'Lechones muertos'}</span>
          <input
            className="field"
            type="number"
            min={1}
            max={live || undefined}
            step={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            required
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Quedan {live} vivos ese día
            {bought ? ` de ${bought} ${isEngorde ? 'trasladados' : 'comprados'}` : ''}.
          </span>
        </label>
        {age && (
          <p className="text-sm text-[var(--muted)]">
            Edad al morir: {age.arrivalAgeDays > 0 ? formatAgeDays(age.ageDays) : `${age.daysOnFarm} días en granja`}
            {age.arrivalAgeDays > 0 ? ` · ${age.daysOnFarm} días desde la compra` : ' (pon la edad de compra en la cepa)'}
          </p>
        )}
        <label>
          <span className="label">Nota (opcional)</span>
          <input
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Causa, si la sabes"
          />
        </label>
        {saved && <SavedNotice />}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={live <= 0 && !initialDeath}>
          {initialDeath ? 'Guardar cambios' : 'Registrar muerte'}
        </button>
      </form>
      {history.length > 0 && (
        <div className="mt-5">
          <h4 className="font-display text-xl">Muertes guardadas</h4>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Cada registro baja el inventario y guarda la edad para la mortalidad en Reportes.
          </p>
          <ul className="mt-3 grid gap-2">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-semibold">
                    {item.date} · {item.count} {item.count === 1 ? (isEngorde ? 'cerdo' : 'lechón') : isEngorde ? 'cerdos' : 'lechones'}
                  </p>
                  <p className="text-[var(--muted)]">
                    Edad {formatAgeDays(item.ageDays)}
                    {item.note ? ` · ${item.note}` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <IconButton label="Editar" onClick={() => onEditDeath(item)}>
                    <PencilIcon />
                  </IconButton>
                  <IconButton label="Eliminar" onClick={() => onDeleteDeath(item.id)}>
                    <TrashIcon />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
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
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  )
}
