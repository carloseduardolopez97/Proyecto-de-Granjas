import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  cepaAgeOnDate,
  cepaAvgWeightKg,
  cepaCountUpTo,
  cepaDeathsUpTo,
  cepaLiveOnDate,
  engordeLotsAsMovements,
  mergeLocationCatalogs,
  resolveCepaWeighingMass,
  uid,
  usdToPesos,
} from '../lib/calc'
import { loadCepa, saveCepa } from '../lib/storage'
import type {
  Cepa,
  CepaCostBasis,
  CepaDeath,
  CepaLocation,
  CepaState,
  CepaSupplier,
  CepaWeighing,
  CepaWeighMode,
  EngordeLot,
  FeedCurrency,
} from '../lib/types'

export type CepaMoneyInput = {
  priceCurrency: FeedCurrency
  unitCost: number
  usdAmount?: number
  usdRate?: number
}

export type CepaInput = CepaMoneyInput & {
  date: string
  supplierId: string
  locationId: string
  pigletCount: number
  arrivalAgeDays: number
  totalWeightKg: number
  costBasis: CepaCostBasis
}

export type CepaWeighingInput = {
  cepaId: string
  date: string
  pigletCount: number
  weighMode: CepaWeighMode
  weighedCount: number
  scaleWeightKg: number
}

export type CepaDeathInput = {
  cepaId: string
  date: string
  count: number
  note?: string
}

export type EngordeLotInput = {
  date: string
  sourceCepaId: string
  locationId: string
  pigCount: number
  totalWeightKg: number
}

type CepaContextValue = {
  state: CepaState
  addSupplier: (name: string, saleAgeDays?: number) => { error: string } | { id: string }
  addLocation: (name: string, capacity?: number) => { error: string } | { id: string }
  updateLocation: (id: string, name: string, capacity?: number) => string | null
  deleteLocation: (id: string) => string | null
  addEngordeLocation: (name: string, capacity?: number) => { error: string } | { id: string }
  updateEngordeLocation: (id: string, name: string, capacity?: number) => string | null
  deleteEngordeLocation: (id: string) => string | null
  addCepa: (input: CepaInput) => string | null
  addCepas: (inputs: CepaInput[]) => string | null
  updateCepa: (id: string, input: CepaInput) => string | null
  deleteCepa: (id: string) => void
  addWeighing: (input: CepaWeighingInput) => string | null
  updateWeighing: (id: string, input: CepaWeighingInput) => string | null
  deleteWeighing: (id: string) => void
  addDeath: (input: CepaDeathInput) => string | null
  updateDeath: (id: string, input: CepaDeathInput) => string | null
  deleteDeath: (id: string) => void
  addEngordeLots: (inputs: EngordeLotInput[]) => string | null
  updateEngordeLot: (id: string, input: EngordeLotInput) => string | null
  deleteEngordeLot: (id: string) => void
}

function transfersOf(state: CepaState) {
  return engordeLotsAsMovements(state.engordeLots ?? [])
}

const CepaContext = createContext<CepaContextValue | null>(null)

function parseMoney(input: CepaMoneyInput): Omit<CepaMoneyInput, 'unitCost'> & { unitCost: number } | string {
  const priceCurrency = input.priceCurrency ?? 'DOP'
  if (priceCurrency === 'USD') {
    if ((input.usdAmount ?? 0) < 0) return 'El costo en dólares no puede ser negativo.'
    if (!input.usdRate || input.usdRate <= 0) return 'Indica la tasa del dólar.'
    return {
      priceCurrency,
      usdAmount: input.usdAmount ?? 0,
      usdRate: input.usdRate,
      unitCost: usdToPesos(input.usdAmount ?? 0, input.usdRate),
    }
  }
  if (!(input.unitCost >= 0)) return 'El costo no puede ser negativo.'
  return { priceCurrency: 'DOP', unitCost: input.unitCost }
}

function parseSaleAgeDays(value?: number): number | undefined | string {
  if (value == null || Number.isNaN(value) || value === 0) return undefined
  if (!Number.isInteger(value) || value < 1) return 'La edad de venta debe ser un número entero de días mayor a 0.'
  if (value > 400) return 'La edad de venta no parece correcta.'
  return value
}

