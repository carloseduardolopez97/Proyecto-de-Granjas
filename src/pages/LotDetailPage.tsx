import { Link, Navigate, useParams } from 'react-router-dom'
import { useFarm } from '../context/FarmContext'
import {
  formatAgeWeeks,
  formatMoney,
  lotAgeDays,
  lotFeedConsumption,
  supplierAvgWeightKg,
  vaccineAlertLevel,
} from '../lib/calc'

export default function LotDetailPage() {
  const { lotId } = useParams()
  const { state, markVaccineApplied } = useFarm()
  const lot = state.lots.find((l) => l.id === lotId)

  if (!lotId || !lot) return <Navigate to="/" replace />

  const ageDays = lotAgeDays(lot.entryDate, lot.ageAtEntryDays)
  const feed = lotFeedConsumption(state.events, lot.id)
  const weeksExact = (ageDays / 7).toFixed(1)

  return (
    <section>
      <Link to="/" className="text-sm font-semibold text-[var(--moss)]">
        ← Inicio
      </Link>
      <div className="mt-3 mb-6">
        <p className="chip mb-2">Ficha técnica</p>
        <h2 className="font-display text-4xl">{lot.cageOrName}</h2>
        <p className="text-[var(--muted)]">
          Entrada {lot.entryDate} · {lot.currentHeadcount} lechones
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Mini label="Edad actual" value={`${formatAgeWeeks(lot.entryDate, lot.ageAtEntryDays)} (${weeksExact} sem)`} />
        <Mini label="Edad al ingreso" value={`${lot.ageAtEntryDays} días`} />
        <Mini
          label="Consumo a la fecha"
          value={`${formatMoney(feed.cost, state.currency)} · ${feed.quantity} kg`}
        />
      </div>

      <h3 className="font-display mb-3 text-2xl">Suplidores</h3>
      <div className="grid gap-3">
        {lot.suppliers.map((supplier) => (
          <article key={supplier.id} className="surface rounded-3xl p-5">
            <h4 className="font-display text-2xl">{supplier.name}</h4>
            <p className="text-sm text-[var(--muted)]">
              {supplier.headcount} lechones · {supplier.totalWeightKg} kg total · promedio{' '}
              {supplierAvgWeightKg(supplier).toFixed(2)} kg
            </p>
            <ul className="mt-3 grid gap-2">
              {supplier.vaccines.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">Sin vacunas programadas</li>
              ) : (
                supplier.vaccines.map((vaccine) => {
                  const level = vaccine.applied ? null : vaccineAlertLevel(vaccine.dueDate)
                  return (
                    <li
                      key={vaccine.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg-muted)] px-3 py-2"
                    >
                      <span>
                        {vaccine.name} · {vaccine.dueDate}
                        {vaccine.applied ? ' · aplicada' : ''}
                        {level === 'vencida' ? ' · vencida' : ''}
                        {level === 'hoy' ? ' · hoy' : ''}
                        {level === 'proxima' ? ' · próxima' : ''}
                      </span>
                      {!vaccine.applied && (
                        <button
                          className="btn btn-ghost"
                          type="button"
                          onClick={() => markVaccineApplied(lot.id, supplier.id, vaccine.id)}
                        >
                          Marcar aplicada
                        </button>
                      )}
                    </li>
                  )
                })
              )}
            </ul>
          </article>
        ))}
      </div>

      {lot.notes && (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Notas: {lot.notes}
        </p>
      )}
    </section>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-2xl p-4">
      <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
    </div>
  )
}
