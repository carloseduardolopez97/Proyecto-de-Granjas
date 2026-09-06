import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { feedNativeStock, feedUnitPrice, formulaCost, lotAgeDays, uid } from '../lib/calc'
import { loadState, saveState } from '../lib/storage'
import type {
  FarmState,
  Feed,
  FeedEntry,
  Formula,
  LotEvent,
  LotSortMode,
  LotSupplier,
  Medication,
} from '../lib/types'

export type NewLotInput = {
  cageOrName: string
  entryDate: string
  ageAtEntryDays: number
  notes: string
  suppliers: Array<{
    name: string
    headcount: number
    totalWeightKg: number
    vaccines: Array<{ name: string; dueDate: string }>
  }>
}

type FarmContextValue = {
  state: FarmState
  addMedication: (med: Omit<Medication, 'id'>) => void
  updateMedication: (id: string, patch: Partial<Medication>) => void
  addStock: (id: string, qty: number, packageCost?: number) => void
  addFormula: (formula: Omit<Formula, 'id'>) => void
  updateFormula: (id: string, patch: Partial<Formula>) => void
  deleteFormula: (id: string) => void
  addFeed: (feed: Omit<Feed, 'id' | 'stockSacks' | 'stockQuintales' | 'lastUnitCost'>) => void
  updateFeed: (id: string, patch: Partial<Feed>) => void
  addFeedEntry: (entry: Omit<FeedEntry, 'id'>) => string | null
  consumeFeed: (lotId: string, feedId: string, quantity: number, date: string, notes: string) => string | null
  addLot: (lot: NewLotInput) => void
  setLotSortMode: (mode: LotSortMode) => void
  moveLot: (lotId: string, direction: 'up' | 'down') => void
  markVaccineApplied: (lotId: string, supplierId: string, vaccineId: string) => void
  transferToEngorde: (fromLotId: string, quantity: number, date: string, notes: string) => string | null
  sellFromLot: (lotId: string, quantity: number, revenue: number, date: string, notes: string) => string | null
  addEvent: (event: Omit<LotEvent, 'id'>) => string | null
  applyFormula: (lotId: string, formulaId: string, doses: number, date: string, notes: string) => string | null
  addDisease: (name: string) => void
  setFarmName: (name: string) => void
  resetDemo: () => void
}

const FarmContext = createContext<FarmContextValue | null>(null)

