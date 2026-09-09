import type {
  ClosestPerformance,
  GameBoxScore,
  GameRecord,
  SearchScope,
  StatCondition,
} from '../types/search'

export type NflMeta = {
  seasons: string[]
  teams: string[]
  players: string[]
  opponents: string[]
  positions: string[]
  counts: {
    games: number
    player_games: number
    team_games: number
  }
  source: string
}

export type NflCoverage = {
  startSeason: string
  endSeason: string
  startYear: number
  endYear: number
  limitingStatistic: string | null
  message: string
}

export type NflSearchPayload = {
  searchType: 'Player' | 'Team'
  gameStage: string
  seasonOperator: string
  seasonValue: string
  seasonSecondValue: string
  careerYearOperator: string
  careerYearValue: string
  careerYearSecondValue: string
  team: string
  opponent: string
  player: string
  position: string
  resultFilter: string
  dayOfWeek: string
  month: string
  specificDate: string
  periodFilter: string
  conditions: StatCondition[]
  limit: number
  offset: number
  sortBy: string
  sortDirection: 'asc' | 'desc'
}

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? ''
).replace(/\/$/, '')

async function json<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const r = await fetch(url, init)

  if (!r.ok) {
    const b = await r
      .json()
      .catch(() => ({}))

    throw new Error(
      b.error ?? `Request failed (${r.status})`,
    )
  }

  return r.json()
}

export const getNflMeta = () =>
  json<NflMeta>(
    `${API_BASE}/api/nfl/meta`,
  )

export const getNflNearestCalendarDay = (
  month: number,
  day: number,
) =>
  json<{
    exact: boolean
    month: number
    day: number
    distanceDays: number | null
  }>(
    `${API_BASE}/api/nfl/calendar-day?month=${month}&day=${day}`,
  )

export const searchNfl = (
  payload: NflSearchPayload,
) =>
  json<{
    total: number
    records: GameRecord[]
    closest: ClosestPerformance[]
    coverage: NflCoverage
  }>(
    `${API_BASE}/api/nfl/search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

export const getNflBoxScore = (
  gameId: string,
) =>
  json<GameBoxScore>(
    `${API_BASE}/api/nfl/games/${gameId}`,
  )

export type NflAggregatePayload =
  Omit<
    NflSearchPayload,
    'opponent' | 'resultFilter'
  > & {
    scope: Exclude<SearchScope, 'Game'>
  }

export const searchNflAggregate = (
  payload: NflAggregatePayload,
) =>
  json<{
    total: number
    records: GameRecord[]
    closest: ClosestPerformance[]
    coverage: NflCoverage
  }>(
    `${API_BASE}/api/nfl/aggregate-search`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  )

export type NflQaReport = {
  generatedAt: string

  overview: {
    games: number
    seasons: number
    earliestSeason: string
    latestSeason: string
    playerGames: number
    teamGames: number
  }

  integrity: {
    gamesMissingTwoTeamRows: number
    gamesWithoutPlayerRows: number
    unexpectedTeamGaps: number
  }

  seasons: {
    season: string
    games: number
    regularSeason: number
    playoffs: number
    playerRows: number
    teamRows: number
  }[]

  coverage: {
    standardizedStartSeason: string
    advancedStartSeason: string

    playerPresence: {
      statistic: string
      label: string
      firstSeason: string | null
      rowsWithData: number
    }[]

    teamPresence: {
      statistic: string
      label: string
      firstSeason: string | null
      rowsWithData: number
    }[]

    note: string
  }
}

export const getNflQa = () =>
  json<NflQaReport>(
    `${API_BASE}/api/nfl/qa`,
  )