export type StockUnit = 'ml' | 'cc' | 'sobre' | 'litro' | 'pastilla' | 'kg'

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

export type InjectionUse = {
  id: string
  injectionId: string
  date: string
  doses: number
  cost: number
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
export const THEME_KEY = 'porcigranja.theme'
