import type {
  CostCurrency,
  DismissedAlert,
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
  return { ...use, cost: typeof use.cost === 'number' ? use.cost : 0 }
}

export function injectionUseSummary(uses: InjectionUse[], injections: Injection[]) {
  const totalDoses = uses.reduce((n, item) => n + item.doses, 0)
  const totalCost = uses.reduce((n, item) => n + (item.cost ?? 0), 0)
  const map = new Map<string, { name: string; doses: number; cost: number }>()
  for (const use of uses) {
    const injection = injections.find((item) => item.id === use.injectionId)
    const name = injection?.name ?? 'Inyección eliminada'
    const current = map.get(use.injectionId) ?? { name, doses: 0, cost: 0 }
    current.name = name
    current.doses += use.doses
    current.cost += use.cost ?? 0
    map.set(use.injectionId, current)
  }
  return {
    totalDoses,
    totalCost,
    breakdown: [...map.values()].sort((a, b) => b.doses - a.doses || a.name.localeCompare(b.name, 'es')),
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
