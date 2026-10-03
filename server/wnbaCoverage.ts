export type WnbaSearchType = 'Player' | 'Team'

export type CoverageRule = {
  start: number
  label: string
}

const BASE_START = 1997

export const WNBA_PLAYER_COVERAGE: Record<string, CoverageRule> = {
  fantasyPoints: { start: 1997, label: 'Fantasy Points' },
  points: { start: 1997, label: 'Points' },
  rebounds: { start: 1997, label: 'Rebounds' },
  assists: { start: 1997, label: 'Assists' },
  steals: { start: 1997, label: 'Steals' },
  blocks: { start: 1997, label: 'Blocks' },
  threePointersMade: { start: 1997, label: '3-Pointers Made' },
  fieldGoalsMade: { start: 1997, label: 'Field Goals Made' },
  fieldGoalsAttempted: { start: 1997, label: 'Field Goals Attempted' },
  freeThrowsMade: { start: 1997, label: 'Free Throws Made' },
  freeThrowsAttempted: { start: 1997, label: 'Free Throws Attempted' },
  offensiveRebounds: { start: 1997, label: 'Offensive Rebounds' },
  defensiveRebounds: { start: 1997, label: 'Defensive Rebounds' },
  turnovers: { start: 1997, label: 'Turnovers' },
  personalFouls: { start: 1997, label: 'Personal Fouls' },
  minutes: { start: 1997, label: 'Minutes Played' },
  fieldGoalPct: { start: 1997, label: 'Field Goal %' },
  threePointPct: { start: 1997, label: '3-Point %' },
  freeThrowPct: { start: 1997, label: 'Free Throw %' },
  plusMinus: { start: 1997, label: 'Plus/Minus' },
}

export const WNBA_TEAM_COVERAGE: Record<string, CoverageRule> = {
  points: { start: 1997, label: 'Points' },
  rebounds: { start: 1997, label: 'Rebounds' },
  assists: { start: 1997, label: 'Assists' },
  steals: { start: 1997, label: 'Steals' },
  blocks: { start: 1997, label: 'Blocks' },
  threePointersMade: { start: 1997, label: '3-Pointers Made' },
  threePointersAttempted: { start: 1997, label: '3-Pointers Attempted' },
  fieldGoalsMade: { start: 1997, label: 'Field Goals Made' },
  fieldGoalsAttempted: { start: 1997, label: 'Field Goals Attempted' },
  freeThrowsMade: { start: 1997, label: 'Free Throws Made' },
  freeThrowsAttempted: { start: 1997, label: 'Free Throws Attempted' },
  fieldGoalPct: { start: 1997, label: 'Field Goal %' },
  threePointPct: { start: 1997, label: '3-Point %' },
  freeThrowPct: { start: 1997, label: 'Free Throw %' },
  offensiveRebounds: { start: 1997, label: 'Offensive Rebounds' },
  defensiveRebounds: { start: 1997, label: 'Defensive Rebounds' },
  turnovers: { start: 1997, label: 'Turnovers' },
  personalFouls: { start: 1997, label: 'Personal Fouls' },
  pointDifferential: { start: 1997, label: 'Point Differential' },
  opponentPoints: { start: 1997, label: 'Opponent Points' },
}

export function seasonLabel(start: number) {
  return String(start)
}

export function coverageFor(
  searchType: WnbaSearchType,
  activeStats: string[],
  dbStart = BASE_START,
  dbEnd = new Date().getFullYear(),
) {
  const registry =
    searchType === 'Player'
      ? WNBA_PLAYER_COVERAGE
      : WNBA_TEAM_COVERAGE

  let start = dbStart
  let limiting: CoverageRule | undefined

  for (const stat of activeStats) {
    const rule = registry[stat]

    if (rule && rule.start > start) {
      start = rule.start
      limiting = rule
    }
  }

  const end = dbEnd

  return {
    startSeason: seasonLabel(start),
    endSeason: seasonLabel(end),
    startYear: start,
    endYear: end,
    limitingStatistic: limiting?.label ?? null,
    message: limiting
      ? `Coverage begins in ${seasonLabel(start)} because ${limiting.label} is not treated as historically available before that season.`
      : `Coverage uses all WNBA seasons currently available in the database.`,
  }
}
