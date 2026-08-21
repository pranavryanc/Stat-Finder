import type { NbaCoverage } from '../services/nbaApi'
import type { GameStage, SearchScope, SearchType, Sport, StatCondition } from '../types/search'
import type { RarityKey } from '../config/rarity'

export type SearchHistoryEntry = {
  id: string
  searchedAt: string
  sport: Sport
  searchType: SearchType
  searchScope?: SearchScope
  conditions: StatCondition[]
  gameStage: 'Any' | GameStage
  seasonOperator: 'Any' | 'Exactly' | 'Before' | 'After' | 'Between'
  seasonValue: string
  seasonSecondValue: string
  careerYearOperator?: 'Any' | 'Exactly' | 'Before' | 'After' | 'Between'
  careerYearValue?: string
  careerYearSecondValue?: string
  team: string
  opponent: string
  player: string
  position: string
  result: 'Any' | 'W' | 'L' | 'D'
  dayOfWeek: string
  month: string
  specificDate: string
  sortBy: string
  sortDirection: 'asc' | 'desc'
  totalResults: number
  rarityKey: RarityKey
  rarityLabel: string
  coverage?: NbaCoverage | null
}

const STORAGE_KEY = 'stat-finder-search-history-v1'
const MAX_ENTRIES = 75

export function loadSearchHistory(): SearchHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : []
  } catch {
    return []
  }
}

export function saveSearchHistory(entries: SearchHistoryEntry[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // Search should never fail just because local storage is unavailable.
  }
}

export function prependSearchHistory(entries: SearchHistoryEntry[], entry: SearchHistoryEntry) {
  const next = [entry, ...entries.filter(item => item.id !== entry.id)].slice(0, MAX_ENTRIES)
  saveSearchHistory(next)
  return next
}
