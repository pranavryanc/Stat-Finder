export type Sport = 'NBA' | 'NFL'
export type SearchType = 'Player' | 'Team'
export type SearchScope = 'Game' | 'Season' | 'Career'
export type Operator = 'any' | 'gte' | 'eq' | 'lte' | 'between'
export type GameStage = 'Regular Season' | 'Playoffs'

export type StatDefinition = {
  key: string
  label: string
  section: string
  unit?: string
}

export type StatCondition = {
  statistic: string
  operator: Operator
  value?: number
  secondValue?: number
}

export type GameRecord = {
  id: string
  gameId: string
  sport: Sport
  searchType: SearchType
  entityName: string
  team: string
  opponent: string
  date: string
  season: string
  gameStage: GameStage
  homeAway: 'Home' | 'Away'
  result: 'W' | 'L' | 'D'
  finalScore: string
  stats: Record<string, number>
  scope?: SearchScope
  gamesPlayed?: number
  seasonsPlayed?: number
  careerYear?: number
  stageLabel?: string
}

export type BoxScoreTeam = {
  team: string
  score: number
  result: 'W' | 'L' | 'D'
  stats: Record<string, number>
}

export type BoxScorePlayer = {
  id: string
  name: string
  team: string
  position: string
  starter?: boolean
  stats: Record<string, number>
}

export type GameBoxScore = {
  gameId: string
  sport: Sport
  season: string
  date: string
  gameStage: GameStage
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  teamStats: BoxScoreTeam[]
  playerStats: BoxScorePlayer[]
}

export type ClosestConditionExplanation = {
  statistic: string
  actual: number | null
  met: boolean
  targetText: string
  missText?: string
  normalizedMiss: number
}

export type ClosestPerformance = {
  record: GameRecord
  distance: number
  similarity: number
  conditionsMet: number
  conditionCount: number
  explanations: ClosestConditionExplanation[]
}
