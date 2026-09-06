export type ProgramMode = 'engorde' | 'reproduccion' | 'ciclo_completo'

export type Medication = {
  id: string
  name: string
  presentation: string
  unit: string
  packageQty: number
  packageCost: number
  unitPrice: number
  stock: number
  minStock: number
  notes: string
}

export type FormulaLine = {
  medicationId: string
  quantity: number
}

export type Formula = {
  id: string
  name: string
  indication: string
  lines: FormulaLine[]
}

export type LotStage = 'destete' | 'engorde'
export type LotStatus = 'activa' | 'transferida' | 'cerrada'
export type LotSortMode = 'arrival' | 'custom'

export type LotVaccinePlan = {
  id: string
  name: string
  dueDate: string
  applied: boolean
}

export type LotSupplier = {
  id: string
  name: string
  headcount: number
  totalWeightKg: number
  vaccines: LotVaccinePlan[]
}

export type Lot = {
  id: string
  name: string
  cageOrName: string
  stage: LotStage
  status: LotStatus
  lineageId: string
  parentLotId: string | null
  entryDate: string
  ageAtEntryDays: number
  initialHeadcount: number
  currentHeadcount: number
  transferredOut: number
  purchaseCost: number
  targetWeightKg: number
  salePricePerKg: number
  notes: string
  suppliers: LotSupplier[]
  sortIndex: number
}

export type LotEventType =
  | 'alimento'
  | 'vacuna'
  | 'medicamento'
  | 'formula'
  | 'mortalidad'
  | 'inventario'
  | 'enfermedad'
  | 'transferencia'
  | 'venta'

export type LotEvent = {
  id: string
  lotId: string
  date: string
  type: LotEventType
  quantity: number
  cost: number
  notes: string
  formulaId?: string
  doses?: number
  diseaseName?: string
  feedId?: string
  relatedLotId?: string
  revenue?: number
}

export type Disease = {
  id: string
  name: string
}

export type FeedStorage = 'saco' | 'silo'

export type Feed = {
  id: string
  name: string
  storage: FeedStorage
  sackWeightKg: number
  quintalKg: number
  stockSacks: number
  stockQuintales: number
  lastUnitCost: number
  unitPrice: number
  minStock: number
  notes: string
}

export type FeedEntry = {
  id: string
  feedId: string
  date: string
  quantity: number
  totalCost: number
  notes: string
}

export type FarmState = {
  farmName: string
  currency: string
  medications: Medication[]
  formulas: Formula[]
  feeds: Feed[]
  feedEntries: FeedEntry[]
  lots: Lot[]
  events: LotEvent[]
  diseases: Disease[]
  lotSortMode: LotSortMode
}

export const STORAGE_KEY = 'porcigranja.v1'
export const THEME_KEY = 'porcigranja.theme'
