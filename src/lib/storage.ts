import { catalogFromEntries, cepaAvgWeightKg, emptyPharmacy, KG_PER_QQ, lbToKg, mergeCatalog, mergePurchases, normalizeFeedStorage, resolveCepaWeighingMass, uid, withEntryDefaults, withInjectionLineDefaults, withUseDefaults } from './calc'
import {
  CEPA_STORAGE_KEY,
  FEED_STORAGE_KEY,
  STORAGE_KEY,
  type Cepa,
  type CepaDeath,
  type CepaLocation,
  type CepaState,
  type CepaSupplier,
  type CepaWeighing,
  type EngordeLot,
  type FeedProduct,
  type FeedPurchase,
  type FeedState,
  type FeedUse,
  type PharmacyState,
} from './types'

export function emptyFeed(): FeedState {
  return { products: [], purchases: [], uses: [], feedUnit: 'kg' }
}

type LegacyFeedMass = { quantityKg?: number; quantityQq?: number }
type LegacyFeedPrice = { pricePerKg?: number; pricePerQq?: number; usdAmount?: number }

function qqMassToKg(amount: number): number {
  return Number((amount * KG_PER_QQ).toFixed(4))
}

function qqUnitPriceToKg(amount: number): number {
  return Number((amount / KG_PER_QQ).toFixed(6))
}

function feedMassKg(item: LegacyFeedMass, convertFromQq: boolean): number {
  const raw = convertFromQq ? (item.quantityQq ?? item.quantityKg ?? 0) : (item.quantityKg ?? item.quantityQq ?? 0)
  return convertFromQq ? qqMassToKg(raw) : raw
}

function feedPricePerKg(item: LegacyFeedPrice, convertFromQq: boolean): number {
  const raw = convertFromQq ? (item.pricePerQq ?? item.pricePerKg ?? 0) : (item.pricePerKg ?? item.pricePerQq ?? 0)
  return convertFromQq ? qqUnitPriceToKg(raw) : raw
}

function feedUsdPerKg(usdAmount: number | undefined, convertFromQq: boolean): number | undefined {
  if (usdAmount == null) return usdAmount
  return convertFromQq ? qqUnitPriceToKg(usdAmount) : usdAmount
}

function withFeedProductDefaults(product: FeedProduct): FeedProduct {
  return {
    ...product,
    priceCurrency: product.priceCurrency ?? 'DOP',
    sackWeightKg: product.sackWeightKg && product.sackWeightKg > 0 ? product.sackWeightKg : undefined,
  }
}

function withFeedPurchaseDefaults(purchase: FeedPurchase): FeedPurchase {
  return {
    ...purchase,
    storage: normalizeFeedStorage(purchase.storage),
    priceCurrency: purchase.priceCurrency ?? 'DOP',
    sackCount: purchase.sackCount && purchase.sackCount > 0 ? purchase.sackCount : undefined,
    sackWeightKg: purchase.sackWeightKg && purchase.sackWeightKg > 0 ? purchase.sackWeightKg : undefined,
  }
}

export function loadPharmacy(): PharmacyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyPharmacy()
    const parsed = JSON.parse(raw) as Partial<PharmacyState>
    const entries = (parsed.entries ?? []).map(withEntryDefaults)
    return {
      entries,
      injections: (parsed.injections ?? []).map((injection) => {
        const description = injection.description?.trim()
        return {
          ...injection,
          description: description || undefined,
          lines: (injection.lines ?? []).map(withInjectionLineDefaults),
        }
      }),
      uses: (parsed.uses ?? []).map((use) => {
        const next = withUseDefaults(use)
        if (next.injectionName) return next
        const name = (parsed.injections ?? []).find((item) => item.id === use.injectionId)?.name?.trim() ?? ''
        return { ...next, injectionName: name }
      }),
      catalog: mergeCatalog(parsed.catalog, catalogFromEntries(entries)),
      dismissedAlerts: parsed.dismissedAlerts ?? [],
      purchases: mergePurchases(parsed.purchases, entries),
      lastUsdRate: parsed.lastUsdRate,
    }
  } catch {
    return emptyPharmacy()
  }
}

