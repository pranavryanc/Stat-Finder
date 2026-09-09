import { pool } from './db.js'

type Condition = {
  statistic: string
  operator: 'any' | 'gte' | 'eq' | 'lte' | 'between'
  value?: number
  secondValue?: number
}

type Body = {
  searchType: 'Player' | 'Team'
  gameStage?: 'Any' | 'Regular Season' | 'Playoffs'
  seasonOperator?: 'Any' | 'Exactly' | 'Before' | 'After' | 'Between'
  seasonValue?: string
  seasonSecondValue?: string
  careerYearOperator?: 'Any' | 'Exactly' | 'Before' | 'After' | 'Between'
  careerYearValue?: string
  careerYearSecondValue?: string
  team?: string
  opponent?: string
  player?: string
  position?: string
  resultFilter?: 'Any' | 'W' | 'L' | 'D'
  dayOfWeek?: string
  month?: string
  specificDate?: string
  periodFilter?: string
  conditions?: Condition[]
  limit?: number
  offset?: number
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
}

const playerCols: Record<string, string> = {
  passingYards: 'p.passing_yards',
  passingAttempts: 'p.passing_attempts',
  completions: 'p.completions',
  passingTouchdowns: 'p.passing_touchdowns',
  interceptions: 'p.passing_interceptions',
  completionPercentage: 'p.completion_percentage',
  sacksTaken: 'p.sacks_taken',
  passerRating: 'p.passer_rating',
  rushingAttempts: 'p.rushing_attempts',
  rushingYards: 'p.rushing_yards',
  rushingTouchdowns: 'p.rushing_touchdowns',
  yardsPerCarry: 'p.yards_per_carry',
  targets: 'p.targets',
  receptions: 'p.receptions',
  receivingYards: 'p.receiving_yards',
  receivingTouchdowns: 'p.receiving_touchdowns',
  yardsPerReception: 'p.yards_per_reception',
  tackles: 'p.tackles',
  soloTackles: 'p.solo_tackles',
  assistedTackles: 'p.assisted_tackles',
  sacks: 'p.sacks',
  defensiveInterceptions: 'p.defensive_interceptions',
  forcedFumbles: 'p.forced_fumbles',
  fumbleRecoveries: 'p.fumble_recoveries',
  defensiveTouchdowns: 'p.defensive_touchdowns',
  fieldGoalsMade: 'p.field_goals_made',
  fieldGoalsAttempted: 'p.field_goals_attempted',
  fieldGoalPct: 'p.field_goal_pct',
  longestFieldGoal: 'p.longest_field_goal',
  extraPointsMade: 'p.extra_points_made',
  extraPointsAttempted: 'p.extra_points_attempted',
  extraPointPct: 'p.extra_point_pct',
}

const teamCols: Record<string, string> = {
  points: 't.points',
  touchdowns: 't.touchdowns',
  fieldGoals: 't.field_goals',
  passingYards: 't.passing_yards',
  passingAttempts: 't.passing_attempts',
  passingTouchdowns: 't.passing_touchdowns',
  interceptionsThrown: 't.interceptions_thrown',
  rushingYards: 't.rushing_yards',
  rushingAttempts: 't.rushing_attempts',
  rushingTouchdowns: 't.rushing_touchdowns',
  totalYards: 't.total_yards',
  firstDowns: 't.first_downs',
  thirdDownConversions: 't.third_down_conversions',
  pointsAllowed: 't.points_allowed',
  yardsAllowed: 't.yards_allowed',
  passingYardsAllowed: 't.passing_yards_allowed',
  rushingYardsAllowed: 't.rushing_yards_allowed',
  sacks: 't.sacks',
  interceptions: 't.interceptions',
  forcedFumbles: 't.forced_fumbles',
  takeaways: 't.takeaways',
  turnovers: 't.turnovers',
  turnoverDifferential: 't.turnover_differential',
  pointDifferential: 't.point_differential',
}

