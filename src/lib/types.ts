export type StockUnit = 'ml' | 'cc' | 'sobre' | 'litro' | 'pastilla' | 'kg'

export type FarmStage = 'destete' | 'engorde'

export const STOCK_UNITS: Array<{ value: StockUnit; label: string; hint: string }> = [
  { value: 'ml', label: 'Inyectable (ml)', hint: 'Frascos o envases medidos en mililitros' },
  { value: 'cc', label: 'Inyectable (cc)', hint: 'Frascos o envases medidos en centímetros cúbicos' },
  { value: 'sobre', label: 'Sobres', hint: 'Polvo o soluble, típico para el agua' },
  { value: 'litro', label: 'Litros', hint: 'Líquido a granel o para el agua' },
  { value: 'pastilla', label: 'Pastillas', hint: 'Tabletas o comprimidos' },
  { value: 'kg', label: 'Kilogramos', hint: 'Polvo o premix a granel' },
]

export type CostCurrency = 'COP' | 'USD'

export type MedicationEntry = {
  id: string
  name: string
  date: string
  quantity: number
  size: number
  unit: StockUnit
  cost: number
  remaining: number
  costCurrency: CostCurrency
  usdAmount?: number
  usdRate?: number
}

export type InjectionLine = {
  medicationName: string
  amount: number
  unit: StockUnit
}

export type Injection = {
  id: string
  name: string
  lines: InjectionLine[]
}

export type InjectionUseAllocation = {
  locationId: string
  location: string
  doses: number
}

export type InjectionUse = {
  id: string
  injectionId: string
  date: string
  doses: number
  cost: number
  stage?: FarmStage
  injectionName?: string
  allocations?: InjectionUseAllocation[]
  locationId?: string
  location?: string
}

export type MedicationProfile = {
  name: string
  unit: StockUnit
  size: number
  lastQuantity: number
  lastCost: number
}

export type MedicationPurchase = {
  id: string
  entryId?: string
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

export type DismissedAlert = {
  key: string
  level: 'empty' | 'low'
  purchaseGen: string
}

export type PharmacyState = {
  entries: MedicationEntry[]
  injections: Injection[]
  uses: InjectionUse[]
  catalog: MedicationProfile[]
  dismissedAlerts: DismissedAlert[]
  purchases: MedicationPurchase[]
  lastUsdRate?: number
}

export const STORAGE_KEY = 'porcigranja.farmacia.v1'
export const FEED_STORAGE_KEY = 'porcigranja.alimento.v1'
export const CEPA_STORAGE_KEY = 'porcigranja.cepa.v1'
export const THEME_KEY = 'porcigranja.theme'

export type FeedCurrency = 'DOP' | 'USD'

export type FeedStorage = 'silo' | 'saco'

export const FEED_STORAGES: Array<{ value: FeedStorage; label: string; hint: string }> = [
  { value: 'silo', label: 'Silo', hint: 'Alimento a granel en silo' },
  { value: 'saco', label: 'Sacos', hint: 'Alimento en sacos' },
]

export type FeedProduct = {
  id: string
  name: string
  pricePerQq: number
  priceCurrency: FeedCurrency
  usdAmount?: number
  usdRate?: number
}

export type FeedPurchase = {
  id: string
  feedId: string
  feedName: string
  date: string
  invoiceNumber: string
  quantityQq: number
  storage: FeedStorage
  pricePerQq: number
  priceCurrency: FeedCurrency
  usdAmount?: number
  usdRate?: number
}

export type FeedState = {
  products: FeedProduct[]
  purchases: FeedPurchase[]
  uses: FeedUse[]
  lastUsdRate?: number
}

export type FeedUseAllocation = {
  locationId: string
  location: string
  quantityQq: number
}

export type FeedUse = {
  id: string
  date: string
  stage: FarmStage
  feedId: string
  feedName: string
  quantityQq: number
  storage: FeedStorage
  pricePerQq: number
  cost: number
  allocations?: FeedUseAllocation[]
}

export type CepaCostBasis = 'piglet' | 'kg'

export type CepaWeighMode = 'census' | 'sample'

export type CepaLocation = {
  id: string
  name: string
  capacity: number
}

export type CepaSupplier = {
  id: string
  name: string
  saleAgeDays?: number
}

export type CepaWeighing = {
  id: string
  cepaId: string
  date: string
  pigletCount: number
  weighMode: CepaWeighMode
  weighedCount: number
  scaleWeightKg: number
  totalWeightKg: number
  avgWeightKg: number
}

export type Cepa = {
  id: string
  date: string
  supplierId: string
  supplierName: string
  locationId: string
  location: string
  pigletCount: number
  arrivalAgeDays: number
  totalWeightKg: number
  avgWeightKg: number
  costBasis: CepaCostBasis
  unitCost: number
  priceCurrency: FeedCurrency
  usdAmount?: number
  usdRate?: number
}

export type CepaDeath = {
  id: string
  cepaId: string
  date: string
  count: number
  daysOnFarm: number
  arrivalAgeDays: number
  ageDays: number
  note?: string
}

export type EngordeLot = {
  id: string
  date: string
  sourceCepaId: string
  sourceLocation: string
  sourceSupplierName: string
  locationId: string
  location: string
  pigCount: number
  totalWeightKg: number
  avgWeightKg: number
  arrivalAgeDays: number
  daysOnFarm: number
}

export type CepaState = {
  suppliers: CepaSupplier[]
  locations: CepaLocation[]
  engordeLocations: CepaLocation[]
  cepas: Cepa[]
  weighings: CepaWeighing[]
  deaths: CepaDeath[]
  engordeLots: EngordeLot[]
  lastUsdRate?: number
}