export function savePharmacy(state: PharmacyState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function withFeedUseDefaults(item: FeedUse): FeedUse {
  const quantityKg = item.quantityKg || 0
  const pricePerKg = item.pricePerKg || 0
  const allocations = (item.allocations ?? []).filter((row) => row.quantityKg > 0 && (row.cepaId || row.locationId))
  return {
    id: item.id,
    date: item.date,
    stage: item.stage === 'engorde' ? 'engorde' : 'destete',
    feedId: item.feedId,
    feedName: item.feedName?.trim() || '',
    quantityKg,
    storage: normalizeFeedStorage(item.storage),
    pricePerKg,
    cost: item.cost && item.cost > 0 ? item.cost : Number((quantityKg * pricePerKg).toFixed(4)),
    allocations: allocations.map((row) => ({
      cepaId: row.cepaId ?? '',
      cepaName: row.cepaName ?? '',
      quantityKg: row.quantityKg,
      locationId: row.locationId,
      location: row.location,
    })),
  }
}

export function loadFeed(): FeedState {
  try {
    const raw = localStorage.getItem(FEED_STORAGE_KEY)
    if (!raw) return emptyFeed()
    const parsed = JSON.parse(raw) as Partial<FeedState> & {
      products?: Array<FeedProduct & LegacyFeedPrice>
      purchases?: Array<FeedPurchase & LegacyFeedMass & LegacyFeedPrice>
      uses?: Array<
        FeedUse &
          LegacyFeedMass &
          LegacyFeedPrice & {
            allocations?: Array<{
              cepaId?: string
              cepaName?: string
              locationId?: string
              location?: string
              quantityKg?: number
              quantityQq?: number
            }>
          }
      >
    }
    const convertFromQq = parsed.feedUnit !== 'kg'
    return {
      products: (parsed.products ?? []).map((product) =>
        withFeedProductDefaults({
          ...product,
          pricePerKg: feedPricePerKg(product, convertFromQq),
          usdAmount: feedUsdPerKg(product.usdAmount, convertFromQq),
        }),
      ),
      purchases: (parsed.purchases ?? []).map((purchase) =>
        withFeedPurchaseDefaults({
          ...purchase,
          quantityKg: feedMassKg(purchase, convertFromQq),
          pricePerKg: feedPricePerKg(purchase, convertFromQq),
          usdAmount: feedUsdPerKg(purchase.usdAmount, convertFromQq),
        }),
      ),
      uses: (parsed.uses ?? []).map((use) =>
        withFeedUseDefaults({
          ...use,
          quantityKg: feedMassKg(use, convertFromQq),
          pricePerKg: feedPricePerKg(use, convertFromQq),
          allocations: (use.allocations ?? []).map((row) => ({
            cepaId: row.cepaId ?? '',
            cepaName: row.cepaName ?? '',
            locationId: row.locationId,
            location: row.location ?? '',
            quantityKg: feedMassKg(row, convertFromQq),
          })),
        }),
      ),
      lastUsdRate: parsed.lastUsdRate,
      feedUnit: 'kg',
    }
  } catch {
    return emptyFeed()
  }
}

export function saveFeed(state: FeedState): void {
  localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify({ ...state, feedUnit: 'kg' }))
}

export function emptyCepa(): CepaState {
  return {
    suppliers: [],
    locations: [],
    engordeLocations: [],
    cepas: [],
    weighings: [],
    deaths: [],
    engordeLots: [],
  }
}

function toWeightKg(raw: {
  totalWeightKg?: number
  totalWeightLb?: number
  avgWeightKg?: number
  avgWeightLb?: number
  pigletCount: number
}): number {
  if (raw.totalWeightKg && raw.totalWeightKg > 0) return raw.totalWeightKg
  if (raw.totalWeightLb && raw.totalWeightLb > 0) return lbToKg(raw.totalWeightLb)
  if (raw.avgWeightKg && raw.pigletCount > 0) return raw.avgWeightKg * raw.pigletCount
  if (raw.avgWeightLb && raw.pigletCount > 0) return lbToKg(raw.avgWeightLb * raw.pigletCount)
  return 0
}