const scale: Record<string, number> = {
  passingYards: 50,
  passingAttempts: 8,
  completions: 6,
  passingTouchdowns: 1,
  interceptions: 1,
  completionPercentage: 5,
  sacksTaken: 1,
  passerRating: 10,
  rushingAttempts: 5,
  rushingYards: 25,
  rushingTouchdowns: 1,
  yardsPerCarry: 1,
  targets: 3,
  receptions: 3,
  receivingYards: 25,
  receivingTouchdowns: 1,
  yardsPerReception: 2,
  tackles: 3,
  soloTackles: 3,
  assistedTackles: 2,
  sacks: 0.75,
  defensiveInterceptions: 1,
  forcedFumbles: 1,
  fumbleRecoveries: 1,
  defensiveTouchdowns: 1,
  fieldGoalsMade: 1,
  fieldGoalsAttempted: 1,
  fieldGoalPct: 0.08,
  longestFieldGoal: 5,
  extraPointsMade: 1,
  extraPointsAttempted: 1,
  extraPointPct: 0.08,
  points: 7,
  touchdowns: 1,
  fieldGoals: 1,
  totalYards: 75,
  firstDowns: 5,
  thirdDownConversions: 2,
  pointsAllowed: 7,
  yardsAllowed: 75,
  passingYardsAllowed: 50,
  rushingYardsAllowed: 30,
  takeaways: 1,
  turnovers: 1,
  turnoverDifferential: 1,
  pointDifferential: 7,
}

function seasonNumber(v?: string) {
  if (!v) return undefined
  const m = v.match(/\d{4}/)
  return m ? Number(m[0]) : undefined
}

