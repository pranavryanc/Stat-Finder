import type { ClosestConditionExplanation, ClosestPerformance, GameRecord, StatCondition } from '../types/search'

export function matchesCondition(actual: number | undefined | null, condition: StatCondition) {
  if (condition.operator === 'any') return true
  if (actual === undefined || actual === null || condition.value === undefined) return false
  if (condition.operator === 'gte') return actual >= condition.value
  if (condition.operator === 'lte') return actual <= condition.value
  if (condition.operator === 'eq') return actual === condition.value
  if (condition.operator === 'between') return condition.secondValue !== undefined && actual >= condition.value && actual <= condition.secondValue
  return true
}

export function searchRecords(records: GameRecord[], conditions: StatCondition[]) {
  const active = conditions.filter(c => c.operator !== 'any')
  return records.filter(record => active.every(condition => matchesCondition(record.stats[condition.statistic], condition)))
}

const NORMALIZATION_SCALES: Record<string, number> = {
  points: 8, rebounds: 4, assists: 3, steals: 1, blocks: 1,
  threePointersMade: 2, threePointersAttempted: 5,
  fieldGoalsMade: 3, fieldGoalsAttempted: 5,
  freeThrowsMade: 3, freeThrowsAttempted: 4,
  offensiveRebounds: 2, defensiveRebounds: 3,
  turnovers: 2, personalFouls: 2, minutes: 6,
  fieldGoalPct: 0.08, threePointPct: 0.10, freeThrowPct: 0.10,
  plusMinus: 8, pointDifferential: 10, opponentPoints: 10,
  passingYards: 60, passingAttempts: 8, completions: 6, passingTouchdowns: 1,
  interceptions: 1, completionPercentage: 0.08, sacksTaken: 1, passerRating: 12,
  rushingAttempts: 5, rushingYards: 25, rushingTouchdowns: 1, yardsPerCarry: 1.5,
  targets: 3, receptions: 2, receivingYards: 25, receivingTouchdowns: 1, yardsPerReception: 4,
  tackles: 3, soloTackles: 3, assistedTackles: 2, sacks: 1, forcedFumbles: 1,
  fumbleRecoveries: 1, defensiveTouchdowns: 1, fieldGoals: 1, totalYards: 60,
  firstDowns: 4, thirdDownConversions: 2, takeaways: 1, turnoverDifferential: 1,
}

export function normalizationScale(statistic: string) {
  return NORMALIZATION_SCALES[statistic] ?? 5
}

export function explainCondition(actual: number | undefined | null, condition: StatCondition): ClosestConditionExplanation {
  const value = condition.value
  if (condition.operator === 'any' || value === undefined) {
    return { statistic: condition.statistic, actual: actual ?? null, met: true, targetText: 'Any', normalizedMiss: 0 }
  }

  const targetText = condition.operator === 'gte' ? `≥ ${value}`
    : condition.operator === 'lte' ? `≤ ${value}`
    : condition.operator === 'eq' ? `= ${value}`
    : `between ${value} and ${condition.secondValue ?? '?'}`

  if (actual === undefined || actual === null) {
    return { statistic: condition.statistic, actual: null, met: false, targetText, missText: 'stat unavailable', normalizedMiss: 5 }
  }

  if (matchesCondition(actual, condition)) {
    return { statistic: condition.statistic, actual, met: true, targetText, normalizedMiss: 0 }
  }

  let miss = 0
  let missText = ''
  if (condition.operator === 'gte') {
    miss = value - actual
    missText = `${formatGap(miss)} short; needed ${targetText}`
  } else if (condition.operator === 'lte') {
    miss = actual - value
    missText = `${formatGap(miss)} over; needed ${targetText}`
  } else if (condition.operator === 'eq') {
    miss = Math.abs(actual - value)
    missText = `${formatGap(miss)} ${actual < value ? 'short' : 'over'}; needed ${targetText}`
  } else if (condition.operator === 'between' && condition.secondValue !== undefined) {
    const nearest = actual < value ? value : condition.secondValue
    miss = Math.abs(actual - nearest)
    missText = `${formatGap(miss)} ${actual < value ? 'below' : 'above'} range; needed ${targetText}`
  }

  return {
    statistic: condition.statistic,
    actual,
    met: false,
    targetText,
    missText,
    normalizedMiss: miss / Math.max(normalizationScale(condition.statistic), 0.0001),
  }
}

function formatGap(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function closestRecords(records: GameRecord[], conditions: StatCondition[], limit = 5): ClosestPerformance[] {
  const active = conditions.filter(c => c.operator !== 'any' && c.value !== undefined)
  if (!active.length) return []

  return records.map(record => {
    const explanations = active.map(condition => explainCondition(record.stats[condition.statistic], condition))
    const distance = explanations.reduce((sum, item) => sum + item.normalizedMiss, 0)
    const conditionsMet = explanations.filter(item => item.met).length
    return {
      record,
      distance,
      similarity: Math.round(100 / (1 + distance)),
      conditionsMet,
      conditionCount: explanations.length,
      explanations,
    }
  }).sort((a,b) => a.distance - b.distance || b.conditionsMet - a.conditionsMet || b.record.date.localeCompare(a.record.date)).slice(0, limit)
}