function withWeighingDefaults(
  item: CepaWeighing & { totalWeightLb?: number; avgWeightLb?: number; scaleWeightKg?: number; weighedCount?: number },
): CepaWeighing {
  const pigletCount = item.pigletCount || 0
  const weighMode = item.weighMode ?? 'census'
  const scaleWeightKg =
    item.scaleWeightKg && item.scaleWeightKg > 0 ? item.scaleWeightKg : toWeightKg({ ...item, pigletCount })
  const weighedInput = item.weighedCount && item.weighedCount > 0 ? item.weighedCount : pigletCount
  const resolved = resolveCepaWeighingMass({
    pigletCount,
    weighMode,
    weighedCount: weighedInput,
    scaleWeightKg,
  })
  return {
    id: item.id,
    cepaId: item.cepaId,
    date: item.date,
    pigletCount,
    weighMode,
    weighedCount: resolved.weighedCount,
    scaleWeightKg,
    totalWeightKg: resolved.totalWeightKg,
    avgWeightKg: resolved.avgWeightKg,
  }
}

function withCepaDefaults(
  cepa: Cepa & {
    avgWeightLb?: number
    totalWeightLb?: number
    avgWeightKg?: number
    totalWeightKg?: number
    weightUnit?: string
    costBasis?: Cepa['costBasis'] | 'qq'
  },
): Cepa {
  const pigletCount = cepa.pigletCount || 0
  const totalWeightKg = toWeightKg({ ...cepa, pigletCount })
  return {
    id: cepa.id,
    date: cepa.date,
    supplierId: cepa.supplierId,
    supplierName: cepa.supplierName,
    locationId: cepa.locationId ?? '',
    location: cepa.location,
    pigletCount,
    arrivalAgeDays: cepa.arrivalAgeDays && cepa.arrivalAgeDays > 0 ? cepa.arrivalAgeDays : 0,
    totalWeightKg,
    avgWeightKg: cepaAvgWeightKg(totalWeightKg, pigletCount),
    costBasis: cepa.costBasis === 'qq' ? 'kg' : cepa.costBasis ?? 'piglet',
    unitCost: cepa.costBasis === 'qq' ? cepa.unitCost / KG_PER_QQ : cepa.unitCost,
    priceCurrency: cepa.priceCurrency ?? 'DOP',
    usdAmount:
      cepa.costBasis === 'qq' && cepa.usdAmount != null ? cepa.usdAmount / KG_PER_QQ : cepa.usdAmount,
    usdRate: cepa.usdRate,
  }
}

function withSupplierDefaults(item: CepaSupplier): CepaSupplier {
  return {
    id: item.id,
    name: item.name,
    saleAgeDays: item.saleAgeDays && item.saleAgeDays > 0 ? item.saleAgeDays : undefined,
  }
}

function withDeathDefaults(item: CepaDeath): CepaDeath {
  const count = item.count || 0
  const daysOnFarm = item.daysOnFarm || 0
  const arrivalAgeDays = item.arrivalAgeDays || 0
  return {
    id: item.id,
    cepaId: item.cepaId,
    date: item.date,
    count,
    daysOnFarm,
    arrivalAgeDays,
    ageDays: item.ageDays && item.ageDays > 0 ? item.ageDays : arrivalAgeDays + daysOnFarm,
    note: item.note?.trim() || undefined,
    stage: item.stage === 'engorde' ? 'engorde' : 'destete',
    lotId: item.stage === 'engorde' && item.lotId ? item.lotId : undefined,
  }
}

function withLocationDefaults(item: CepaLocation): CepaLocation {
  return {
    id: item.id,
    name: item.name.trim(),
    capacity: item.capacity && item.capacity > 0 ? item.capacity : 0,
  }
}

