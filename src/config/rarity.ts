export type RarityKey = 'never' | 'oneOfOne' | 'extremelyRare' | 'rare' | 'uncommon' | 'common'

export type RarityClassification = {
  key: RarityKey
  label: string
  description: string
}

// Change rarity thresholds here without touching result UI components.
export const RARITY_THRESHOLDS = {
  oneOfOne: 1,
  extremelyRareMax: 5,
  rareMax: 20,
  uncommonMax: 100,
} as const

export function classifyRarity(total: number): RarityClassification {
  if (total <= 0) return { key: 'never', label: 'NEVER DONE', description: 'No matching performances within the valid search coverage.' }
  if (total === RARITY_THRESHOLDS.oneOfOne) return { key: 'oneOfOne', label: 'ONE OF ONE', description: 'Exactly one matching performance.' }
  if (total <= RARITY_THRESHOLDS.extremelyRareMax) return { key: 'extremelyRare', label: 'EXTREMELY RARE', description: `${total} matching performances.` }
  if (total <= RARITY_THRESHOLDS.rareMax) return { key: 'rare', label: 'RARE', description: `${total} matching performances.` }
  if (total <= RARITY_THRESHOLDS.uncommonMax) return { key: 'uncommon', label: 'UNCOMMON', description: `${total} matching performances.` }
  return { key: 'common', label: 'COMMON', description: `${total.toLocaleString()} matching performances.` }
}
