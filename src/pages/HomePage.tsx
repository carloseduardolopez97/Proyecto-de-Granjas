import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFarm } from '../context/FarmContext'
import {
  farmFeedConsumption,
  formatAgeWeeks,
  formatMoney,
  lotFeedConsumption,
  lotVaccineAlerts,
  sortLots,
  supplierAvgWeightKg,
} from '../lib/calc'

type VaccineFilter = 'todas' | 'alerta' | 'vencida' | 'hoy' | 'proxima'

export default function HomePage() {
  const { state, setLotSortMode, moveLot } = useFarm()
  const [query, setQuery] = useState('')
  const [vaccineFilter, setVaccineFilter] = useState<VaccineFilter>('todas')

  const alerts = useMemo(() => lotVaccineAlerts(state.lots), [state.lots])
  const consumption = useMemo(() => farmFeedConsumption(state.events), [state.events])
  const alertLotIds = useMemo(() => new Set(alerts.map((a) => a.lotId)), [alerts])

  const lots = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sortLots(state.lots, state.lotSortMode).filter((lot) => {
      if (vaccineFilter === 'alerta' && !alertLotIds.has(lot.id)) return false
      if (vaccineFilter === 'vencida' || vaccineFilter === 'hoy' || vaccineFilter === 'proxima') {
        const match = alerts.some((a) => a.lotId === lot.id && a.level === vaccineFilter)
        if (!match) return false
      }
      if (!q) return true
      const haystack = [
        lot.cageOrName,
        lot.name,
        lot.entryDate,
        ...lot.suppliers.flatMap((s) => [s.name, ...s.vaccines.map((v) => v.name)]),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [state.lots, state.lotSortMode, query, vaccineFilter, alertLotIds, alerts])

  const heads = state.lots.reduce((n, l) => n + l.currentHeadcount, 0)
  const orderedAll = sortLots(state.lots, 'custom')

  return (
    <section>
      <div className="mb-6 max-w-3xl">
        <p className="chip mb-3">Resumen de cepas</p>
        <h2 className="font-display text-4xl leading-tight md:text-5xl">Cómo van las cepas</h2>
        <p className="mt-3 text-[var(--muted)]">
          Consumo hasta la fecha, orden de llegada o el que tú definas, y alertas de vacunas.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Cepas" value={String(state.lots.length)} />
        <Stat label="Lechones actuales" value={String(heads)} />
        <Stat
          label="Consumo a la fecha"
          value={`${formatMoney(consumption.cost, state.currency)} · ${consumption.quantity} kg`}
        />
      </div>

      {alerts.length > 0 && (
        <div className="surface mb-6 rounded-3xl p-4">
          <h3 className="font-display text-2xl">Alertas de vacunas</h3>
          <ul className="mt-3 grid gap-2">
            {alerts.map((alert) => (
              <li key={`${alert.lotId}-${alert.vaccine.id}`}>
                <Link
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg-muted)] px-3 py-2"
                  to={`/cepas/lote/${alert.lotId}`}
                >
                  <span>
                    <strong>{alert.lotName}</strong>
                    <span className="text-[var(--muted)]">
                      {' '}
                      · {alert.supplierName} · {alert.vaccine.name}
                    </span>
                  </span>
                  <span
                    className={`chip ${
                      alert.level === 'vencida'
                        ? 'bg-[var(--clay-soft)]'
                        : alert.level === 'hoy'
                          ? 'bg-[var(--leaf)]'
                          : ''
                    }`}
                  >
                    {alert.level === 'vencida'
                      ? `Vencida ${alert.vaccine.dueDate}`
                      : alert.level === 'hoy'
                        ? 'Aplicar hoy'
                        : `En ${alert.daysUntil} d · ${alert.vaccine.dueDate}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="label">Buscar</span>
          <input
            className="field"
            placeholder="Jaula, suplidor o vacuna"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          <span className="label">Vacunas</span>
          <select
            className="field"
            value={vaccineFilter}
            onChange={(e) => setVaccineFilter(e.target.value as VaccineFilter)}
          >
            <option value="todas">Todas las cepas</option>
            <option value="alerta">Con alerta</option>
            <option value="vencida">Vencidas</option>
            <option value="hoy">Para hoy</option>
            <option value="proxima">Próximos 7 días</option>
          </select>
        </label>
        <label>
          <span className="label">Orden</span>
          <select
            className="field"
            value={state.lotSortMode}
            onChange={(e) => setLotSortMode(e.target.value as 'arrival' | 'custom')}
          >
            <option value="arrival">Por llegada</option>
            <option value="custom">Mi orden</option>
          </select>
        </label>
        <Link className="btn btn-primary" to="/entrada">
          Nueva entrada
        </Link>
      </div>

      {lots.length === 0 ? (
        <div className="surface rounded-3xl p-8 text-[var(--muted)]">
          No hay cepas con esos filtros.{' '}
          <Link className="font-semibold text-[var(--moss)]" to="/entrada">
            Registrar una entrada
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {lots.map((lot) => {
            const feed = lotFeedConsumption(state.events, lot.id)
            const customIndex = orderedAll.findIndex((l) => l.id === lot.id)
            return (
              <article key={lot.id} className="surface rounded-3xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to={`/cepas/lote/${lot.id}`}>
                      <h3 className="font-display text-3xl">{lot.cageOrName}</h3>
                    </Link>
                    <p className="text-sm text-[var(--muted)]">
                      Llegó {lot.entryDate} · {formatAgeWeeks(lot.entryDate, lot.ageAtEntryDays)} ·{' '}
                      {lot.currentHeadcount} lechones
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={customIndex <= 0}
                      onClick={() => moveLot(lot.id, 'up')}
                    >
                      Subir
                    </button>
                    <button
                      className="btn btn-ghost"
                      type="button"
                      disabled={customIndex < 0 || customIndex >= orderedAll.length - 1}
                      onClick={() => moveLot(lot.id, 'down')}
                    >
                      Bajar
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Mini
                    label="Consumo a la fecha"
                    value={`${formatMoney(feed.cost, state.currency)} · ${feed.quantity} kg`}
                  />
                  {lot.suppliers.map((supplier) => (
                    <Mini
                      key={supplier.id}
                      label={supplier.name}
                      value={`${supplier.headcount} lechones · ${supplierAvgWeightKg(supplier).toFixed(1)} kg prom.`}
                    />
                  ))}
                </div>
              </article>
            )
          })}
        </div>
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