function withEngordeLotDefaults(item: EngordeLot): EngordeLot {
  const pigCount = item.pigCount || 0
  const totalWeightKg = item.totalWeightKg && item.totalWeightKg > 0 ? item.totalWeightKg : 0
  return {
    id: item.id,
    date: item.date,
    sourceCepaId: item.sourceCepaId,
    sourceLocation: item.sourceLocation?.trim() || '',
    sourceSupplierName: item.sourceSupplierName?.trim() || '',
    locationId: item.locationId ?? '',
    location: item.location?.trim() || '',
    pigCount,
    totalWeightKg,
    avgWeightKg: item.avgWeightKg && item.avgWeightKg > 0 ? item.avgWeightKg : cepaAvgWeightKg(totalWeightKg, pigCount),
    arrivalAgeDays: item.arrivalAgeDays && item.arrivalAgeDays > 0 ? item.arrivalAgeDays : 0,
    daysOnFarm: item.daysOnFarm && item.daysOnFarm > 0 ? item.daysOnFarm : 0,
  }
}

function mergeNamedLocations(
  saved: CepaLocation[] | undefined,
  fromRecords: Array<{ location: string; locationId?: string }>,
): { locations: CepaLocation[]; assigned: CepaLocation[] } {
  const locations = (saved ?? [])
    .map(withLocationDefaults)
    .filter((item) => item.id && item.name)
  const byId = new Map(locations.map((item) => [item.id, item]))
  const byName = new Map(locations.map((item) => [item.name.toLowerCase(), item]))

  function ensureLocation(name: string, id?: string): CepaLocation {
    const trimmed = name.trim()
    const existingId = id ? byId.get(id) : undefined
    if (existingId) return existingId
    const existingName = trimmed ? byName.get(trimmed.toLowerCase()) : undefined
    if (existingName) return existingName
    const created: CepaLocation = {
      id: id && !byId.has(id) ? id : uid(),
      name: trimmed || 'Sin ubicación',
      capacity: 0,
    }
    locations.push(created)
    byId.set(created.id, created)
    byName.set(created.name.toLowerCase(), created)
    return created
  }

  const assigned = fromRecords.map((row) => ensureLocation(row.location, row.locationId))
  locations.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return { locations, assigned }
}

export function loadCepa(): CepaState {
  try {
    const raw = localStorage.getItem(CEPA_STORAGE_KEY)
    if (!raw) return emptyCepa()
    const parsed = JSON.parse(raw) as Partial<CepaState>
    const cepas = (parsed.cepas ?? []).map(withCepaDefaults)
    const destete = mergeNamedLocations(parsed.locations, cepas)
    const desteteIds = new Set(destete.locations.map((item) => item.id))
    const lots = (parsed.engordeLots ?? []).map(withEngordeLotDefaults)
    const savedEngorde = (parsed.engordeLocations ?? []).filter((item) => item.id && !desteteIds.has(item.id))
    const engordeLotsForCatalog = lots.filter((lot) => !lot.locationId || !desteteIds.has(lot.locationId))
    const engorde = mergeNamedLocations(savedEngorde, engordeLotsForCatalog)
    let assignedIndex = 0
    return {
      suppliers: (parsed.suppliers ?? []).map(withSupplierDefaults),
      locations: destete.locations,
      engordeLocations: engorde.locations,
      cepas: cepas.map((cepa, index) => {
        const loc = destete.assigned[index]
        return { ...cepa, locationId: loc.id, location: cepa.location.trim() || loc.name }
      }),
      weighings: (parsed.weighings ?? []).map(withWeighingDefaults),
      deaths: (parsed.deaths ?? []).map(withDeathDefaults),
      engordeLots: lots.map((lot) => {
        if (lot.locationId && desteteIds.has(lot.locationId)) {
          const dest = destete.locations.find((item) => item.id === lot.locationId)
          return { ...lot, location: lot.location.trim() || dest?.name || lot.location }
        }
        const loc = engorde.assigned[assignedIndex]
        assignedIndex += 1
        return { ...lot, locationId: loc.id, location: lot.location.trim() || loc.name }
      }),
      lastUsdRate: parsed.lastUsdRate,
    }
  } catch {
    return emptyCepa()
  }
}

export function saveCepa(state: CepaState): void {
  localStorage.setItem(CEPA_STORAGE_KEY, JSON.stringify(state))
}
