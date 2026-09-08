import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { uid, usdToPesos, feedAvailableQq, latestFeedPrice, normalizeFeedStorage } from '../lib/calc'
import { loadFeed, saveFeed } from '../lib/storage'
import type { FarmStage, FeedCurrency, FeedProduct, FeedPurchase, FeedState, FeedStorage, FeedUse, FeedUseAllocation } from '../lib/types'

export type FeedMoneyInput = {
  priceCurrency: FeedCurrency
  pricePerQq: number
  usdAmount?: number
  usdRate?: number
}

export type FeedProductInput = FeedMoneyInput & {
  name: string
}

export type FeedPurchaseInput = FeedMoneyInput & {
  feedId: string
  date: string
  invoiceNumber: string
  quantityQq: number
  storage: FeedStorage
}

export type FeedUseInput = {
  date: string
  stage: FarmStage
  feedId: string
  quantityQq: number
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

function parseMoney(input: FeedMoneyInput): Omit<FeedMoneyInput, 'pricePerQq'> & { pricePerQq: number } | string {
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
      pricePerQq: usdToPesos(usdAmount, usdRate),
    }
  }
  if (!(input.pricePerQq >= 0)) return 'El precio no puede ser negativo.'
  return { priceCurrency: 'DOP', pricePerQq: input.pricePerQq }
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
  return { id: id ?? uid(), name, ...money }
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
  if (!(input.quantityQq > 0)) return 'La cantidad debe ser mayor a 0.'
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
    quantityQq: input.quantityQq,
    storage,
    ...money,
  }
}

function parseUse(input: FeedUseInput, state: FeedState, previous?: FeedUse): FeedUse | string {
  if (!input.date) return 'Indica la fecha.'
  const storage = normalizeFeedStorage(input.storage)
  const priced = latestFeedPrice(input.feedId, state.purchases, state.products, input.date, storage)
  if (!priced) return 'Elige un alimento que ya esté en Ajustes.'
  if (!(input.quantityQq > 0)) return 'La cantidad de alimento debe ser mayor a 0.'
  const available = feedAvailableQq(state.purchases, state.uses ?? [], input.feedId, previous?.id, storage)
  if (input.quantityQq - available > 0.0001) {
    const place = storage === 'silo' ? 'en silo' : 'en sacos'
    return `Solo hay ${available} QQ disponibles ${place} de ese alimento.`
  }
  const allocations = (input.allocations ?? []).filter((item) => item.locationId && item.quantityQq > 0)
  const placed = allocations.reduce((sum, item) => sum + item.quantityQq, 0)
  if (allocations.length > 0 && Math.abs(placed - input.quantityQq) > 0.02) {
    return `Las jaulas deben sumar ${input.quantityQq} QQ.`
  }
  const feedName =
    previous && previous.feedId === input.feedId ? previous.feedName : priced.feedName
  const pricePerQq =
    previous && previous.feedId === input.feedId && previous.storage === storage
      ? previous.pricePerQq
      : priced.pricePerQq
  return {
    id: previous?.id ?? uid(),
    date: input.date,
    stage: input.stage,
    feedId: input.feedId,
    feedName,
    quantityQq: input.quantityQq,
    storage,
    pricePerQq,
    cost: Number((input.quantityQq * pricePerQq).toFixed(4)),
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
      return { ...s, uses: [parsed, ...(s.uses ?? [])] }
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
