import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { uid, usdToPesos, feedAvailableKg, feedKgFromSacks, formatKg, latestFeedPrice, normalizeFeedStorage, normalizeSackWeightKg } from '../lib/calc'
import { loadFeed, saveFeed } from '../lib/storage'
import type { FarmStage, FeedCurrency, FeedProduct, FeedPurchase, FeedState, FeedStorage, FeedUse, FeedUseAllocation } from '../lib/types'

export type FeedMoneyInput = {
  priceCurrency: FeedCurrency
  pricePerKg: number
  usdAmount?: number
  usdRate?: number
}

export type FeedProductInput = FeedMoneyInput & {
  name: string
  sackWeightKg?: number
}

export type FeedPurchaseInput = FeedMoneyInput & {
  feedId: string
  date: string
  invoiceNumber: string
  quantityKg: number
  storage: FeedStorage
  sackCount?: number
  sackWeightKg?: number
}

export type FeedUseInput = {
  date: string
  stage: FarmStage
  feedId: string
  quantityKg: number
  storage: FeedStorage
  allocations?: FeedUseAllocation[]
}

type FeedContextValue = {
  state: FeedState
  addProduct: (input: FeedProductInput) => string | null
  updateProduct: (id: string, input: FeedProductInput) => string | null
  deleteProduct: (id: string) => void
  addPurchase: (input: FeedPurchaseInput) => string | null
  updatePurchase: (id: string, input: FeedPurchaseInput) => string | null
  deletePurchase: (id: string) => void
  addUse: (input: FeedUseInput) => string | null
  updateUse: (id: string, input: FeedUseInput) => string | null
  deleteUse: (id: string) => void
}

const FeedContext = createContext<FeedContextValue | null>(null)

function parseMoney(input: FeedMoneyInput): Omit<FeedMoneyInput, 'pricePerKg'> & { pricePerKg: number } | string {
  const priceCurrency = input.priceCurrency ?? 'DOP'
  if (priceCurrency === 'USD') {
    if ((input.usdAmount ?? 0) < 0) return 'El costo en dólares no puede ser negativo.'
    if (!input.usdRate || input.usdRate <= 0) return 'Indica la tasa del dólar.'
    const usdAmount = input.usdAmount ?? 0
    const usdRate = input.usdRate
    return {
      priceCurrency,
      usdAmount,
      usdRate,
      pricePerKg: usdToPesos(usdAmount, usdRate),
    }
  }
  if (!(input.pricePerKg >= 0)) return 'El precio no puede ser negativo.'
  return { priceCurrency: 'DOP', pricePerKg: input.pricePerKg }
}

function parseProduct(input: FeedProductInput, others: FeedProduct[], id?: string): FeedProduct | string {
  const name = input.name.trim()
  if (!name) return 'Indica el nombre del alimento.'
  const money = parseMoney(input)
  if (typeof money === 'string') return money
  const taken = others.some(
    (item) => item.id !== id && item.name.trim().toLowerCase() === name.toLowerCase(),
  )
  if (taken) return 'Ya existe un alimento con ese nombre.'
  const sackWeightKg = normalizeSackWeightKg(input.sackWeightKg)
  if (input.sackWeightKg != null && input.sackWeightKg !== 0 && !sackWeightKg) {
    return 'El peso del saco debe ser mayor a 0.'
  }
  return { id: id ?? uid(), name, ...money, sackWeightKg }
}

function parsePurchase(
  input: FeedPurchaseInput,
  products: FeedProduct[],
  previous?: FeedPurchase,
): FeedPurchase | string {
  const product = products.find((item) => item.id === input.feedId)
  if (!product) return 'Elige el alimento que se compró.'
  if (!input.date) return 'Indica la fecha de entrada.'
  const invoiceNumber = input.invoiceNumber.trim()
  if (!invoiceNumber) return 'Indica el número de factura.'
  const sackWeightKg = normalizeSackWeightKg(input.sackWeightKg)
  const sackCount = input.sackCount
  let quantityKg = input.quantityKg
  if (sackCount != null || sackWeightKg != null) {
    if (!(sackCount && sackCount > 0)) return 'Indica cuántos sacos llegaron.'
    if (!sackWeightKg) return 'Indica el peso de un saco.'
    quantityKg = feedKgFromSacks(sackCount, sackWeightKg)
  }
  if (!(quantityKg > 0)) return 'La cantidad debe ser mayor a 0.'
  const money = parseMoney(input)
  if (typeof money === 'string') return money
  const feedName = previous && previous.feedId === product.id ? previous.feedName : product.name
  const storage = normalizeFeedStorage(input.storage)
  return {
    id: previous?.id ?? uid(),
    feedId: product.id,
    feedName,
    date: input.date,
    invoiceNumber,
    quantityKg,
    storage,
    ...money,
    sackCount: sackWeightKg && sackCount && sackCount > 0 ? sackCount : undefined,
    sackWeightKg,
  }
}

