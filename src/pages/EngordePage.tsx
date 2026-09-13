import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import DeathForm from '../components/DeathForm'
import FeedUseForm, { FeedUseHistory } from '../components/FeedUseForm'
import StageActionHistory from '../components/StageActionHistory'
import { ClearFiltersButton, FilterField, HistoryFilterBar, inDateRange } from '../components/HistoryFilters'
import Modal, { afterSaveReadyForNext, SavedNotice } from '../components/Modal'
import { useCepa, type EngordeLotInput } from '../context/CepaContext'
import { useFeed } from '../context/FeedContext'
import { usePharmacy } from '../context/PharmacyContext'
import {
  cepaAgeOnDate,
  cepaAvgWeightKg,
  cepaLiveOnDate,
  deathStage,
  engordeDeathsUpTo,
  engordeLocationLiveCount,
  engordeLotLiveOnDate,
  engordeLotsAsMovements,
  formatAgeDays,
  formatKg,
  latestCepaWeight,
  engordeCostGroups,
  cepaCostSheets,
  emptyCepaCostSheet,
  splitKgByHeads,
  buildStageActions,
  formatDop,
  todayIso,
  uid,
} from '../lib/calc'
import { useQuickAdd } from '../lib/quickAdd'
import type { Cepa, CepaDeath, CepaLocation, CepaWeighing, EngordeLot, FeedUse } from '../lib/types'