function careerYearNumber(v?: string) {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

const nflCareerSeasonCte = `
career_seasons AS (
  SELECT
    player_id,
    season,
    dense_rank() OVER (
      PARTITION BY player_id
      ORDER BY season
    ) career_year
  FROM (
    SELECT DISTINCT
      p.player_id,
      g.season
    FROM nfl_player_games p
    JOIN nfl_games g
      ON g.game_id = p.game_id
  ) seasons_played
)`

function resultExpr(prefix: string) {
  return `(CASE
    WHEN ${prefix}.team = g.home_team THEN
      CASE
        WHEN g.home_score > g.away_score THEN 'W'
        WHEN g.home_score < g.away_score THEN 'L'
        ELSE 'D'
      END
    ELSE
      CASE
        WHEN g.away_score > g.home_score THEN 'W'
        WHEN g.away_score < g.home_score THEN 'L'
        ELSE 'D'
      END
  END)`
}

function where(body: Body, prefix: 'p' | 't') {
  const clauses: string[] = []
  const values: any[] = []

  const add = (sql: string, v: any) => {
    values.push(v)
    clauses.push(sql.replace('?', `$${values.length}`))
  }

  if (body.gameStage && body.gameStage !== 'Any') {
    add('g.season_type=?', body.gameStage)
  }

  const a = seasonNumber(body.seasonValue)
  const b = seasonNumber(body.seasonSecondValue)

  if (
    body.seasonOperator &&
    body.seasonOperator !== 'Any' &&
    a !== undefined
  ) {
    if (body.seasonOperator === 'Exactly') {
      add('g.season=?', a)
    }

    if (body.seasonOperator === 'Before') {
      add('g.season<?', a)
    }

    if (body.seasonOperator === 'After') {
      add('g.season>?', a)
    }

    if (
      body.seasonOperator === 'Between' &&
      b !== undefined
    ) {
      values.push(Math.min(a, b), Math.max(a, b))
      clauses.push(
        `g.season BETWEEN $${values.length - 1} AND $${values.length}`,
      )
    }
  }

  if (body.team && body.team !== 'Any') {
    add(`${prefix}.team=?`, body.team)
  }

  if (body.opponent && body.opponent !== 'Any') {
    add(`${prefix}.opponent=?`, body.opponent)
  }

  if (
    prefix === 'p' &&
    body.player &&
    body.player !== 'Any'
  ) {
    add('p.player_name=?', body.player)
  }

  if (
    prefix === 'p' &&
    body.position &&
    body.position !== 'Any'
  ) {
    add('p.position=?', body.position)
  }

  if (
    prefix === 'p' &&
    body.careerYearOperator &&
    body.careerYearOperator !== 'Any'
  ) {
    const c1 = careerYearNumber(body.careerYearValue)
    const c2 = careerYearNumber(body.careerYearSecondValue)

    if (c1 !== undefined) {
      if (body.careerYearOperator === 'Exactly') {
        add('cy.career_year=?', c1)
      }

      if (body.careerYearOperator === 'Before') {
        add('cy.career_year<?', c1)
      }

      if (body.careerYearOperator === 'After') {
        add('cy.career_year>?', c1)
      }

      if (
        body.careerYearOperator === 'Between' &&
        c2 !== undefined
      ) {
        values.push(
          Math.min(c1, c2),
          Math.max(c1, c2),
        )

        clauses.push(
          `cy.career_year BETWEEN $${values.length - 1} AND $${values.length}`,
        )
      }
    }
  }

  if (
    body.resultFilter &&
    body.resultFilter !== 'Any'
  ) {
    add(
      `${resultExpr(prefix)}=?`,
      body.resultFilter,
    )
  }

  if (
    body.dayOfWeek &&
    body.dayOfWeek !== 'Any'
  ) {
    add(
      'extract(dow from g.game_date)::int=?',
      Number(body.dayOfWeek),
    )
  }

  if (
    body.month &&
    body.month !== 'Any'
  ) {
    add(
      'extract(month from g.game_date)::int=?',
      Number(body.month),
    )
  }

  if (
    body.specificDate &&
    /^\d{2}-\d{2}$/.test(body.specificDate)
  ) {
    const [m, d] = body.specificDate
      .split('-')
      .map(Number)

    values.push(m, d)

    clauses.push(
      `extract(month from g.game_date)::int=$${values.length - 1}
       AND extract(day from g.game_date)::int=$${values.length}`,
    )
  }

  if (
    body.periodFilter &&
    body.periodFilter !== 'Any'
  ) {
    if (body.periodFilter.startsWith('Week ')) {
      const week = Number(body.periodFilter.slice(5))

      if (Number.isInteger(week)) {
        values.push(week)

        clauses.push(
          `g.season_type='Regular Season'
           AND g.week=$${values.length}`,
        )
      }
    } else {
      const code: Record<string, string> = {
        'Wild Card': 'WC',
        Divisional: 'DIV',
        'Conference Championship': 'CON',
        'Super Bowl': 'SB',
      }

      const gameType = code[body.periodFilter]

      if (gameType) {
        values.push(gameType)

        clauses.push(
          `g.season_type='Playoffs'
           AND upper(g.game_type)=$${values.length}`,
        )
      }
    }
  }

  const cols =
    prefix === 'p'
      ? playerCols
      : teamCols

  for (const c of body.conditions ?? []) {
    if (
      c.operator === 'any' ||
      c.value === undefined
    ) {
      continue
    }

    const col = cols[c.statistic]
    if (!col) continue

    if (
      c.operator === 'between' &&
      c.secondValue !== undefined
    ) {
      values.push(c.value, c.secondValue)

      clauses.push(
        `${col} BETWEEN
          LEAST($${values.length - 1}, $${values.length})
          AND
          GREATEST($${values.length - 1}, $${values.length})`,
      )
    } else {
      values.push(c.value)

      clauses.push(
        `${col} ${
          c.operator === 'gte'
            ? '>='
            : c.operator === 'lte'
              ? '<='
              : '='
        } $${values.length}`,
      )
    }
  }

  return {
    sql: clauses.length
      ? `WHERE ${clauses.join(' AND ')}`
      : '',
    values,
  }
}

function record(row: any, body: Body) {
  const stats: Record<string, number> = {}

  const cols =
    body.searchType === 'Player'
      ? playerCols
      : teamCols

  for (const [key, col] of Object.entries(cols)) {
    const name = col.split('.').pop()!

    if (
      row[name] !== null &&
      row[name] !== undefined
    ) {
      const x = Number(row[name])

      if (Number.isFinite(x)) {
        stats[key] =
          Math.round(x * 1000) / 1000
      }
    }
  }

  const home = row.team === row.home_team

  const teamScore = home
    ? row.home_score
    : row.away_score

  const oppScore = home
    ? row.away_score
    : row.home_score

  const result =
    teamScore > oppScore
      ? 'W'
      : teamScore < oppScore
        ? 'L'
        : 'D'

  return {
    id:
      `NFL-${body.searchType}-${row.game_id}-` +
      `${
        body.searchType === 'Player'
          ? row.player_id
          : row.team
      }`,
    gameId: row.game_id,
    sport: 'NFL',
    searchType: body.searchType,
    scope: 'Game',
    entityName:
      body.searchType === 'Player'
        ? row.player_name
        : row.team,
    team: row.team,
    opponent: row.opponent,
    date: String(row.game_date).slice(0, 10),
    season: String(row.season),
    gameStage: row.season_type,
    homeAway: home ? 'Home' : 'Away',
    result,
    finalScore: `${teamScore}-${oppScore}`,
    careerYear:
      row.career_year === null ||
      row.career_year === undefined
        ? undefined
        : Number(row.career_year),
    stats,
  }
}

function closestSql(
  body: Body,
  prefix: 'p' | 't',
  baseValues: any[],
) {
  const cols =
    prefix === 'p'
      ? playerCols
      : teamCols

  const values = [...baseValues]
  const terms: string[] = []
  const mets: string[] = []

  for (const c of body.conditions ?? []) {
    if (
      c.operator === 'any' ||
      c.value === undefined
    ) {
      continue
    }

    const col = cols[c.statistic]
    if (!col) continue

    const sc = scale[c.statistic] ?? 5

    values.push(c.value)
    const p1 = `$${values.length}`

    if (c.operator === 'gte') {
      terms.push(
        `CASE
          WHEN ${col} >= ${p1}
          THEN 0
          ELSE (${p1}-${col})/${sc}::numeric
        END`,
      )

      mets.push(
        `CASE
          WHEN ${col} >= ${p1}
          THEN 1
          ELSE 0
        END`,
      )
    } else if (c.operator === 'lte') {
      terms.push(
        `CASE
          WHEN ${col} <= ${p1}
          THEN 0
          ELSE (${col}-${p1})/${sc}::numeric
        END`,
      )

      mets.push(
        `CASE
          WHEN ${col} <= ${p1}
          THEN 1
          ELSE 0
        END`,
      )
    } else if (c.operator === 'eq') {
      terms.push(
        `abs(${col}-${p1})/${sc}::numeric`,
      )

      mets.push(
        `CASE
          WHEN ${col}=${p1}
          THEN 1
          ELSE 0
        END`,
      )
    } else if (
      c.operator === 'between' &&
      c.secondValue !== undefined
    ) {
      values.push(c.secondValue)

      const p2 = `$${values.length}`

      terms.push(
        `CASE
          WHEN ${col} BETWEEN LEAST(${p1},${p2}) AND GREATEST(${p1},${p2})
          THEN 0
          ELSE LEAST(
            abs(${col}-${p1}),
            abs(${col}-${p2})
          )/${sc}::numeric
        END`,
      )

      mets.push(
        `CASE
          WHEN ${col} BETWEEN LEAST(${p1},${p2}) AND GREATEST(${p1},${p2})
          THEN 1
          ELSE 0
        END`,
      )
    }
  }

  return {
    values,
    distance: terms.length
      ? terms.join('+')
      : '0',
    met: mets.length
      ? mets.join('+')
      : '0',
  }
}

function explain(
  stats: Record<string, number>,
  c: Condition,
) {
  const actual = stats[c.statistic]
  const v = c.value ?? 0

  const target =
    c.operator === 'gte'
      ? `≥ ${v}`
      : c.operator === 'lte'
        ? `≤ ${v}`
        : c.operator === 'eq'
          ? `= ${v}`
          : `between ${v} and ${c.secondValue}`

  const met =
    actual !== undefined &&
    (
      c.operator === 'gte'
        ? actual >= v
        : c.operator === 'lte'
          ? actual <= v
          : c.operator === 'eq'
            ? actual === v
            : c.secondValue !== undefined &&
              actual >= Math.min(v, c.secondValue) &&
              actual <= Math.max(v, c.secondValue)
    )

  return {
    statistic: c.statistic,
    actual: actual ?? null,
    met,
    targetText: target,
    missText: met
      ? undefined
      : `needed ${target}`,
    normalizedMiss: met ? 0 : 1,
  }
}

export async function nflMetadata() {
  const [
    seasons,
    teams,
    players,
    positions,
    counts,
  ] = await Promise.all([
    pool.query(
      'SELECT DISTINCT season FROM nfl_games ORDER BY season DESC',
    ),
    pool.query(
      'SELECT DISTINCT team FROM nfl_team_games ORDER BY team',
    ),
    pool.query(
      "SELECT DISTINCT player_name FROM nfl_player_games WHERE player_name<>'' ORDER BY player_name",
    ),
    pool.query(
      "SELECT DISTINCT position FROM nfl_player_games WHERE position IS NOT NULL AND position<>'' ORDER BY position",
    ),
    pool.query(`
      SELECT
        (SELECT count(*) FROM nfl_games)::int games,
        (SELECT count(*) FROM nfl_player_games)::int player_games,
        (SELECT count(*) FROM nfl_team_games)::int team_games
    `),
  ])

  return {
    seasons: seasons.rows.map(
      r => String(r.season),
    ),
    teams: teams.rows.map(
      r => r.team,
    ),
    opponents: teams.rows.map(
      r => r.team,
    ),
    players: players.rows.map(
      r => r.player_name,
    ),
    positions: positions.rows.map(
      r => r.position,
    ),
    counts: counts.rows[0],
    source:
      'Historical NFL stats (1970-1998) + nflverse weekly player/team stats (1999+)',
  }
}

export async function searchNfl(body: Body) {
  const prefix =
    body.searchType === 'Player'
      ? 'p'
      : 't'

  const useCareerYear =
    body.searchType === 'Player' &&
    body.careerYearOperator !== undefined &&
    body.careerYearOperator !== 'Any' &&
    careerYearNumber(body.careerYearValue) !== undefined

  const table =
    body.searchType === 'Player'
      ? `nfl_player_games p
         JOIN nfl_games g
           ON g.game_id=p.game_id
         ${
           useCareerYear
             ? `JOIN career_seasons cy
                  ON cy.player_id=p.player_id
                 AND cy.season=g.season`
             : ''
         }`
      : `nfl_team_games t
         JOIN nfl_games g
           ON g.game_id=t.game_id`

  const w = where(body, prefix)

  const queryPrefix = useCareerYear
    ? `WITH ${nflCareerSeasonCte} `
    : ''

  const count = await pool.query(
    `${queryPrefix}
     SELECT count(*)::int count
     FROM ${table}
     ${w.sql}`,
    w.values,
  )

  const total =
    count.rows[0]?.count ?? 0

  const cols =
    body.searchType === 'Player'
      ? playerCols
      : teamCols

  const sortMap: Record<string, string> = {
    date: 'g.game_date',
    entity:
      body.searchType === 'Player'
        ? 'p.player_name'
        : 't.team',
    team: `${prefix}.team`,
    opponent: `${prefix}.opponent`,
    season: 'g.season',
    result: resultExpr(prefix),
    ...cols,
  }

  const sort =
    sortMap[body.sortBy ?? 'date'] ??
    'g.game_date'

  const dir =
    body.sortDirection === 'asc'
      ? 'ASC'
      : 'DESC'

  const limit = Math.min(
    body.limit ?? 50,
    200,
  )

  const offset = Math.max(
    body.offset ?? 0,
    0,
  )

  const rows = await pool.query(
    `${queryPrefix}
     SELECT
       ${prefix}.*,
       g.season,
       g.game_date,
       g.season_type,
       g.home_team,
       g.away_team,
       g.home_score,
       g.away_score
       ${
         useCareerYear
           ? ',cy.career_year AS career_year'
           : ''
       }
     FROM ${table}
     ${w.sql}
     ORDER BY
       ${sort} ${dir} NULLS LAST,
       g.game_date DESC
     LIMIT $${w.values.length + 1}
     OFFSET $${w.values.length + 2}`,
    [
      ...w.values,
      limit,
      offset,
    ],
  )

  let closest: any[] = []

  const active = (body.conditions ?? [])
    .filter(
      c =>
        c.operator !== 'any' &&
        c.value !== undefined,
    )

  if (
    total === 0 &&
    active.length
  ) {
    const baseBody = {
      ...body,
      conditions: [],
    } as Body

    const bw = where(
      baseBody,
      prefix,
    )

    const c = closestSql(
      body,
      prefix,
      bw.values,
    )

    const cr = await pool.query(
      `${queryPrefix}
       SELECT
         ${prefix}.*,
         g.season,
         g.game_date,
         g.season_type,
         g.home_team,
         g.away_team,
         g.home_score,
         g.away_score
         ${
           useCareerYear
             ? ',cy.career_year AS career_year'
             : ''
         },
         ${c.distance} normalized_distance,
         ${c.met} conditions_met
       FROM ${table}
       ${bw.sql}
       ORDER BY
         normalized_distance ASC,
         conditions_met DESC,
         g.game_date DESC
       LIMIT 5`,
      c.values,
    )

    closest = cr.rows.map(r => {
      const rec = record(r, body)
      const distance =
        Number(r.normalized_distance ?? 0)

      return {
        record: rec,
        distance,
        similarity:
          Math.round(100 / (1 + distance)),
        conditionsMet:
          Number(r.conditions_met ?? 0),
        conditionCount:
          active.length,
        explanations:
          active.map(
            x => explain(rec.stats, x),
          ),
      }
    })
  }

  const meta = (
    await pool.query(
      'SELECT min(season) min,max(season) max FROM nfl_games',
    )
  ).rows[0]

  const coverageMessage =
    body.searchType === 'Team'
      ? 'NFL team coverage uses historical game-level statistics for 1970-1998 and nflverse standardized game-level statistics from 1999 onward. Historical field availability varies by statistic.'
      : 'NFL player coverage uses historical game-level statistics for 1970-1998 and nflverse standardized game-level statistics from 1999 onward. Historical field availability varies by statistic.'

  return {
    total,
    records: rows.rows.map(
      r => record(r, body),
    ),
    closest,
    coverage: {
      startSeason: String(meta.min),
      endSeason: String(meta.max),
      startYear: Number(meta.min),
      endYear: Number(meta.max),
      limitingStatistic: null,
      message: coverageMessage,
    },
  }
}

export async function nflBoxScore(
  gameId: string,
) {
  const game = (
    await pool.query(
      'SELECT * FROM nfl_games WHERE game_id=$1',
      [gameId],
    )
  ).rows[0]

  if (!game) return null

  const teams = (
    await pool.query(
      'SELECT * FROM nfl_team_games WHERE game_id=$1 ORDER BY team',
      [gameId],
    )
  ).rows

  const players = (
    await pool.query(
      'SELECT * FROM nfl_player_games WHERE game_id=$1 ORDER BY team,player_name',
      [gameId],
    )
  ).rows

  const teamStats = teams.map(t => {
    const stats: Record<string, number> = {}

    for (
      const [key, col]
      of Object.entries(teamCols)
    ) {
      const n = col.split('.').pop()!

      if (t[n] !== null) {
        const x = Number(t[n])

        if (Number.isFinite(x)) {
          stats[key] = x
        }
      }
    }

    const score =
      t.team === game.home_team
        ? game.home_score
        : game.away_score

    const opp =
      t.team === game.home_team
        ? game.away_score
        : game.home_score

    return {
      team: t.team,
      score,
      result:
        score > opp
          ? 'W'
          : score < opp
            ? 'L'
            : 'D',
      stats,
    }
  })

  const playerStats = players.map(p => {
    const stats: Record<string, number> = {}

    for (
      const [key, col]
      of Object.entries(playerCols)
    ) {
      const n = col.split('.').pop()!

      if (p[n] !== null) {
        const x = Number(p[n])

        if (Number.isFinite(x)) {
          stats[key] = x
        }
      }
    }

    return {
      id: p.player_id,
      name: p.player_name,
      team: p.team,
      position: p.position ?? '',
      stats,
    }
  })

  return {
    gameId: game.game_id,
    sport: 'NFL',
    season: String(game.season),
    date:
      String(game.game_date).slice(0, 10),
    gameStage:
      game.season_type,
    homeTeam:
      game.home_team,
    awayTeam:
      game.away_team,
    homeScore:
      game.home_score,
    awayScore:
      game.away_score,
    teamStats,
    playerStats,
  }
}

export async function nflNearestCalendarDay(
  month: number,
  day: number,
) {
  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(
      'Invalid calendar date',
    )
  }

  const target =
    `make_date(2000, $1::int, $2::int)`

  const query = `
    WITH available AS (
      SELECT DISTINCT
        EXTRACT(MONTH FROM game_date)::int AS month,
        EXTRACT(DAY FROM game_date)::int AS day,
        EXTRACT(
          DOY FROM make_date(
            2000,
            EXTRACT(MONTH FROM game_date)::int,
            EXTRACT(DAY FROM game_date)::int
          )
        )::int AS doy
      FROM nfl_games
      WHERE game_date IS NOT NULL
    ),
    target AS (
      SELECT
        EXTRACT(DOY FROM ${target})::int AS doy
    )
    SELECT
      a.month,
      a.day,
      LEAST(
        ABS(a.doy-t.doy),
        366-ABS(a.doy-t.doy)
      )::int AS distance_days,
      (
        a.month=$1::int
        AND a.day=$2::int
      ) AS exact
    FROM available a
    CROSS JOIN target t
    ORDER BY
      distance_days ASC,
      a.doy ASC
    LIMIT 1
  `

  const result = await pool.query(
    query,
    [month, day],
  )

  const row =
    result.rows[0]

  if (!row) {
    return {
      exact: false,
      month,
      day,
      distanceDays: null,
    }
  }

  return {
    exact: Boolean(row.exact),
    month: Number(row.month),
    day: Number(row.day),
    distanceDays:
      Number(row.distance_days),
  }
}

