import { catalogFromEntries, emptyPharmacy, mergeCatalog, mergePurchases, withEntryDefaults, withInjectionLineDefaults, withUseDefaults } from './calc'
import { STORAGE_KEY, type PharmacyState } from './types'

export function loadPharmacy(): PharmacyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyPharmacy()
    const parsed = JSON.parse(raw) as Partial<PharmacyState>
    const entries = (parsed.entries ?? []).map(withEntryDefaults)
    return {
      entries,
      injections: (parsed.injections ?? []).map((injection) => ({
        ...injection,
        lines: (injection.lines ?? []).map(withInjectionLineDefaults),
      })),
      uses: (parsed.uses ?? []).map(withUseDefaults),
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
