import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import Modal from '../components/Modal'
import { usePharmacy } from '../context/PharmacyContext'
import {
  applyInjectionUse,
  costInCop,
  formatMoney,
  formatQty,
  formatUnitPrice,
  formatUsd,
  formatVolumeMl,
  injectionUseSummary,
  isVolumeUnit,
  isAlertDismissed,
  mergePurchases,
  packPriceLabel,
  pharmacyRestockAlerts,
  restockPrefill,
  type RestockPrefill,
  purchaseHistoryRows,
  purchasePackCost,
  stockAlertLevel,
  stockByMedication,
  stockFamily,
  todayIso,
  toDismissedAlert,
  totalInventoryCost,
  unitLabel,
  unitsMatch,
  usesPackageSize,
} from '../lib/calc'
import { STOCK_UNITS, type CostCurrency, type Injection, type InjectionLine, type InjectionUse, type MedicationEntry, type MedicationProfile, type MedicationPurchase, type StockUnit } from '../lib/types'

export default function PharmacyPage() {
  const {
    state,
    addEntry,
    updateEntry,
    deleteMedication,
    addInjection,
    updateInjection,
    deleteInjection,
    useInjection,
    updatePurchase,
    deletePurchase,
    updateUse,
    deleteUse,
    dismissRestockAlerts,
  } = usePharmacy()
  const [entryOpen, setEntryOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<MedicationEntry | null>(null)
  const [restocking, setRestocking] = useState<{ name: string; unit: StockUnit } | null>(null)
  const [editingPurchase, setEditingPurchase] = useState<MedicationPurchase | null>(null)
  const [editingUse, setEditingUse] = useState<InjectionUse | null>(null)
  const [injectionOpen, setInjectionOpen] = useState(false)
  const [editing, setEditing] = useState<Injection | null>(null)
  const [useOpen, setUseOpen] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<
    | { kind: 'medication'; name: string; unit: StockUnit }
    | { kind: 'injection'; id: string; name: string }
    | { kind: 'purchase'; id: string; name: string }
    | { kind: 'use'; id: string; name: string }
    | null
  >(null)

  const stock = useMemo(() => stockByMedication(state.entries), [state.entries])
  const alerts = useMemo(() => {
    return pharmacyRestockAlerts(state.entries, state.injections).filter(
      (alert) => !isAlertDismissed(state.dismissedAlerts, alert),
    )
  }, [state.entries, state.injections, state.dismissedAlerts])
  const inventoryCost = useMemo(() => totalInventoryCost(state.entries), [state.entries])
  const purchaseRows = useMemo(
    () => purchaseHistoryRows(mergePurchases(state.purchases, state.entries)),
    [state.purchases, state.entries],
  )
  const usage = useMemo(
    () => injectionUseSummary(state.uses, state.injections),
    [state.uses, state.injections],
  )
  const knownMeds = useMemo(() => {
    const map = new Map<string, { name: string; unit: StockUnit }>()
    for (const entry of state.entries) {
      const name = entry.name.trim()
      map.set(`${name}|${stockFamily(entry.unit)}`, {
        name,
        unit: isVolumeUnit(entry.unit) ? 'ml' : entry.unit,
      })
    }
    for (const injection of state.injections) {
      for (const line of injection.lines) {
        const name = line.medicationName.trim()
        if (!name) continue
        map.set(`${name}|${stockFamily(line.unit)}`, {
          name,
          unit: isVolumeUnit(line.unit) ? 'ml' : line.unit,
        })
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es') || a.unit.localeCompare(b.unit))
  }, [state.entries, state.injections])

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="chip mb-3">Inventario</p>
          <h2 className="font-display text-4xl">Farmacia</h2>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Elige cómo llegó el medicamento (inyectable, sobres, litros, pastillas) y, al armar una
            inyección, reparte la dosis en la misma unidad.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" type="button" onClick={() => setEntryOpen(true)}>
            Añadir medicamento
          </button>
          <button className="btn btn-primary" type="button" onClick={() => setInjectionOpen(true)}>
            Añadir inyección
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="mb-6 rounded-3xl border border-[var(--clay)] bg-[var(--clay-soft)] p-4">
          <p className="text-xs font-semibold tracking-wide text-[var(--clay)] uppercase">Alertas de inventario</p>
          <ul className="mt-2 grid gap-2">
            {alerts.map((alert) => (
              <li
                key={`${alert.name}|${alert.unit}|${alert.level}`}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>{alert.message}</span>
                <button
                  className="btn btn-ghost shrink-0"
                  type="button"
                  onClick={() => dismissRestockAlerts([toDismissedAlert(alert)])}
                >
                  Entendido
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Medicamentos disponibles" value={String(stock.length)} />
        <Stat label="Costo en inventario" value={formatMoney(inventoryCost)} />
        <HoverStat
          label="Inyecciones utilizadas"
          value={String(usage.totalDoses)}
          breakdown={usage.breakdown}
        />
      </div>

      <h3 className="font-display mb-3 text-2xl">Stock actual</h3>
      {stock.length === 0 ? (
        <p className="mb-8 text-[var(--muted)]">Aún no hay medicamentos en inventario.</p>
      ) : (
        <div className="mb-8 grid gap-3 md:grid-cols-2">
          {stock.map((row) => {
            const latest = state.entries.find(
              (entry) => entry.name.trim() === row.name && unitsMatch(entry.unit, row.unit),
            )
            const level = stockAlertLevel(row)
            return (
            <article key={`${row.name}|${row.unit}`} className="surface rounded-3xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-display text-2xl">{row.name}</h4>
                    {level === 'empty' && (
                      <button
                        className="rounded-full bg-[var(--clay-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--clay)]"
                        type="button"
                        onClick={() => setRestocking({ name: row.name, unit: row.unit })}
                      >
                        Comprar más
                      </button>
                    )}
                    {level === 'low' && (
                      <button
                        className="rounded-full bg-[var(--clay-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--clay)]"
                        type="button"
                        onClick={() => setRestocking({ name: row.name, unit: row.unit })}
                      >
                        Reponer
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {isVolumeUnit(row.unit) ? formatVolumeMl(row.remaining) : formatQty(row.remaining, row.unit)} ·{' '}
                    {formatMoney(row.inventoryCost)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {latest && (
                    <IconButton label="Editar" onClick={() => setEditingEntry(latest)}>
                      <PencilIcon />
                    </IconButton>
                  )}
                  <IconButton
                    label="Eliminar"
                    onClick={() => setConfirm({ kind: 'medication', name: row.name, unit: row.unit })}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </div>
            </article>
            )
          })}
        </div>
      )}

      <h3 className="font-display mb-3 text-2xl">Historial de compras</h3>
      {purchaseRows.length === 0 ? (
        <p className="mb-8 text-[var(--muted)]">Cuando registres una compra, aparecerá aquí.</p>
      ) : (
        <div className="mb-8 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="pb-2 font-semibold">Fecha</th>
                <th className="pb-2 font-semibold">Medicamento</th>
                <th className="pb-2 font-semibold">Cantidad</th>
                <th className="pb-2 font-semibold">Costo</th>
                <th className="pb-2 font-semibold">Precio por envase</th>
                <th className="pb-2 font-semibold">Precio por unidad</th>
                <th className="pb-2 font-semibold">Cambio</th>
                <th className="pb-2 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {purchaseRows.map((row) => (
                <tr key={row.purchase.id} className="border-t border-[var(--line)]">
                  <td className="py-2">{row.purchase.date}</td>
                  <td className="py-2">{row.purchase.name}</td>
                  <td className="py-2">
                    {entryPresentation(row.purchase.quantity, row.purchase.size, row.purchase.unit)}
                  </td>
                  <td className="py-2">
                    <span>{formatMoney(row.purchase.cost)}</span>
                    {row.purchase.costCurrency === 'USD' && row.purchase.usdAmount != null && row.purchase.usdRate ? (
                      <span className="mt-0.5 block text-xs text-[var(--muted)]">
                        {formatUsd(row.purchase.usdAmount)} · tasa {formatMoney(row.purchase.usdRate)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2">
                    {formatMoney(purchasePackCost(row.purchase))} / {packPriceLabel(row.purchase.unit)}
                  </td>
                  <td className="py-2">
                    {formatUnitPrice(row.unitCost)} / {unitLabel(row.displayUnit)}
                  </td>
                  <td className={`py-2 ${priceChangeClass(row.change)}`}>
                    {priceChangeLabel(row.change, row.changePct)}
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-1">
                      <IconButton
                        label="Editar"
                        onClick={() => {
                          const entry = row.purchase.entryId
                            ? state.entries.find((item) => item.id === row.purchase.entryId)
                            : undefined
                          if (entry) setEditingEntry(entry)
                          else setEditingPurchase(row.purchase)
                        }}
                      >
                        <PencilIcon />
                      </IconButton>
                      <IconButton
                        label="Eliminar"
                        onClick={() =>
                          setConfirm({ kind: 'purchase', id: row.purchase.id, name: row.purchase.name })
                        }
                      >
                        <TrashIcon />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="font-display mb-3 text-2xl">Inyecciones</h3>
      {state.injections.length === 0 ? (
        <p className="mb-8 text-[var(--muted)]">Añade una inyección para descontar medicamentos al usarla.</p>
      ) : (
        <div className="mb-8 grid gap-3">
          {state.injections.map((injection) => {
            const preview = applyInjectionUse(state.entries, injection, 1)
            const usesOf = state.uses.filter((item) => item.injectionId === injection.id)
            const lastUse = usesOf[0]
            const spent = usesOf.reduce((n, item) => n + (item.cost ?? 0), 0)
            return (
            <article key={injection.id} className="surface rounded-3xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-display text-2xl">{injection.name}</h4>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {injection.lines
                      .map((line) => `${formatQty(line.amount, line.unit)} de ${line.medicationName}`)
                      .join(' · ')}
                  </p>
                  <p className="mt-2 text-sm">
                    {preview.ok
                      ? `Costo por dosis: ${formatMoney(preview.cost)}`
                      : 'Sin stock suficiente para calcular el costo'}
                  </p>
                  {lastUse && (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Último uso: {lastUse.doses} dosis
                      {lastUse.cost > 0 ? ` · ${formatMoney(lastUse.cost)}` : ''}
                      {spent > 0 ? ` · Acumulado ${formatMoney(spent)}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1">
                  <IconButton label="Editar" onClick={() => setEditing(injection)}>
                    <PencilIcon />
                  </IconButton>
                  <button className="btn btn-ghost" type="button" onClick={() => setUseOpen(injection.id)}>
                    Registrar uso
                  </button>
                  <IconButton
                    label="Eliminar"
                    onClick={() => setConfirm({ kind: 'injection', id: injection.id, name: injection.name })}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </div>
            </article>
            )
          })}
        </div>
      )}

      <h3 className="font-display mb-3 text-2xl">Historial de inyecciones</h3>
      {state.uses.length === 0 ? (
        <p className="text-[var(--muted)]">Cuando registres un uso, aparecerá aquí.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-[var(--muted)]">
                <th className="pb-2 font-semibold">Fecha</th>
                <th className="pb-2 font-semibold">Inyección</th>
                <th className="pb-2 font-semibold">Dosis</th>
                <th className="pb-2 font-semibold">Costo</th>
                <th className="pb-2 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {state.uses.map((use) => {
                const injection = state.injections.find((item) => item.id === use.injectionId)
                const useName = injection?.name ?? 'Inyección eliminada'
                return (
                  <tr key={use.id} className="border-t border-[var(--line)]">
                    <td className="py-2">{use.date}</td>
                    <td className="py-2">{useName}</td>
                    <td className="py-2">{use.doses}</td>
                    <td className="py-2">{use.cost > 0 ? formatMoney(use.cost) : '—'}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1">
                        <IconButton label="Editar" onClick={() => setEditingUse(use)}>
                          <PencilIcon />
                        </IconButton>
                        <IconButton
                          label="Eliminar"
                          onClick={() => setConfirm({ kind: 'use', id: use.id, name: useName })}
                        >
                          <TrashIcon />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(entryOpen || editingEntry || editingPurchase || restocking) && (
        <EntryModal
          title={
            editingEntry || editingPurchase
              ? 'Editar medicamento'
              : restocking
                ? 'Reponer medicamento'
                : 'Añadir medicamento'
          }
          initial={editingEntry ?? (editingPurchase ? purchaseAsEntry(editingPurchase) : undefined)}
          prefill={
            restocking
              ? restockPrefill(
                  restocking.name,
                  restocking.unit,
                  state.catalog ?? [],
                  state.purchases ?? [],
                  state.lastUsdRate,
                )
              : undefined
          }
          catalog={state.catalog ?? []}
          lastUsdRate={state.lastUsdRate}
          onClose={() => {
            setEntryOpen(false)
            setEditingEntry(null)
            setEditingPurchase(null)
            setRestocking(null)
          }}
          onSave={(payload) => {
            const message = editingEntry
              ? updateEntry(editingEntry.id, payload)
              : editingPurchase
                ? updatePurchase(editingPurchase.id, payload)
                : addEntry(payload)
            if (message) return message
            setEntryOpen(false)
            setEditingEntry(null)
            setEditingPurchase(null)
            setRestocking(null)
            return null
          }}
        />
      )}

      {(injectionOpen || editing) && (
        <InjectionModal
          title={editing ? 'Editar inyección' : 'Añadir inyección'}
          knownMeds={knownMeds}
          initialName={editing?.name ?? ''}
          initialLines={editing?.lines}
          onClose={() => {
            setInjectionOpen(false)
            setEditing(null)
          }}
          onSave={(injectionName, lines) => {
            const message = editing
              ? updateInjection(editing.id, injectionName, lines)
              : addInjection(injectionName, lines)
            if (message) return message
            setInjectionOpen(false)
            setEditing(null)
            return null
          }}
        />
      )}

      {useOpen && (
        <UseModal
          injection={state.injections.find((item) => item.id === useOpen)}
          entries={state.entries}
          onClose={() => setUseOpen(null)}
          onSave={(doses, useDate) => {
            const message = useInjection(useOpen, doses, useDate)
            if (message) return message
            setUseOpen(null)
            return null
          }}
        />
      )}

      {editingUse && (
        <EditUseModal
          initial={editingUse}
          injectionName={
            state.injections.find((item) => item.id === editingUse.injectionId)?.name ?? 'Inyección eliminada'
          }
          onClose={() => setEditingUse(null)}
          onSave={(doses, useDate) => {
            const message = updateUse(editingUse.id, useDate, doses)
            if (message) return message
            setEditingUse(null)
            return null
          }}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={
            confirm.kind === 'injection'
              ? 'Eliminar inyección'
              : confirm.kind === 'purchase'
                ? 'Eliminar compra'
                : confirm.kind === 'use'
                  ? 'Eliminar uso'
                  : 'Eliminar medicamento'
          }
          message={
            confirm.kind === 'injection'
              ? `¿Eliminar “${confirm.name}”? El historial de usos se conserva.`
              : confirm.kind === 'purchase'
                ? `¿Eliminar esta compra de “${confirm.name}”? Si todavía hay stock de esa entrada, también se quita.`
                : confirm.kind === 'use'
                  ? `¿Eliminar este uso de “${confirm.name}” del historial? El stock ya descontado no se devuelve.`
                  : `¿Eliminar “${confirm.name}” del inventario? Se borrarán todas sus entradas. El historial de compras se conserva.`
          }
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            if (confirm.kind === 'medication') deleteMedication(confirm.name, confirm.unit)
            if (confirm.kind === 'injection') deleteInjection(confirm.id)
            if (confirm.kind === 'purchase') deletePurchase(confirm.id)
            if (confirm.kind === 'use') deleteUse(confirm.id)
            setConfirm(null)
          }}
        />
      )}
    </section>
  )
}

function purchaseAsEntry(purchase: MedicationPurchase): MedicationEntry {
  return {
    id: purchase.id,
    name: purchase.name,
    date: purchase.date,
    quantity: purchase.quantity,
    size: purchase.size,
    unit: purchase.unit,
    cost: purchase.cost,
    remaining: 0,
    costCurrency: purchase.costCurrency ?? 'COP',
    usdAmount: purchase.usdAmount,
    usdRate: purchase.usdRate,
  }
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

function entryPresentation(quantity: number, size: number, unit: StockUnit): string {
  if (usesPackageSize(unit)) {
    const packs = quantity === 1 ? 'envase' : 'envases'
    return `${quantity} ${packs} de ${size} ${unitLabel(unit)}`
  }
  return formatQty(quantity, unit)
}

function priceChangeLabel(change: 'first' | 'up' | 'down' | 'same', changePct: number): string {
  if (change === 'first') return 'Primera compra'
  if (change === 'same') return 'Mismo precio'
  const pct = Math.abs(changePct).toFixed(0)
  return change === 'up' ? `Subió ${pct}%` : `Bajó ${pct}%`
}

function priceChangeClass(change: 'first' | 'up' | 'down' | 'same'): string {
  if (change === 'up') return 'text-[var(--danger)]'
  if (change === 'down') return 'text-[var(--ok)]'
  return 'text-[var(--muted)]'
}

function quantityLabel(unit: StockUnit): string {
  if (unit === 'sobre') return 'Cuántos sobres llegaron'
  if (unit === 'pastilla') return 'Cuántas pastillas llegaron'
  if (unit === 'kg') return 'Cuántos kilogramos llegaron'
  return 'Cuántos envases llegaron'
}

function sizeLabel(unit: StockUnit): string {
  if (unit === 'litro') return 'Litros por envase'
  if (unit === 'cc') return 'cc por envase'
  return 'ml por envase'
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface rounded-2xl p-4">
      <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
    </div>
  )
}

function HoverStat({
  label,
  value,
  breakdown,
}: {
  label: string
  value: string
  breakdown: Array<{ name: string; doses: number; cost: number }>
}) {
  return (
    <div className="group relative">
      <div className="surface cursor-default rounded-2xl p-4">
        <p className="text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">{label}</p>
        <p className="font-display mt-1 text-2xl">{value}</p>
      </div>
      <div className="pointer-events-none invisible absolute top-full right-0 z-20 mt-2 w-72 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-3 text-sm shadow-lg group-hover:visible">
        {breakdown.length === 0 ? (
          <p className="text-[var(--muted)]">Aún no se ha usado ninguna inyección.</p>
        ) : (
          <ul className="grid gap-1">
            {breakdown.map((row) => (
              <li key={row.name} className="flex justify-between gap-2">
                <span>{row.name}</span>
                <strong>
                  {row.doses} dosis
                  {row.cost > 0 ? ` · ${formatMoney(row.cost)}` : ''}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function catalogOptionLabel(profile: MedicationProfile): string {
  const kind = STOCK_UNITS.find((item) => item.value === profile.unit)?.label ?? profile.unit
  if (usesPackageSize(profile.unit)) return `${profile.name} · ${kind} · ${profile.size} ${unitLabel(profile.unit)}`
  return `${profile.name} · ${kind}`
}

function EntryModal({
  title,
  initial,
  prefill,
  catalog,
  lastUsdRate,
  onClose,
  onSave,
}: {
  title: string
  initial?: MedicationEntry
  prefill?: RestockPrefill
  catalog: MedicationProfile[]
  lastUsdRate?: number
  onClose: () => void
  onSave: (payload: {
    name: string
    date: string
    quantity: number
    size: number
    unit: StockUnit
    cost: number
    costCurrency: CostCurrency
    usdAmount?: number
    usdRate?: number
  }) => string | null
}) {
  const seed = initial ?? prefill
  const [picked, setPicked] = useState(prefill?.catalogKey ?? '')
  const [name, setName] = useState(seed?.name ?? '')
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [quantity, setQuantity] = useState(seed ? String(seed.quantity) : '')
  const [size, setSize] = useState(seed && usesPackageSize(seed.unit) ? String(seed.size) : '')
  const [unit, setUnit] = useState<StockUnit>(seed?.unit ?? 'ml')
  const [cost, setCost] = useState(seed && seed.costCurrency !== 'USD' ? String(seed.cost) : '')
  const [costCurrency, setCostCurrency] = useState<CostCurrency>(seed?.costCurrency ?? 'COP')
  const [usdAmount, setUsdAmount] = useState(
    seed?.costCurrency === 'USD' && seed.usdAmount != null ? String(seed.usdAmount) : '',
  )
  const [usdRate, setUsdRate] = useState(
    seed?.costCurrency === 'USD' && seed.usdRate
      ? String(seed.usdRate)
      : lastUsdRate
        ? String(lastUsdRate)
        : '',
  )
  const [error, setError] = useState<string | null>(null)
  const selected = STOCK_UNITS.find((item) => item.value === unit)
  const needsSize = usesPackageSize(unit)
  const isNewEntry = !initial
  const qty = Number(quantity)
  const copTotal = costInCop({
    cost: Number(cost) || 0,
    costCurrency,
    usdAmount: Number(usdAmount) || 0,
    usdRate: Number(usdRate) || 0,
  })
  const packCost = qty > 0 && copTotal > 0 ? copTotal / qty : 0

  function applyProfile(key: string) {
    setPicked(key)
    if (!key) return
    const profile = catalog.find((item) => `${item.name}|${item.unit}` === key)
    if (!profile) return
    setName(profile.name)
    setUnit(profile.unit)
    setSize(usesPackageSize(profile.unit) ? String(profile.size) : '')
    setQuantity(String(profile.lastQuantity))
    if (costCurrency === 'COP') setCost(String(profile.lastCost))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const message = onSave({
      name,
      date,
      quantity: Number(quantity),
      size: needsSize ? Number(size) : 1,
      unit,
      cost: Number(cost),
      costCurrency,
      usdAmount: costCurrency === 'USD' ? Number(usdAmount) : undefined,
      usdRate: costCurrency === 'USD' ? Number(usdRate) : undefined,
    })
    if (message) setError(message)
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        {isNewEntry && catalog.length > 0 && (
          <label>
            <span className="label">Ya comprado</span>
            <select className="field" value={picked} onChange={(e) => applyProfile(e.target.value)}>
              <option value="">Nuevo medicamento</option>
              {catalog.map((item) => (
                <option key={`${item.name}|${item.unit}`} value={`${item.name}|${item.unit}`}>
                  {catalogOptionLabel(item)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Elige uno para rellenar nombre, presentación y el último precio. Solo ajusta cantidad, fecha o costo si
              cambió.
            </p>
          </label>
        )}
        <label>
          <span className="label">Medicamento</span>
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del medicamento que llegó"
            required
          />
        </label>
        <label>
          <span className="label">Fecha</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          <span className="label">Cómo llega</span>
          <select className="field" value={unit} onChange={(e) => setUnit(e.target.value as StockUnit)}>
            {STOCK_UNITS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          {selected && <p className="mt-1 text-xs text-[var(--muted)]">{selected.hint}</p>}
        </label>
        <label>
          <span className="label">{quantityLabel(unit)}</span>
          <input
            className="field"
            type="number"
            min={0.01}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>
        {needsSize && (
          <label>
            <span className="label">{sizeLabel(unit)}</span>
            <input
              className="field"
              type="number"
              min={0.01}
              step="any"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder={unit === 'litro' ? 'Ej. 1 o 5' : 'Ej. 100'}
              required
            />
          </label>
        )}
        <label>
          <span className="label">Moneda</span>
          <select
            className="field"
            value={costCurrency}
            onChange={(e) => setCostCurrency(e.target.value as CostCurrency)}
          >
            <option value="COP">Pesos</option>
            <option value="USD">Dólares</option>
          </select>
        </label>
        {costCurrency === 'USD' ? (
          <>
            <label>
              <span className="label">Costo en dólares</span>
              <input
                className="field"
                type="number"
                min={0}
                step="any"
                value={usdAmount}
                onChange={(e) => setUsdAmount(e.target.value)}
                placeholder="Precio en USD"
                required
              />
            </label>
            <label>
              <span className="label">Tasa del dólar (pesos por 1 USD)</span>
              <input
                className="field"
                type="number"
                min={0.01}
                step="any"
                value={usdRate}
                onChange={(e) => setUsdRate(e.target.value)}
                placeholder="Ej. 4100"
                required
              />
            </label>
          </>
        ) : (
          <label>
            <span className="label">Costo</span>
            <input
              className="field"
              type="number"
              min={0}
              step="any"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="Precio de esta entrada"
              required
            />
          </label>
        )}
        {copTotal > 0 && (
          <p className="text-sm text-[var(--muted)]">
            En pesos: {formatMoney(copTotal)}
            {packCost > 0 ? ` · ${formatMoney(packCost)} por ${packPriceLabel(unit)}` : ''}
          </p>
        )}
        {isNewEntry && catalog.length === 0 && (
          <p className="text-xs text-[var(--muted)]">
            La primera vez se guarda el nombre, cómo llega y el tamaño. En la próxima compra solo eliges el
            medicamento.
          </p>
        )}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit">
          {initial ? 'Guardar cambios' : prefill ? 'Reponer medicamento' : 'Añadir medicamento'}
        </button>
      </form>
    </Modal>
  )
}

function InjectionModal({
  title,
  knownMeds,
  initialName = '',
  initialLines,
  onClose,
  onSave,
}: {
  title: string
  knownMeds: Array<{ name: string; unit: StockUnit }>
  initialName?: string
  initialLines?: InjectionLine[]
  onClose: () => void
  onSave: (name: string, lines: InjectionLine[]) => string | null
}) {
  const emptyLine = (): InjectionLine => ({
    medicationName: knownMeds[0]?.name ?? '',
    amount: 0,
    unit: knownMeds[0]?.unit ?? 'ml',
  })
  const [name, setName] = useState(initialName)
  const [lines, setLines] = useState<InjectionLine[]>(
    initialLines && initialLines.length > 0 ? initialLines : [emptyLine()],
  )
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const message = onSave(name, lines)
    if (message) setError(message)
  }

  function setLine(index: number, patch: Partial<InjectionLine>) {
    setLines((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Nombre de la inyección</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <p className="text-sm text-[var(--muted)]">
          La dosis puede ir en ml aunque el medicamento haya llegado en litros: 1 ml descuenta 1 ml de
          1 litro (1000 ml).
        </p>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_auto_7rem]">
            <label>
              <span className="label">Medicamento</span>
              {knownMeds.length > 0 ? (
                <select
                  className="field"
                  value={`${line.medicationName}|${stockFamily(line.unit)}`}
                  onChange={(e) => {
                    const sep = e.target.value.lastIndexOf('|')
                    const medName = e.target.value.slice(0, sep)
                    const family = e.target.value.slice(sep + 1)
                    const med = knownMeds.find(
                      (item) => item.name === medName && stockFamily(item.unit) === family,
                    )
                    setLine(index, {
                      medicationName: medName,
                      unit: med?.unit ?? (family === 'volume' ? 'ml' : (family as StockUnit)),
                    })
                  }}
                >
                  {knownMeds.map((med) => (
                    <option
                      key={`${med.name}|${stockFamily(med.unit)}`}
                      value={`${med.name}|${stockFamily(med.unit)}`}
                    >
                      {med.name}
                      {isVolumeUnit(med.unit) ? ' (ml / litros)' : ` (${unitLabel(med.unit, true)})`}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="field"
                  value={line.medicationName}
                  onChange={(e) => setLine(index, { medicationName: e.target.value })}
                  placeholder="Nombre del medicamento"
                />
              )}
            </label>
            <label>
              <span className="label">Cantidad por dosis</span>
              <input
                className="field"
                type="number"
                min={0.01}
                step="any"
                value={line.amount || ''}
                onChange={(e) => setLine(index, { amount: Number(e.target.value) })}
                required
              />
            </label>
            <label>
              <span className="label">Unidad</span>
              <select
                className="field"
                value={line.unit}
                onChange={(e) => setLine(index, { unit: e.target.value as StockUnit })}
              >
                {STOCK_UNITS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {unitLabel(item.value, true)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
        <button className="btn btn-ghost w-fit" type="button" onClick={() => setLines((rows) => [...rows, emptyLine()])}>
          Añadir otro medicamento
        </button>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit">
          Guardar inyección
        </button>
      </form>
    </Modal>
  )
}

function UseModal({
  injection,
  entries,
  onClose,
  onSave,
}: {
  injection?: Injection
  entries: MedicationEntry[]
  onClose: () => void
  onSave: (doses: number, date: string) => string | null
}) {
  const [doses, setDoses] = useState(1)
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState<string | null>(null)
  const preview = injection ? applyInjectionUse(entries, injection, doses) : { ok: false, cost: 0 }

  function submit(e: FormEvent) {
    e.preventDefault()
    const message = onSave(doses, date)
    if (message) setError(message)
  }

  return (
    <Modal title="Registrar uso" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <label>
          <span className="label">Fecha</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          <span className="label">Dosis usadas</span>
          <input
            className="field"
            type="number"
            min={1}
            value={doses}
            onChange={(e) => setDoses(Number(e.target.value))}
          />
        </label>
        <p className="text-sm text-[var(--muted)]">
          {preview.ok
            ? `Esta vez costará ${formatMoney(preview.cost)}`
            : 'No hay stock suficiente para calcular el costo'}
        </p>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit">
          Descontar del inventario
        </button>
      </form>
    </Modal>
  )
}

function EditUseModal({
  initial,
  injectionName,
  onClose,
  onSave,
}: {
  initial: InjectionUse
  injectionName: string
  onClose: () => void
  onSave: (doses: number, date: string) => string | null
}) {
  const [doses, setDoses] = useState(initial.doses)
  const [date, setDate] = useState(initial.date)
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const message = onSave(doses, date)
    if (message) setError(message)
  }

  return (
    <Modal title="Editar uso" onClose={onClose}>
      <form className="grid gap-3" onSubmit={submit}>
        <p className="text-sm text-[var(--muted)]">{injectionName}</p>
        <label>
          <span className="label">Fecha</span>
          <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label>
          <span className="label">Dosis usadas</span>
          <input
            className="field"
            type="number"
            min={1}
            value={doses}
            onChange={(e) => setDoses(Number(e.target.value))}
          />
        </label>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button className="btn btn-primary" type="submit">
          Guardar cambios
        </button>
      </form>
    </Modal>
  )
}

function ConfirmModal({
  title,
  message,
  onClose,
  onConfirm,
}: {
  title: string
  message: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-[var(--muted)]">{message}</p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn btn-primary" type="button" onClick={onConfirm}>
          Eliminar
        </button>
      </div>
    </Modal>
  )
}