const NFL_PLAYER_QA_FIELDS = [
  ['passingYards', 'Passing Yards', 'passing_yards'],
  ['passingTouchdowns', 'Passing Touchdowns', 'passing_touchdowns'],
  ['rushingYards', 'Rushing Yards', 'rushing_yards'],
  ['receivingYards', 'Receiving Yards', 'receiving_yards'],
  ['tackles', 'Tackles', 'tackles'],
  ['sacks', 'Sacks', 'sacks'],
  [
    'defensiveInterceptions',
    'Defensive Interceptions',
    'defensive_interceptions',
  ],
  ['forcedFumbles', 'Forced Fumbles', 'forced_fumbles'],
  ['fieldGoalsMade', 'Field Goals Made', 'field_goals_made'],
  [
    'fieldGoalsAttempted',
    'Field Goals Attempted',
    'field_goals_attempted',
  ],
  ['extraPointsMade', 'Extra Points Made', 'extra_points_made'],
  [
    'extraPointsAttempted',
    'Extra Points Attempted',
    'extra_points_attempted',
  ],
] as const

const NFL_TEAM_QA_FIELDS = [
  ['points', 'Points', 'points'],
  ['passingYards', 'Passing Yards', 'passing_yards'],
  ['rushingYards', 'Rushing Yards', 'rushing_yards'],
  ['totalYards', 'Total Yards', 'total_yards'],
  ['firstDowns', 'First Downs', 'first_downs'],
  ['pointsAllowed', 'Points Allowed', 'points_allowed'],
  ['yardsAllowed', 'Yards Allowed', 'yards_allowed'],
  ['sacks', 'Sacks', 'sacks'],
  ['takeaways', 'Takeaways', 'takeaways'],
  ['turnovers', 'Turnovers', 'turnovers'],
] as const