function parseUse(input: FeedUseInput, state: FeedState, previous?: FeedUse): FeedUse | string {
  if (!input.date) return 'Indica la fecha.'
  const storage = normalizeFeedStorage(input.storage)
  const priced = latestFeedPrice(input.feedId, state.purchases, state.products, input.date, storage)
  if (!priced) return 'Elige un alimento que ya esté en Ajustes.'
  if (!(input.quantityKg > 0)) return 'La cantidad de alimento debe ser mayor a 0.'
  const available = feedAvailableKg(state.purchases, state.uses ?? [], input.feedId, previous?.id, storage)
  if (input.quantityKg - available > 0.0001) {
    const place = storage === 'silo' ? 'en silo' : 'en sacos'
    return `Solo hay ${formatKg(available)} kg disponibles ${place} de ese alimento.`
  }
  const allocations = (input.allocations ?? []).filter((item) => item.cepaId && item.quantityKg > 0)
  if (allocations.length === 0) return 'Elige la cepa que se alimenta.'
  const ids = allocations.map((item) => item.cepaId)
  if (new Set(ids).size !== ids.length) {
    return 'No repitas la misma cepa. Junta esas cantidades en una sola línea.'
  }
  const placed = allocations.reduce((sum, item) => sum + item.quantityKg, 0)
  if (Math.abs(placed - input.quantityKg) > 0.5) {
    return `Las cepas deben sumar ${formatKg(input.quantityKg)} kg.`
  }
  const feedName =
    previous && previous.feedId === input.feedId ? previous.feedName : priced.feedName
  const pricePerKg =
    previous && previous.feedId === input.feedId && previous.storage === storage
      ? previous.pricePerKg
      : priced.pricePerKg
  return {
    id: previous?.id ?? uid(),
    date: input.date,
    stage: input.stage,
    feedId: input.feedId,
    feedName,
    quantityKg: input.quantityKg,
    storage,
    pricePerKg,
    cost: Number((input.quantityKg * pricePerKg).toFixed(4)),
    allocations,
  }
}

function rememberRate(state: FeedState, money: { priceCurrency: FeedCurrency; usdRate?: number }): number | undefined {
  return money.priceCurrency === 'USD' ? money.usdRate : state.lastUsdRate
}

export function FeedProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FeedState>(loadFeed)

  useEffect(() => {
    saveFeed(state)
  }, [state])

  const addProduct = useCallback((input: FeedProductInput): string | null => {
    const parsed = parseProduct(input, state.products)
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      products: [parsed, ...s.products],
      lastUsdRate: rememberRate(s, parsed),
      feedUnit: 'kg',
    }))
    return null
  }, [state.products])

  const updateProduct = useCallback((id: string, input: FeedProductInput): string | null => {
    if (!state.products.some((item) => item.id === id)) return 'No se encontró el alimento.'
    const parsed = parseProduct(input, state.products, id)
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      products: s.products.map((item) => (item.id === id ? parsed : item)),
      lastUsdRate: rememberRate(s, parsed),
      feedUnit: 'kg',
    }))
    return null
  }, [state.products])

  const deleteProduct = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      products: s.products.filter((item) => item.id !== id),
    }))
  }, [])

  const addPurchase = useCallback((input: FeedPurchaseInput): string | null => {
    const parsed = parsePurchase(input, state.products)
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      purchases: [parsed, ...s.purchases],
      lastUsdRate: rememberRate(s, parsed),
      feedUnit: 'kg',
    }))
    return null
  }, [state.products])

  const updatePurchase = useCallback((id: string, input: FeedPurchaseInput): string | null => {
    const current = state.purchases.find((item) => item.id === id)
    if (!current) return 'No se encontró la compra.'
    const parsed = parsePurchase(input, state.products, current)
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      purchases: s.purchases.map((item) => (item.id === id ? parsed : item)),
      lastUsdRate: rememberRate(s, parsed),
      feedUnit: 'kg',
    }))
    return null
  }, [state.products, state.purchases])

  const deletePurchase = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      purchases: s.purchases.filter((item) => item.id !== id),
    }))
  }, [])

  const addUse = useCallback((input: FeedUseInput): string | null => {
    const parsed = parseUse(input, state)
    if (typeof parsed === 'string') return parsed
    setState((s) => {
      if ((s.uses ?? []).some((item) => item.id === parsed.id)) return s
      return { ...s, uses: [parsed, ...(s.uses ?? [])], feedUnit: 'kg' }
    })
    return null
  }, [state])

  const updateUse = useCallback((id: string, input: FeedUseInput): string | null => {
    const current = (state.uses ?? []).find((item) => item.id === id)
    if (!current) return 'No se encontró la alimentación.'
    const parsed = parseUse(input, state, current)
    if (typeof parsed === 'string') return parsed
    setState((s) => ({
      ...s,
      uses: (s.uses ?? []).map((item) => (item.id === id ? parsed : item)),
      feedUnit: 'kg',
    }))
    return null
  }, [state])

  const deleteUse = useCallback((id: string) => {
    setState((s) => ({ ...s, uses: (s.uses ?? []).filter((item) => item.id !== id) }))
  }, [])

  return (
    <FeedContext.Provider
      value={{
        state,
        addProduct,
        updateProduct,
        deleteProduct,
        addPurchase,
        updatePurchase,
        deletePurchase,
        addUse,
        updateUse,
        deleteUse,
      }}
    >
      {children}
    </FeedContext.Provider>
  )
}

export function useFeed(): FeedContextValue {
  const ctx = useContext(FeedContext)
  if (!ctx) throw new Error('useFeed debe usarse dentro de FeedProvider')
  return ctx
}
