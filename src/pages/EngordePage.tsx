import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import Modal from '../components/Modal'
import { useFarm } from '../context/FarmContext'
import { formatMoney, formatQty, lineagePnl, lotAgeDays, lotDeaths, lotPatioCost, todayIso } from '../lib/calc'
import type { LotStage } from '../lib/types'

export default function LotsPage() {
  const { stage } = useParams()
  const current: LotStage | null = stage === 'engorde' || stage === 'destete' ? stage : null
  const { state, addLot } = useFarm()
  const [open, setOpen] = useState(false)

  if (!current) return <Navigate to="/cepas/destete" replace />

  const liveLots = state.lots.filter((l) => l.stage === current)
  const heads = liveLots.reduce((n, l) => n + l.currentHeadcount, 0)
  const invested = liveLots.reduce((n, l) => n + l.purchaseCost, 0)
  const isDestete = current === 'destete'

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="chip mb-2">{isDestete ? 'Etapa destete' : 'Etapa engorde'}</p>
          <h2 className="font-display text-4xl">{isDestete ? 'Cepas en destete' : 'Cepas en engorde'}</h2>
          <p className="mt-2 max-w-xl text-[var(--muted)]">
            {isDestete
              ? 'Entrada de lechones. Cada cepa tiene su inventario. Al terminar, se transfiere a engorde sin perder el historial ni el precio de compra.'
              : 'Inventario de engorde. Cada cepa queda ligada a su destete para ver el beneficio desde el precio de entrada.'}
          </p>
        </div>
        {isDestete && (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            Nueva cepa
          </button>
        )}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Cepas" value={String(liveLots.length)} />
        <Stat label="Inventario" value={String(heads)} />
        <Stat
          label={isDestete ? 'Inversión en compra' : 'Costo de entrada prorrateado'}
          value={formatMoney(invested, state.currency)}
        />
      </div>

      {liveLots.length === 0 ? (
        <div className="surface rounded-3xl p-8 text-center text-[var(--muted)]">
          {isDestete
            ? 'Aún no hay cepas en destete. Registra la primera entrada.'
            : 'No hay cepas en engorde. Transfiere animales desde destete.'}
        </div>
      ) : (
        <div className="grid gap-4">
          {liveLots.map((lot) => {
            const age = lotAgeDays(lot.entryDate, lot.ageAtEntryDays)
            const patio = lotPatioCost(state.events, lot.id)
            const deaths = lotDeaths(state.events, lot.id)
            const pnl = lineagePnl(state.lots, state.events, lot.lineageId)
            const projected = lot.currentHeadcount * lot.targetWeightKg * lot.salePricePerKg
            return (
              <Link
                key={lot.id}
                to={`/cepas/lote/${lot.id}`}
                className="surface block rounded-3xl p-5 transition hover:-translate-y-0.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-3xl">{lot.name}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {lot.entryDate} · {lot.currentHeadcount} de {lot.initialHeadcount} animales
                      {deaths > 0 ? ` · ${deaths} muertes` : ''}
                      {lot.transferredOut > 0 ? ` · ${lot.transferredOut} a engorde` : ''}
                    </p>
                  </div>
                  <span className="chip">
                    {lot.status === 'activa' ? `${age} días` : lot.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Mini
                    label={isDestete ? 'Costo acumulado etapa' : 'Linaje: compra + patios'}
                    value={formatMoney(isDestete ? lot.purchaseCost + patio : pnl.totalCost, state.currency)}
                  />
                  <Mini
                    label={pnl.revenue > 0 ? 'Venta real' : 'Venta proyectada'}
                    value={formatMoney(pnl.revenue > 0 ? pnl.revenue : projected, state.currency)}
                  />
                  <Mini
                    label={pnl.revenue > 0 ? 'Beneficio real' : 'Margen proyectado'}
                    value={formatMoney(
                      pnl.revenue > 0 ? pnl.benefit : projected - lot.purchaseCost - patio,
                      state.currency,
                    )}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {open && isDestete && (
        <NewLotModal
          onClose={() => setOpen(false)}
          onSave={(payload) => {
            addLot({
              cageOrName: payload.name,
              entryDate: payload.entryDate,
              ageAtEntryDays: payload.ageAtEntryDays,
              notes: payload.notes,
              suppliers: [
                {
                  name: 'Sin suplidor',
                  headcount: payload.initialHeadcount,
                  totalWeightKg: 0,
                  vaccines: [],
                },
              ],
            })
            setOpen(false)
          }}
        />
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-2xl p-4">
      <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-muted)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function NewLotModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (payload: {
    name: string
    entryDate: string
    ageAtEntryDays: number
    initialHeadcount: number
    purchaseCost: number
    targetWeightKg: number
    salePricePerKg: number
    notes: string
  }) => void
}) {
  const [name, setName] = useState('')
  const [entryDate, setEntryDate] = useState(todayIso())
  const [ageAtEntryDays, setAge] = useState(21)
  const [heads, setHeads] = useState(100)
  const [purchaseCost, setPurchase] = useState(0)
  const [targetWeightKg, setTarget] = useState(110)
  const [salePricePerKg, setPrice] = useState(9000)
  const [notes, setNotes] = useState('')

  const ageNow = useMemo(
    () => lotAgeDays(entryDate, ageAtEntryDays),
    [entryDate, ageAtEntryDays],
  )

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      entryDate,
      ageAtEntryDays,
      initialHeadcount: heads,
      purchaseCost,
      targetWeightKg,
      salePricePerKg,
      notes,
    })
  }

  return (
    <Modal title="Entrada a destete" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Nombre de la cepa</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Fecha de ingreso</span>
            <input
              className="field"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              required
            />
          </label>
          <label>
            <span className="label">Edad al ingreso (días)</span>
            <input
              className="field"
              type="number"
              min={0}
              value={ageAtEntryDays}
              onChange={(e) => setAge(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="text-sm text-[var(--muted)]">Hoy tendrían {formatQty(ageNow)} días de edad.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Cantidad de lechones</span>
            <input
              className="field"
              type="number"
              min={1}
              value={heads}
              onChange={(e) => setHeads(Number(e.target.value))}
            />
          </label>
          <label>
            <span className="label">Precio de compra de la cepa</span>
            <input
              className="field"
              type="number"
              min={0}
              value={purchaseCost}
              onChange={(e) => setPurchase(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Peso objetivo de venta (kg)</span>
            <input
              className="field"
              type="number"
              min={0}
              value={targetWeightKg}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </label>
          <label>
            <span className="label">Precio venta / kg</span>
            <input
              className="field"
              type="number"
              min={0}
              value={salePricePerKg}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </label>
        </div>
        <label>
          <span className="label">Notas</span>
          <textarea className="field min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn btn-primary mt-2" type="submit">
          Registrar en destete
        </button>
      </form>
    </Modal>
  )
}