export function FarmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FarmState>(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const addMedication = useCallback((med: Omit<Medication, 'id'>) => {
    const unitPrice =
      med.unitPrice > 0 ? med.unitPrice : med.packageQty ? med.packageCost / med.packageQty : 0
    setState((s) => ({
      ...s,
      medications: [...s.medications, { ...med, id: uid(), unitPrice }],
    }))
  }, [])

  const updateMedication = useCallback((id: string, patch: Partial<Medication>) => {
    setState((s) => ({
      ...s,
      medications: s.medications.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }))
  }, [])

  const addStock = useCallback((id: string, qty: number, packageCost?: number) => {
    setState((s) => ({
      ...s,
      medications: s.medications.map((m) => {
        if (m.id !== id) return m
        return {
          ...m,
          stock: m.stock + qty,
          packageCost: packageCost ?? m.packageCost,
        }
      }),
    }))
  }, [])

  const addFormula = useCallback((formula: Omit<Formula, 'id'>) => {
    setState((s) => ({ ...s, formulas: [...s.formulas, { ...formula, id: uid() }] }))
  }, [])

  const updateFormula = useCallback((id: string, patch: Partial<Formula>) => {
    setState((s) => ({
      ...s,
      formulas: s.formulas.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }))
  }, [])

  const deleteFormula = useCallback((id: string) => {
    setState((s) => ({ ...s, formulas: s.formulas.filter((f) => f.id !== id) }))
  }, [])

  const addFeed = useCallback(
    (feed: Omit<Feed, 'id' | 'stockSacks' | 'stockQuintales' | 'lastUnitCost'>) => {
      setState((s) => ({
        ...s,
        feeds: [
          ...s.feeds,
          {
            ...feed,
            id: uid(),
            stockSacks: 0,
            stockQuintales: 0,
            lastUnitCost: 0,
            unitPrice: feed.unitPrice ?? 0,
          },
        ],
      }))
    },
    [],
  )

  const updateFeed = useCallback((id: string, patch: Partial<Feed>) => {
    setState((s) => ({
      ...s,
      feeds: s.feeds.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }))
  }, [])

  const addFeedEntry = useCallback((entry: Omit<FeedEntry, 'id'>): string | null => {
    if (entry.quantity <= 0) return 'Indica la cantidad comprada.'
    const feed = state.feeds.find((f) => f.id === entry.feedId)
    if (!feed) return 'No se encontró el alimento.'
    const unitCost = entry.totalCost / entry.quantity
    setState((s) => ({
      ...s,
      feedEntries: [{ ...entry, id: uid() }, ...s.feedEntries],
      feeds: s.feeds.map((f) => {
        if (f.id !== entry.feedId) return f
        if (f.storage === 'saco') {
          return {
            ...f,
            stockSacks: f.stockSacks + entry.quantity,
            lastUnitCost: unitCost,
            unitPrice: f.unitPrice > 0 ? f.unitPrice : unitCost,
          }
        }
        return {
          ...f,
          stockQuintales: f.stockQuintales + entry.quantity,
          lastUnitCost: unitCost,
          unitPrice: f.unitPrice > 0 ? f.unitPrice : unitCost,
        }
      }),
    }))
    return null
  }, [state.feeds])

  const consumeFeed = useCallback(
    (lotId: string, feedId: string, quantity: number, date: string, notes: string): string | null => {
      const feed = state.feeds.find((f) => f.id === feedId)
      if (!feed) return 'No se encontró el alimento.'
      if (quantity <= 0) return 'Indica la cantidad consumida.'
      const stock = feedNativeStock(feed)
      if (stock + 1e-9 < quantity) {
        const unit = feed.storage === 'saco' ? 'sacos' : 'qq'
        return `Stock insuficiente de ${feed.name}: hay ${stock} ${unit}, se necesitan ${quantity}.`
      }
      const cost = feedUnitPrice(feed) * quantity
      const unit = feed.storage === 'saco' ? (quantity === 1 ? 'saco' : 'sacos') : 'qq'
      setState((s) => ({
        ...s,
        feeds: s.feeds.map((f) => {
          if (f.id !== feedId) return f
          if (f.storage === 'saco') return { ...f, stockSacks: Math.max(0, f.stockSacks - quantity) }
          return { ...f, stockQuintales: Math.max(0, f.stockQuintales - quantity) }
        }),
        events: [
          {
            id: uid(),
            lotId,
            date,
            type: 'alimento',
            quantity,
            cost,
            notes: notes || `Consumo ${feed.name}: ${quantity} ${unit}`,
            feedId,
          },
          ...s.events,
        ],
      }))
      return null
    },
    [state.feeds],
  )

  const addLot = useCallback((lot: NewLotInput) => {
    const id = uid()
    const suppliers: LotSupplier[] = lot.suppliers.map((supplier) => ({
      id: uid(),
      name: supplier.name.trim(),
      headcount: supplier.headcount,
      totalWeightKg: supplier.totalWeightKg,
      vaccines: supplier.vaccines
        .filter((v) => v.name.trim() && v.dueDate)
        .map((v) => ({
          id: uid(),
          name: v.name.trim(),
          dueDate: v.dueDate,
          applied: false,
        })),
    }))
    const heads = suppliers.reduce((n, s) => n + s.headcount, 0)
    const cageOrName = lot.cageOrName.trim()
    setState((s) => {
      const sortIndex = s.lots.reduce((max, l) => Math.max(max, l.sortIndex), -1) + 1
      return {
        ...s,
        lots: [
          ...s.lots,
          {
            id,
            name: cageOrName,
            cageOrName,
            stage: 'destete',
            status: 'activa',
            lineageId: id,
            parentLotId: null,
            entryDate: lot.entryDate,
            ageAtEntryDays: lot.ageAtEntryDays,
            initialHeadcount: heads,
            currentHeadcount: heads,
            transferredOut: 0,
            purchaseCost: 0,
            targetWeightKg: 110,
            salePricePerKg: 0,
            notes: lot.notes,
            suppliers,
            sortIndex,
          },
        ],
      }
    })
  }, [])

  const setLotSortMode = useCallback((mode: LotSortMode) => {
    setState((s) => ({ ...s, lotSortMode: mode }))
  }, [])

  const moveLot = useCallback((lotId: string, direction: 'up' | 'down') => {
    setState((s) => {
      const ordered = [...s.lots].sort((a, b) => a.sortIndex - b.sortIndex)
      const index = ordered.findIndex((l) => l.id === lotId)
      if (index < 0) return s
      const swapWith = direction === 'up' ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= ordered.length) return s
      const a = ordered[index]
      const b = ordered[swapWith]
      return {
        ...s,
        lotSortMode: 'custom',
        lots: s.lots.map((lot) => {
          if (lot.id === a.id) return { ...lot, sortIndex: b.sortIndex }
          if (lot.id === b.id) return { ...lot, sortIndex: a.sortIndex }
          return lot
        }),
      }
    })
  }, [])

  const markVaccineApplied = useCallback((lotId: string, supplierId: string, vaccineId: string) => {
    setState((s) => ({
      ...s,
      lots: s.lots.map((lot) => {
        if (lot.id !== lotId) return lot
        return {
          ...lot,
          suppliers: lot.suppliers.map((supplier) => {
            if (supplier.id !== supplierId) return supplier
            return {
              ...supplier,
              vaccines: supplier.vaccines.map((v) =>
                v.id === vaccineId ? { ...v, applied: true } : v,
              ),
            }
          }),
        }
      }),
    }))
  }, [])

  const transferToEngorde = useCallback(
    (fromLotId: string, quantity: number, date: string, notes: string): string | null => {
      const from = state.lots.find((l) => l.id === fromLotId)
      if (!from) return 'No se encontró la cepa.'
      if (from.stage !== 'destete') return 'Solo se transfiere desde destete hacia engorde.'
      if (from.status === 'cerrada') return 'Esta cepa ya está cerrada.'
      if (quantity <= 0) return 'Indica cuántos animales se transfieren.'
      if (quantity > from.currentHeadcount) {
        return `Solo hay ${from.currentHeadcount} animales en destete.`
      }
      const newId = uid()
      const age = lotAgeDays(from.entryDate, from.ageAtEntryDays)
      const allocatedPurchase =
        from.initialHeadcount > 0 ? (from.purchaseCost * quantity) / from.initialHeadcount : 0
      const remaining = from.currentHeadcount - quantity
      setState((s) => ({
        ...s,
        lots: [
          ...s.lots.map((lot) => {
            if (lot.id !== fromLotId) return lot
            return {
              ...lot,
              currentHeadcount: remaining,
              transferredOut: lot.transferredOut + quantity,
              status: remaining === 0 ? ('transferida' as const) : ('activa' as const),
            }
          }),
          {
            id: newId,
            name: from.name,
            cageOrName: from.cageOrName || from.name,
            stage: 'engorde',
            status: 'activa',
            lineageId: from.lineageId,
            parentLotId: from.id,
            entryDate: date,
            ageAtEntryDays: age,
            initialHeadcount: quantity,
            currentHeadcount: quantity,
            transferredOut: 0,
            purchaseCost: allocatedPurchase,
            suppliers: [
              {
                id: uid(),
                name: 'Transferencia destete',
                headcount: quantity,
                totalWeightKg: 0,
                vaccines: [],
              },
            ],
            sortIndex: from.sortIndex,
            targetWeightKg: from.targetWeightKg,
            salePricePerKg: from.salePricePerKg,
            notes: notes || `Transferida desde destete el ${date}`,
          },
        ],
        events: [
          {
            id: uid(),
            lotId: fromLotId,
            date,
            type: 'transferencia',
            quantity,
            cost: 0,
            notes: notes || `Salida a engorde: ${quantity} animales`,
            relatedLotId: newId,
          },
          {
            id: uid(),
            lotId: newId,
            date,
            type: 'transferencia',
            quantity,
            cost: 0,
            notes:
              notes ||
              `Entrada desde destete ${from.name}. Precio de compra prorrateado: ${Math.round(allocatedPurchase)}.`,
            relatedLotId: fromLotId,
          },
          ...s.events,
        ],
      }))
      return null
    },
    [state.lots],
  )

  const sellFromLot = useCallback(
    (lotId: string, quantity: number, revenue: number, date: string, notes: string): string | null => {
      const lot = state.lots.find((l) => l.id === lotId)
      if (!lot) return 'No se encontró la cepa.'
      if (lot.stage !== 'engorde') return 'La venta se registra en engorde.'
      if (quantity <= 0) return 'Indica cuántos animales se venden.'
      if (quantity > lot.currentHeadcount) return 'La venta supera el inventario de engorde.'
      const remaining = lot.currentHeadcount - quantity
      setState((s) => ({
        ...s,
        lots: s.lots.map((item) => {
          if (item.id !== lotId) return item
          return {
            ...item,
            currentHeadcount: remaining,
            status: remaining === 0 ? ('cerrada' as const) : ('activa' as const),
          }
        }),
        events: [
          {
            id: uid(),
            lotId,
            date,
            type: 'venta',
            quantity,
            cost: 0,
            revenue,
            notes: notes || `Venta de ${quantity} animales`,
          },
          ...s.events,
        ],
      }))
      return null
    },
    [state.lots],
  )

  const addEvent = useCallback((event: Omit<LotEvent, 'id'>): string | null => {
    if (event.type === 'mortalidad' && event.quantity > 0) {
      const lot = state.lots.find((l) => l.id === event.lotId)
      if (!lot) return 'No se encontró la cepa.'
      if (event.quantity > lot.currentHeadcount) return 'La mortalidad supera el inventario actual.'
    }
    setState((s) => ({
      ...s,
      events: [{ ...event, id: uid() }, ...s.events],
      lots: s.lots.map((lot) => {
        if (lot.id !== event.lotId) return lot
        if (event.type === 'mortalidad') {
          return { ...lot, currentHeadcount: lot.currentHeadcount - event.quantity }
        }
        return lot
      }),
    }))
    return null
  }, [state.lots])

  const applyFormula = useCallback(
    (lotId: string, formulaId: string, doses: number, date: string, notes: string): string | null => {
      const formula = state.formulas.find((f) => f.id === formulaId)
      if (!formula) return 'No se encontró la fórmula.'
      if (doses <= 0) return 'Indica al menos una dosis o aplicación.'

      for (const line of formula.lines) {
        const med = state.medications.find((m) => m.id === line.medicationId)
        if (!med) return 'La fórmula incluye un medicamento eliminado.'
        const need = line.quantity * doses
        if (med.stock + 1e-9 < need) {
          return `Stock insuficiente de ${med.name}: hay ${med.stock} ${med.unit}, se necesitan ${need}.`
        }
      }

      const cost = formulaCost(formula, state.medications, doses)
      setState((s) => ({
        ...s,
        medications: s.medications.map((m) => {
          const line = formula.lines.find((l) => l.medicationId === m.id)
          if (!line) return m
          return { ...m, stock: Math.max(0, m.stock - line.quantity * doses) }
        }),
        events: [
          {
            id: uid(),
            lotId,
            date,
            type: 'formula',
            quantity: doses,
            cost,
            notes: notes || `Fórmula: ${formula.name}`,
            formulaId,
            doses,
          },
          ...s.events,
        ],
      }))
      return null
    },
    [state.formulas, state.medications],
  )

  const addDisease = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setState((s) => {
      if (s.diseases.some((d) => d.name.toLowerCase() === trimmed.toLowerCase())) return s
      return { ...s, diseases: [...s.diseases, { id: uid(), name: trimmed }] }
    })
  }, [])

  const setFarmName = useCallback((name: string) => {
    setState((s) => ({ ...s, farmName: name }))
  }, [])

  const resetDemo = useCallback(() => {
    setState(loadState())
  }, [])

  const value = useMemo(
    () => ({
      state,
      addMedication,
      updateMedication,
      addStock,
      addFormula,
      updateFormula,
      deleteFormula,
      addFeed,
      updateFeed,
      addFeedEntry,
      consumeFeed,
      addLot,
      setLotSortMode,
      moveLot,
      markVaccineApplied,
      transferToEngorde,
      sellFromLot,
      addEvent,
      applyFormula,
      addDisease,
      setFarmName,
      resetDemo,
    }),
    [
      state,
      addMedication,
      updateMedication,
      addStock,
      addFormula,
      updateFormula,
      deleteFormula,
      addFeed,
      updateFeed,
      addFeedEntry,
      consumeFeed,
      addLot,
      setLotSortMode,
      moveLot,
      markVaccineApplied,
      transferToEngorde,
      sellFromLot,
      addEvent,
      applyFormula,
      addDisease,
      setFarmName,
      resetDemo,
    ],
  )

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>
}

export function useFarm(): FarmContextValue {
  const ctx = useContext(FarmContext)
  if (!ctx) throw new Error('useFarm debe usarse dentro de FarmProvider')
  return ctx
}
