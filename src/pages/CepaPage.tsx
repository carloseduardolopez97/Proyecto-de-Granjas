import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import FeedPriceFields, { pesosFromFields } from '../components/FeedPriceFields'
import FeedUseForm, { FeedUseHistory } from '../components/FeedUseForm'
import StageActionHistory from '../components/StageActionHistory'
import { ClearFiltersButton, FilterField, HistoryFilterBar, inDateRange, uniqueSorted } from '../components/HistoryFilters'
import Modal, { afterSaveReadyForNext, SavedNotice } from '../components/Modal'
import { useCepa, type CepaDeathInput, type CepaInput, type CepaWeighingInput } from '../context/CepaContext'
import { useFeed } from '../context/FeedContext'
import { usePharmacy } from '../context/PharmacyContext'
import {
  cepaAgeOnDate,
  cepaAvgWeightKg,
  cepaCountUpTo,
  cepaDeathsUpTo,
  cepaLiveOnDate,
  cepaTotalCost,
  cepaWeightPoints,
  dailyGainKg,
  engordeLotsAsMovements,
  formatAgeDays,
  formatDop,
  formatDopUnit,
  formatKg,
  formatUsd,
  isoDaysBetween,
  latestCepaWeight,
  locationLiveCount,
  resolveCepaWeighingMass,
  splitKgByHeads,
  stageUsageCosts,
  buildStageActions,
  todayIso,
  uid,
  type HeadMovement,
} from '../lib/calc'
import { useQuickAdd } from '../lib/quickAdd'
import type { Cepa, CepaCostBasis, CepaDeath, CepaLocation, CepaSupplier, CepaWeighing, CepaWeighMode, FeedCurrency, FeedUse } from '../lib/types'

