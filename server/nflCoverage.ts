export type NflSearchType = 'Player' | 'Team'

export type CoverageRule = {
  start: number
  label: string
}

const BASE_START = 1920

/*
 * These dates describe reliable coverage in Stat Finder's NFL database.
 * They are not necessarily the historical introduction dates of the stats.
 */
export const NFL_TEAM_COVERAGE: Record<string, CoverageRule> = {
  points: { start: 1920, label: 'Points' },
  pointsPerGame: { start: 1920, label: 'Points / Game' },
  pointsAllowed: { start: 1920, label: 'Points Allowed' },
  pointsAllowedPerGame: { start: 1920, label: 'Points Allowed / Game' },
  pointDifferential: { start: 1920, label: 'Point Differential' },
  pointDifferentialPerGame: { start: 1920, label: 'Point Differential / Game' },

  passingYards: { start: 1950, label: 'Passing Yards' },
  passingYardsPerGame: { start: 1950, label: 'Passing Yards / Game' },
  passingTouchdowns: { start: 1950, label: 'Passing Touchdowns' },
  interceptionsThrown: { start: 1950, label: 'Interceptions Thrown' },

  rushingYards: { start: 1950, label: 'Rushing Yards' },
  rushingYardsPerGame: { start: 1950, label: 'Rushing Yards / Game' },
  rushingTouchdowns: { start: 1950, label: 'Rushing Touchdowns' },

  interceptions: { start: 1960, label: 'Defensive Interceptions' },

  sacks: { start: 1982, label: 'Sacks' },

  totalYards: { start: 1999, label: 'Total Yards' },
  totalYardsPerGame: { start: 1999, label: 'Total Yards / Game' },

  yardsAllowed: { start: 1999, label: 'Yards Allowed' },
  yardsAllowedPerGame: { start: 1999, label: 'Yards Allowed / Game' },

  takeaways: { start: 1999, label: 'Takeaways' },
  turnovers: { start: 1999, label: 'Turnovers' },
  turnoverDifferential: { start: 1999, label: 'Turnover Differential' },
}

/*
 * Team Touchdowns is intentionally omitted. The historical touchdowns
 * column in nfl_team_games is too incomplete to treat as reliable career
 * coverage.
 *
 * Third-down conversions are also omitted because the current database
 * does not contain usable historical values for that field.
 */

export function coverageFor(
  searchType: NflSearchType,
  activeStats: string[],
  dbStart = BASE_START,
  dbEnd = 2025,
) {
  if (searchType !== 'Team') {
    return {
      startSeason: String(dbStart),
      endSeason: String(dbEnd),
      startYear: dbStart,
      endYear: dbEnd,
      limitingStatistic: null,
      message:
        'NFL player coverage varies by statistic and historical data source.',
    }
  }

  let start = dbStart
  let limiting: CoverageRule | undefined

  for (const stat of activeStats) {
    const rule = NFL_TEAM_COVERAGE[stat]

    if (rule && rule.start > start) {
      start = rule.start
      limiting = rule
    }
  }

  return {
    startSeason: String(start),
    endSeason: String(dbEnd),
    startYear: start,
    endYear: dbEnd,
    limitingStatistic: limiting?.label ?? null,
    message: limiting
      ? `Coverage begins in ${start} because ${limiting.label} is not treated as reliably available before that season.`
      : 'Coverage uses all NFL seasons currently available in the database.',
  }
}
