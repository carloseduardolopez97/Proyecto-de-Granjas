import type {
  Cepa,
  CepaDeath,
  CepaWeighing,
  CepaWeighMode,
  CostCurrency,
  DismissedAlert,
  EngordeLot,
  FarmStage,
  FeedProduct,
  FeedPurchase,
  FeedQtyMode,
  FeedStorage,
  FeedUse,
  Injection,
  InjectionLine,
  InjectionUse,
  MedicationEntry,
  MedicationProfile,
  MedicationPurchase,
  PharmacyState,
  StockUnit,
} from './types'

export function uid(): string {
  return crypto.randomUUID()
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function formatMoney(amount: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatUnitPrice(amount: number, currency = 'COP'): string {
  const digits = amount > 0 && amount < 1 ? 4 : amount < 100 ? 2 : 0
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
}

export function usdToPesos(usdAmount: number, usdRate: number): number {
  return Number(((usdAmount || 0) * (usdRate || 0)).toFixed(2))
}

export function formatDop(amount: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDopUnit(amount: number): string {
  const digits = amount > 0 && amount < 1 ? 4 : amount < 100 ? 2 : 0
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount)
}

export const LB_PER_QQ = 100
export const KG_PER_LB = 0.45359237
export const KG_PER_QQ = LB_PER_QQ * KG_PER_LB

export function formatQq(amount: number): string {
  return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 2 }).format(amount)
}

export function farmStageLabel(stage: FarmStage): string {
  return stage === 'engorde' ? 'Engorde' : 'Destete'
}

export function injectionUseStage(use: Pick<InjectionUse, 'stage'>): FarmStage {
  return use.stage === 'engorde' ? 'engorde' : 'destete'
}

export function formatKg(amount: number): string {
  return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 2 }).format(amount)
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}

export function lbToQq(lb: number): number {
  return lb / LB_PER_QQ
}

export function kgToQq(kg: number): number {
  return kg / KG_PER_QQ
}

export function cepaAvgWeightKg(totalWeightKg: number, pigletCount: number): number {
  if (pigletCount <= 0) return 0
  return totalWeightKg / pigletCount
}

export function resolveCepaWeighingMass(input: {
  pigletCount: number
  weighMode: CepaWeighMode
  weighedCount: number
  scaleWeightKg: number
}): { weighedCount: number; avgWeightKg: number; totalWeightKg: number } {
  const weighedCount = input.weighMode === 'census' ? input.pigletCount : input.weighedCount
  const avgWeightKg = cepaAvgWeightKg(input.scaleWeightKg, weighedCount)
  return {
    weighedCount,
    avgWeightKg,
    totalWeightKg: avgWeightKg * input.pigletCount,
  }
}

export function dailyGainKg(gainKg: number, days: number): number {
  if (days <= 0) return 0
  return gainKg / days
}

export function formatAgeDays(days: number): string {
  if (days <= 0) return '—'
  const weeks = days / 7
  const weekLabel =
    Number.isInteger(weeks) ? `${weeks} sem.` : `${weeks.toFixed(1).replace(/\.0$/, '')} sem.`
  return `${days} días (${weekLabel})`
}

export function cepaAgeOnDate(
  cepa: { date: string; arrivalAgeDays?: number },
  date: string,
): { daysOnFarm: number; arrivalAgeDays: number; ageDays: number } {
  const arrivalAgeDays = cepa.arrivalAgeDays && cepa.arrivalAgeDays > 0 ? cepa.arrivalAgeDays : 0
  const daysOnFarm = Math.max(0, isoDaysBetween(cepa.date, date))
  return {
    daysOnFarm,
    arrivalAgeDays,
    ageDays: arrivalAgeDays + daysOnFarm,
  }
}

export type HeadMovement = { id?: string; cepaId: string; date: string; count: number }

export function cepaCountUpTo(
  items: HeadMovement[],
  cepaId: string,
  date?: string,
  exceptId?: string,
): number {
  return items.reduce((sum, item) => {
    if (item.cepaId !== cepaId) return sum
    if (exceptId && item.id === exceptId) return sum
    if (date && item.date > date) return sum
    return sum + (item.count || 0)
  }, 0)
}

export function deathStage(item: { stage?: FarmStage }): FarmStage {
  return item.stage === 'engorde' ? 'engorde' : 'destete'
}

export function cepaDeathsUpTo(
  deaths: Array<{ id?: string; cepaId: string; date: string; count: number; stage?: FarmStage }>,
  cepaId: string,
  date?: string,
  exceptId?: string,
): number {
  return cepaCountUpTo(
    deaths.filter((item) => deathStage(item) === 'destete'),
    cepaId,
    date,
    exceptId,
  )
}

export function engordeDeathsUpTo(
  deaths: Array<{ id?: string; lotId?: string; date: string; count: number; stage?: FarmStage }>,
  lotId: string,
  date?: string,
  exceptId?: string,
): number {
  return deaths.reduce((sum, item) => {
    if (deathStage(item) !== 'engorde' || item.lotId !== lotId) return sum
    if (exceptId && item.id === exceptId) return sum
    if (date && item.date > date) return sum
    return sum + (item.count || 0)
  }, 0)
}

export function engordeLotLiveOnDate(
  lot: { id: string; pigCount: number },
  deaths: Array<{ id?: string; lotId?: string; date: string; count: number; stage?: FarmStage }>,
  date?: string,
  exceptId?: string,
): number {
  return Math.max(0, lot.pigCount - engordeDeathsUpTo(deaths, lot.id, date, exceptId))
}

export function engordeLotsAsMovements(
  lots: Array<{ id?: string; sourceCepaId: string; date: string; pigCount: number }>,
): HeadMovement[] {
  return lots.map((item) => ({
    id: item.id,
    cepaId: item.sourceCepaId,
    date: item.date,
    count: item.pigCount,
  }))
}

export function cepaLiveOnDate(
  cepa: { id: string; pigletCount: number },
  deaths: Array<{ cepaId: string; date: string; count: number; id?: string }>,
  date?: string,
  exceptDeathId?: string,
  transfers: HeadMovement[] = [],
  exceptTransferId?: string,
): number {
  return Math.max(
    0,
    cepa.pigletCount -
      cepaDeathsUpTo(deaths, cepa.id, date, exceptDeathId) -
      cepaCountUpTo(transfers, cepa.id, date, exceptTransferId),
  )
}