export default function CepaPage() {
  const {
    state,
    addCepas,
    updateCepa,
    deleteCepa,
    addSupplier,
    addLocation,
    addWeighing,
    updateWeighing,
    deleteWeighing,
    addDeath,
    updateDeath,
    deleteDeath,
  } = useCepa()
  const feed = useFeed()
  const pharmacy = usePharmacy()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cepa | null>(null)
  const [removing, setRemoving] = useState<Cepa | null>(null)
  const [weightOpen, setWeightOpen] = useState(false)
  const [weighingCepa, setWeighingCepa] = useState<Cepa | null>(null)
  const [editingWeighing, setEditingWeighing] = useState<CepaWeighing | null>(null)
  const [deathOpen, setDeathOpen] = useState(false)
  const [deathCepa, setDeathCepa] = useState<Cepa | null>(null)
  const [editingDeath, setEditingDeath] = useState<CepaDeath | null>(null)
  const [feedOpen, setFeedOpen] = useState(false)
  const [editingFeedUse, setEditingFeedUse] = useState<FeedUse | null>(null)
  const [removingFeedUse, setRemovingFeedUse] = useState<FeedUse | null>(null)
  const [supplierFilter, setSupplierFilter] = useState('')
  const [locationFilter, setLocationFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)

  useQuickAdd({
    cepa: () => {
      setEditing(null)
      setFormOpen(true)
    },
    'alimento-destete': () => {
      setEditingFeedUse(null)
      setFeedOpen(true)
    },
    peso: () => {
      setEditingWeighing(null)
      setWeighingCepa(state.cepas[0] ?? null)
      setWeightOpen(true)
    },
    muerte: () => {
      setEditingDeath(null)
      setDeathCepa(state.cepas[0] ?? null)
      setDeathOpen(true)
    },
  })

  const rows = useMemo(
    () => [...state.cepas].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [state.cepas],
  )
  const supplierOptions = useMemo(
    () => uniqueSorted([...rows.map((row) => row.supplierName), ...state.suppliers.map((item) => item.name)]),
    [rows, state.suppliers],
  )
  const locationCatalog = state.locations ?? []
  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (supplierFilter && row.supplierName !== supplierFilter) return false
        if (locationFilter) {
          const selected = locationCatalog.find((item) => item.id === locationFilter)
          const matchesId = row.locationId === locationFilter
          const matchesName = selected ? row.location === selected.name : row.location === locationFilter
          if (!matchesId && !matchesName) return false
        }
        return inDateRange(row.date, fromDate, toDate)
      }),
    [rows, supplierFilter, locationFilter, fromDate, toDate, locationCatalog],
  )
  const weighings = state.weighings ?? []
  const deaths = state.deaths ?? []
  const transfers = engordeLotsAsMovements(state.engordeLots ?? [])
  const totals = useMemo(() => summarizeCepas(visibleRows, weighings, deaths, transfers), [visibleRows, weighings, deaths, transfers])
  const allTotals = useMemo(() => summarizeCepas(rows, weighings, deaths, transfers), [rows, weighings, deaths, transfers])
  const byLocation = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; piglets: number; dead: number; moved: number; cost: number; cepas: number; capacity: number }
    >()
    for (const loc of locationCatalog) {
      map.set(loc.id, {
        id: loc.id,
        name: loc.name,
        piglets: 0,
        dead: 0,
        moved: 0,
        cost: 0,
        cepas: 0,
        capacity: loc.capacity || 0,
      })
    }
    for (const row of rows) {
      const key = row.locationId || row.location.trim() || 'sin'
      const catalog = locationCatalog.find((item) => item.id === row.locationId)
      const name = catalog?.name || row.location.trim() || 'Sin ubicación'
      const current = map.get(key) ?? {
        id: key,
        name,
        piglets: 0,
        dead: 0,
        moved: 0,
        cost: 0,
        cepas: 0,
        capacity: catalog?.capacity || 0,
      }
      current.piglets += cepaLiveOnDate(row, deaths, undefined, undefined, transfers)
      current.dead += cepaDeathsUpTo(deaths, row.id)
      current.moved += cepaCountUpTo(transfers, row.id)
      current.cost += cepaTotalCost(row)
      current.cepas += 1
      map.set(key, current)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [rows, deaths, locationCatalog, transfers])
  const usage = useMemo(
    () =>
      stageUsageCosts({
        stage: 'destete',
        locations: locationCatalog,
        feedUses: feed.state.uses ?? [],
        injectionUses: pharmacy.state.uses,
      }),
    [locationCatalog, feed.state.uses, pharmacy.state.uses],
  )
  const feedUseRows = useMemo(
    () =>
      [...(feed.state.uses ?? [])]
        .filter((item) => item.stage === 'destete')
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [feed.state.uses],
  )
  const actionRows = useMemo(
    () =>
      buildStageActions({
        stage: 'destete',
        cepas: rows,
        weighings,
        deaths,
        lots: state.engordeLots ?? [],
        feedUses: feed.state.uses ?? [],
        injectionUses: pharmacy.state.uses,
        injections: pharmacy.state.injections,
      }),
    [rows, weighings, deaths, state.engordeLots, feed.state.uses, pharmacy.state.uses, pharmacy.state.injections],
  )

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="chip mb-3">Destete</p>
          <h2 className="font-display text-4xl">Cepa</h2>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Registra cada entrada de lechones de destete: suplidor, ubicación, fecha, cantidad, peso
            total y el costo (por lechón o por kilo). Eliges una o varias jaulas al registrar. Anota la
            edad de los lechones al comprar (cada suplidor puede vender a una edad distinta). Cuando
            pasen a engorde, usa{' '}
            <Link className="font-semibold underline" to="/engorde">
              Engorde
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setEditingFeedUse(null)
              setFeedOpen(true)
            }}
          >
            Alimentar
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={state.cepas.length === 0}
            onClick={() => {
              setEditingWeighing(null)
              setWeighingCepa(state.cepas[0] ?? null)
              setWeightOpen(true)
            }}
          >
            Actualizar peso
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={state.cepas.length === 0}
            onClick={() => {
              setEditingDeath(null)
              setDeathCepa(state.cepas[0] ?? null)
              setDeathOpen(true)
            }}
          >
            Registrar muerte
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Registrar cepa
          </button>
        </div>
      </div>

      {locationCatalog.length === 0 && (
        <div className="mb-6 rounded-3xl border border-[var(--clay)] bg-[var(--clay-soft)] p-4">
          <p className="text-sm">
            Primero crea las salas o galpones en{' '}
            <Link className="font-semibold underline" to="/ajustes">
              Ajustes
            </Link>
            . Así el registro de cepa elige jaulas ya guardadas y, si quieres, reparte los lechones entre varias.
          </p>
        </div>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <HoverStat
          label="Lechones vivos"
          value={String(allTotals.piglets)}
          empty="Aún no hay lechones registrados."
          breakdown={byLocation.map((row) => ({
            key: row.id,
            name: row.name,
            value: String(row.piglets),
          }))}
        />
        <HoverStat
          label="Muertos"
          value={String(allTotals.dead)}
          empty="Aún no hay muertes registradas."
          breakdown={byLocation.map((row) => ({
            key: row.id,
            name: row.name,
            value: String(row.dead),
          }))}
        />
        <HoverStat
          label="Trasladados"
          value={String(allTotals.moved)}
          empty="Aún no hay traslados a engorde."
          breakdown={byLocation.map((row) => ({
            key: `${row.id}-moved`,
            name: row.name,
            value: String(row.moved),
          }))}
        />
        <Stat label="Peso total" value={`${formatKg(allTotals.kg)} kg`} />
        <HoverStat
          label="Costo"
          value={formatDop(allTotals.cost)}
          empty="Aún no hay costos registrados."
          align="right"
          breakdown={byLocation.map((row) => ({
            key: row.id,
            name: row.name,
            value: formatDop(row.cost),
          }))}
        />
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HoverStat
          label="Alimento usado"
          value={formatDop(usage.totals.feedCost)}
          empty="Aún no hay alimento asignado."
          breakdown={usage.rows
            .filter((row) => row.feedCost > 0)
            .map((row) => ({ key: `feed-${row.key}`, name: row.name, value: formatDop(row.feedCost) }))}
        />
        <HoverStat
          label="Farmacia usada"
          value={formatDop(usage.totals.pharmacyCost)}
          empty="Aún no hay inyecciones asignadas."
          breakdown={usage.rows
            .filter((row) => row.pharmacyCost > 0)
            .map((row) => ({ key: `pharm-${row.key}`, name: row.name, value: formatDop(row.pharmacyCost) }))}
        />
        <HoverStat
          label="Costo usado"
          value={formatDop(usage.totals.total)}
          empty="Aún no hay costos de uso."
          breakdown={usage.rows
            .filter((row) => row.total > 0)
            .map((row) => ({ key: `use-${row.key}`, name: row.name, value: formatDop(row.total) }))}
        />
      </div>

      <h3 className="font-display mb-3 text-2xl">Ubicaciones</h3>
      {byLocation.length === 0 ? (
        <p className="mb-8 text-[var(--muted)]">
          Añade las salas o galpones en{' '}
          <Link className="font-semibold underline" to="/ajustes">
            Ajustes
          </Link>
          . Aquí verás cuántos lechones hay en cada sitio.
        </p>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {byLocation.map((row) => {
            const selected = locationFilter === row.id
            const overcrowded = row.capacity > 0 && row.piglets > row.capacity
            return (
              <button
                key={row.id}
                type="button"
                className={`surface rounded-3xl p-4 text-left ${
                  selected ? 'ring-2 ring-[var(--moss)]' : overcrowded ? 'ring-2 ring-[var(--danger)]' : ''
                }`}
                onClick={() => {
                  setLocationFilter(row.id)
                  historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-display text-2xl">{row.name}</h4>
                  {overcrowded && (
                    <span className="rounded-full bg-[var(--clay-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--clay)]">
                      Sobrepoblación
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">Lechones vivos</p>
                <p className={`font-display text-3xl ${overcrowded ? 'text-[var(--danger)]' : ''}`}>
                  {row.piglets}
                  {row.capacity > 0 ? ` / ${row.capacity}` : ''}
                </p>
                {row.capacity > 0 && (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Capacidad {row.capacity}
                    {overcrowded ? ` · ${row.piglets - row.capacity} de más` : ''}
                  </p>
                )}
                <p className="mt-3 text-sm text-[var(--muted)]">
                  {row.cepas} {row.cepas === 1 ? 'cepa' : 'cepas'}
                  {row.dead > 0 ? ` · ${row.dead} muertos` : ''}
                </p>
                <p className="mt-1 font-display text-xl">{formatDop(row.cost)}</p>
                {(() => {
                  const used = usage.rows.find((item) => item.key === row.id)
                  return used && used.total > 0 ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Usado {formatDop(used.total)} · alimento {formatDop(used.feedCost)} · farmacia{' '}
                      {formatDop(used.pharmacyCost)}
                    </p>
                  ) : null
                })()}
              </button>
            )
          })}
        </div>
      )}

      <div className="mb-8 surface rounded-3xl p-5">
        <h3 className="font-display text-2xl">Alimentación</h3>
        <FeedUseHistory
          rows={feedUseRows}
          onEdit={(item) => {
            setEditingFeedUse(item)
            setFeedOpen(true)
          }}
          onDelete={setRemovingFeedUse}
        />
      </div>

      <div className="mb-8 surface rounded-3xl p-5">
        <h3 className="font-display text-2xl">Historial de acciones</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Compras, pesos, muertes, alimento, inyecciones y traslados de esta etapa.
        </p>
        <StageActionHistory rows={actionRows} />
      </div>

      <div ref={historyRef} className="surface overflow-x-auto rounded-3xl p-5">
        <h3 className="font-display text-2xl">Historial de cepas</h3>
        {rows.length === 0 ? (
          <p className="mt-3 text-[var(--muted)]">Aún no hay cepas. Registra la primera compra de destete.</p>
        ) : (
          <>
            <HistoryFilterBar>
              <FilterField label="Suplidor">
                <select
                  className="field"
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                >
                  <option value="">Todos</option>
                  {supplierOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Ubicación">
                <select
                  className="field"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                >
                  <option value="">Todas</option>
                  {locationCatalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Desde">
                <input className="field" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </FilterField>
              <FilterField label="Hasta">
                <input className="field" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </FilterField>
              <ClearFiltersButton
                disabled={!supplierFilter && !locationFilter && !fromDate && !toDate}
                onClick={() => {
                  setSupplierFilter('')
                  setLocationFilter('')
                  setFromDate('')
                  setToDate('')
                }}
              />
            </HistoryFilterBar>
            {visibleRows.length === 0 ? (
              <p className="mt-3 text-[var(--muted)]">Ninguna cepa coincide con esos filtros.</p>
            ) : (
              <table className="mt-4 w-full min-w-[980px] text-left text-sm">
                <thead className="text-xs tracking-wide text-[var(--muted)] uppercase">
                  <tr>
                    <th className="pb-2 font-semibold">Fecha</th>
                    <th className="pb-2 font-semibold">Suplidor</th>
                    <th className="pb-2 font-semibold">Ubicación</th>
                    <th className="pb-2 font-semibold">Edad compra</th>
                    <th className="pb-2 font-semibold">Lechones</th>
                    <th className="pb-2 font-semibold">Peso total</th>
                    <th className="pb-2 font-semibold">Prom. / lechón</th>
                    <th className="pb-2 font-semibold">Ganancia / lechón</th>
                    <th className="pb-2 font-semibold">Costo</th>
                    <th className="pb-2 font-semibold">Total</th>
                    <th className="pb-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const current = latestCepaWeight(row, weighings)
                    const live = cepaLiveOnDate(row, deaths, undefined, undefined, transfers)
                    const dead = cepaDeathsUpTo(deaths, row.id)
                    const moved = cepaCountUpTo(transfers, row.id)
                    const total = cepaTotalCost(row)
                    const gainKg = current.avgWeightKg - cepaAvgWeightKg(row.totalWeightKg, row.pigletCount)
                    const liveKg = current.avgWeightKg * live
                    return (
                      <tr key={row.id} className="border-t border-[var(--line)]">
                        <td className="py-3">{row.date}</td>
                        <td className="py-3">{row.supplierName}</td>
                        <td className="py-3">{row.location}</td>
                        <td className="py-3">{formatAgeDays(row.arrivalAgeDays)}</td>
                        <td className="py-3">
                          {live}
                          <span className="mt-0.5 block text-xs text-[var(--muted)]">
                            {row.pigletCount} comprados
                            {dead > 0 ? ` · ${dead} muertos` : ''}
                            {moved > 0 ? ` · ${moved} a engorde` : ''}
                          </span>
                        </td>
                        <td className="py-3">
                          {formatKg(liveKg)} kg
                          {current.estimated ? (
                            <span className="mt-0.5 block text-xs text-[var(--muted)]">estimado</span>
                          ) : null}
                        </td>
                        <td className="py-3">{formatKg(current.avgWeightKg)} kg</td>
                        <td className="py-3">{formatGain(gainKg)}</td>
                        <td className="py-3">
                          <div>
                            {formatDopUnit(row.unitCost)} / {row.costBasis === 'piglet' ? 'lechón' : 'kilo'}
                          </div>
                          {row.priceCurrency === 'USD' && row.usdAmount != null && row.usdRate ? (
                            <div className="text-xs text-[var(--muted)]">
                              {formatUsd(row.usdAmount)} · tasa {formatDop(row.usdRate)}
                            </div>
                          ) : null}
                        </td>
                        <td className="py-3">{formatDop(total)}</td>
                        <td className="py-3">
                          <div className="flex justify-end gap-1">
                            <IconButton
                              label="Actualizar peso"
                              onClick={() => {
                                setEditingWeighing(null)
                                setWeighingCepa(row)
                                setWeightOpen(true)
                              }}
                            >
                              <ScaleIcon />
                            </IconButton>
                            <IconButton
                              label="Registrar muerte"
                              onClick={() => {
                                setEditingDeath(null)
                                setDeathCepa(row)
                                setDeathOpen(true)
                              }}
                            >
                              <DeathIcon />
                            </IconButton>
                            <IconButton
                              label="Editar"
                              onClick={() => {
                                setEditing(row)
                                setFormOpen(true)
                              }}
                            >
                              <PencilIcon />
                            </IconButton>
                            <IconButton label="Eliminar" onClick={() => setRemoving(row)}>
                              <TrashIcon />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--line)]">
                    <td className="py-3 font-semibold" colSpan={4}>
                      Total
                    </td>
                    <td className="py-3 font-semibold">
                      {totals.piglets}
                      {(totals.dead > 0 || totals.moved > 0) ? (
                        <span className="mt-0.5 block text-xs font-normal text-[var(--muted)]">
                          {totals.dead > 0 ? `${totals.dead} muertos` : ''}
                          {totals.dead > 0 && totals.moved > 0 ? ' · ' : ''}
                          {totals.moved > 0 ? `${totals.moved} a engorde` : ''}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 font-semibold">{formatKg(totals.kg)} kg</td>
                    <td className="py-3" />
                    <td className="py-3" />
                    <td className="py-3" />
                    <td className="py-3 font-semibold">{formatDop(totals.cost)}</td>
                    <td className="py-3" />
                  </tr>
                </tfoot>
              </table>
            )}
          </>
        )}
      </div>

      {formOpen && (
        <CepaForm
          title={editing ? 'Editar cepa' : 'Registrar cepa'}
          suppliers={state.suppliers}
          locations={locationCatalog}
          cepas={rows}
          deaths={deaths}
          transfers={transfers}
          lastUsdRate={state.lastUsdRate}
          initial={editing}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onAddSupplier={addSupplier}
          onAddLocation={addLocation}
          onSave={(inputs) => {
            if (editing) {
              if (inputs.length !== 1) return 'Al editar, deja los lechones en una sola jaula.'
              return updateCepa(editing.id, inputs[0])
            }
            return addCepas(inputs)
          }}
        />
      )}

      {weightOpen && (
        <WeightForm
          key={`${editingWeighing?.id ?? 'new'}:${weighingCepa?.id ?? 'none'}`}
          cepas={state.cepas}
          weighings={weighings}
          deaths={deaths}
          transfers={transfers}
          initialCepa={weighingCepa}
          initialWeighing={editingWeighing}
          onClose={() => {
            setWeightOpen(false)
            setWeighingCepa(null)
            setEditingWeighing(null)
          }}
          onSave={(input) =>
            editingWeighing ? updateWeighing(editingWeighing.id, input) : addWeighing(input)
          }
          onEditWeighing={(item) => {
            const cepa = state.cepas.find((row) => row.id === item.cepaId) ?? null
            setWeighingCepa(cepa)
            setEditingWeighing(item)
          }}
          onDeleteWeighing={deleteWeighing}
        />
      )}

      {deathOpen && (
        <DeathForm
          key={`${editingDeath?.id ?? 'new'}:${deathCepa?.id ?? 'none'}`}
          cepas={state.cepas}
          deaths={deaths}
          transfers={transfers}
          initialCepa={deathCepa}
          initialDeath={editingDeath}
          onClose={() => {
            setDeathOpen(false)
            setDeathCepa(null)
            setEditingDeath(null)
          }}
          onSave={(input) => (editingDeath ? updateDeath(editingDeath.id, input) : addDeath(input))}
          onEditDeath={(item) => {
            const cepa = state.cepas.find((row) => row.id === item.cepaId) ?? null
            setDeathCepa(cepa)
            setEditingDeath(item)
          }}
          onDeleteDeath={deleteDeath}
        />
      )}

      {feedOpen && (
        <FeedUseForm
          title={editingFeedUse ? 'Editar alimentación' : 'Alimentar destete'}
          stage="destete"
          locations={locationCatalog}
          initial={editingFeedUse}
          onClose={() => {
            setFeedOpen(false)
            setEditingFeedUse(null)
          }}
        />
      )}

      {removingFeedUse && (
        <Modal title="Eliminar alimentación" onClose={() => setRemovingFeedUse(null)}>
          <p className="text-[var(--muted)]">
            ¿Quitar {removingFeedUse.feedName} del {removingFeedUse.date}? El inventario de alimento vuelve a
            contar esos QQ.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => setRemovingFeedUse(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                feed.deleteUse(removingFeedUse.id)
                setRemovingFeedUse(null)
              }}
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}

      {removing && (
        <Modal title="Eliminar cepa" onClose={() => setRemoving(null)}>
          <p className="text-[var(--muted)]">
            ¿Eliminar la cepa de {removing.pigletCount} lechones de “{removing.supplierName}” en{' '}
            {removing.location}?
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                deleteCepa(removing.id)
                setRemoving(null)
              }}
            >
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </section>
  )
}

function CepaForm({
  title,
  suppliers,
  locations,
  cepas,
  deaths,
  transfers,
  lastUsdRate,
  initial,
  onClose,
  onAddSupplier,
  onAddLocation,
  onSave,
}: {
  title: string
  suppliers: CepaSupplier[]
  locations: CepaLocation[]
  cepas: Cepa[]
  deaths: CepaDeath[]
  transfers: HeadMovement[]
  lastUsdRate?: number
  initial: Cepa | null
  onClose: () => void
  onAddSupplier: (name: string, saleAgeDays?: number) => { error: string } | { id: string }
  onAddLocation: (name: string, capacity?: number) => { error: string } | { id: string }
  onSave: (inputs: CepaInput[]) => string | null
}) {
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [supplierId, setSupplierId] = useState(initial?.supplierId ?? suppliers[0]?.id ?? '')
  const [addingSupplier, setAddingSupplier] = useState(!initial && suppliers.length === 0)
  const [newSupplier, setNewSupplier] = useState('')
  const [newSupplierAge, setNewSupplierAge] = useState('')
  const [supplierError, setSupplierError] = useState<string | null>(null)
  const [placements, setPlacements] = useState(() =>
    initial
      ? [{ key: initial.id, locationId: initial.locationId, pigletCount: String(initial.pigletCount) }]
      : [{ key: uid(), locationId: locations[0]?.id ?? '', pigletCount: '' }],
  )
  const [addingLocation, setAddingLocation] = useState(!initial && locations.length === 0)
  const [newLocation, setNewLocation] = useState('')
  const [newLocationCapacity, setNewLocationCapacity] = useState('')
  const [locationError, setLocationError] = useState<string | null>(null)
  const selectedSupplier = suppliers.find((item) => item.id === supplierId)
  const [arrivalAge, setArrivalAge] = useState(
    initial?.arrivalAgeDays
      ? String(initial.arrivalAgeDays)
      : selectedSupplier?.saleAgeDays
        ? String(selectedSupplier.saleAgeDays)
        : '',
  )
  const [totalWeight, setTotalWeight] = useState(initial ? String(initial.totalWeightKg) : '')
  const [costBasis, setCostBasis] = useState<CepaCostBasis>(initial?.costBasis ?? 'piglet')
  const [currency, setCurrency] = useState<FeedCurrency>(initial?.priceCurrency ?? 'DOP')
  const [price, setPrice] = useState(
    initial && initial.priceCurrency !== 'USD' ? String(initial.unitCost) : '',
  )
  const [usdAmount, setUsdAmount] = useState(
    initial?.priceCurrency === 'USD' && initial.usdAmount != null ? String(initial.usdAmount) : '',
  )
  const [usdRate, setUsdRate] = useState(
    initial?.priceCurrency === 'USD' && initial.usdRate
      ? String(initial.usdRate)
      : lastUsdRate
        ? String(lastUsdRate)
        : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const counts = placements.map((row) => Number.parseInt(row.pigletCount, 10) || 0)
  const count = counts.reduce((sum, value) => sum + value, 0)
  const totalKg = Number(totalWeight) || 0
  const pesos = pesosFromFields(currency, price, usdAmount, usdRate)
  const avgKg = count > 0 && totalKg > 0 ? cepaAvgWeightKg(totalKg, count) : 0
  const total =
    count > 0 && totalKg > 0
      ? cepaTotalCost({ costBasis, unitCost: pesos, pigletCount: count, totalWeightKg: totalKg })
      : 0
  const priceUnit = costBasis === 'kg' ? 'kilo' : 'lechón'
  const overcrowdedLines = placements.flatMap((row, index) => {
    const heads = counts[index]
    if (!row.locationId || heads <= 0) return []
    const location = locations.find((item) => item.id === row.locationId)
    if (!location?.capacity) return []
    const current = locationLiveCount(row.locationId, cepas, deaths, transfers)
    const already = initial && initial.locationId === row.locationId ? cepaLiveOnDate(initial, deaths, undefined, undefined, transfers) : 0
    const projected = current - already + heads
    return projected > location.capacity
      ? [`${location.name}: ${projected} vivos / ${location.capacity} de capacidad`]
      : []
  })

  function saveSupplier() {
    const ageValue = newSupplierAge.trim() ? Number.parseInt(newSupplierAge, 10) : undefined
    const result = onAddSupplier(newSupplier, ageValue)
    if ('error' in result) {
      setSupplierError(result.error)
      return
    }
    setSupplierId(result.id)
    if (ageValue && ageValue > 0) setArrivalAge(String(ageValue))
    setNewSupplier('')
    setNewSupplierAge('')
    setAddingSupplier(false)
    setSupplierError(null)
  }

  function saveLocation() {
    const capacity = newLocationCapacity.trim() ? Number.parseInt(newLocationCapacity, 10) : undefined
    const result = onAddLocation(newLocation, capacity)
    if ('error' in result) {
      setLocationError(result.error)
      return
    }
    setPlacements((rows) => {
      const emptyIndex = rows.findIndex((row) => !row.locationId)
      const index = emptyIndex >= 0 ? emptyIndex : rows.length - 1
      return rows.map((row, i) => (i === index ? { ...row, locationId: result.id } : row))
    })
    setNewLocation('')
    setNewLocationCapacity('')
    setAddingLocation(false)
    setLocationError(null)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const filled = placements.filter((row) => row.locationId && (Number.parseInt(row.pigletCount, 10) || 0) > 0)
    if (filled.length === 0) {
      setSaved(false)
      setError('Indica al menos una jaula con lechones.')
      return
    }
    if (initial && filled.length !== 1) {
      setSaved(false)
      setError('Al editar, deja los lechones en una sola jaula.')
      return
    }
    const locationIds = filled.map((row) => row.locationId)
    if (new Set(locationIds).size !== locationIds.length) {
      setSaved(false)
      setError('No repitas la misma jaula. Junta esas cantidades en una sola línea.')
      return
    }
    const filledCounts = filled.map((row) => Number.parseInt(row.pigletCount, 10))
    const filledWeights = splitKgByHeads(totalKg, filledCounts)
    const message = onSave(
      filled.map((row, index) => ({
        date,
        supplierId,
        locationId: row.locationId,
        pigletCount: filledCounts[index],
        arrivalAgeDays: Number.parseInt(arrivalAge, 10),
        totalWeightKg: filledWeights[index],
        costBasis,
        priceCurrency: currency,
        unitCost: Number(price),
        usdAmount: currency === 'USD' ? Number(usdAmount) : undefined,
        usdRate: currency === 'USD' ? Number(usdRate) : undefined,
      })),
    )
    if (message) {
      setSaved(false)
      setError(message)
      return
    }
    if (initial) {
      onClose()
      return
    }
    setPlacements([{ key: uid(), locationId: locations[0]?.id ?? '', pigletCount: '' }])
    setTotalWeight('')
    setDate(todayIso())
    setError(null)
    setSaved(true)
    afterSaveReadyForNext(e)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Fecha de compra</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>

        <div>
          <span className="label">Suplidor</span>
          {suppliers.length > 0 && (
            <select
              className="field"
              value={supplierId}
              onChange={(e) => {
                const nextId = e.target.value
                setSupplierId(nextId)
                const next = suppliers.find((item) => item.id === nextId)
                if (next?.saleAgeDays) setArrivalAge(String(next.saleAgeDays))
              }}
              required={!addingSupplier}
            >
              {suppliers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
          {addingSupplier ? (
            <div className="mt-2 grid gap-2 rounded-2xl border border-[var(--line)] p-3">
              <label>
                <span className="label">Nombre del suplidor</span>
                <input
                  className="field"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  placeholder="Ej. Granja El Valle"
                />
              </label>
              <label>
                <span className="label">Edad habitual de venta (días)</span>
                <input
                  className="field"
                  type="number"
                  min={1}
                  step={1}
                  value={newSupplierAge}
                  onChange={(e) => setNewSupplierAge(e.target.value)}
                  placeholder="Ej. 21"
                />
              </label>
              {supplierError && <p className="text-sm text-[var(--danger)]">{supplierError}</p>}
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" type="button" onClick={saveSupplier}>
                  Guardar suplidor
                </button>
                {suppliers.length > 0 && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => {
                      setAddingSupplier(false)
                      setSupplierError(null)
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button className="btn btn-ghost mt-2" type="button" onClick={() => setAddingSupplier(true)}>
              Añadir suplidor
            </button>
          )}
        </div>

        <div>
          <span className="label">{initial ? 'Ubicación y lechones' : 'Jaulas y lechones'}</span>
          <p className="mb-2 text-xs text-[var(--muted)]">
            {initial
              ? 'Esta cepa queda en una sola jaula.'
              : 'Si quieres, reparte la misma compra entre varias jaulas. Cada jaula se guarda como una cepa.'}{' '}
            Lo normal es crearlas antes en{' '}
            <Link className="font-semibold underline" to="/ajustes">
              Ajustes
            </Link>
            .
          </p>
          <div className="grid gap-2">
            {placements.map((row, index) => {
              const location = locations.find((item) => item.id === row.locationId)
              const heads = counts[index]
              const live = row.locationId ? locationLiveCount(row.locationId, cepas, deaths, transfers) : 0
              const already = initial && initial.locationId === row.locationId ? cepaLiveOnDate(initial, deaths, undefined, undefined, transfers) : 0
              const projected = row.locationId && heads > 0 ? live - already + heads : 0
              const over = Boolean(location?.capacity && projected > location.capacity)
              return (
                <div key={row.key} className="grid gap-2 rounded-2xl border border-[var(--line)] p-3 sm:grid-cols-[1fr_8rem_auto]">
                  <label>
                    <span className="label">Jaula</span>
                    <select
                      className="field"
                      value={row.locationId}
                      onChange={(e) =>
                        setPlacements((rows) =>
                          rows.map((item) =>
                            item.key === row.key ? { ...item, locationId: e.target.value } : item,
                          ),
                        )
                      }
                      required={placements.length === 1 && !addingLocation}
                    >
                      <option value="">Elegir jaula</option>
                      {locations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.capacity > 0 ? ` (${item.capacity})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label">Lechones</span>
                    <input
                      className="field"
                      type="number"
                      min={1}
                      step={1}
                      value={row.pigletCount}
                      onChange={(e) =>
                        setPlacements((rows) =>
                          rows.map((item) =>
                            item.key === row.key ? { ...item, pigletCount: e.target.value } : item,
                          ),
                        )
                      }
                      required={placements.length === 1}
                    />
                  </label>
                  {!initial && placements.length > 1 ? (
                    <button
                      className="btn btn-ghost self-end"
                      type="button"
                      onClick={() => setPlacements((rows) => rows.filter((item) => item.key !== row.key))}
                    >
                      Quitar
                    </button>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                  {over && location && (
                    <p className="text-sm text-[var(--danger)] sm:col-span-3">
                      Sobrepoblación en {location.name}: quedarían {projected} vivos de {location.capacity} de
                      capacidad.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          {!initial && (
            <button
              className="btn btn-ghost mt-2"
              type="button"
              onClick={() =>
                setPlacements((rows) => [...rows, { key: uid(), locationId: '', pigletCount: '' }])
              }
            >
              Añadir otra jaula
            </button>
          )}
          {addingLocation ? (
            <div className="mt-2 grid gap-2 rounded-2xl border border-[var(--line)] p-3">
              <label>
                <span className="label">Nombre de la jaula</span>
                <input
                  className="field"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="Ej. Jaula 3"
                />
              </label>
              <label>
                <span className="label">Capacidad (lechones)</span>
                <input
                  className="field"
                  type="number"
                  min={1}
                  step={1}
                  value={newLocationCapacity}
                  onChange={(e) => setNewLocationCapacity(e.target.value)}
                  placeholder="Opcional"
                />
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  Si se pasa este número, la ficha de la jaula avisa sobrepoblación.
                </span>
              </label>
              {locationError && <p className="text-sm text-[var(--danger)]">{locationError}</p>}
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" type="button" onClick={saveLocation}>
                  Guardar jaula
                </button>
                {locations.length > 0 && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => {
                      setAddingLocation(false)
                      setLocationError(null)
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button className="btn btn-ghost mt-2" type="button" onClick={() => setAddingLocation(true)}>
              Añadir jaula nueva
            </button>
          )}
          {overcrowdedLines.length > 0 && (
            <p className="mt-2 text-sm text-[var(--danger)]">
              Hay sobrepoblación prevista. Puedes registrar igual; la ficha de la jaula lo marcará.
            </p>
          )}
        </div>

        <label>
          <span className="label">Edad al comprar (días)</span>
          <input
            className="field"
            type="number"
            min={1}
            step={1}
            value={arrivalAge}
            onChange={(e) => setArrivalAge(e.target.value)}
            placeholder="Ej. 21"
            required
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Edad de estos lechones al llegar. Si el suplidor vende a otra edad, cámbiala aquí.
            {arrivalAge && Number.parseInt(arrivalAge, 10) > 0
              ? ` ${formatAgeDays(Number.parseInt(arrivalAge, 10))}.`
              : ''}
          </span>
        </label>

        <label>
          <span className="label">Peso total (kg)</span>
          <input
            className="field"
            type="number"
            min={0.01}
            step="any"
            value={totalWeight}
            onChange={(e) => setTotalWeight(e.target.value)}
            placeholder="Kilos de toda la compra"
            required
          />
        </label>
        {avgKg > 0 && (
          <p className="text-sm text-[var(--muted)]">
            Promedio por lechón: {formatKg(avgKg)} kg
            {count > 0 && placements.filter((row) => row.locationId && (Number.parseInt(row.pigletCount, 10) || 0) > 0).length > 1
              ? ' · El peso se reparte según cuántos lechones van a cada jaula.'
              : ''}
          </p>
        )}

        <fieldset>
          <legend className="label">Costo</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            <label className="btn btn-ghost">
              <input
                className="mr-2"
                type="radio"
                name="costBasis"
                checked={costBasis === 'piglet'}
                onChange={() => setCostBasis('piglet')}
              />
              Por lechón
            </label>
            <label className="btn btn-ghost">
              <input
                className="mr-2"
                type="radio"
                name="costBasis"
                checked={costBasis === 'kg'}
                onChange={() => setCostBasis('kg')}
              />
              Costo por kilo
            </label>
          </div>
        </fieldset>

        <FeedPriceFields
          currency={currency}
          onCurrency={setCurrency}
          dopPrice={price}
          onDopPrice={setPrice}
          usdAmount={usdAmount}
          onUsdAmount={setUsdAmount}
          usdRate={usdRate}
          onUsdRate={setUsdRate}
          priceUnit={priceUnit}
        />
        {total > 0 && <p className="text-sm text-[var(--muted)]">Total de la compra: {formatDop(total)}</p>}
        {saved && <SavedNotice />}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit">
          {initial
            ? 'Guardar cambios'
            : placements.filter((row) => row.locationId && (Number.parseInt(row.pigletCount, 10) || 0) > 0).length > 1
              ? 'Registrar cepas'
              : 'Registrar cepa'}
        </button>
      </form>
    </Modal>
  )
}

function WeightForm({
  cepas,
  weighings,
  deaths,
  transfers,
  initialCepa,
  initialWeighing,
  onClose,
  onSave,
  onEditWeighing,
  onDeleteWeighing,
}: {
  cepas: Cepa[]
  weighings: CepaWeighing[]
  deaths: CepaDeath[]
  transfers: HeadMovement[]
  initialCepa: Cepa | null
  initialWeighing: CepaWeighing | null
  onClose: () => void
  onSave: (input: CepaWeighingInput) => string | null
  onEditWeighing: (item: CepaWeighing) => void
  onDeleteWeighing: (id: string) => void
}) {
  const orderedCepas = [...cepas].sort(
    (a, b) => b.date.localeCompare(a.date) || a.location.localeCompare(b.location, 'es'),
  )
  const [cepaId, setCepaId] = useState(initialWeighing?.cepaId ?? initialCepa?.id ?? orderedCepas[0]?.id ?? '')
  const cepa = cepas.find((item) => item.id === cepaId) ?? null
  const points = cepa ? cepaWeightPoints(cepa, weighings) : []
  const [date, setDate] = useState(initialWeighing?.date ?? todayIso())
  const inventoryLive = cepa ? cepaLiveOnDate(cepa, deaths, date, undefined, transfers) : 0
  const [pigletCount, setPigletCount] = useState(
    String(initialWeighing?.pigletCount ?? inventoryLive),
  )
  const [weighMode, setWeighMode] = useState<CepaWeighMode>(initialWeighing?.weighMode ?? 'sample')
  const [weighedCount, setWeighedCount] = useState(
    initialWeighing?.weighMode === 'sample' ? String(initialWeighing.weighedCount) : '',
  )
  const [scaleWeight, setScaleWeight] = useState(
    initialWeighing ? String(initialWeighing.scaleWeightKg) : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const liveCount = Number.parseInt(pigletCount, 10) || 0
  const sampleCount = Number.parseInt(weighedCount, 10) || 0
  const scaleKg = Number(scaleWeight) || 0
  const mass =
    liveCount > 0 && scaleKg > 0 && (weighMode === 'census' || sampleCount > 0)
      ? resolveCepaWeighingMass({
          pigletCount: liveCount,
          weighMode,
          weighedCount: sampleCount,
          scaleWeightKg: scaleKg,
        })
      : null
  const avgKg = mass?.avgWeightKg ?? 0
  const estimatedTotalKg = mass?.totalWeightKg ?? 0
  const purchaseAvg = cepa ? cepaAvgWeightKg(cepa.totalWeightKg, cepa.pigletCount) : 0
  const previous = points
    .filter((point) => point.id !== initialWeighing?.id && point.date <= date)
    .at(-1)
  const gainVsPurchase = avgKg > 0 ? avgKg - purchaseAvg : 0
  const gainVsPrevious = avgKg > 0 && previous ? avgKg - previous.avgWeightKg : 0
  const daysFromPurchase = cepa && date ? isoDaysBetween(cepa.date, date) : 0
  const daysFromPrevious = previous && date ? isoDaysBetween(previous.date, date) : 0

  function changeCepa(id: string) {
    setCepaId(id)
    const next = cepas.find((item) => item.id === id)
    if (!next || initialWeighing) return
    setPigletCount(String(cepaLiveOnDate(next, deaths, date, undefined, transfers)))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const message = onSave({
      cepaId,
      date,
      pigletCount: liveCount,
      weighMode,
      weighedCount: weighMode === 'census' ? liveCount : sampleCount,
      scaleWeightKg: scaleKg,
    })
    if (message) {
      setSaved(false)
      setError(message)
      return
    }
    if (initialWeighing) {
      onClose()
      return
    }
    setScaleWeight('')
    setDate(todayIso())
    setError(null)
    setSaved(true)
    afterSaveReadyForNext(e)
  }

  const history = weighings
    .filter((item) => item.cepaId === cepaId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  return (
    <Modal title={initialWeighing ? 'Editar pesaje' : 'Actualizar peso'} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Cepa</span>
          <select className="field" value={cepaId} onChange={(e) => changeCepa(e.target.value)} required>
            {orderedCepas.map((item) => (
              <option key={item.id} value={item.id}>
                {item.location} · {item.supplierName} · {item.date}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Fecha de pesaje</span>
          <input
            className="field"
            type="date"
            min={cepa?.date}
            value={date}
            onChange={(e) => {
              const nextDate = e.target.value
              setDate(nextDate)
              if (!initialWeighing && cepa) setPigletCount(String(cepaLiveOnDate(cepa, deaths, nextDate, undefined, transfers)))
            }}
            required
          />
        </label>
        <label>
          <span className="label">Lechones vivos</span>
          <input
            className="field"
            type="number"
            min={1}
            step={1}
            value={pigletCount}
            onChange={(e) => setPigletCount(e.target.value)}
            required
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Inventario ese día: {inventoryLive} vivos
            {cepa ? ` de ${cepa.pigletCount} comprados` : ''}.
          </span>
        </label>
        <fieldset>
          <legend className="label">Cómo se pesó</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            <label className="btn btn-ghost">
              <input
                className="mr-2"
                type="radio"
                name="weighMode"
                checked={weighMode === 'sample'}
                onChange={() => setWeighMode('sample')}
              />
              Muestra
            </label>
            <label className="btn btn-ghost">
              <input
                className="mr-2"
                type="radio"
                name="weighMode"
                checked={weighMode === 'census'}
                onChange={() => setWeighMode('census')}
              />
              Toda la cepa
            </label>
          </div>
        </fieldset>
        {weighMode === 'sample' && (
          <label>
            <span className="label">Lechones pesados</span>
            <input
              className="field"
              type="number"
              min={1}
              max={liveCount || undefined}
              step={1}
              value={weighedCount}
              onChange={(e) => setWeighedCount(e.target.value)}
              placeholder="Ej. 30"
              required
            />
          </label>
        )}
        <label>
          <span className="label">{weighMode === 'sample' ? 'Peso de la muestra (kg)' : 'Peso total (kg)'}</span>
          <input
            className="field"
            type="number"
            min={0.01}
            step="any"
            value={scaleWeight}
            onChange={(e) => setScaleWeight(e.target.value)}
            placeholder={weighMode === 'sample' ? 'Kilos de los lechones pesados' : 'Kilos de toda la cepa'}
            required
          />
        </label>
        {avgKg > 0 && cepa && (
          <div className="rounded-2xl border border-[var(--line)] p-3 text-sm">
            <p>Promedio por lechón: {formatKg(avgKg)} kg</p>
            <p className="mt-1 text-[var(--muted)]">
              {weighMode === 'sample' ? 'Peso estimado de la cepa' : 'Peso de la cepa'}:{' '}
              {formatKg(estimatedTotalKg)} kg
              {weighMode === 'sample' ? ` (${liveCount} vivos)` : ''}
            </p>
            <p className="mt-1 text-[var(--muted)]">
              Ganancia desde la compra ({daysFromPurchase} días): {formatGain(gainVsPurchase)} por lechón
              {daysFromPurchase > 0 ? ` · ${formatDailyGain(dailyGainKg(gainVsPurchase, daysFromPurchase))}` : ''}
            </p>
            {previous && previous.source === 'weighing' && (
              <p className="mt-1 text-[var(--muted)]">
                Ganancia desde el pesaje anterior ({daysFromPrevious} días): {formatGain(gainVsPrevious)} por
                lechón
                {daysFromPrevious > 0
                  ? ` · ${formatDailyGain(dailyGainKg(gainVsPrevious, daysFromPrevious))}`
                  : ''}
              </p>
            )}
          </div>
        )}
        {saved && <SavedNotice />}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit">
          {initialWeighing ? 'Guardar cambios' : 'Guardar pesaje'}
        </button>
      </form>
      {history.length > 0 && (
        <div className="mt-5">
          <h4 className="font-display text-xl">Pesajes guardados</h4>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Cada fecha queda para comparar en Reportes por días, semanas o meses.
          </p>
          <ul className="mt-3 grid gap-2">
            {history.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--line)] px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-semibold">{item.date}</p>
                  <p className="text-[var(--muted)]">
                    {formatKg(item.avgWeightKg)} kg / lechón · {formatKg(item.totalWeightKg)} kg
                    {item.weighMode === 'sample' ? ' est.' : ''}
                    {` · ${item.weighedCount}/${item.pigletCount} pesados`}
                    {cepa ? ` · +${isoDaysBetween(cepa.date, item.date)} días` : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <IconButton label="Editar" onClick={() => onEditWeighing(item)}>
                    <PencilIcon />
                  </IconButton>
                  <IconButton label="Eliminar" onClick={() => onDeleteWeighing(item.id)}>
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

function DeathForm({
  cepas,
  deaths,
  transfers,
  initialCepa,
  initialDeath,
  onClose,
  onSave,
  onEditDeath,
  onDeleteDeath,
}: {
  cepas: Cepa[]
  deaths: CepaDeath[]
  transfers: HeadMovement[]
  initialCepa: Cepa | null
  initialDeath: CepaDeath | null
  onClose: () => void
  onSave: (input: CepaDeathInput) => string | null
  onEditDeath: (item: CepaDeath) => void
  onDeleteDeath: (id: string) => void
}) {
  const orderedCepas = [...cepas].sort(
    (a, b) => b.date.localeCompare(a.date) || a.location.localeCompare(b.location, 'es'),
  )
  const [cepaId, setCepaId] = useState(initialDeath?.cepaId ?? initialCepa?.id ?? orderedCepas[0]?.id ?? '')
  const cepa = cepas.find((item) => item.id === cepaId) ?? null
  const [date, setDate] = useState(initialDeath?.date ?? todayIso())
  const live = cepa ? cepaLiveOnDate(cepa, deaths, date, initialDeath?.id, transfers) : 0
  const [count, setCount] = useState(initialDeath ? String(initialDeath.count) : '')
  const [note, setNote] = useState(initialDeath?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const qty = Number.parseInt(count, 10) || 0
  const age = cepa && date ? cepaAgeOnDate(cepa, date) : null

  function submit(e: FormEvent) {
    e.preventDefault()
    const message = onSave({
      cepaId,
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
    .filter((item) => item.cepaId === cepaId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  return (
    <Modal title={initialDeath ? 'Editar muerte' : 'Registrar muerte'} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
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
        <label>
          <span className="label">Fecha</span>
          <input
            className="field"
            type="date"
            min={cepa?.date}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label>
          <span className="label">Lechones muertos</span>
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
            {cepa ? ` de ${cepa.pigletCount} comprados` : ''}.
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
                    {item.date} · {item.count} {item.count === 1 ? 'lechón' : 'lechones'}
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

function summarizeCepas(rows: Cepa[], weighings: CepaWeighing[], deaths: CepaDeath[], transfers: HeadMovement[]) {
  return rows.reduce(
    (acc, row) => {
      const current = latestCepaWeight(row, weighings)
      const live = cepaLiveOnDate(row, deaths, undefined, undefined, transfers)
      acc.piglets += live
      acc.dead += cepaDeathsUpTo(deaths, row.id)
      acc.moved += cepaCountUpTo(transfers, row.id)
      acc.kg += current.avgWeightKg * live
      acc.cost += cepaTotalCost(row)
      return acc
    },
    { piglets: 0, dead: 0, moved: 0, kg: 0, cost: 0 },
  )
}

function formatGain(kg: number): string {
  const sign = kg > 0 ? '+' : ''
  return `${sign}${formatKg(kg)} kg`
}

function formatDailyGain(kg: number): string {
  const sign = kg > 0 ? '+' : ''
  return `${sign}${formatKg(kg)} kg/día`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-3xl p-4">
      <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  )
}

function HoverStat({
  label,
  value,
  breakdown,
  empty,
  align = 'left',
}: {
  label: string
  value: string
  breakdown: Array<{ key: string; name: string; value: string }>
  empty: string
  align?: 'left' | 'right'
}) {
  return (
    <div className="group relative">
      <div className="surface cursor-default rounded-3xl p-4" tabIndex={0}>
        <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
        <p className="mt-1 font-display text-2xl">{value}</p>
      </div>
      <div
        className={`pointer-events-none invisible absolute top-full z-20 mt-2 w-72 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-3 text-sm shadow-lg group-hover:visible group-focus-within:visible ${
          align === 'right' ? 'right-0 left-auto' : 'left-0'
        }`}
      >
        {breakdown.length === 0 ? (
          <p className="text-[var(--muted)]">{empty}</p>
        ) : (
          <ul className="grid gap-1">
            {breakdown.map((row) => (
              <li key={row.key} className="flex justify-between gap-2">
                <span>{row.name}</span>
                <strong>{row.value}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
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

function DeathIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v6" />
      <path d="M8 7h8" />
      <circle cx="12" cy="16" r="5" />
    </svg>
  )
}

function ScaleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v3" />
      <path d="M4 10h16" />
      <path d="M7 10 4.5 16h5L7 10Z" />
      <path d="M17 10 14.5 16h5L17 10Z" />
      <path d="M12 6v14" />
    </svg>
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
