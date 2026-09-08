import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyInjectionUse, costInCop, entryStockAmount, normalizeName, remainingAfterEdit, uid, unitLabel, unitsMatch, upsertCatalog, upsertPurchaseForEntry, usesPackageSize } from '../lib/calc'
import { loadPharmacy, savePharmacy } from '../lib/storage'
import type { CostCurrency, DismissedAlert, FarmStage, Injection, InjectionLine, InjectionUseAllocation, MedicationEntry, PharmacyState, StockUnit } from '../lib/types'

export type NewEntryInput = {
  name: string
  date: string
  quantity: number
  size: number
  unit: StockUnit
  cost: number
  costCurrency: CostCurrency
  usdAmount?: number
  usdRate?: number
}

type PharmacyContextValue = {
  state: PharmacyState
  addEntry: (input: NewEntryInput) => string | null
  updateEntry: (id: string, input: NewEntryInput) => string | null
  deleteEntry: (id: string) => void
  deleteMedication: (name: string, unit: StockUnit) => void
  addInjection: (name: string, lines: InjectionLine[]) => string | null
  updateInjection: (id: string, name: string, lines: InjectionLine[]) => string | null
  deleteInjection: (id: string) => void
  useInjection: (
    injectionId: string,
    doses: number,
    date: string,
    stage: FarmStage,
    allocations?: InjectionUseAllocation[] | null,
  ) => string | null
  updatePurchase: (id: string, input: NewEntryInput) => string | null
  deletePurchase: (id: string) => void
  updateUse: (
    id: string,
    date: string,
    doses: number,
    stage: FarmStage,
    allocations?: InjectionUseAllocation[] | null,
  ) => string | null
  deleteUse: (id: string) => void
  dismissRestockAlerts: (items: DismissedAlert[]) => void
}

function parseAllocations(
  allocations: InjectionUseAllocation[] | null | undefined,
  doses: number,
): InjectionUseAllocation[] | string {
  if (allocations == null) return []
  const filled = allocations.filter((item) => item.locationId && item.doses > 0)
  if (filled.length === 0) return []
  const ids = filled.map((item) => item.locationId)
  if (new Set(ids).size !== ids.length) {
    return 'No repitas la misma jaula. Junta esas cantidades en una sola línea.'
  }
  for (const item of filled) {
    if (!Number.isInteger(item.doses) || item.doses <= 0) {
      return 'La cantidad de cada jaula debe ser un número entero mayor a 0.'
    }
    if (!item.location.trim()) return 'Elige una jaula de la lista.'
  }
  const sum = filled.reduce((total, item) => total + item.doses, 0)
  if (sum !== doses) {
    return `Las cantidades de las jaulas deben sumar ${doses} dosis.`
  }
  return filled
}

const PharmacyContext = createContext<PharmacyContextValue | null>(null)

function parseEntry(input: NewEntryInput) {
  const name = input.name.trim()
  if (!name) return 'Indica el nombre del medicamento.'
  if (!input.date) return 'Indica la fecha de entrada.'
  if (input.quantity <= 0) return 'La cantidad debe ser mayor a 0.'
  const size = usesPackageSize(input.unit) ? input.size : 1
  if (usesPackageSize(input.unit) && size <= 0) return 'Indica el tamaño de cada envase.'
  const costCurrency = input.costCurrency ?? 'COP'
  let cost = input.cost
  let usdAmount: number | undefined
  let usdRate: number | undefined
  if (costCurrency === 'USD') {
    if ((input.usdAmount ?? 0) < 0) return 'El costo en dólares no puede ser negativo.'
    if (!input.usdRate || input.usdRate <= 0) return 'Indica la tasa del dólar.'
    usdAmount = input.usdAmount ?? 0
    usdRate = input.usdRate
    cost = costInCop({ cost: 0, costCurrency: 'USD', usdAmount, usdRate })
  } else if (cost < 0) {
    return 'El costo no puede ser negativo.'
  }
  return {
    name,
    date: input.date,
    quantity: input.quantity,
    size,
    unit: input.unit,
    cost,
    costCurrency,
    usdAmount,
    usdRate,
    total: entryStockAmount(input.quantity, size, input.unit),
  }
}

function validLines(lines: InjectionLine[]): InjectionLine[] | string {
  const valid = lines
    .map((line) => ({
      medicationName: line.medicationName.trim(),
      amount: line.amount,
      unit: line.unit,
    }))
    .filter((line) => line.medicationName && line.amount > 0)
  if (valid.length === 0) return 'Agrega al menos un medicamento con cantidad.'
  return valid
}