function parseSupplier(
  name: string,
  saleAgeDays: number | undefined,
  others: CepaSupplier[],
  id?: string,
): CepaSupplier | string {
  const trimmed = name.trim()
  if (!trimmed) return 'Indica el nombre del suplidor.'
  const taken = others.some(
    (item) => item.id !== id && item.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  if (taken) return 'Ya existe un suplidor con ese nombre.'
  const age = parseSaleAgeDays(saleAgeDays)
  if (typeof age === 'string') return age
  return { id: id ?? uid(), name: trimmed, saleAgeDays: age }
}

function parseCapacity(value?: number): number | string {
  if (value == null || Number.isNaN(value) || value === 0) return 0
  if (!Number.isInteger(value) || value < 1) return 'La capacidad debe ser un número entero de lechones mayor a 0.'
  return value
}

function parseLocation(
  name: string,
  capacity: number | undefined,
  others: CepaLocation[],
  id?: string,
): CepaLocation | string {
  const trimmed = name.trim()
  if (!trimmed) return 'Indica el nombre de la ubicación.'
  const taken = others.some(
    (item) => item.id !== id && item.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  if (taken) return 'Ya existe una ubicación con ese nombre.'
  const parsedCapacity = parseCapacity(capacity)
  if (typeof parsedCapacity === 'string') return parsedCapacity
  return { id: id ?? uid(), name: trimmed, capacity: parsedCapacity }
}

function parseCepa(
  input: CepaInput,
  suppliers: CepaSupplier[],
  locations: CepaLocation[],
  deaths: CepaDeath[],
  transfers: ReturnType<typeof engordeLotsAsMovements>,
  previous?: Cepa,
): Cepa | string {
  if (!input.date) return 'Indica la fecha de compra.'
  const supplier = suppliers.find((item) => item.id === input.supplierId)
  if (!supplier) return 'Elige un suplidor o añade uno nuevo.'
  const location = locations.find((item) => item.id === input.locationId)
  if (!location) return 'Elige una ubicación o añade una nueva.'
  if (!Number.isInteger(input.pigletCount) || input.pigletCount <= 0) {
    return 'La cantidad de lechones debe ser un número entero mayor a 0.'
  }
  if (!Number.isInteger(input.arrivalAgeDays) || input.arrivalAgeDays < 1) {
    return 'Indica la edad de los lechones en días (mayor a 0).'
  }
  if (!(input.totalWeightKg > 0)) return 'El peso total debe ser mayor a 0.'
  const dead = cepaDeathsUpTo(deaths, previous?.id ?? '')
  const moved = cepaCountUpTo(transfers, previous?.id ?? '')
  const reserved = dead + moved
  if (previous && input.pigletCount < reserved) {
    return `Ya hay ${dead} muertos y ${moved} trasladados a engorde. La cantidad comprada no puede ser menor.`
  }
  const money = parseMoney(input)
  if (typeof money === 'string') return money
  const supplierName = previous && previous.supplierId === supplier.id ? previous.supplierName : supplier.name
  const locationName = previous && previous.locationId === location.id ? previous.location : location.name
  return {
    id: previous?.id ?? uid(),
    date: input.date,
    supplierId: supplier.id,
    supplierName,
    locationId: location.id,
    location: locationName,
    pigletCount: input.pigletCount,
    arrivalAgeDays: input.arrivalAgeDays,
    totalWeightKg: input.totalWeightKg,
    avgWeightKg: cepaAvgWeightKg(input.totalWeightKg, input.pigletCount),
    costBasis: input.costBasis,
    ...money,
  }
}

function parseWeighing(
  input: CepaWeighingInput,
  cepas: Cepa[],
  weighings: CepaWeighing[],
  deaths: CepaDeath[],
  transfers: ReturnType<typeof engordeLotsAsMovements>,
  previous?: CepaWeighing,
): CepaWeighing | string {
  const cepa = cepas.find((item) => item.id === input.cepaId)
  if (!cepa) return 'Elige la cepa que se pesó.'
  if (!input.date) return 'Indica la fecha de pesaje.'
  if (input.date < cepa.date) return 'La fecha de pesaje no puede ser anterior a la compra.'
  const live = cepaLiveOnDate(cepa, deaths, input.date, undefined, transfers)
  if (live <= 0) return 'No quedan lechones vivos en esa fecha.'
  if (!Number.isInteger(input.pigletCount) || input.pigletCount <= 0) {
    return 'La cantidad de lechones vivos debe ser un número entero mayor a 0.'
  }
  if (input.pigletCount > live) {
    return `Ese día solo había ${live} lechones vivos.`
  }
  const weighMode = input.weighMode === 'sample' ? 'sample' : 'census'
  const weighedCount = weighMode === 'census' ? input.pigletCount : input.weighedCount
  if (!Number.isInteger(weighedCount) || weighedCount <= 0) {
    return 'Indica cuántos lechones se pesaron.'
  }
  if (weighedCount > input.pigletCount) {
    return 'No se pueden pesar más lechones de los que hay vivos.'
  }
  if (!(input.scaleWeightKg > 0)) return 'El peso de la báscula debe ser mayor a 0.'
  const mass = resolveCepaWeighingMass({
    pigletCount: input.pigletCount,
    weighMode,
    weighedCount,
    scaleWeightKg: input.scaleWeightKg,
  })
  const taken = weighings.some(
    (item) => item.cepaId === input.cepaId && item.date === input.date && item.id !== previous?.id,
  )
  if (taken) return 'Ya hay un pesaje en esa fecha para esta cepa.'
  return {
    id: previous?.id ?? uid(),
    cepaId: cepa.id,
    date: input.date,
    pigletCount: input.pigletCount,
    weighMode,
    weighedCount: mass.weighedCount,
    scaleWeightKg: input.scaleWeightKg,
    totalWeightKg: mass.totalWeightKg,
    avgWeightKg: mass.avgWeightKg,
  }
}

function parseDeath(
  input: CepaDeathInput,
  cepas: Cepa[],
  deaths: CepaDeath[],
  transfers: ReturnType<typeof engordeLotsAsMovements>,
  previous?: CepaDeath,
): CepaDeath | string {
  const cepa = cepas.find((item) => item.id === input.cepaId)
  if (!cepa) return 'Elige la cepa de las muertes.'
  if (!input.date) return 'Indica la fecha de la muerte.'
  if (input.date < cepa.date) return 'La fecha no puede ser anterior a la compra.'
  if (!Number.isInteger(input.count) || input.count <= 0) {
    return 'La cantidad de muertos debe ser un número entero mayor a 0.'
  }
  const live = cepaLiveOnDate(cepa, deaths, input.date, previous?.id, transfers)
  if (input.count > live) {
    return `Solo hay ${live} lechones vivos ese día.`
  }
  const age = cepaAgeOnDate(cepa, input.date)
  const note = input.note?.trim()
  return {
    id: previous?.id ?? uid(),
    cepaId: cepa.id,
    date: input.date,
    count: input.count,
    daysOnFarm: age.daysOnFarm,
    arrivalAgeDays: age.arrivalAgeDays,
    ageDays: age.ageDays,
    note: note || undefined,
  }
}

function parseEngordeLot(
  input: EngordeLotInput,
  cepas: Cepa[],
  deaths: CepaDeath[],
  locations: CepaLocation[],
  lots: EngordeLot[],
  previous?: EngordeLot,
): EngordeLot | string {
  const cepa = cepas.find((item) => item.id === input.sourceCepaId)
  if (!cepa) return 'Elige la cepa de destete que se traslada.'
  if (!input.date) return 'Indica la fecha del traslado.'
  if (input.date < cepa.date) return 'La fecha no puede ser anterior a la compra de destete.'
  const location = locations.find((item) => item.id === input.locationId)
  if (!location) return 'Elige una sala de engorde o créala en Ajustes.'
  if (!Number.isInteger(input.pigCount) || input.pigCount <= 0) {
    return 'La cantidad de cerdos debe ser un número entero mayor a 0.'
  }
  const transfers = engordeLotsAsMovements(lots)
  const live = cepaLiveOnDate(cepa, deaths, input.date, undefined, transfers, previous?.id)
  if (input.pigCount > live) {
    return `En destete solo quedan ${live} lechones vivos ese día.`
  }
  if (!(input.totalWeightKg > 0)) return 'El peso total al traslado debe ser mayor a 0.'
  const age = cepaAgeOnDate(cepa, input.date)
  const locationName = previous && previous.locationId === location.id ? previous.location : location.name
  return {
    id: previous?.id ?? uid(),
    date: input.date,
    sourceCepaId: cepa.id,
    sourceLocation: previous && previous.sourceCepaId === cepa.id ? previous.sourceLocation : cepa.location,
    sourceSupplierName:
      previous && previous.sourceCepaId === cepa.id ? previous.sourceSupplierName : cepa.supplierName,
    locationId: location.id,
    location: locationName,
    pigCount: input.pigCount,
    totalWeightKg: input.totalWeightKg,
    avgWeightKg: cepaAvgWeightKg(input.totalWeightKg, input.pigCount),
    arrivalAgeDays: age.ageDays,
    daysOnFarm: age.daysOnFarm,
  }
}

function rememberRate(state: CepaState, money: { priceCurrency: FeedCurrency; usdRate?: number }): number | undefined {
  return money.priceCurrency === 'USD' ? money.usdRate : state.lastUsdRate
}

export function CepaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CepaState>(loadCepa)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    saveCepa(state)
  }, [state])

  const addSupplier = useCallback((name: string, saleAgeDays?: number): { error: string } | { id: string } => {
    const parsed = parseSupplier(name, saleAgeDays, stateRef.current.suppliers)
    if (typeof parsed === 'string') return { error: parsed }
    setState((s) => {
      if (s.suppliers.some((item) => item.id === parsed.id)) return s
      return {
        ...s,
        suppliers: [...s.suppliers, parsed].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }
    })
    return { id: parsed.id }
  }, [])

  const addLocation = useCallback((name: string, capacity?: number): { error: string } | { id: string } => {
    const parsed = parseLocation(name, capacity, stateRef.current.locations ?? [])
    if (typeof parsed === 'string') return { error: parsed }
    setState((s) => {
      if ((s.locations ?? []).some((item) => item.id === parsed.id)) return s
      return {
        ...s,
        locations: [...(s.locations ?? []), parsed].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }
    })
    return { id: parsed.id }
  }, [])

  const updateLocation = useCallback((id: string, name: string, capacity?: number): string | null => {
    const parsed = parseLocation(name, capacity, stateRef.current.locations ?? [], id)
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      locations: (s.locations ?? []).map((item) => (item.id === id ? parsed : item)),
    }))
    return null
  }, [])

  const deleteLocation = useCallback((id: string): string | null => {
    const used = stateRef.current.cepas.some((item) => item.locationId === id)
    if (used) return 'No se puede eliminar: hay cepas registradas en esa ubicación.'
    const usedEngorde = (stateRef.current.engordeLots ?? []).some((item) => item.locationId === id)
    if (usedEngorde) return 'No se puede eliminar: hay cerdos de engorde en esa jaula.'
    setState((s) => ({
      ...s,
      locations: (s.locations ?? []).filter((item) => item.id !== id),
    }))
    return null
  }, [])

  const addEngordeLocation = useCallback((name: string, capacity?: number): { error: string } | { id: string } => {
    const parsed = parseLocation(name, capacity, stateRef.current.engordeLocations ?? [])
    if (typeof parsed === 'string') return { error: parsed }
    setState((s) => {
      if ((s.engordeLocations ?? []).some((item) => item.id === parsed.id)) return s
      return {
        ...s,
        engordeLocations: [...(s.engordeLocations ?? []), parsed].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }
    })
    return { id: parsed.id }
  }, [])

  const updateEngordeLocation = useCallback((id: string, name: string, capacity?: number): string | null => {
    const parsed = parseLocation(name, capacity, stateRef.current.engordeLocations ?? [], id)
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      engordeLocations: (s.engordeLocations ?? []).map((item) => (item.id === id ? parsed : item)),
    }))
    return null
  }, [])

  const deleteEngordeLocation = useCallback((id: string): string | null => {
    const used = (stateRef.current.engordeLots ?? []).some((item) => item.locationId === id)
    if (used) return 'No se puede eliminar: hay cerdos de engorde en esa sala.'
    setState((s) => ({
      ...s,
      engordeLocations: (s.engordeLocations ?? []).filter((item) => item.id !== id),
    }))
    return null
  }, [])

  const addCepa = useCallback((input: CepaInput): string | null => {
    const parsed = parseCepa(
      input,
      stateRef.current.suppliers,
      stateRef.current.locations ?? [],
      stateRef.current.deaths ?? [],
      transfersOf(stateRef.current),
    )
    if (typeof parsed === 'string') return parsed
    setState((s) => {
      if (s.cepas.some((item) => item.id === parsed.id)) return s
      return {
        ...s,
        cepas: [parsed, ...s.cepas],
        lastUsdRate: rememberRate(s, parsed),
      }
    })
    return null
  }, [])

  const addCepas = useCallback((inputs: CepaInput[]): string | null => {
    if (inputs.length === 0) return 'Indica al menos una ubicación con lechones.'
    const parsedRows: Cepa[] = []
    for (const input of inputs) {
      const parsed = parseCepa(
        input,
        stateRef.current.suppliers,
        stateRef.current.locations ?? [],
        stateRef.current.deaths ?? [],
        transfersOf(stateRef.current),
      )
      if (typeof parsed === 'string') return parsed
      parsedRows.push(parsed)
    }
    setState((s) => {
      const existing = new Set(s.cepas.map((item) => item.id))
      const fresh = parsedRows.filter((item) => !existing.has(item.id))
      if (fresh.length === 0) return s
      return {
        ...s,
        cepas: [...fresh, ...s.cepas],
        lastUsdRate: rememberRate(s, fresh[0]),
      }
    })
    return null
  }, [])

  const updateCepa = useCallback((id: string, input: CepaInput): string | null => {
    const current = stateRef.current.cepas.find((item) => item.id === id)
    if (!current) return 'No se encontró la cepa.'
    const parsed = parseCepa(
      input,
      stateRef.current.suppliers,
      stateRef.current.locations ?? [],
      stateRef.current.deaths ?? [],
      transfersOf(stateRef.current),
      current,
    )
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      cepas: s.cepas.map((item) => (item.id === id ? parsed : item)),
      lastUsdRate: rememberRate(s, parsed),
    }))
    return null
  }, [])

  const deleteCepa = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      cepas: s.cepas.filter((item) => item.id !== id),
      weighings: (s.weighings ?? []).filter((item) => item.cepaId !== id),
      deaths: (s.deaths ?? []).filter((item) => item.cepaId !== id),
      engordeLots: (s.engordeLots ?? []).filter((item) => item.sourceCepaId !== id),
    }))
  }, [])

  const addWeighing = useCallback((input: CepaWeighingInput): string | null => {
    const parsed = parseWeighing(
      input,
      stateRef.current.cepas,
      stateRef.current.weighings ?? [],
      stateRef.current.deaths ?? [],
      transfersOf(stateRef.current),
    )
    if (typeof parsed === 'string') return parsed
    setState((s) => {
      if ((s.weighings ?? []).some((item) => item.id === parsed.id)) return s
      return { ...s, weighings: [parsed, ...(s.weighings ?? [])] }
    })
    return null
  }, [])

  const updateWeighing = useCallback((id: string, input: CepaWeighingInput): string | null => {
    const current = (stateRef.current.weighings ?? []).find((item) => item.id === id)
    if (!current) return 'No se encontró el pesaje.'
    const parsed = parseWeighing(
      input,
      stateRef.current.cepas,
      stateRef.current.weighings ?? [],
      stateRef.current.deaths ?? [],
      transfersOf(stateRef.current),
      current,
    )
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      weighings: (s.weighings ?? []).map((item) => (item.id === id ? parsed : item)),
    }))
    return null
  }, [])

  const deleteWeighing = useCallback((id: string) => {
    setState((s) => ({ ...s, weighings: (s.weighings ?? []).filter((item) => item.id !== id) }))
  }, [])

  const addDeath = useCallback((input: CepaDeathInput): string | null => {
    const parsed = parseDeath(
      input,
      stateRef.current.cepas,
      stateRef.current.deaths ?? [],
      transfersOf(stateRef.current),
    )
    if (typeof parsed === 'string') return parsed
    setState((s) => {
      if ((s.deaths ?? []).some((item) => item.id === parsed.id)) return s
      return { ...s, deaths: [parsed, ...(s.deaths ?? [])] }
    })
    return null
  }, [])

  const updateDeath = useCallback((id: string, input: CepaDeathInput): string | null => {
    const current = (stateRef.current.deaths ?? []).find((item) => item.id === id)
    if (!current) return 'No se encontró el registro de muerte.'
    const parsed = parseDeath(
      input,
      stateRef.current.cepas,
      stateRef.current.deaths ?? [],
      transfersOf(stateRef.current),
      current,
    )
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      deaths: (s.deaths ?? []).map((item) => (item.id === id ? parsed : item)),
    }))
    return null
  }, [])

  const deleteDeath = useCallback((id: string) => {
    setState((s) => ({ ...s, deaths: (s.deaths ?? []).filter((item) => item.id !== id) }))
  }, [])

  const addEngordeLots = useCallback((inputs: EngordeLotInput[]): string | null => {
    if (inputs.length === 0) return 'Indica al menos una sala de engorde con cerdos.'
    const parsedRows: EngordeLot[] = []
    const pending = [...(stateRef.current.engordeLots ?? [])]
    const seen = new Set<string>()
    for (const input of inputs) {
      if (input.locationId && seen.has(input.locationId)) {
        return 'No repitas la misma sala de engorde en el mismo traslado.'
      }
      if (input.locationId) seen.add(input.locationId)
      const parsed = parseEngordeLot(
        input,
        stateRef.current.cepas,
        stateRef.current.deaths ?? [],
        mergeLocationCatalogs(stateRef.current.locations ?? [], stateRef.current.engordeLocations ?? []),
        pending,
      )
      if (typeof parsed === 'string') return parsed
      parsedRows.push(parsed)
      pending.push(parsed)
    }
    setState((s) => {
      const existing = new Set((s.engordeLots ?? []).map((item) => item.id))
      const fresh = parsedRows.filter((item) => !existing.has(item.id))
      if (fresh.length === 0) return s
      return { ...s, engordeLots: [...fresh, ...(s.engordeLots ?? [])] }
    })
    return null
  }, [])

  const updateEngordeLot = useCallback((id: string, input: EngordeLotInput): string | null => {
    const current = (stateRef.current.engordeLots ?? []).find((item) => item.id === id)
    if (!current) return 'No se encontró el traslado.'
    const parsed = parseEngordeLot(
      input,
      stateRef.current.cepas,
      stateRef.current.deaths ?? [],
      mergeLocationCatalogs(stateRef.current.locations ?? [], stateRef.current.engordeLocations ?? []),
      stateRef.current.engordeLots ?? [],
      current,
    )
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      engordeLots: (s.engordeLots ?? []).map((item) => (item.id === id ? parsed : item)),
    }))
    return null
  }, [])

  const deleteEngordeLot = useCallback((id: string) => {
    setState((s) => ({ ...s, engordeLots: (s.engordeLots ?? []).filter((item) => item.id !== id) }))
  }, [])

  return (
    <CepaContext.Provider
      value={{
        state,
        addSupplier,
        addLocation,
        updateLocation,
        deleteLocation,
        addEngordeLocation,
        updateEngordeLocation,
        deleteEngordeLocation,
        addCepa,
        addCepas,
        updateCepa,
        deleteCepa,
        addWeighing,
        updateWeighing,
        deleteWeighing,
        addDeath,
        updateDeath,
        deleteDeath,
        addEngordeLots,
        updateEngordeLot,
        deleteEngordeLot,
      }}
    >
      {children}
    </CepaContext.Provider>
  )
}

export function useCepa(): CepaContextValue {
  const ctx = useContext(CepaContext)
  if (!ctx) throw new Error('useCepa debe usarse dentro de CepaProvider')
  return ctx
}