export default function EngordePage() {
  const { state, addEngordeLots, updateEngordeLot, deleteEngordeLot, addDeath, updateDeath, deleteDeath } = useCepa()
  const feed = useFeed()
  const pharmacy = usePharmacy()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<EngordeLot | null>(null)
  const [removing, setRemoving] = useState<EngordeLot | null>(null)
  const [feedOpen, setFeedOpen] = useState(false)
  const [editingFeedUse, setEditingFeedUse] = useState<FeedUse | null>(null)
  const [removingFeedUse, setRemovingFeedUse] = useState<FeedUse | null>(null)
  const [deathOpen, setDeathOpen] = useState(false)
  const [deathLot, setDeathLot] = useState<EngordeLot | null>(null)
  const [editingDeath, setEditingDeath] = useState<CepaDeath | null>(null)
  const [locationFilter, setLocationFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)

  useQuickAdd({
    traslado: () => {
      setEditing(null)
      setFormOpen(true)
    },
    'alimento-engorde': () => {
      setEditingFeedUse(null)
      setFeedOpen(true)
    },
    'muerte-engorde': () => {
      setEditingDeath(null)
      setDeathLot(state.engordeLots?.[0] ?? null)
      setDeathOpen(true)
    },
  })

  const desteteRooms = state.locations ?? []
  const rooms = state.engordeLocations ?? []
  const lots = useMemo(
    () => [...(state.engordeLots ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [state.engordeLots],
  )
  const visibleRows = useMemo(
    () =>
      lots.filter((row) => {
        if (locationFilter) {
          const selected = rooms.find((item) => item.id === locationFilter)
          const matchesId = row.locationId === locationFilter
          const matchesName = selected ? row.location === selected.name : row.location === locationFilter
          if (!matchesId && !matchesName) return false
        }
        return inDateRange(row.date, fromDate, toDate)
      }),
    [lots, locationFilter, fromDate, toDate, rooms],
  )
  const deaths = state.deaths ?? []
  const byRoom = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; pigs: number; dead: number; lots: number; kg: number; capacity: number }
    >()
    for (const loc of rooms) {
      map.set(loc.id, {
        id: loc.id,
        name: loc.name,
        pigs: 0,
        dead: 0,
        lots: 0,
        kg: 0,
        capacity: loc.capacity || 0,
      })
    }
    for (const row of lots) {
      const catalog =
        rooms.find((item) => item.id === row.locationId) ??
        rooms.find((item) => item.name.trim().toLowerCase() === row.location.trim().toLowerCase())
      const key = catalog?.id || row.locationId || row.location.trim() || 'sin'
      const name = catalog?.name || row.location.trim() || 'Sin sala'
      const current = map.get(key) ?? {
        id: key,
        name,
        pigs: 0,
        dead: 0,
        lots: 0,
        kg: 0,
        capacity: catalog?.capacity || 0,
      }
      const live = engordeLotLiveOnDate(row, deaths)
      const dead = engordeDeathsUpTo(deaths, row.id)
      const ratio = row.pigCount > 0 ? live / row.pigCount : 0
      current.pigs += live
      current.dead += dead
      current.lots += 1
      current.kg += row.totalWeightKg * ratio
      map.set(key, current)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [lots, rooms, deaths])
  const costLedger = useMemo(
    () =>
      cepaCostSheets({
        cepas: state.cepas,
        lots,
        feedUses: feed.state.uses ?? [],
        injectionUses: pharmacy.state.uses,
      }),
    [state.cepas, lots, feed.state.uses, pharmacy.state.uses],
  )
  const sheetById = useMemo(
    () => new Map(costLedger.sheets.map((item) => [item.cepaId, item])),
    [costLedger.sheets],
  )
  const feedUseRows = useMemo(
    () =>
      [...(feed.state.uses ?? [])]
        .filter((item) => item.stage === 'engorde')
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [feed.state.uses],
  )
  const actionRows = useMemo(
    () =>
      buildStageActions({
        stage: 'engorde',
        lots,
        deaths,
        feedUses: feed.state.uses ?? [],
        injectionUses: pharmacy.state.uses,
        injections: pharmacy.state.injections,
      }),
    [lots, deaths, feed.state.uses, pharmacy.state.uses, pharmacy.state.injections],
  )
  const totals = useMemo(
    () =>
      visibleRows.reduce(
        (acc, row) => {
          const live = engordeLotLiveOnDate(row, deaths)
          const ratio = row.pigCount > 0 ? live / row.pigCount : 0
          acc.pigs += live
          acc.kg += row.totalWeightKg * ratio
          return acc
        },
        { pigs: 0, kg: 0 },
      ),
    [visibleRows, deaths],
  )
  const allPigs = lots.reduce((sum, row) => sum + engordeLotLiveOnDate(row, deaths), 0)
  const allDead = deaths
    .filter((item) => deathStage(item) === 'engorde')
    .reduce((sum, item) => sum + item.count, 0)
  const desteteWithLive = state.cepas.some(
    (row) => cepaLiveOnDate(row, deaths, undefined, undefined, engordeLotsAsMovements(lots)) > 0,
  )

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="chip mb-3">Crecimiento</p>
          <h2 className="font-display text-4xl">Engorde</h2>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            El traslado es una transferencia: de una jaula de destete ya creada a una sala de engorde ya
            creada. Las salas se crean en Ajustes, no en este paso. El inventario de Cepa baja con el
            traslado.
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
            disabled={lots.length === 0}
            onClick={() => {
              setEditingDeath(null)
              setDeathLot(lots[0] ?? null)
              setDeathOpen(true)
            }}
          >
            Registrar muerte
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={state.cepas.length === 0}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Trasladar a engorde
          </button>
        </div>
      </div>

      {desteteRooms.length === 0 || rooms.length === 0 ? (
        <div className="mb-6 rounded-3xl border border-[var(--clay)] bg-[var(--clay-soft)] p-4">
          <p className="text-sm">
            Primero crea las jaulas de destete y las salas de engorde en{' '}
            <Link className="font-semibold underline" to="/ajustes">
              Ajustes
            </Link>
            . El traslado solo mueve cerdos entre esas salas; no crea habitaciones nuevas.
          </p>
        </div>
      ) : null}

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HoverStat
          label="Cerdos en engorde"
          value={String(allPigs)}
          empty="Aún no hay traslados."
          breakdown={byRoom.map((row) => ({
            key: row.id,
            name: row.name,
            value: String(row.pigs),
          }))}
        />
        <HoverStat
          label="Muertos"
          value={String(allDead)}
          empty="Aún no hay muertes en engorde."
          breakdown={byRoom
            .filter((row) => row.dead > 0)
            .map((row) => ({
              key: `${row.id}-dead`,
              name: row.name,
              value: String(row.dead),
            }))}
        />
        <Stat label="Peso al traslado" value={`${formatKg(lots.reduce((sum, row) => sum + row.totalWeightKg, 0))} kg`} />
        <Stat label="Traslados" value={String(lots.length)} />
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HoverStat
          label="Alimento usado"
          value={formatDop(costLedger.sheets.reduce((sum, row) => sum + row.engordeFeedCost, 0))}
          empty="Aún no hay alimento asignado."
          breakdown={costLedger.sheets
            .filter((row) => row.engordeFeedCost > 0)
            .map((row) => ({ key: `feed-${row.cepaId}`, name: row.label, value: formatDop(row.engordeFeedCost) }))}
        />
        <HoverStat
          label="Farmacia usada"
          value={formatDop(costLedger.sheets.reduce((sum, row) => sum + row.engordePharmacyCost, 0))}
          empty="Asigna inyecciones a estas cepas en Farmacia."
          breakdown={costLedger.sheets
            .filter((row) => row.engordePharmacyCost > 0)
            .map((row) => ({ key: `pharm-${row.cepaId}`, name: row.label, value: formatDop(row.engordePharmacyCost) }))}
        />
        <HoverStat
          label="Costo acumulado"
          value={formatDop(
            [...new Set(lots.map((item) => item.sourceCepaId))].reduce(
              (sum, id) => sum + (sheetById.get(id)?.total ?? 0),
              0,
            ),
          )}
          empty="Aún no hay costos de lote."
          breakdown={[...new Set(lots.map((item) => item.sourceCepaId))]
            .map((id) => sheetById.get(id) ?? emptyCepaCostSheet(id))
            .filter((row) => row.total > 0)
            .map((row) => ({ key: `acc-${row.cepaId}`, name: row.label, value: formatDop(row.total) }))}
        />
      </div>

      <h3 className="font-display mb-3 text-2xl">Salas</h3>
      {byRoom.length === 0 ? (
        <p className="mb-8 text-[var(--muted)]">
          Añade las salas de engorde en{' '}
          <Link className="font-semibold underline" to="/ajustes">
            Ajustes
          </Link>
          .
        </p>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {byRoom.map((row) => {
            const selected = locationFilter === row.id
            const overcrowded = row.capacity > 0 && row.pigs > row.capacity
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
                <p className="mt-2 text-sm text-[var(--muted)]">Cerdos</p>
                <p className={`font-display text-3xl ${overcrowded ? 'text-[var(--danger)]' : ''}`}>
                  {row.pigs}
                  {row.capacity > 0 ? ` / ${row.capacity}` : ''}
                </p>
                {row.capacity > 0 && (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Capacidad {row.capacity}
                    {overcrowded ? ` · ${row.pigs - row.capacity} de más` : ''}
                  </p>
                )}
                {(() => {
                  const cepaIds = [
                    ...new Set(
                      lots
                        .filter((item) => {
                          const catalog =
                            rooms.find((loc) => loc.id === item.locationId) ??
                            rooms.find(
                              (loc) => loc.name.trim().toLowerCase() === item.location.trim().toLowerCase(),
                            )
                          return (catalog?.id || item.locationId || item.location.trim()) === row.id
                        })
                        .map((item) => item.sourceCepaId),
                    ),
                  ]
                  const used = cepaIds.reduce(
                    (acc, id) => {
                      const sheet = sheetById.get(id)
                      return {
                        feed: acc.feed + (sheet?.engordeFeedCost ?? 0),
                        pharmacy: acc.pharmacy + (sheet?.engordePharmacyCost ?? 0),
                        total: acc.total + (sheet?.total ?? 0),
                      }
                    },
                    { feed: 0, pharmacy: 0, total: 0 },
                  )
                  return used.total > 0 || used.feed + used.pharmacy > 0 ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Acumulado {formatDop(used.total)}
                      {used.feed + used.pharmacy > 0
                        ? ` · engorde alimento ${formatDop(used.feed)} · farmacia ${formatDop(used.pharmacy)}`
                        : ''}
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
          Traslados, alimento e inyecciones de esta etapa.
        </p>
        <StageActionHistory rows={actionRows} />
      </div>

      <div ref={historyRef} className="surface overflow-x-auto rounded-3xl p-5">
        <h3 className="font-display text-2xl">Historial de traslados</h3>
        {lots.length === 0 ? (
          <p className="mt-3 text-[var(--muted)]">
            {state.cepas.length === 0
              ? 'Primero registra una cepa de destete.'
              : desteteWithLive
                ? 'Todavía no hay traslados a engorde.'
                : 'No quedan lechones vivos en destete para trasladar.'}
          </p>
        ) : (
          <>
            <HistoryFilterBar>
              <FilterField label="Sala">
                <select className="field" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
                  <option value="">Todas</option>
                  {rooms.map((item) => (
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
                disabled={!locationFilter && !fromDate && !toDate}
                onClick={() => {
                  setLocationFilter('')
                  setFromDate('')
                  setToDate('')
                }}
              />
            </HistoryFilterBar>
            {visibleRows.length === 0 ? (
              <p className="mt-3 text-[var(--muted)]">Ningún traslado coincide con esos filtros.</p>
            ) : (
              <table className="mt-4 w-full min-w-[860px] text-left text-sm">
                <thead className="text-xs tracking-wide text-[var(--muted)] uppercase">
                  <tr>
                    <th className="pb-2 font-semibold">Fecha</th>
                    <th className="pb-2 font-semibold">Origen destete</th>
                    <th className="pb-2 font-semibold">Sala</th>
                    <th className="pb-2 font-semibold">Cerdos</th>
                    <th className="pb-2 font-semibold">Edad al pasar</th>
                    <th className="pb-2 font-semibold">Peso</th>
                    <th className="pb-2 font-semibold">Prom. / cerdo</th>
                    <th className="pb-2 font-semibold">Acumulado</th>
                    <th className="pb-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const live = engordeLotLiveOnDate(row, deaths)
                    const dead = engordeDeathsUpTo(deaths, row.id)
                    return (
                    <tr key={row.id} className="border-t border-[var(--line)]">
                      <td className="py-3">{row.date}</td>
                      <td className="py-3">
                        {row.sourceLocation}
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">{row.sourceSupplierName}</span>
                      </td>
                      <td className="py-3">{row.location}</td>
                      <td className="py-3">
                        {live}
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">
                          {row.pigCount} trasladados
                          {dead > 0 ? ` · ${dead} muertos` : ''}
                        </span>
                      </td>
                      <td className="py-3">{formatAgeDays(row.arrivalAgeDays)}</td>
                      <td className="py-3">{formatKg(row.totalWeightKg)} kg</td>
                      <td className="py-3">{formatKg(row.avgWeightKg)} kg</td>
                      <td className="py-3">
                        {formatDop((sheetById.get(row.sourceCepaId) ?? emptyCepaCostSheet(row.sourceCepaId)).total)}
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-1">
                          <IconButton
                            label="Registrar muerte"
                            onClick={() => {
                              setEditingDeath(null)
                              setDeathLot(row)
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
                    <td className="py-3 font-semibold" colSpan={3}>
                      Total
                    </td>
                    <td className="py-3 font-semibold">{totals.pigs}</td>
                    <td className="py-3" />
                    <td className="py-3 font-semibold">{formatKg(totals.kg)} kg</td>
                    <td className="py-3" />
                    <td className="py-3" />
                    <td className="py-3" />
                  </tr>
                  <tr>
                    <td className="pb-1 text-xs text-[var(--muted)]" colSpan={9}>
                      {visibleRows.length} {visibleRows.length === 1 ? 'traslado' : 'traslados'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </>
        )}
      </div>

      {deathOpen && (
        <DeathForm
          key={`${editingDeath?.id ?? 'new'}:${deathLot?.id ?? 'none'}`}
          stage="engorde"
          cepas={state.cepas}
          lots={lots}
          deaths={deaths}
          initialLot={deathLot}
          initialDeath={editingDeath}
          onClose={() => {
            setDeathOpen(false)
            setDeathLot(null)
            setEditingDeath(null)
          }}
          onSave={(input) => (editingDeath ? updateDeath(editingDeath.id, input) : addDeath(input))}
          onEditDeath={(item) => {
            const lot = lots.find((row) => row.id === item.lotId) ?? null
            setDeathLot(lot)
            setEditingDeath(item)
          }}
          onDeleteDeath={deleteDeath}
        />
      )}

      {feedOpen && (
        <FeedUseForm
          title={editingFeedUse ? 'Editar alimentación' : 'Alimentar engorde'}
          stage="engorde"
          groups={engordeCostGroups(state.cepas, lots)}
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
            contar esos kilos.
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

      {formOpen && (
        <TransferForm
          title={editing ? 'Editar traslado' : 'Trasladar a engorde'}
          cepas={state.cepas}
          deaths={state.deaths ?? []}
          weighings={state.weighings ?? []}
          desteteRooms={desteteRooms}
          rooms={rooms}
          lots={lots}
          initial={editing}
          onClose={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          onSave={(inputs) => {
            if (editing) {
              if (inputs.length !== 1) return 'Al editar, deja los cerdos en una sola sala.'
              return updateEngordeLot(editing.id, inputs[0])
            }
            return addEngordeLots(inputs)
          }}
        />
      )}

      {removing && (
        <Modal title="Eliminar traslado" onClose={() => setRemoving(null)}>
          <p className="text-[var(--muted)]">
            ¿Quitar el traslado de {removing.pigCount} cerdos a “{removing.location}”? Vuelven a contar en destete.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => setRemoving(null)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                deleteEngordeLot(removing.id)
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

function TransferForm({
  title,
  cepas,
  deaths,
  weighings,
  desteteRooms,
  rooms,
  lots,
  initial,
  onClose,
  onSave,
}: {
  title: string
  cepas: Cepa[]
  deaths: CepaDeath[]
  weighings: CepaWeighing[]
  desteteRooms: CepaLocation[]
  rooms: CepaLocation[]
  lots: EngordeLot[]
  initial: EngordeLot | null
  onClose: () => void
  onSave: (inputs: EngordeLotInput[]) => string | null
}) {
  const transfers = engordeLotsAsMovements(lots)
  const ordered = [...cepas].sort((a, b) => b.date.localeCompare(a.date) || a.location.localeCompare(b.location, 'es'))
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const initialCepa = cepas.find((item) => item.id === initial?.sourceCepaId) ?? ordered[0] ?? null
  const [originLocationId, setOriginLocationId] = useState(initialCepa?.locationId ?? desteteRooms[0]?.id ?? '')
  const cepasInOrigin = ordered.filter((row) => (originLocationId ? row.locationId === originLocationId : true))
  const [sourceCepaId, setSourceCepaId] = useState(initial?.sourceCepaId ?? cepasInOrigin[0]?.id ?? '')
  const cepa = cepas.find((item) => item.id === sourceCepaId) ?? null
  const live = cepa ? cepaLiveOnDate(cepa, deaths, date, undefined, transfers, initial?.id) : 0
  const [placements, setPlacements] = useState(() =>
    initial
      ? [{ key: initial.id, locationId: initial.locationId, pigCount: String(initial.pigCount) }]
      : [{ key: uid(), locationId: rooms[0]?.id ?? '', pigCount: '' }],
  )
  const [totalWeight, setTotalWeight] = useState(initial ? String(initial.totalWeightKg) : '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const counts = placements.map((row) => Number.parseInt(row.pigCount, 10) || 0)
  const count = counts.reduce((sum, value) => sum + value, 0)
  const suggestedAvg = cepa ? latestCepaWeight(cepa, weighings).avgWeightKg : 0
  const suggestedKg = suggestedAvg > 0 && count > 0 ? Number((suggestedAvg * count).toFixed(2)) : 0
  const totalKg = Number(totalWeight) || 0
  const age = cepa && date ? cepaAgeOnDate(cepa, date) : null
  const overcrowdedLines = placements.flatMap((row, index) => {
    const heads = counts[index]
    if (!row.locationId || heads <= 0) return []
    const location = rooms.find((item) => item.id === row.locationId)
    if (!location?.capacity) return []
    const current = engordeLocationLiveCount(row.locationId, lots, deaths)
    const already = initial && initial.locationId === row.locationId ? engordeLotLiveOnDate(initial, deaths) : 0
    const deadOnLot = initial && initial.locationId === row.locationId ? engordeDeathsUpTo(deaths, initial.id) : 0
    const placedLive = Math.max(0, heads - deadOnLot)
    const projected = current - already + placedLive
    return projected > location.capacity
      ? [`${location.name}: ${projected} cerdos / ${location.capacity} de capacidad`]
      : []
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (desteteRooms.length === 0 || rooms.length === 0) {
      setSaved(false)
      setError('Crea la jaula de destete y la sala de engorde en Ajustes. El traslado no crea salas nuevas.')
      return
    }
    const filled = placements.filter((row) => row.locationId && (Number.parseInt(row.pigCount, 10) || 0) > 0)
    if (filled.length === 0) {
      setSaved(false)
      setError('Indica al menos una sala de engorde con cerdos.')
      return
    }
    if (filled.some((row) => row.locationId === originLocationId)) {
      setSaved(false)
      setError('La sala de destino tiene que ser distinta a la jaula de destete de origen.')
      return
    }
    const heads = filled.map((row) => Number.parseInt(row.pigCount, 10))
    const weight = totalKg > 0 ? totalKg : suggestedKg
    const parts = splitKgByHeads(weight, heads)
    const message = onSave(
      filled.map((row, index) => ({
        date,
        sourceCepaId,
        locationId: row.locationId,
        pigCount: heads[index],
        totalWeightKg: parts[index],
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
    setPlacements([{ key: uid(), locationId: rooms[0]?.id ?? '', pigCount: '' }])
    setTotalWeight('')
    setError(null)
    setSaved(true)
    afterSaveReadyForNext(e)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Fecha del traslado</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          <span className="label">Sala de origen (destete)</span>
          <select
            className="field"
            value={originLocationId}
            onChange={(e) => {
              const nextOrigin = e.target.value
              setOriginLocationId(nextOrigin)
              const nextCepa = ordered.find((row) => row.locationId === nextOrigin)
              setSourceCepaId(nextCepa?.id ?? '')
            }}
            required
            disabled={Boolean(initial)}
          >
            <option value="">Elegir jaula de destete</option>
            {desteteRooms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Cepa de destete</span>
          <select
            className="field"
            value={sourceCepaId}
            onChange={(e) => setSourceCepaId(e.target.value)}
            required
            disabled={Boolean(initial)}
          >
            {cepasInOrigin.map((row) => {
              const remaining = cepaLiveOnDate(row, deaths, date, undefined, transfers, initial?.id)
              return (
                <option key={row.id} value={row.id}>
                  {row.date} · {row.supplierName} · {remaining} vivos
                </option>
              )
            })}
          </select>
          {cepa && (
            <span className="mt-1 block text-xs text-[var(--muted)]">
              Quedan {live} en destete ese día
              {age ? ` · edad ${formatAgeDays(age.ageDays)}` : ''}.
            </span>
          )}
          {originLocationId && cepasInOrigin.length === 0 && (
            <span className="mt-1 block text-xs text-[var(--danger)]">No hay cepas en esa jaula de destete.</span>
          )}
        </label>
        <div>
          <span className="label">Sala de destino (engorde)</span>
          <p className="mb-2 text-xs text-[var(--muted)]">
            Elige una sala de engorde ya creada. Puedes repartir a varias, pero todas tienen que existir
            en Ajustes.
          </p>
          <div className="grid gap-2">
            {placements.map((row, index) => {
              const location = rooms.find((item) => item.id === row.locationId)
              const heads = counts[index]
              const current = row.locationId ? engordeLocationLiveCount(row.locationId, lots, deaths) : 0
              const already = initial && initial.locationId === row.locationId ? engordeLotLiveOnDate(initial, deaths) : 0
              const deadOnLot = initial && initial.locationId === row.locationId ? engordeDeathsUpTo(deaths, initial.id) : 0
              const placedLive = Math.max(0, heads - deadOnLot)
              const projected = current - already + placedLive
              const over = Boolean(location?.capacity && projected > location.capacity)
              return (
                <div key={row.key} className="grid gap-2 rounded-2xl border border-[var(--line)] p-3 sm:grid-cols-[1fr_8rem_auto]">
                  <select
                    className="field"
                    value={row.locationId}
                    onChange={(e) =>
                      setPlacements((rows) =>
                        rows.map((item) => (item.key === row.key ? { ...item, locationId: e.target.value } : item)),
                      )
                    }
                    required
                  >
                    <option value="">Elegir sala de engorde</option>
                    {rooms.map((item) => (
                      <option key={item.id} value={item.id} disabled={item.id === originLocationId}>
                        {item.name}
                        {item.capacity > 0 ? ` (${item.capacity})` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    step={1}
                    value={row.pigCount}
                    onChange={(e) =>
                      setPlacements((rows) =>
                        rows.map((item) => (item.key === row.key ? { ...item, pigCount: e.target.value } : item)),
                      )
                    }
                    placeholder="Cerdos"
                    required
                  />
                  {placements.length > 1 && !initial ? (
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
                  {over && location && (
                    <p className="text-xs text-[var(--clay)] sm:col-span-3">
                      Sobrepoblación en {location.name}: quedarían {projected} de {location.capacity}.
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
                setPlacements((rows) => [...rows, { key: uid(), locationId: rooms[0]?.id ?? '', pigCount: '' }])
              }
            >
              Añadir otra sala de engorde
            </button>
          )}
        </div>
        <label>
          <span className="label">Peso total al traslado (kg)</span>
          <input
            className="field"
            type="number"
            min={0.01}
            step="0.01"
            value={totalWeight}
            onChange={(e) => setTotalWeight(e.target.value)}
            placeholder={suggestedKg > 0 ? String(suggestedKg) : ''}
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Si lo dejas vacío se usa el promedio actual de destete
            {suggestedKg > 0 ? ` (${formatKg(suggestedKg)} kg)` : ''}. Si hay varias salas, se reparte por cabeza.
          </span>
        </label>
        {count > 0 && (totalKg > 0 || suggestedKg > 0) && (
          <p className="text-sm text-[var(--muted)]">
            {count} cerdos · promedio {formatKg(cepaAvgWeightKg(totalKg > 0 ? totalKg : suggestedKg, count))} kg
          </p>
        )}
        {overcrowdedLines.length > 0 && (
          <p className="text-sm text-[var(--clay)]">Aviso: {overcrowdedLines.join(' · ')} (no bloquea el guardado).</p>
        )}
        {count > live && live >= 0 && (
          <p className="text-sm text-[var(--danger)]">Estás pasando más cerdos de los {live} que quedan en destete.</p>
        )}
        {saved && <SavedNotice />}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        {desteteRooms.length === 0 && (
          <p className="text-sm text-[var(--danger)]">
            Crea al menos una jaula de destete en{' '}
            <Link className="font-semibold underline" to="/ajustes">
              Ajustes
            </Link>
            .
          </p>
        )}
        {rooms.length === 0 && (
          <p className="text-sm text-[var(--danger)]">
            Crea al menos una sala de engorde en{' '}
            <Link className="font-semibold underline" to="/ajustes">
              Ajustes
            </Link>
            . El traslado no crea salas nuevas.
          </p>
        )}
        <button
          className="btn btn-primary"
          disabled={desteteRooms.length === 0 || rooms.length === 0 || !sourceCepaId}
          type="submit"
        >
          {initial ? 'Guardar cambios' : 'Trasladar'}
        </button>
      </form>
    </Modal>
  )
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
}: {
  label: string
  value: string
  breakdown: Array<{ key: string; name: string; value: string }>
  empty: string
}) {
  return (
    <div className="group relative">
      <div className="surface cursor-default rounded-3xl p-4" tabIndex={0}>
        <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
        <p className="mt-1 font-display text-2xl">{value}</p>
      </div>
      <div className="pointer-events-none invisible absolute top-full left-0 z-20 mt-2 w-72 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-3 text-sm shadow-lg group-hover:visible group-focus-within:visible">
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
