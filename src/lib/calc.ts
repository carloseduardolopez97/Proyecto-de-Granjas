import type {
  FarmState,
  Feed,
  Formula,
  Lot,
  LotEvent,
  LotSupplier,
  LotVaccinePlan,
  Medication,
} from './types'

export function uid(): string {
  return crypto.randomUUID()
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function unitCost(med: Medication): number {
  if (med.unitPrice > 0) return med.unitPrice
  if (!med.packageQty) return 0
  return med.packageCost / med.packageQty
}

export function formulaCost(formula: Formula, medications: Medication[], doses = 1): number {
  return formula.lines.reduce((sum, line) => {
    const med = medications.find((m) => m.id === line.medicationId)
    if (!med) return sum
    return sum + unitCost(med) * line.quantity * doses
  }, 0)
}

export function daysBetween(fromIso: string, to = new Date()): number {
  const from = new Date(`${fromIso}T00:00:00`)
  const ms = to.getTime() - from.getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

export function lotAgeDays(entryDate: string, ageAtEntryDays: number): number {
  return ageAtEntryDays + daysBetween(entryDate)
}

export function lotAgeWeeks(entryDate: string, ageAtEntryDays: number): number {
  return lotAgeDays(entryDate, ageAtEntryDays) / 7
}

export function formatAgeWeeks(entryDate: string, ageAtEntryDays: number): string {
  const days = lotAgeDays(entryDate, ageAtEntryDays)
  const weeks = Math.floor(days / 7)
  const rest = days % 7
  if (rest === 0) return `${weeks} sem`
  return `${weeks} sem ${rest} d`
}

export function supplierAvgWeightKg(supplier: LotSupplier): number {
  if (!supplier.headcount) return 0
  return supplier.totalWeightKg / supplier.headcount
}

export function lotFeedConsumption(events: LotEvent[], lotId: string) {
  const rows = events.filter((e) => e.lotId === lotId && e.type === 'alimento')
  return {
    quantity: rows.reduce((n, e) => n + e.quantity, 0),
    cost: rows.reduce((n, e) => n + e.cost, 0),
  }
}

export function farmFeedConsumption(events: LotEvent[]) {
  const rows = events.filter((e) => e.type === 'alimento')
  return {
    quantity: rows.reduce((n, e) => n + e.quantity, 0),
    cost: rows.reduce((n, e) => n + e.cost, 0),
  }
}

export type VaccineAlertLevel = 'vencida' | 'hoy' | 'proxima'

export type VaccineAlert = {
  lotId: string
  lotName: string
  supplierName: string
  vaccine: LotVaccinePlan
  level: VaccineAlertLevel
  daysUntil: number
}

export function vaccineAlertLevel(dueDate: string, today = todayIso()): VaccineAlertLevel | null {
  if (dueDate < today) return 'vencida'
  if (dueDate === today) return 'hoy'
  const days = daysBetween(today, new Date(`${dueDate}T00:00:00`))
  if (days <= 7) return 'proxima'
  return null
}

export function lotVaccineAlerts(lots: Lot[], today = todayIso()): VaccineAlert[] {
  const alerts: VaccineAlert[] = []
  for (const lot of lots) {
    for (const supplier of lot.suppliers ?? []) {
      for (const vaccine of supplier.vaccines ?? []) {
        if (vaccine.applied) continue
        const level = vaccineAlertLevel(vaccine.dueDate, today)
        if (!level) continue
        const daysUntil =
          vaccine.dueDate >= today
            ? daysBetween(today, new Date(`${vaccine.dueDate}T00:00:00`))
            : -daysBetween(vaccine.dueDate, new Date(`${today}T00:00:00`))
        alerts.push({
          lotId: lot.id,
          lotName: lot.cageOrName || lot.name,
          supplierName: supplier.name,
          vaccine,
          level,
          daysUntil,
        })
      }
    }
  }
  const rank = { vencida: 0, hoy: 1, proxima: 2 }
  return alerts.sort((a, b) => rank[a.level] - rank[b.level] || a.daysUntil - b.daysUntil)
}

export function sortLots(lots: Lot[], mode: FarmState['lotSortMode']): Lot[] {
  const copy = [...lots]
  if (mode === 'custom') {
    return copy.sort((a, b) => a.sortIndex - b.sortIndex || a.entryDate.localeCompare(b.entryDate))
  }
  return copy.sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.sortIndex - b.sortIndex)
}

export function formatMoney(amount: number, currency = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatQty(n: number, unit?: string): string {
  const value = Number.isInteger(n) ? String(n) : n.toFixed(2)
  return unit ? `${value} ${unit}` : value
}

export function feedNativeStock(feed: Feed): number {
  return feed.storage === 'saco' ? feed.stockSacks : feed.stockQuintales
}

export function feedNativeUnit(feed: Feed): string {
  return feed.storage === 'saco' ? 'sacos' : 'qq'
}

export function feedStockKg(feed: Feed): number {
  if (feed.storage === 'saco') return feed.stockSacks * feed.sackWeightKg
  return feed.stockQuintales * feed.quintalKg
}

export function feedUnitPrice(feed: Feed): number {
  return feed.unitPrice > 0 ? feed.unitPrice : feed.lastUnitCost
}

export function feedCostPerKg(feed: Feed): number {
  const kg = feed.storage === 'saco' ? feed.sackWeightKg : feed.quintalKg
  const price = feedUnitPrice(feed)
  if (!kg || !price) return 0
  return price / kg
}

export function withLotDefaults(lot: Lot, index = 0): Lot {
  const cageOrName = lot.cageOrName || lot.name
  const suppliers: LotSupplier[] =
    lot.suppliers?.length > 0
      ? lot.suppliers.map((s) => ({
          ...s,
          vaccines: (s.vaccines ?? []).map((v) => ({ ...v, applied: Boolean(v.applied) })),
        }))
      : [
          {
            id: lot.id ? `${lot.id}-sup` : uid(),
            name: 'Sin suplidor',
            headcount: lot.initialHeadcount ?? 0,
            totalWeightKg: 0,
            vaccines: [],
          },
        ]
  const heads = suppliers.reduce((n, s) => n + (s.headcount || 0), 0)
  return {
    ...lot,
    name: cageOrName,
    cageOrName,
    stage: lot.stage ?? 'destete',
    status: lot.status ?? (lot.currentHeadcount > 0 ? 'activa' : 'transferida'),
    lineageId: lot.lineageId ?? lot.id,
    parentLotId: lot.parentLotId ?? null,
    transferredOut: lot.transferredOut ?? 0,
    suppliers,
    initialHeadcount: lot.initialHeadcount || heads,
    sortIndex: typeof lot.sortIndex === 'number' ? lot.sortIndex : index,
  }
}

export function lotDeaths(events: LotEvent[], lotId: string): number {
  return events
    .filter((e) => e.lotId === lotId && e.type === 'mortalidad')
    .reduce((n, e) => n + e.quantity, 0)
}

export function lotPatioCost(events: LotEvent[], lotId: string): number {
  return events
    .filter((e) => e.lotId === lotId && e.type !== 'venta' && e.type !== 'transferencia')
    .reduce((n, e) => n + e.cost, 0)
}

export function lineageLots(lots: Lot[], lineageId: string): Lot[] {
  return lots.filter((l) => l.lineageId === lineageId)
}

export function originLot(lots: Lot[], lineageId: string): Lot | undefined {
  return lots.find((l) => l.lineageId === lineageId && !l.parentLotId)
}

export function lineagePnl(lots: Lot[], events: LotEvent[], lineageId: string) {
  const members = lineageLots(lots, lineageId)
  const ids = new Set(members.map((l) => l.id))
  const origin = originLot(lots, lineageId)
  const purchase = origin?.purchaseCost ?? 0
  const patio = events
    .filter((e) => ids.has(e.lotId) && e.type !== 'venta' && e.type !== 'transferencia')
    .reduce((n, e) => n + e.cost, 0)
  const revenue = events
    .filter((e) => ids.has(e.lotId) && e.type === 'venta')
    .reduce((n, e) => n + (e.revenue ?? 0), 0)
  const destetePatio = members
    .filter((l) => l.stage === 'destete')
    .reduce((n, l) => n + lotPatioCost(events, l.id), 0)
  const engordePatio = members
    .filter((l) => l.stage === 'engorde')
    .reduce((n, l) => n + lotPatioCost(events, l.id), 0)
  return {
    purchase,
    destetePatio,
    engordePatio,
    patio,
    revenue,
    totalCost: purchase + patio,
    benefit: revenue - purchase - patio,
    projected:
      members
        .filter((l) => l.stage === 'engorde' && l.status === 'activa')
        .reduce((n, l) => n + l.currentHeadcount * l.targetWeightKg * l.salePricePerKg, 0) ||
      members
        .filter((l) => l.status === 'activa')
        .reduce((n, l) => n + l.currentHeadcount * l.targetWeightKg * l.salePricePerKg, 0),
  }
}

export const emptyState = (): FarmState => ({
  farmName: 'Mi granja',
  currency: 'COP',
  medications: [],
  formulas: [],
  feeds: [],
  feedEntries: [],
  lots: [],
  events: [],
  diseases: [],
  lotSortMode: 'arrival',
})

export const seedState = (): FarmState => ({
  farmName: 'Granja El Roble',
  currency: 'COP',
  diseases: [
    { id: uid(), name: 'Diarrea' },
    { id: uid(), name: 'Neumonía' },
    { id: uid(), name: 'Cojera' },
  ],
  medications: [
    {
      id: 'med-amox',
      name: 'Amoxicilina 15%',
      presentation: 'Frasco 500 ml',
      unit: 'ml',
      packageQty: 500,
      packageCost: 85_000,
      unitPrice: 170,
      stock: 420,
      minStock: 100,
      notes: 'Antibiótico de amplio espectro',
    },
    {
      id: 'med-iverm',
      name: 'Ivermectina 1%',
      presentation: 'Frasco 50 ml',
      unit: 'ml',
      packageQty: 50,
      packageCost: 32_000,
      unitPrice: 640,
      stock: 38,
      minStock: 20,
      notes: 'Desparasitante',
    },
    {
      id: 'med-fe',
      name: 'Hierro dextrano',
      presentation: 'Frasco 100 ml',
      unit: 'ml',
      packageQty: 100,
      packageCost: 28_000,
      unitPrice: 280,
      stock: 90,
      minStock: 30,
      notes: '',
    },
  ],
  formulas: [
    {
      id: 'f-destete',
      name: 'Recepción destete',
      indication: 'Aplicar el día de ingreso a engorde',
      lines: [
        { medicationId: 'med-iverm', quantity: 0.3 },
        { medicationId: 'med-fe', quantity: 1 },
      ],
    },
  ],
  feeds: [
    {
      id: 'feed-pre',
      name: 'Preiniciador',
      storage: 'saco',
      sackWeightKg: 40,
      quintalKg: 50,
      stockSacks: 30,
      stockQuintales: 0,
      lastUnitCost: 96_000,
      unitPrice: 96_000,
      minStock: 10,
      notes: 'Almacenado en bodega de sacos',
    },
    {
      id: 'feed-eng',
      name: 'Engorde',
      storage: 'silo',
      sackWeightKg: 40,
      quintalKg: 50,
      stockSacks: 0,
      stockQuintales: 24,
      lastUnitCost: 85_000,
      unitPrice: 85_000,
      minStock: 8,
      notes: 'Descarga a silo',
    },
  ],
  feedEntries: [
    {
      id: 'fe-1',
      feedId: 'feed-pre',
      date: new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10),
      quantity: 30,
      totalCost: 2_880_000,
      notes: 'Compra inicial en sacos',
    },
    {
      id: 'fe-2',
      feedId: 'feed-eng',
      date: new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10),
      quantity: 24,
      totalCost: 2_040_000,
      notes: 'Llenado de silo',
    },
  ],
  lots: [
    {
      id: 'lot-demo',
      name: 'Jaula 12',
      cageOrName: 'Jaula 12',
      stage: 'destete',
      status: 'activa',
      lineageId: 'lot-demo',
      parentLotId: null,
      entryDate: new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10),
      ageAtEntryDays: 28,
      initialHeadcount: 120,
      currentHeadcount: 117,
      transferredOut: 0,
      purchaseCost: 18_000_000,
      targetWeightKg: 110,
      salePricePerKg: 9_200,
      notes: 'Lote de ejemplo para el prototipo',
      sortIndex: 0,
      suppliers: [
        {
          id: 'sup-demo-1',
          name: 'Granada Porcícola',
          headcount: 70,
          totalWeightKg: 490,
          vaccines: [
            {
              id: 'vac-demo-1',
              name: 'Circovirus',
              dueDate: new Date().toISOString().slice(0, 10),
              applied: false,
            },
          ],
        },
        {
          id: 'sup-demo-2',
          name: 'El Roble',
          headcount: 50,
          totalWeightKg: 375,
          vaccines: [
            {
              id: 'vac-demo-2',
              name: 'Mycoplasma',
              dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
              applied: false,
            },
          ],
        },
      ],
    },
  ],
  events: [
    {
      id: uid(),
      lotId: 'lot-demo',
      date: new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10),
      type: 'alimento',
      quantity: 40,
      cost: 96_000,
      notes: 'Preiniciador — 40 kg',
    },
    {
      id: uid(),
      lotId: 'lot-demo',
      date: new Date(Date.now() - 4 * 86_400_000).toISOString().slice(0, 10),
      type: 'mortalidad',
      quantity: 3,
      cost: 0,
      notes: 'Diarrea post-destete',
      diseaseName: 'Diarrea',
    },
  ],
  lotSortMode: 'arrival',
})