export function PharmacyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PharmacyState>(loadPharmacy)

  useEffect(() => {
    savePharmacy(state)
  }, [state])

  const addEntry = useCallback((input: NewEntryInput): string | null => {
    const parsed = parseEntry(input)
    if (typeof parsed === 'string') return parsed
    const entry: MedicationEntry = {
      id: uid(),
      name: parsed.name,
      date: parsed.date,
      quantity: parsed.quantity,
      size: parsed.size,
      unit: parsed.unit,
      cost: parsed.cost,
      remaining: parsed.total,
      costCurrency: parsed.costCurrency,
      usdAmount: parsed.usdAmount,
      usdRate: parsed.usdRate,
    }
    setState((s) => ({
      ...s,
      entries: [entry, ...s.entries],
      catalog: upsertCatalog(s.catalog ?? [], {
        name: parsed.name,
        unit: parsed.unit,
        size: parsed.size,
        lastQuantity: parsed.quantity,
        lastCost: parsed.cost,
      }),
      purchases: upsertPurchaseForEntry(s.purchases, entry),
      lastUsdRate: parsed.costCurrency === 'USD' ? parsed.usdRate : s.lastUsdRate,
    }))
    return null
  }, [])

  const updateEntry = useCallback((id: string, input: NewEntryInput): string | null => {
    const parsed = parseEntry(input)
    if (typeof parsed === 'string') return parsed
    const current = state.entries.find((entry) => entry.id === id)
    if (!current) return 'No se encontró el medicamento.'
    const remaining = Number(
      remainingAfterEdit(current, {
        quantity: parsed.quantity,
        size: parsed.size,
        unit: parsed.unit,
      }).toFixed(6),
    )
    setState((s) => {
      const entries = s.entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              name: parsed.name,
              date: parsed.date,
              quantity: parsed.quantity,
              size: parsed.size,
              unit: parsed.unit,
              cost: parsed.cost,
              remaining,
              costCurrency: parsed.costCurrency,
              usdAmount: parsed.usdAmount,
              usdRate: parsed.usdRate,
            }
          : entry,
      )
      const updated = entries.find((entry) => entry.id === id)
      return {
        ...s,
        entries,
        catalog: upsertCatalog(s.catalog ?? [], {
          name: parsed.name,
          unit: parsed.unit,
          size: parsed.size,
          lastQuantity: parsed.quantity,
          lastCost: parsed.cost,
        }),
        purchases: updated ? upsertPurchaseForEntry(s.purchases, updated) : s.purchases,
        lastUsdRate: parsed.costCurrency === 'USD' ? parsed.usdRate : s.lastUsdRate,
      }
    })
    return null
  }, [state.entries])

  const deleteEntry = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      entries: s.entries.filter((entry) => entry.id !== id),
      purchases: (s.purchases ?? []).map((item) =>
        item.entryId === id ? { ...item, entryId: undefined } : item,
      ),
    }))
  }, [])

  const deleteMedication = useCallback((name: string, unit: StockUnit) => {
    setState((s) => {
      const removed = new Set(
        s.entries
          .filter(
            (entry) =>
              normalizeName(entry.name) === normalizeName(name) && unitsMatch(entry.unit, unit),
          )
          .map((entry) => entry.id),
      )
      return {
        ...s,
        entries: s.entries.filter((entry) => !removed.has(entry.id)),
        purchases: (s.purchases ?? []).map((item) =>
          item.entryId && removed.has(item.entryId) ? { ...item, entryId: undefined } : item,
        ),
      }
    })
  }, [])

  const addInjection = useCallback((name: string, lines: InjectionLine[]): string | null => {
    const trimmed = name.trim()
    if (!trimmed) return 'Indica el nombre de la inyección.'
    const valid = validLines(lines)
    if (typeof valid === 'string') return valid
    const injection: Injection = { id: uid(), name: trimmed, lines: valid }
    setState((s) => ({ ...s, injections: [...s.injections, injection] }))
    return null
  }, [])

  const updateInjection = useCallback((id: string, name: string, lines: InjectionLine[]): string | null => {
    const trimmed = name.trim()
    if (!trimmed) return 'Indica el nombre de la inyección.'
    const valid = validLines(lines)
    if (typeof valid === 'string') return valid
    setState((s) => ({
      ...s,
      injections: s.injections.map((item) =>
        item.id === id ? { ...item, name: trimmed, lines: valid } : item,
      ),
    }))
    return null
  }, [])

  const deleteInjection = useCallback((id: string) => {
    setState((s) => {
      const name = s.injections.find((item) => item.id === id)?.name.trim() ?? ''
      return {
        ...s,
        injections: s.injections.filter((item) => item.id !== id),
        uses: name
          ? s.uses.map((use) =>
              use.injectionId === id && !use.injectionName ? { ...use, injectionName: name } : use,
            )
          : s.uses,
      }
    })
  }, [])

  const useInjection = useCallback(
    (
      injectionId: string,
      doses: number,
      date: string,
      stage: FarmStage,
      allocations?: InjectionUseAllocation[] | null,
    ): string | null => {
    if (doses <= 0) return 'Indica cuántas dosis se usaron.'
    if (!date) return 'Indica la fecha de uso.'
    if (stage !== 'engorde' && stage !== 'destete') return 'Indica si el uso fue en destete o en engorde.'
    const parsed = parseAllocations(allocations, doses)
    if (typeof parsed === 'string') return parsed
    const injection = state.injections.find((item) => item.id === injectionId)
    if (!injection) return 'No se encontró la inyección.'

    const result = applyInjectionUse(state.entries, injection, doses)
    if (!result.ok) {
      const line = injection.lines.find((item) => item.medicationName === result.missing)
      const need = (line?.amount ?? 0) * doses
      return `No hay suficiente ${result.missing} (${formatNeed(need, line?.unit ?? 'ml')}).`
    }

    setState((s) => ({
      ...s,
      entries: result.entries,
      uses: [
        {
          id: uid(),
          injectionId,
          date,
          doses,
          cost: result.cost,
          injectionName: injection.name,
          stage,
          allocations: parsed,
        },
        ...s.uses,
      ],
    }))
    return null
  }, [state.entries, state.injections])

  const updatePurchase = useCallback((id: string, input: NewEntryInput): string | null => {
    const purchase = state.purchases?.find((item) => item.id === id)
    if (!purchase) return 'No se encontró la compra.'
    const linkedId = purchase.entryId
    if (linkedId && state.entries.some((entry) => entry.id === linkedId)) {
      return updateEntry(linkedId, input)
    }
    const parsed = parseEntry(input)
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      purchases: (s.purchases ?? []).map((item) =>
        item.id === id
          ? {
              ...item,
              name: parsed.name,
              date: parsed.date,
              quantity: parsed.quantity,
              size: parsed.size,
              unit: parsed.unit,
              cost: parsed.cost,
              costCurrency: parsed.costCurrency,
              usdAmount: parsed.usdAmount,
              usdRate: parsed.usdRate,
            }
          : item,
      ),
      catalog: upsertCatalog(s.catalog ?? [], {
        name: parsed.name,
        unit: parsed.unit,
        size: parsed.size,
        lastQuantity: parsed.quantity,
        lastCost: parsed.cost,
      }),
      lastUsdRate: parsed.costCurrency === 'USD' ? parsed.usdRate : s.lastUsdRate,
    }))
    return null
  }, [state.purchases, state.entries, updateEntry])

  const deletePurchase = useCallback((id: string) => {
    setState((s) => {
      const purchase = (s.purchases ?? []).find((item) => item.id === id)
      const entryId = purchase?.entryId
      return {
        ...s,
        purchases: (s.purchases ?? []).filter((item) => item.id !== id),
        entries: entryId ? s.entries.filter((entry) => entry.id !== entryId) : s.entries,
      }
    })
  }, [])

  const updateUse = useCallback(
    (
      id: string,
      date: string,
      doses: number,
      stage: FarmStage,
      allocations?: InjectionUseAllocation[] | null,
    ): string | null => {
      if (doses <= 0) return 'Indica cuántas dosis se usaron.'
      if (!date) return 'Indica la fecha de uso.'
      if (stage !== 'engorde' && stage !== 'destete') return 'Indica si el uso fue en destete o en engorde.'
      const parsed = parseAllocations(allocations, doses)
      if (typeof parsed === 'string') return parsed
      setState((s) => ({
        ...s,
        uses: s.uses.map((item) =>
          item.id === id
            ? {
                ...item,
                date,
                doses,
                stage,
                allocations: parsed,
                locationId: '',
                location: '',
              }
            : item,
        ),
      }))
      return null
    },
    [],
  )

  const deleteUse = useCallback((id: string) => {
    setState((s) => ({ ...s, uses: s.uses.filter((item) => item.id !== id) }))
  }, [])

  const dismissRestockAlerts = useCallback((items: DismissedAlert[]) => {
    setState((s) => {
      const next = [...(s.dismissedAlerts ?? [])]
      for (const item of items) {
        const index = next.findIndex((row) => row.key === item.key && row.level === item.level)
        if (index >= 0) next[index] = item
        else next.push(item)
      }
      return { ...s, dismissedAlerts: next }
    })
  }, [])

  const value = useMemo(
    () => ({
      state,
      addEntry,
      updateEntry,
      deleteEntry,
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
    }),
    [
      state,
      addEntry,
      updateEntry,
      deleteEntry,
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
    ],
  )

  return <PharmacyContext.Provider value={value}>{children}</PharmacyContext.Provider>
}

function formatNeed(amount: number, unit: StockUnit): string {
  return `se necesitan ${amount} ${unitLabel(unit, amount !== 1)}`
}

export function usePharmacy(): PharmacyContextValue {
  const ctx = useContext(PharmacyContext)
  if (!ctx) throw new Error('usePharmacy debe usarse dentro de PharmacyProvider')
  return ctx
}
