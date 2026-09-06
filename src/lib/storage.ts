import { emptyState, seedState, unitCost, withLotDefaults } from './calc'
import { STORAGE_KEY, type FarmState, type Feed, type Medication } from './types'

function withMedPrice(med: Medication): Medication {
  if (typeof med.unitPrice === 'number' && med.unitPrice > 0) return med
  return { ...med, unitPrice: unitCost({ ...med, unitPrice: 0 }) }
}

function withFeedPrice(feed: Feed): Feed {
  if (typeof feed.unitPrice === 'number' && feed.unitPrice > 0) return feed
  return { ...feed, unitPrice: feed.lastUnitCost ?? 0 }
}

export function loadState(): FarmState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState()
    const parsed = JSON.parse(raw) as Partial<FarmState>
    const seed = seedState()
    const lots = (parsed.lots ?? []).map((lot, i) => withLotDefaults(lot, i))
    const uniqueOrder = new Set(lots.map((lot) => lot.sortIndex)).size === lots.length
    return {
      ...emptyState(),
      ...parsed,
      medications: (parsed.medications ?? []).map(withMedPrice),
      formulas: parsed.formulas ?? [],
      lots: uniqueOrder ? lots : lots.map((lot, i) => ({ ...lot, sortIndex: i })),
      lotSortMode: parsed.lotSortMode === 'custom' ? 'custom' : 'arrival',
      events: parsed.events ?? [],
      diseases: parsed.diseases ?? [],
      feeds: (parsed.feeds ?? seed.feeds).map(withFeedPrice),
      feedEntries: parsed.feedEntries ?? seed.feedEntries,
    }
  } catch {
    return seedState()
  }
}

export function saveState(state: FarmState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