export function locationLiveCount(
  locationId: string,
  cepas: Array<{ id: string; locationId?: string; pigletCount: number }>,
  deaths: Array<{ cepaId: string; date: string; count: number; id?: string }>,
  transfers: HeadMovement[] = [],
): number {
  return cepas
    .filter((item) => item.locationId === locationId)
    .reduce((sum, item) => sum + cepaLiveOnDate(item, deaths, undefined, undefined, transfers), 0)
}

export function mergeLocationCatalogs(...lists: Array<Array<{ id: string; name: string; capacity: number }>>) {
  const map = new Map<string, { id: string; name: string; capacity: number }>()
  for (const list of lists) {
    for (const item of list) {
      if (item.id && !map.has(item.id)) map.set(item.id, item)
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function engordeLocationLiveCount(
  locationId: string,
  lots: Array<{ id: string; locationId: string; pigCount: number }>,
  deaths: Array<{ id?: string; lotId?: string; date: string; count: number; stage?: FarmStage }> = [],
): number {
  return lots
    .filter((item) => item.locationId === locationId)
    .reduce((sum, item) => sum + engordeLotLiveOnDate(item, deaths), 0)
}

export function feedStorageLabel(storage: FeedStorage): string {
  return storage === 'silo' ? 'Silo' : 'Sacos'
}

export function normalizeFeedStorage(value?: string): FeedStorage {
  return value === 'silo' ? 'silo' : 'saco'
}

export function feedKgFromSacks(sacks: number, sackWeightKg: number): number {
  return Number((sacks * sackWeightKg).toFixed(4))
}

export function kgPriceToPerSack(pricePerKg: number, sackWeightKg: number): number {
  return Number((pricePerKg * sackWeightKg).toFixed(6))
}

export function sackPriceToPerKg(pricePerSack: number, sackWeightKg: number): number {
  if (!(sackWeightKg > 0)) return 0
  return Number((pricePerSack / sackWeightKg).toFixed(6))
}

export function normalizeSackWeightKg(value?: number): number | undefined {
  if (!(value && value > 0)) return undefined
  return Number(value.toFixed(4))
}

export function formatFeedPurchaseQty(row: Pick<FeedPurchase, 'quantityKg' | 'sackCount' | 'sackWeightKg'>): string {
  if (row.sackCount && row.sackWeightKg) {
    return `${formatKg(row.sackCount)} sacos (${formatKg(row.sackWeightKg)} kg) · ${formatKg(row.quantityKg)} kg`
  }
  return `${formatKg(row.quantityKg)} kg`
}

export function convertDisplayedFeedPrice(
  current: { price: string; usdAmount: string },
  from: FeedQtyMode,
  to: FeedQtyMode,
  sackWeightKg: number,
): { price: string; usdAmount: string } {
  if (from === to || !(sackWeightKg > 0)) return current
  const factor = from === 'kg' && to === 'saco' ? sackWeightKg : 1 / sackWeightKg
  const scale = (value: string) => {
    if (!value) return value
    const n = Number(value)
    if (!(n >= 0)) return value
    return String(Number((n * factor).toFixed(6)))
  }
  return { price: scale(current.price), usdAmount: scale(current.usdAmount) }
}

export function latestFeedPrice(
  feedId: string,
  purchases: FeedPurchase[],
  products: FeedProduct[],
  date?: string,
  storage?: FeedStorage,
): { pricePerKg: number; feedName: string } | null {
  const product = products.find((item) => item.id === feedId)
  const eligible = purchases
    .filter(
      (item) =>
        item.feedId === feedId &&
        (!date || item.date <= date) &&
        (!storage || item.storage === storage),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  const purchase = eligible[0]
  if (purchase) return { pricePerKg: purchase.pricePerKg, feedName: purchase.feedName }
  if (storage) {
    const anyStorage = latestFeedPrice(feedId, purchases, products, date)
    if (anyStorage) return anyStorage
  }
  if (product) return { pricePerKg: product.pricePerKg, feedName: product.name }
  return null
}

export function feedPurchasedKg(purchases: FeedPurchase[], feedId?: string, storage?: FeedStorage): number {
  return purchases.reduce((sum, item) => {
    if (feedId && item.feedId !== feedId) return sum
    if (storage && item.storage !== storage) return sum
    return sum + (item.quantityKg || 0)
  }, 0)
}

export function feedUsedKg(uses: FeedUse[], feedId?: string, exceptId?: string, storage?: FeedStorage): number {
  return uses.reduce((sum, item) => {
    if (exceptId && item.id === exceptId) return sum
    if (feedId && item.feedId !== feedId) return sum
    if (storage && item.storage !== storage) return sum
    return sum + (item.quantityKg || 0)
  }, 0)
}

export function feedAvailableKg(
  purchases: FeedPurchase[],
  uses: FeedUse[],
  feedId: string,
  exceptUseId?: string,
  storage?: FeedStorage,
): number {
  return Number(
    (feedPurchasedKg(purchases, feedId, storage) - feedUsedKg(uses, feedId, exceptUseId, storage)).toFixed(4),
  )
}

export const GENERAL_COST_KEY = '__general__'

export type StageUsageRow = {
  key: string
  name: string
  feedCost: number
  pharmacyCost: number
  total: number
}

export function stageUsageCosts(input: {
  stage: FarmStage
  locations: Array<{ id: string; name: string }>
  feedUses: FeedUse[]
  injectionUses: InjectionUse[]
}): { rows: StageUsageRow[]; totals: StageUsageRow } {
  const byId = new Map<string, StageUsageRow>()
  const general: StageUsageRow = {
    key: GENERAL_COST_KEY,
    name: 'General',
    feedCost: 0,
    pharmacyCost: 0,
    total: 0,
  }
  for (const loc of input.locations) {
    byId.set(loc.id, { key: loc.id, name: loc.name, feedCost: 0, pharmacyCost: 0, total: 0 })
  }

  function bucket(locationId?: string): StageUsageRow {
    if (!locationId) return general
    return byId.get(locationId) ?? general
  }

  for (const use of input.feedUses) {
    if (use.stage !== input.stage) continue
    const cost = use.cost || 0
    const allocations = (use.allocations ?? []).filter((item) => item.locationId && item.quantityKg > 0)
    if (allocations.length === 0) {
      general.feedCost += cost
      continue
    }
    const heads = allocations.reduce((sum, item) => sum + item.quantityKg, 0)
    for (const item of allocations) {
      const share = heads > 0 ? cost * (item.quantityKg / heads) : 0
      bucket(item.locationId).feedCost += share
    }
  }

  for (const use of input.injectionUses) {
    if (injectionUseStage(use) !== input.stage) continue
    const cost = use.cost || 0
    const allocations = (use.allocations ?? []).filter((item) => item.locationId && item.doses > 0)
    if (allocations.length === 0) {
      general.pharmacyCost += cost
      continue
    }
    const doses = allocations.reduce((sum, item) => sum + item.doses, 0)
    for (const item of allocations) {
      const share = doses > 0 ? cost * (item.doses / doses) : 0
      const row = byId.get(item.locationId)
      if (row) row.pharmacyCost += share
      else general.pharmacyCost += share
    }
  }

  const rows = [general, ...[...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))].map((row) => ({
    ...row,
    total: row.feedCost + row.pharmacyCost,
  }))
  const totals = rows.reduce(
    (acc, row) => ({
      key: 'total',
      name: 'Total',
      feedCost: acc.feedCost + row.feedCost,
      pharmacyCost: acc.pharmacyCost + row.pharmacyCost,
      total: acc.total + row.total,
    }),
    { key: 'total', name: 'Total', feedCost: 0, pharmacyCost: 0, total: 0 },
  )
  return { rows, totals }
}

export type CostGroup = {
  id: string
  label: string
  locationId: string
  location: string
}

export function cepaGroupLabel(cepa: { date: string; supplierName: string; location: string }): string {
  return `${cepa.date} · ${cepa.supplierName} · ${cepa.location}`
}

export function desteteCostGroups(cepas: Cepa[]): CostGroup[] {
  return [...cepas]
    .sort((a, b) => b.date.localeCompare(a.date) || a.location.localeCompare(b.location, 'es'))
    .map((cepa) => ({
      id: cepa.id,
      label: cepaGroupLabel(cepa),
      locationId: cepa.locationId,
      location: cepa.location,
    }))
}

export function engordeCostGroups(cepas: Cepa[], lots: EngordeLot[]): CostGroup[] {
  const roomsByCepa = new Map<string, { locationId: string; names: string[] }>()
  for (const lot of lots) {
    const current = roomsByCepa.get(lot.sourceCepaId) ?? { locationId: lot.locationId, names: [] }
    if (lot.location && !current.names.includes(lot.location)) current.names.push(lot.location)
    if (!current.locationId) current.locationId = lot.locationId
    roomsByCepa.set(lot.sourceCepaId, current)
  }
  return cepas
    .filter((cepa) => roomsByCepa.has(cepa.id))
    .sort((a, b) => b.date.localeCompare(a.date) || a.supplierName.localeCompare(b.supplierName, 'es'))
    .map((cepa) => {
      const rooms = roomsByCepa.get(cepa.id)
      const location = rooms?.names.join(', ') || cepa.location
      return {
        id: cepa.id,
        label: `${cepa.date} · ${cepa.supplierName} · ${location}`,
        locationId: rooms?.locationId || cepa.locationId,
        location,
      }
    })
}

export type CepaCostSheet = {
  cepaId: string
  label: string
  purchaseCost: number
  desteteFeedCost: number
  destetePharmacyCost: number
  engordeFeedCost: number
  engordePharmacyCost: number
  feedCost: number
  pharmacyCost: number
  usedCost: number
  total: number
}

function guessCepaId(
  stage: FarmStage,
  locationId: string | undefined,
  cepas: Cepa[],
  lots: EngordeLot[],
): string | undefined {
  if (!locationId) return undefined
  if (stage === 'engorde') {
    const ids = [...new Set(lots.filter((item) => item.locationId === locationId).map((item) => item.sourceCepaId))]
    return ids.length === 1 ? ids[0] : undefined
  }
  const ids = cepas.filter((item) => item.locationId === locationId).map((item) => item.id)
  return ids.length === 1 ? ids[0] : undefined
}

export function cepaCostSheets(input: {
  cepas: Cepa[]
  lots?: EngordeLot[]
  feedUses: FeedUse[]
  injectionUses: InjectionUse[]
}): { sheets: CepaCostSheet[]; unassigned: { feedCost: number; pharmacyCost: number } } {
  const lots = input.lots ?? []
  const byId = new Map<string, CepaCostSheet>()
  for (const cepa of input.cepas) {
    const purchaseCost = cepaTotalCost(cepa)
    byId.set(cepa.id, {
      cepaId: cepa.id,
      label: cepaGroupLabel(cepa),
      purchaseCost,
      desteteFeedCost: 0,
      destetePharmacyCost: 0,
      engordeFeedCost: 0,
      engordePharmacyCost: 0,
      feedCost: 0,
      pharmacyCost: 0,
      usedCost: 0,
      total: purchaseCost,
    })
  }
  const unassigned = { feedCost: 0, pharmacyCost: 0 }

  function addFeed(cepaId: string, stage: FarmStage, amount: number) {
    const row = byId.get(cepaId)
    if (!row) {
      unassigned.feedCost += amount
      return
    }
    if (stage === 'engorde') row.engordeFeedCost += amount
    else row.desteteFeedCost += amount
  }

  function addPharmacy(cepaId: string, stage: FarmStage, amount: number) {
    const row = byId.get(cepaId)
    if (!row) {
      unassigned.pharmacyCost += amount
      return
    }
    if (stage === 'engorde') row.engordePharmacyCost += amount
    else row.destetePharmacyCost += amount
  }

  for (const use of input.feedUses) {
    const cost = use.cost || 0
    const stage = use.stage === 'engorde' ? 'engorde' : 'destete'
    const parts = (use.allocations ?? [])
      .map((item) => ({
        cepaId: item.cepaId || guessCepaId(stage, item.locationId, input.cepas, lots) || '',
        quantityKg: item.quantityKg,
      }))
      .filter((item) => item.cepaId && item.quantityKg > 0)
    if (parts.length === 0) {
      unassigned.feedCost += cost
      continue
    }
    const kg = parts.reduce((sum, item) => sum + item.quantityKg, 0)
    for (const item of parts) {
      addFeed(item.cepaId, stage, kg > 0 ? cost * (item.quantityKg / kg) : 0)
    }
  }

  for (const use of input.injectionUses) {
    const cost = use.cost || 0
    const stage = injectionUseStage(use)
    const parts = (use.allocations ?? [])
      .map((item) => ({
        cepaId: item.cepaId || guessCepaId(stage, item.locationId, input.cepas, lots) || '',
        doses: item.doses,
      }))
      .filter((item) => item.cepaId && item.doses > 0)
    if (parts.length === 0) {
      unassigned.pharmacyCost += cost
      continue
    }
    const doses = parts.reduce((sum, item) => sum + item.doses, 0)
    for (const item of parts) {
      addPharmacy(item.cepaId, stage, doses > 0 ? cost * (item.doses / doses) : 0)
    }
  }

  const sheets = [...byId.values()].map((row) => {
    const feedCost = row.desteteFeedCost + row.engordeFeedCost
    const pharmacyCost = row.destetePharmacyCost + row.engordePharmacyCost
    const usedCost = feedCost + pharmacyCost
    return { ...row, feedCost, pharmacyCost, usedCost, total: row.purchaseCost + usedCost }
  })
  return { sheets, unassigned }
}

export function emptyCepaCostSheet(cepaId: string, label = ''): CepaCostSheet {
  return {
    cepaId,
    label,
    purchaseCost: 0,
    desteteFeedCost: 0,
    destetePharmacyCost: 0,
    engordeFeedCost: 0,
    engordePharmacyCost: 0,
    feedCost: 0,
    pharmacyCost: 0,
    usedCost: 0,
    total: 0,
  }
}

export function splitKgByHeads(totalKg: number, counts: number[]): number[] {
  const heads = counts.reduce((sum, count) => sum + count, 0)
  if (heads <= 0 || !(totalKg > 0)) return counts.map(() => 0)
  const parts = counts.map((count) => Number(((totalKg * count) / heads).toFixed(4)))
  const drift = Number((totalKg - parts.reduce((sum, part) => sum + part, 0)).toFixed(4))
  parts[parts.length - 1] = Number((parts[parts.length - 1] + drift).toFixed(4))
  return parts
}

export function cepaTotalCost(input: {
  costBasis: 'piglet' | 'kg' | 'qq'
  unitCost: number
  pigletCount: number
  totalWeightKg: number
}): number {
  if (input.costBasis === 'piglet') return input.pigletCount * input.unitCost
  if (input.costBasis === 'qq') return kgToQq(input.totalWeightKg) * input.unitCost
  return input.totalWeightKg * input.unitCost
}

export type CepaWeightPoint = {
  id: string
  date: string
  pigletCount: number
  totalWeightKg: number
  avgWeightKg: number
  weighMode: CepaWeighMode
  estimated: boolean
  source: 'purchase' | 'weighing'
}

export function isoDaysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00`)
  const end = Date.parse(`${to}T00:00:00`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

export function cepaPurchasePoint(cepa: {
  id: string
  date: string
  pigletCount: number
  totalWeightKg: number
}): CepaWeightPoint {
  return {
    id: `purchase:${cepa.id}`,
    date: cepa.date,
    pigletCount: cepa.pigletCount,
    totalWeightKg: cepa.totalWeightKg,
    avgWeightKg: cepaAvgWeightKg(cepa.totalWeightKg, cepa.pigletCount),
    weighMode: 'census',
    estimated: false,
    source: 'purchase',
  }
}

export function cepaWeightPoints(
  cepa: { id: string; date: string; pigletCount: number; totalWeightKg: number },
  weighings: Array<{
    id: string
    cepaId: string
    date: string
    pigletCount: number
    totalWeightKg: number
    weighMode?: CepaWeighMode
  }>,
): CepaWeightPoint[] {
  const extras = weighings
    .filter((item) => item.cepaId === cepa.id)
    .map((item): CepaWeightPoint => {
      const weighMode = item.weighMode ?? 'census'
      return {
        id: item.id,
        date: item.date,
        pigletCount: item.pigletCount,
        totalWeightKg: item.totalWeightKg,
        avgWeightKg: cepaAvgWeightKg(item.totalWeightKg, item.pigletCount),
        weighMode,
        estimated: weighMode === 'sample',
        source: 'weighing',
      }
    })
  return [cepaPurchasePoint(cepa), ...extras].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )
}

export function latestCepaWeight(
  cepa: { id: string; date: string; pigletCount: number; totalWeightKg: number },
  weighings: Array<{
    id: string
    cepaId: string
    date: string
    pigletCount: number
    totalWeightKg: number
    weighMode?: CepaWeighMode
  }>,
): CepaWeightPoint {
  const points = cepaWeightPoints(cepa, weighings)
  return points[points.length - 1] ?? cepaPurchasePoint(cepa)
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

export function costInCop(input: {
  cost: number
  costCurrency?: CostCurrency
  usdAmount?: number
  usdRate?: number
}): number {
  if (input.costCurrency === 'USD') {
    return Number(((input.usdAmount ?? 0) * (input.usdRate ?? 0)).toFixed(2))
  }
  return input.cost
}

export function purchasePackCost(purchase: { cost: number; quantity: number }): number {
  if (purchase.quantity <= 0) return 0
  return purchase.cost / purchase.quantity
}

export function packPriceLabel(unit: StockUnit): string {
  return usesPackageSize(unit) ? 'envase' : unitLabel(unit)
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function usesPackageSize(unit: StockUnit): boolean {
  return unit === 'ml' || unit === 'cc' || unit === 'litro'
}

export function isVolumeUnit(unit: StockUnit): boolean {
  return unit === 'ml' || unit === 'cc' || unit === 'litro'
}

export function stockFamily(unit: StockUnit): string {
  if (isVolumeUnit(unit)) return 'volume'
  return unit
}

export function unitsMatch(a: StockUnit, b: StockUnit): boolean {
  return stockFamily(a) === stockFamily(b)
}

/** ml, cc and liters share the same liquid; 1 litro = 1000 ml. */
export function toMl(amount: number, unit: StockUnit): number | null {
  if (unit === 'ml' || unit === 'cc') return amount
  if (unit === 'litro') return amount * 1000
  return null
}

export function fromMl(ml: number, unit: StockUnit): number {
  if (unit === 'litro') return ml / 1000
  return ml
}

export function toCanonical(amount: number, unit: StockUnit): number {
  return toMl(amount, unit) ?? amount
}

export function fromCanonical(amount: number, unit: StockUnit): number {
  if (isVolumeUnit(unit)) return fromMl(amount, unit)
  return amount
}

export function unitLabel(unit: StockUnit, plural = false): string {
  const labels: Record<StockUnit, [string, string]> = {
    ml: ['ml', 'ml'],
    cc: ['cc', 'cc'],
    sobre: ['sobre', 'sobres'],
    litro: ['litro', 'litros'],
    pastilla: ['pastilla', 'pastillas'],
    kg: ['kg', 'kg'],
  }
  const [one, many] = labels[unit]
  return plural ? many : one
}

function formatSimple(amount: number, unit: StockUnit): string {
  const rounded = Number(Number(amount).toFixed(4))
  const value = Number.isInteger(rounded) ? String(rounded) : String(rounded)
  return `${value} ${unitLabel(unit, rounded !== 1)}`
}

export function formatQty(amount: number, unit: StockUnit): string {
  if (unit === 'litro') {
    const ml = Number((amount * 1000).toFixed(4))
    if (ml <= 0) return formatSimple(0, 'litro')
    const liters = Math.floor(ml / 1000)
    const rest = Number((ml - liters * 1000).toFixed(4))
    if (liters > 0 && rest > 0) return `${formatSimple(liters, 'litro')} y ${formatSimple(rest, 'ml')}`
    if (liters > 0) return formatSimple(liters, 'litro')
    return formatSimple(rest, 'ml')
  }
  return formatSimple(amount, unit)
}

export function formatVolumeMl(ml: number): string {
  return formatQty(ml / 1000, 'litro')
}

export function entryStockAmount(quantity: number, size: number, unit: StockUnit): number {
  if (usesPackageSize(unit)) return quantity * (size || 1)
  return quantity
}

export function withEntryDefaults(entry: MedicationEntry & { remainingMl?: number }): MedicationEntry {
  const remaining =
    typeof entry.remaining === 'number' ? entry.remaining : (entry.remainingMl ?? 0)
  return {
    ...entry,
    unit: entry.unit ?? 'ml',
    size: entry.size || 1,
    remaining,
    costCurrency: entry.costCurrency ?? 'COP',
  }
}

export function withInjectionLineDefaults(line: InjectionLine): InjectionLine {
  return {
    medicationName: line.medicationName,
    amount: line.amount,
    unit: line.unit ?? 'ml',
  }
}

export function remainingAfterEdit(
  current: MedicationEntry,
  next: { quantity: number; size: number; unit: StockUnit },
): number {
  const newTotal = entryStockAmount(next.quantity, next.size, next.unit)
  if (!unitsMatch(current.unit, next.unit)) return newTotal
  const oldTotal = entryStockAmount(current.quantity, current.size, current.unit)
  const consumed = Math.max(
    0,
    toCanonical(oldTotal, current.unit) - toCanonical(current.remaining, current.unit),
  )
  return Math.max(0, fromCanonical(toCanonical(newTotal, next.unit) - consumed, next.unit))
}

export function costPerUnit(entry: MedicationEntry): number {
  const totalNative = entryStockAmount(entry.quantity, entry.size, entry.unit)
  const total = toMl(totalNative, entry.unit) ?? totalNative
  if (!total) return 0
  return entry.cost / total
}

export type StockRow = {
  name: string
  unit: StockUnit
  remaining: number
  original: number
  inventoryCost: number
  purchaseGen: string
}

export const LOW_STOCK_RATIO = 0.2

export type StockAlertLevel = 'empty' | 'low'

export function stockAlertLevel(row: StockRow): StockAlertLevel | null {
  if (row.remaining <= 0.0001) return 'empty'
  if (row.original <= 0) return null
  if (row.remaining / row.original <= LOW_STOCK_RATIO) return 'low'
  return null
}

export function stockAlertMessage(row: StockRow, level: StockAlertLevel): string {
  if (level === 'empty') return `${row.name} se acabó. Hay que comprar más.`
  const qty = isVolumeUnit(row.unit) ? formatVolumeMl(row.remaining) : formatQty(row.remaining, row.unit)
  return `${row.name} está a punto de acabarse (quedan ${qty}). Debe reponerse.`
}

export function stockAlerts(rows: StockRow[]): Array<StockRow & { level: StockAlertLevel; message: string }> {
  return rows
    .map((row) => {
      const level = stockAlertLevel(row)
      if (!level) return null
      return { ...row, level, message: stockAlertMessage(row, level) }
    })
    .filter((row): row is StockRow & { level: StockAlertLevel; message: string } => row !== null)
}

export function pharmacyRestockAlerts(
  entries: MedicationEntry[],
  injections: Injection[],
): Array<StockRow & { level: StockAlertLevel; message: string }> {
  const stock = stockByMedication(entries)
  const alerts = stockAlerts(stock)
  const seen = new Set(alerts.map((alert) => `${normalizeName(alert.name)}|${stockFamily(alert.unit)}`))

  for (const injection of injections) {
    for (const line of injection.lines) {
      const name = line.medicationName.trim()
      if (!name) continue
      const key = `${normalizeName(name)}|${stockFamily(line.unit)}`
      if (seen.has(key)) continue
      const row = stock.find(
        (item) => normalizeName(item.name) === normalizeName(name) && unitsMatch(item.unit, line.unit),
      )
      if (row && row.remaining > 0.0001) continue
      seen.add(key)
      alerts.push({
        name,
        unit: isVolumeUnit(line.unit) ? 'ml' : line.unit,
        remaining: 0,
        original: row?.original ?? 0,
        inventoryCost: 0,
        purchaseGen: row?.purchaseGen ?? 'none',
        level: 'empty',
        message: `${name} se acabó. Hay que comprar más.`,
      })
    }
  }

  return alerts.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'empty' ? -1 : 1
    return a.name.localeCompare(b.name, 'es')
  })
}

export function stockByMedication(entries: MedicationEntry[]): StockRow[] {
  const map = new Map<string, StockRow>()
  for (const entry of entries) {
    const family = stockFamily(entry.unit)
    const key = `${normalizeName(entry.name)}|${family}`
    const current = map.get(key) ?? {
      name: entry.name.trim(),
      unit: isVolumeUnit(entry.unit) ? 'ml' : entry.unit,
      remaining: 0,
      original: 0,
      inventoryCost: 0,
      purchaseGen: entry.id,
    }
    const remainingNative = Math.max(0, entry.remaining)
    const remaining = toCanonical(remainingNative, entry.unit)
    const pack = toCanonical(entryStockAmount(entry.quantity, entry.size, entry.unit), entry.unit)
    current.remaining += remaining
    // Solo lotes con existencias: si no, un reabastecimiento seguiría alertando por compras ya vacías.
    if (remaining > 0.0001) current.original += pack
    current.inventoryCost += remaining * costPerUnit(entry)
    if (!map.has(key)) {
      current.name = entry.name.trim()
      current.unit = isVolumeUnit(entry.unit) ? 'ml' : entry.unit
    }
    map.set(key, current)
  }
  return [...map.values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'es') || a.unit.localeCompare(b.unit),
  )
}

export function totalInventoryCost(entries: MedicationEntry[]): number {
  return stockByMedication(entries).reduce((n, row) => n + row.inventoryCost, 0)
}

export function deductFifo(
  entries: MedicationEntry[],
  medicationName: string,
  amount: number,
  unit: StockUnit,
): { entries: MedicationEntry[]; ok: boolean; cost: number } {
  const key = normalizeName(medicationName)
  let left = toCanonical(amount, unit)
  let cost = 0
  const next = entries.map((entry) => ({ ...entry }))
  const order = next
    .map((entry, index) => ({ entry, index }))
    .filter(
      ({ entry }) =>
        normalizeName(entry.name) === key && unitsMatch(entry.unit, unit) && entry.remaining > 0,
    )
    .sort((a, b) => a.entry.date.localeCompare(b.entry.date) || a.index - b.index)

  for (const { entry } of order) {
    if (left <= 0) break
    const have = toCanonical(entry.remaining, entry.unit)
    const take = Math.min(have, left)
    const leftover = have - take
    cost += take * costPerUnit(entry)
    entry.remaining = Number(fromCanonical(leftover, entry.unit).toFixed(6))
    left = Number((left - take).toFixed(6))
  }

  return { entries: next, ok: left <= 0.0001, cost }
}

export function applyInjectionUse(
  entries: MedicationEntry[],
  injection: Injection,
  doses: number,
): { entries: MedicationEntry[]; ok: boolean; cost: number; missing?: string } {
  let next = entries
  let cost = 0
  for (const line of injection.lines) {
    const need = line.amount * doses
    const result = deductFifo(next, line.medicationName, need, line.unit)
    if (!result.ok) {
      return { entries, ok: false, cost: 0, missing: line.medicationName }
    }
    next = result.entries
    cost += result.cost
  }
  return { entries: next, ok: true, cost }
}

export function withUseDefaults(use: InjectionUse): InjectionUse {
  const cost = typeof use.cost === 'number' ? use.cost : 0
  const fromAllocations = (use.allocations ?? []).filter(
    (item) => item.doses > 0 && (item.cepaId || item.locationId),
  )
  const allocations =
    fromAllocations.length > 0
      ? fromAllocations.map((item) => ({
          cepaId: item.cepaId ?? '',
          cepaName: item.cepaName ?? '',
          doses: item.doses,
          locationId: item.locationId,
          location: item.location,
        }))
      : use.locationId
        ? [{ cepaId: '', cepaName: '', locationId: use.locationId, location: use.location ?? '', doses: use.doses }]
        : []
  return { ...use, cost, allocations, injectionName: use.injectionName?.trim() ?? '', stage: injectionUseStage(use) }
}

export function useInjectionLabel(use: InjectionUse, injections: Injection[]): string {
  return injections.find((item) => item.id === use.injectionId)?.name.trim() || use.injectionName?.trim() || ''
}

export function formatUseAllocations(use: InjectionUse): string {
  const allocations = use.allocations ?? []
  if (allocations.length === 0) return 'Sin cepa'
  return allocations
    .map((item) => {
      const name = item.cepaName?.trim() || item.location?.trim() || 'Cepa'
      return allocations.length > 1 ? `${name} (${item.doses})` : name
    })
    .join(', ')
}

export type StageActionKind = 'compra' | 'peso' | 'muerte' | 'alimento' | 'inyeccion' | 'traslado'

export type StageAction = {
  id: string
  date: string
  kind: StageActionKind
  title: string
  detail: string
}

function feedAction(row: FeedUse): StageAction {
  const place =
    (row.allocations ?? []).length > 0
      ? (row.allocations ?? [])
          .map((item) => `${item.cepaName?.trim() || item.location || 'Cepa'} (${formatKg(item.quantityKg)} kg)`)
          .join(', ')
      : 'Sin cepa'
  return {
    id: `alimento-${row.id}`,
    date: row.date,
    kind: 'alimento',
    title: 'Alimentación',
    detail: `${row.feedName} · ${feedStorageLabel(row.storage)} · ${formatKg(row.quantityKg)} kg · ${place}`,
  }
}

function injectionAction(row: InjectionUse, injections: Injection[]): StageAction {
  const name = useInjectionLabel(row, injections) || 'Inyección'
  return {
    id: `inyeccion-${row.id}`,
    date: row.date,
    kind: 'inyeccion',
    title: 'Inyección',
    detail: `${name} · ${row.doses} ${row.doses === 1 ? 'dosis' : 'dosis'} · ${formatUseAllocations(row)} · ${formatDop(row.cost || 0)}`,
  }
}

export function buildStageActions(input: {
  stage: FarmStage
  cepas?: Cepa[]
  weighings?: CepaWeighing[]
  deaths?: CepaDeath[]
  lots?: EngordeLot[]
  feedUses: FeedUse[]
  injectionUses: InjectionUse[]
  injections: Injection[]
}): StageAction[] {
  const actions: StageAction[] = []
  const cepas = input.cepas ?? []
  const cepaById = new Map(cepas.map((item) => [item.id, item]))

  if (input.stage === 'destete') {
    for (const row of cepas) {
      actions.push({
        id: `compra-${row.id}`,
        date: row.date,
        kind: 'compra',
        title: 'Compra de destete',
        detail: `${row.supplierName} · ${row.location} · ${row.pigletCount} lechones`,
      })
    }
    for (const row of input.weighings ?? []) {
      const cepa = cepaById.get(row.cepaId)
      actions.push({
        id: `peso-${row.id}`,
        date: row.date,
        kind: 'peso',
        title: 'Actualizar peso',
        detail: `${cepa?.location || 'Jaula'} · ${formatKg(row.totalWeightKg)} · promedio ${formatKg(row.avgWeightKg)}`,
      })
    }
    for (const row of input.deaths ?? []) {
      if (deathStage(row) !== 'destete') continue
      const cepa = cepaById.get(row.cepaId)
      actions.push({
        id: `muerte-${row.id}`,
        date: row.date,
        kind: 'muerte',
        title: 'Muerte',
        detail: `${cepa?.location || 'Jaula'} · ${row.count} ${row.count === 1 ? 'lechón' : 'lechones'}${row.note ? ` · ${row.note}` : ''}`,
      })
    }
    for (const row of input.lots ?? []) {
      actions.push({
        id: `traslado-${row.id}`,
        date: row.date,
        kind: 'traslado',
        title: 'Traslado a engorde',
        detail: `${row.sourceLocation} → ${row.location} · ${row.pigCount} cerdos`,
      })
    }
  } else {
    for (const row of input.lots ?? []) {
      actions.push({
        id: `traslado-${row.id}`,
        date: row.date,
        kind: 'traslado',
        title: 'Traslado a engorde',
        detail: `${row.sourceLocation} → ${row.location} · ${row.pigCount} cerdos`,
      })
    }
    for (const row of input.deaths ?? []) {
      if (deathStage(row) !== 'engorde') continue
      const lot = (input.lots ?? []).find((item) => item.id === row.lotId)
      actions.push({
        id: `muerte-${row.id}`,
        date: row.date,
        kind: 'muerte',
        title: 'Muerte',
        detail: `${lot?.location || 'Sala'} · ${row.count} ${row.count === 1 ? 'cerdo' : 'cerdos'}${row.note ? ` · ${row.note}` : ''}`,
      })
    }
  }

  for (const row of input.feedUses) {
    if (row.stage !== input.stage) continue
    actions.push(feedAction(row))
  }
  for (const row of input.injectionUses) {
    if (injectionUseStage(row) !== input.stage) continue
    actions.push(injectionAction(row, input.injections))
  }

  return actions.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

export function injectionUseSummary(uses: InjectionUse[], injections: Injection[]) {
  const map = new Map<string, { id: string; name: string; doses: number; cost: number }>()
  for (const use of uses) {
    const name = useInjectionLabel(use, injections)
    if (!name) continue
    const current = map.get(use.injectionId) ?? { id: use.injectionId, name, doses: 0, cost: 0 }
    current.name = name
    current.doses += use.doses
    current.cost += use.cost ?? 0
    map.set(use.injectionId, current)
  }
  const breakdown = [...map.values()].sort((a, b) => b.doses - a.doses || a.name.localeCompare(b.name, 'es'))
  return {
    totalDoses: breakdown.reduce((sum, row) => sum + row.doses, 0),
    totalCost: breakdown.reduce((sum, row) => sum + row.cost, 0),
    breakdown,
  }
}

export function emptyPharmacy(): PharmacyState {
  return { entries: [], injections: [], uses: [], catalog: [], dismissedAlerts: [], purchases: [] }
}

export function withPurchaseDefaults(purchase: MedicationPurchase): MedicationPurchase {
  return {
    ...purchase,
    unit: purchase.unit ?? 'ml',
    size: purchase.size || 1,
    costCurrency: purchase.costCurrency ?? 'COP',
  }
}

export function purchaseFromEntry(entry: MedicationEntry): MedicationPurchase {
  return {
    id: entry.id,
    entryId: entry.id,
    name: entry.name.trim(),
    date: entry.date,
    quantity: entry.quantity,
    size: entry.size || 1,
    unit: entry.unit,
    cost: entry.cost,
    costCurrency: entry.costCurrency ?? 'COP',
    usdAmount: entry.usdAmount,
    usdRate: entry.usdRate,
  }
}

export function upsertPurchaseForEntry(
  purchases: MedicationPurchase[] | undefined,
  entry: MedicationEntry,
): MedicationPurchase[] {
  const next = purchaseFromEntry(entry)
  const list = [...(purchases ?? [])]
  const index = list.findIndex((item) => item.entryId === entry.id || item.id === entry.id)
  if (index < 0) return [next, ...list]
  list[index] = { ...list[index], ...next, id: list[index].id, entryId: entry.id }
  return list
}

export function mergePurchases(
  saved: MedicationPurchase[] | undefined,
  entries: MedicationEntry[],
): MedicationPurchase[] {
  const list = (saved ?? []).map(withPurchaseDefaults)
  const seen = new Set(list.flatMap((item) => [item.id, item.entryId].filter(Boolean) as string[]))
  for (const entry of entries) {
    if (seen.has(entry.id)) continue
    list.push(purchaseFromEntry(entry))
    seen.add(entry.id)
  }
  return list
}

export function purchaseUnitCost(purchase: MedicationPurchase): number {
  const qty = entryStockAmount(purchase.quantity, purchase.size, purchase.unit)
  if (qty <= 0) return 0
  return purchase.cost / qty
}

export function purchaseCanonicalUnitCost(purchase: MedicationPurchase): number {
  const qty = toCanonical(entryStockAmount(purchase.quantity, purchase.size, purchase.unit), purchase.unit)
  if (qty <= 0) return 0
  return purchase.cost / qty
}

export function comparablePriceUnit(unit: StockUnit): StockUnit {
  return unit
}

export type PurchasePriceChange = 'first' | 'up' | 'down' | 'same'

export type PurchaseHistoryRow = {
  purchase: MedicationPurchase
  unitCost: number
  displayUnit: StockUnit
  change: PurchasePriceChange
  changePct: number
}

export type PurchaseHistoryGroup = {
  name: string
  displayUnit: StockUnit
  rows: PurchaseHistoryRow[]
}

export function purchaseHistoryGroups(purchases: MedicationPurchase[]): PurchaseHistoryGroup[] {
  const map = new Map<string, MedicationPurchase[]>()
  for (const purchase of purchases) {
    const key = `${normalizeName(purchase.name)}|${stockFamily(purchase.unit)}`
    const rows = map.get(key) ?? []
    rows.push(purchase)
    map.set(key, rows)
  }

  return [...map.values()]
    .map((items) => {
      const chronological = [...items].sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
      )
      const latest = chronological[chronological.length - 1]
      const rows = chronological.map((purchase, index): PurchaseHistoryRow => {
        const unitCost = purchaseUnitCost(purchase)
        const displayUnit = purchase.unit
        if (index === 0) return { purchase, unitCost, displayUnit, change: 'first', changePct: 0 }
        const previous = purchaseCanonicalUnitCost(chronological[index - 1])
        const current = purchaseCanonicalUnitCost(purchase)
        if (previous <= 0) return { purchase, unitCost, displayUnit, change: 'first', changePct: 0 }
        const changePct = ((current - previous) / previous) * 100
        const change: PurchasePriceChange =
          Math.abs(changePct) < 0.5 ? 'same' : current > previous ? 'up' : 'down'
        return { purchase, unitCost, displayUnit, change, changePct }
      })
      rows.reverse()
      return {
        name: latest.name,
        displayUnit: latest.unit,
        rows,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function purchaseHistoryRows(purchases: MedicationPurchase[]): PurchaseHistoryRow[] {
  return purchaseHistoryGroups(purchases)
    .flatMap((group) => group.rows)
    .sort(
      (a, b) =>
        b.purchase.date.localeCompare(a.purchase.date) || b.purchase.id.localeCompare(a.purchase.id),
    )
}

export function restockAlertKey(name: string, unit: StockUnit): string {
  return `${normalizeName(name)}|${stockFamily(unit)}`
}

export function isAlertDismissed(
  dismissed: DismissedAlert[] | undefined,
  alert: { name: string; unit: StockUnit; level: StockAlertLevel; purchaseGen: string },
): boolean {
  const key = restockAlertKey(alert.name, alert.unit)
  return (dismissed ?? []).some(
    (item) => item.key === key && item.level === alert.level && item.purchaseGen === alert.purchaseGen,
  )
}

export function toDismissedAlert(alert: {
  name: string
  unit: StockUnit
  level: StockAlertLevel
  purchaseGen: string
}): DismissedAlert {
  return {
    key: restockAlertKey(alert.name, alert.unit),
    level: alert.level,
    purchaseGen: alert.purchaseGen,
  }
}

export function catalogKey(name: string, unit: StockUnit): string {
  return `${normalizeName(name)}|${unit}`
}

export type RestockPrefill = {
  name: string
  unit: StockUnit
  size: number
  quantity: number
  cost: number
  costCurrency: CostCurrency
  usdAmount?: number
  usdRate?: number
  catalogKey: string
}

export function restockPrefill(
  name: string,
  unit: StockUnit,
  catalog: MedicationProfile[],
  purchases: MedicationPurchase[],
  lastUsdRate?: number,
): RestockPrefill {
  const profile = catalog.find(
    (item) => normalizeName(item.name) === normalizeName(name) && unitsMatch(item.unit, unit),
  )
  const lastPurchase = [...purchases]
    .filter((item) => normalizeName(item.name) === normalizeName(name) && unitsMatch(item.unit, unit))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0]
  const nextUnit = lastPurchase?.unit ?? profile?.unit ?? unit
  const quantity = lastPurchase?.quantity ?? profile?.lastQuantity ?? 1
  const size = lastPurchase?.size ?? profile?.size ?? 1
  const costCurrency = lastPurchase?.costCurrency ?? 'COP'
  return {
    name: (lastPurchase?.name ?? profile?.name ?? name).trim(),
    unit: nextUnit,
    size: usesPackageSize(nextUnit) ? size : 1,
    quantity: quantity > 0 ? quantity : 1,
    cost: lastPurchase?.cost ?? profile?.lastCost ?? 0,
    costCurrency,
    usdAmount: lastPurchase?.usdAmount,
    usdRate: lastPurchase?.usdRate ?? lastUsdRate,
    catalogKey: profile ? `${profile.name}|${profile.unit}` : '',
  }
}

export function upsertCatalog(
  catalog: PharmacyState['catalog'],
  profile: PharmacyState['catalog'][number],
): PharmacyState['catalog'] {
  const key = catalogKey(profile.name, profile.unit)
  const next = catalog.filter((item) => catalogKey(item.name, item.unit) !== key)
  return [...next, profile].sort((a, b) => a.name.localeCompare(b.name, 'es') || a.unit.localeCompare(b.unit))
}

export function catalogFromEntries(entries: MedicationEntry[]): PharmacyState['catalog'] {
  const map = new Map<string, PharmacyState['catalog'][number]>()
  for (const entry of entries) {
    const key = catalogKey(entry.name, entry.unit)
    if (map.has(key)) continue
    map.set(key, {
      name: entry.name.trim(),
      unit: entry.unit,
      size: entry.size || 1,
      lastQuantity: entry.quantity,
      lastCost: entry.cost,
    })
  }
  return [...map.values()]
}

export function mergeCatalog(
  saved: PharmacyState['catalog'] | undefined,
  fromEntries: PharmacyState['catalog'],
): PharmacyState['catalog'] {
  const map = new Map<string, PharmacyState['catalog'][number]>()
  for (const item of saved ?? []) map.set(catalogKey(item.name, item.unit), item)
  for (const item of fromEntries) map.set(catalogKey(item.name, item.unit), item)
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es') || a.unit.localeCompare(b.unit))
}