async function fieldPresence(
  table:
    | 'nfl_player_games'
    | 'nfl_team_games',
  fields:
    readonly (
      readonly [
        string,
        string,
        string,
      ]
    )[],
) {
  const alias =
    table === 'nfl_player_games'
      ? 'p'
      : 't'

  const rows: {
    statistic: string
    label: string
    firstSeason: string | null
    rowsWithData: number
  }[] = []

  for (
    const [
      statistic,
      label,
      column,
    ] of fields
  ) {
    const result = await pool.query(`
      SELECT
        min(g.season)::text AS first_season,
        count(*) FILTER (
          WHERE ${alias}.${column} IS NOT NULL
        )::int AS rows_with_data
      FROM ${table} ${alias}
      JOIN nfl_games g
        ON g.game_id=${alias}.game_id
      WHERE ${alias}.${column} IS NOT NULL
    `)

    rows.push({
      statistic,
      label,
      firstSeason:
        result.rows[0]?.first_season ?? null,
      rowsWithData:
        Number(
          result.rows[0]?.rows_with_data ?? 0,
        ),
    })
  }

  return rows
}

export async function nflQualityReport() {
  const [
    overviewResult,
    integrityResult,
    seasonsResult,
    playerPresence,
    teamPresence,
  ] = await Promise.all([
    pool.query(`
      SELECT
        count(*)::int games,
        count(DISTINCT season)::int seasons,
        min(season)::text earliest_season,
        max(season)::text latest_season,
        (
          SELECT count(*)::int
          FROM nfl_player_games
        ) player_games,
        (
          SELECT count(*)::int
          FROM nfl_team_games
        ) team_games
      FROM nfl_games
    `),

    pool.query(`
      WITH team_counts AS (
        SELECT
          g.game_id,
          count(t.team)::int team_rows
        FROM nfl_games g
        LEFT JOIN nfl_team_games t
          ON t.game_id=g.game_id
        GROUP BY g.game_id
      ),
      player_counts AS (
        SELECT
          g.game_id,
          count(p.player_id)::int player_rows
        FROM nfl_games g
        LEFT JOIN nfl_player_games p
          ON p.game_id=g.game_id
        GROUP BY g.game_id
      )
      SELECT
        count(*) FILTER (
          WHERE tc.team_rows<>2
        )::int games_missing_two_team_rows,
        count(*) FILTER (
          WHERE pc.player_rows=0
        )::int games_without_player_rows
      FROM team_counts tc
      JOIN player_counts pc
        USING(game_id)
    `),

    pool.query(`
      WITH game_counts AS (
        SELECT
          season,
          count(*)::int games,
          count(*) FILTER (
            WHERE season_type='Regular Season'
          )::int regular_season,
          count(*) FILTER (
            WHERE season_type='Playoffs'
          )::int playoffs
        FROM nfl_games
        GROUP BY season
      ),
      player_counts AS (
        SELECT
          g.season,
          count(*)::int player_rows
        FROM nfl_player_games p
        JOIN nfl_games g
          ON g.game_id=p.game_id
        GROUP BY g.season
      ),
      team_counts AS (
        SELECT
          g.season,
          count(*)::int team_rows
        FROM nfl_team_games t
        JOIN nfl_games g
          ON g.game_id=t.game_id
        GROUP BY g.season
      )
      SELECT
        gc.season::text season,
        gc.games,
        gc.regular_season,
        gc.playoffs,
        coalesce(pc.player_rows,0)::int player_rows,
        coalesce(tc.team_rows,0)::int team_rows
      FROM game_counts gc
      LEFT JOIN player_counts pc
        USING(season)
      LEFT JOIN team_counts tc
        USING(season)
      ORDER BY gc.season DESC
    `),

    fieldPresence(
      'nfl_player_games',
      NFL_PLAYER_QA_FIELDS,
    ),

    fieldPresence(
      'nfl_team_games',
      NFL_TEAM_QA_FIELDS,
    ),
  ])

  const o =
    overviewResult.rows[0]

  const i =
    integrityResult.rows[0]

  return {
    generatedAt:
      new Date().toISOString(),

    overview: {
      games: o.games,
      seasons: o.seasons,
      earliestSeason:
        o.earliest_season,
      latestSeason:
        o.latest_season,
      playerGames:
        o.player_games,
      teamGames:
        o.team_games,

    },

    integrity: {
      gamesMissingTwoTeamRows:
        i.games_missing_two_team_rows,

      gamesWithoutPlayerRows:
        i.games_without_player_rows,

      // With no approved exclusion registry anymore,
      // any missing team pair is unexpected.
      unexpectedTeamGaps:
        i.games_missing_two_team_rows,
    },

    seasons:
      seasonsResult.rows.map(r => ({
        season: r.season,
        games: r.games,
        regularSeason:
          r.regular_season,
        playoffs:
          r.playoffs,
        playerRows:
          r.player_rows,
        teamRows:
          r.team_rows,

      })),

    coverage: {
      standardizedStartSeason: '1999',
      advancedStartSeason: '2018',
      playerPresence,
      teamPresence,
      note:
        'Field presence shows rows populated in PostgreSQL and is a QA signal, not an independent certification of historical completeness. Historical 1970-1998 field availability can vary by statistic; standardized nflverse weekly statistics begin in 1999.',
    },
  }
}