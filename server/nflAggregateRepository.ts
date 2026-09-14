import { pool } from './db.js'

type Condition = {
  statistic: string
  operator: 'any' | 'gte' | 'eq' | 'lte' | 'between'
  value?: number
  secondValue?: number
}

type Body = {
  scope: 'Season' | 'Career'
  searchType: 'Player' | 'Team'
  gameStage?: 'Any' | 'Regular Season' | 'Playoffs'
  seasonOperator?: 'Any' | 'Exactly' | 'Before' | 'After' | 'Between'
  seasonValue?: string
  seasonSecondValue?: string
  careerYearOperator?: 'Any' | 'Exactly' | 'Before' | 'After' | 'Between'
  careerYearValue?: string
  careerYearSecondValue?: string
  team?: string
  player?: string
  position?: string
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

const pAlias: Record<string, string> = {
  fantasyPointsStandard4: 'fantasy_points_standard_4',
  fantasyPointsStandard4PerGame: 'fantasy_points_standard_4_per_game',
  fantasyPointsStandard6: 'fantasy_points_standard_6',
  fantasyPointsStandard6PerGame: 'fantasy_points_standard_6_per_game',
  fantasyPointsHalfPpr4: 'fantasy_points_half_ppr_4',
  fantasyPointsHalfPpr4PerGame: 'fantasy_points_half_ppr_4_per_game',
  fantasyPointsHalfPpr6: 'fantasy_points_half_ppr_6',
  fantasyPointsHalfPpr6PerGame: 'fantasy_points_half_ppr_6_per_game',
  fantasyPointsPpr4: 'fantasy_points_ppr_4',
  fantasyPointsPpr4PerGame: 'fantasy_points_ppr_4_per_game',
  fantasyPointsPpr6: 'fantasy_points_ppr_6',
  fantasyPointsPpr6PerGame: 'fantasy_points_ppr_6_per_game',
  gamesPlayed: 'games_played',
  seasonsPlayed: 'seasons_played',
  passingYards: 'passing_yards',
  passingYardsPerGame: 'passing_yards_per_game',
  passingAttempts: 'passing_attempts',
  completions: 'completions',
  passingTouchdowns: 'passing_touchdowns',
  passingInterceptions: 'passing_interceptions',
  sacksTaken: 'sacks_taken',
  completionPercentage: 'completion_percentage',
  passerRating: 'passer_rating',
  rushingAttempts: 'rushing_attempts',
  rushingYards: 'rushing_yards',
  rushingYardsPerGame: 'rushing_yards_per_game',
  rushingTouchdowns: 'rushing_touchdowns',
  yardsPerCarry: 'yards_per_carry',
  targets: 'targets',
  receptions: 'receptions',
  receivingYards: 'receiving_yards',
  receivingYardsPerGame: 'receiving_yards_per_game',
  receivingTouchdowns: 'receiving_touchdowns',
  yardsPerReception: 'yards_per_reception',
  tackles: 'tackles',
  soloTackles: 'solo_tackles',
  assistedTackles: 'assisted_tackles',
  sacks: 'sacks',
  defensiveInterceptions: 'defensive_interceptions',
  forcedFumbles: 'forced_fumbles',
  fumbleRecoveries: 'fumble_recoveries',
  defensiveTouchdowns: 'defensive_touchdowns',
  fieldGoalsMade: 'field_goals_made',
  fieldGoalsAttempted: 'field_goals_attempted',
  fieldGoalPct: 'field_goal_pct',
  longestFieldGoal: 'longest_field_goal',
  extraPointsMade: 'extra_points_made',
  extraPointsAttempted: 'extra_points_attempted',
  extraPointPct: 'extra_point_pct',
}

const tAlias: Record<string, string> = {
  gamesPlayed: 'games_played',
  wins: 'wins',
  losses: 'losses',
  draws: 'draws',
  winPct: 'win_pct',
  points: 'points',
  pointsPerGame: 'points_per_game',
  touchdowns: 'touchdowns',
  passingYards: 'passing_yards',
  passingYardsPerGame: 'passing_yards_per_game',
  passingTouchdowns: 'passing_touchdowns',
  interceptionsThrown: 'interceptions_thrown',
  rushingYards: 'rushing_yards',
  rushingYardsPerGame: 'rushing_yards_per_game',
  rushingTouchdowns: 'rushing_touchdowns',
  totalYards: 'total_yards',
  totalYardsPerGame: 'total_yards_per_game',
  pointsAllowed: 'points_allowed',
  pointsAllowedPerGame: 'points_allowed_per_game',
  yardsAllowed: 'yards_allowed',
  yardsAllowedPerGame: 'yards_allowed_per_game',
  sacks: 'sacks',
  interceptions: 'interceptions',
  takeaways: 'takeaways',
  turnovers: 'turnovers',
  turnoverDifferential: 'turnover_differential',
  pointDifferential: 'point_differential',
  pointDifferentialPerGame: 'point_differential_per_game',
}

function year(v?: string) {
  if (!v) return undefined
  const m = v.match(/\d{4}/)
  return m ? Number(m[0]) : undefined
}

function careerYearNumber(v?: string) {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : undefined
}

const careerSeasonCte = `
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
      ON g.game_id=p.game_id
  ) seasons_played
)`

function base(body: Body, prefix: 'p' | 't') {
  const c: string[] = []
  const v: any[] = []

  const add = (sql: string, x: any) => {
    v.push(x)
    c.push(sql.replace('?', `$${v.length}`))
  }
  const addMulti = (column:string, raw?:string) => { const items=(raw??'').split('||').map(x=>x.trim()).filter(x=>x&&x!=='Any'); if(!items.length)return; const marks=items.map(item=>{v.push(item);return `$${v.length}`}); c.push(`${column} IN (${marks.join(',')})`) }

  if (
    body.gameStage &&
    body.gameStage !== 'Any'
  ) {
    add('g.season_type=?', body.gameStage)
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

    v.push(m, d)

    c.push(
      `extract(month from g.game_date)::int=$${v.length - 1}
       AND extract(day from g.game_date)::int=$${v.length}`,
    )
  }

  if (
    body.periodFilter &&
    body.periodFilter !== 'Any'
  ) {
    if (body.periodFilter.startsWith('Week ')) {
      const week = Number(
        body.periodFilter.slice(5),
      )

      if (Number.isInteger(week)) {
        v.push(week)

        c.push(
          `g.season_type='Regular Season'
           AND g.week=$${v.length}`,
        )
      }
    } else {
      const code: Record<string, string> = {
        'Wild Card': 'WC',
        Divisional: 'DIV',
        'Conference Championship': 'CON',
        'Super Bowl': 'SB',
      }

      const gameType =
        code[body.periodFilter]

      if (gameType) {
        v.push(gameType)

        c.push(
          `g.season_type='Playoffs'
           AND upper(g.game_type)=$${v.length}`,
        )
      }
    }
  }

  addMulti(`${prefix}.team`, body.team)
  if (prefix === 'p') { addMulti('p.player_name', body.player); addMulti('p.position', body.position) }

  if (
    prefix === 'p' &&
    body.careerYearOperator &&
    body.careerYearOperator !== 'Any'
  ) {
    const c1 =
      careerYearNumber(
        body.careerYearValue,
      )

    const c2 =
      careerYearNumber(
        body.careerYearSecondValue,
      )

    if (c1 !== undefined) {
      if (
        body.careerYearOperator === 'Exactly'
      ) {
        add('cy.career_year=?', c1)
      }

      if (
        body.careerYearOperator === 'Before'
      ) {
        add('cy.career_year<?', c1)
      }

      if (
        body.careerYearOperator === 'After'
      ) {
        add('cy.career_year>?', c1)
      }

      if (
        body.careerYearOperator === 'Between' &&
        c2 !== undefined
      ) {
        v.push(
          Math.min(c1, c2),
          Math.max(c1, c2),
        )

        c.push(
          `cy.career_year BETWEEN $${v.length - 1} AND $${v.length}`,
        )
      }
    }
  }

  const a = year(body.seasonValue)
  const b = year(body.seasonSecondValue)

  if (
    body.seasonOperator &&
    body.seasonOperator !== 'Any' &&
    a !== undefined
  ) {
    if (
      body.seasonOperator === 'Exactly'
    ) {
      add('g.season=?', a)
    }

    if (
      body.seasonOperator === 'Before'
    ) {
      add('g.season<?', a)
    }

    if (
      body.seasonOperator === 'After'
    ) {
      add('g.season>?', a)
    }

    if (
      body.seasonOperator === 'Between' &&
      b !== undefined
    ) {
      v.push(
        Math.min(a, b),
        Math.max(a, b),
      )

      c.push(
        `g.season BETWEEN $${v.length - 1} AND $${v.length}`,
      )
    }
  }

  return {
    sql: c.length
      ? `WHERE ${c.join(' AND ')}`
      : '',
    values: v,
  }
}

function playerAgg(
  scope: 'Season' | 'Career',
  w: string,
  useCareerYear: boolean,
) {
  const group =
    scope === 'Season'
      ? 'p.player_id,p.player_name,g.season'
      : 'p.player_id,p.player_name'

  const season =
    scope === 'Season'
      ? `
        g.season::text season,
        g.season::text start_season,
        g.season::text end_season,
        1::int seasons_played,
        ${
          useCareerYear
            ? 'max(cy.career_year)::int'
            : 'NULL::int'
        } career_year,
      `
      : `
        min(g.season)::text start_season,
        max(g.season)::text end_season,
        count(DISTINCT g.season)::int seasons_played,
        NULL::int career_year,
      `

  return `
    SELECT
      p.player_id row_id,
      p.player_name entity_name,
      string_agg(
        DISTINCT p.team,
        '/' ORDER BY p.team
      ) team,
      ${season}
      count(*)::int games_played,
      sum((coalesce(p.passing_yards,0)/25.0 + 4*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 0*coalesce(p.receptions,0))) fantasy_points_standard_4,
      avg((coalesce(p.passing_yards,0)/25.0 + 4*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 0*coalesce(p.receptions,0))) fantasy_points_standard_4_per_game,
      sum((coalesce(p.passing_yards,0)/25.0 + 6*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 0*coalesce(p.receptions,0))) fantasy_points_standard_6,
      avg((coalesce(p.passing_yards,0)/25.0 + 6*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 0*coalesce(p.receptions,0))) fantasy_points_standard_6_per_game,
      sum((coalesce(p.passing_yards,0)/25.0 + 4*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 0.5*coalesce(p.receptions,0))) fantasy_points_half_ppr_4,
      avg((coalesce(p.passing_yards,0)/25.0 + 4*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 0.5*coalesce(p.receptions,0))) fantasy_points_half_ppr_4_per_game,
      sum((coalesce(p.passing_yards,0)/25.0 + 6*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 0.5*coalesce(p.receptions,0))) fantasy_points_half_ppr_6,
      avg((coalesce(p.passing_yards,0)/25.0 + 6*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 0.5*coalesce(p.receptions,0))) fantasy_points_half_ppr_6_per_game,
      sum((coalesce(p.passing_yards,0)/25.0 + 4*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 1*coalesce(p.receptions,0))) fantasy_points_ppr_4,
      avg((coalesce(p.passing_yards,0)/25.0 + 4*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 1*coalesce(p.receptions,0))) fantasy_points_ppr_4_per_game,
      sum((coalesce(p.passing_yards,0)/25.0 + 6*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 1*coalesce(p.receptions,0))) fantasy_points_ppr_6,
      avg((coalesce(p.passing_yards,0)/25.0 + 6*coalesce(p.passing_touchdowns,0) - 2*coalesce(p.passing_interceptions,0) + coalesce(p.rushing_yards,0)/10.0 + 6*coalesce(p.rushing_touchdowns,0) + coalesce(p.receiving_yards,0)/10.0 + 6*coalesce(p.receiving_touchdowns,0) + 1*coalesce(p.receptions,0))) fantasy_points_ppr_6_per_game,
      sum(p.passing_yards) passing_yards,
      avg(p.passing_yards) passing_yards_per_game,
      sum(p.passing_attempts) passing_attempts,
      sum(p.completions) completions,
      sum(p.passing_touchdowns) passing_touchdowns,
      sum(p.passing_interceptions) passing_interceptions,
      sum(p.sacks_taken) sacks_taken,
      100*sum(p.completions)/
        nullif(sum(p.passing_attempts),0)
        completion_percentage,
      CASE
        WHEN sum(p.passing_attempts)>0 THEN
          (
            (
              greatest(
                0,
                least(
                  2.375,
                  (
                    (
                      sum(p.completions)/
                      sum(p.passing_attempts)
                    )-.3
                  )*5
                )
              )
              +
              greatest(
                0,
                least(
                  2.375,
                  (
                    (
                      sum(p.passing_yards)/
                      sum(p.passing_attempts)
                    )-3
                  )*.25
                )
              )
              +
              greatest(
                0,
                least(
                  2.375,
                  (
                    sum(p.passing_touchdowns)/
                    sum(p.passing_attempts)
                  )*20
                )
              )
              +
              greatest(
                0,
                least(
                  2.375,
                  2.375-
                  (
                    sum(p.passing_interceptions)/
                    sum(p.passing_attempts)
                  )*25
                )
              )
            )/6
          )*100
        ELSE NULL
      END passer_rating,
      sum(p.rushing_attempts) rushing_attempts,
      sum(p.rushing_yards) rushing_yards,
      avg(p.rushing_yards) rushing_yards_per_game,
      sum(p.rushing_touchdowns) rushing_touchdowns,
      sum(p.rushing_yards)/
        nullif(sum(p.rushing_attempts),0)
        yards_per_carry,
      sum(p.targets) targets,
      sum(p.receptions) receptions,
      sum(p.receiving_yards) receiving_yards,
      avg(p.receiving_yards) receiving_yards_per_game,
      sum(p.receiving_touchdowns) receiving_touchdowns,
      sum(p.receiving_yards)/
        nullif(sum(p.receptions),0)
        yards_per_reception,
      sum(p.tackles) tackles,
      sum(p.solo_tackles) solo_tackles,
      sum(p.assisted_tackles) assisted_tackles,
      sum(p.sacks) sacks,
      sum(p.defensive_interceptions) defensive_interceptions,
      sum(p.forced_fumbles) forced_fumbles,
      sum(p.fumble_recoveries) fumble_recoveries,
      sum(p.defensive_touchdowns) defensive_touchdowns,
      sum(p.field_goals_made) field_goals_made,
      sum(p.field_goals_attempted) field_goals_attempted,
      sum(p.field_goals_made)/
        nullif(sum(p.field_goals_attempted),0)
        field_goal_pct,
      max(p.longest_field_goal) longest_field_goal,
      sum(p.extra_points_made) extra_points_made,
      sum(p.extra_points_attempted) extra_points_attempted,
      sum(p.extra_points_made)/
        nullif(sum(p.extra_points_attempted),0)
        extra_point_pct
    FROM nfl_player_games p
    JOIN nfl_games g
      ON g.game_id=p.game_id
    ${
      useCareerYear
        ? `JOIN career_seasons cy
             ON cy.player_id=p.player_id
            AND cy.season=g.season`
        : ''
    }
    ${w}
    GROUP BY ${group}
  `
}

function teamAgg(w: string) {
  return `
    SELECT
      t.team row_id,
      t.team entity_name,
      t.team team,
      g.season::text season,
      g.season::text start_season,
      g.season::text end_season,
      1::int seasons_played,
      count(*)::int games_played,
      sum(
        CASE
          WHEN t.points>t.points_allowed THEN 1
          ELSE 0
        END
      )::int wins,
      sum(
        CASE
          WHEN t.points<t.points_allowed THEN 1
          ELSE 0
        END
      )::int losses,
      sum(
        CASE
          WHEN t.points=t.points_allowed THEN 1
          ELSE 0
        END
      )::int draws,
      avg(
        CASE
          WHEN t.points>t.points_allowed THEN 1.0
          WHEN t.points=t.points_allowed THEN .5
          ELSE 0
        END
      ) win_pct,
      sum(t.points) points,
      avg(t.points) points_per_game,
      sum(t.touchdowns) touchdowns,
      sum(t.passing_yards) passing_yards,
      avg(t.passing_yards) passing_yards_per_game,
      sum(t.passing_touchdowns) passing_touchdowns,
      sum(t.interceptions_thrown) interceptions_thrown,
      sum(t.rushing_yards) rushing_yards,
      avg(t.rushing_yards) rushing_yards_per_game,
      sum(t.rushing_touchdowns) rushing_touchdowns,
      sum(t.total_yards) total_yards,
      avg(t.total_yards) total_yards_per_game,
      sum(t.points_allowed) points_allowed,
      avg(t.points_allowed) points_allowed_per_game,
      sum(t.yards_allowed) yards_allowed,
      avg(t.yards_allowed) yards_allowed_per_game,
      sum(t.sacks) sacks,
      sum(t.interceptions) interceptions,
      sum(t.takeaways) takeaways,
      sum(t.turnovers) turnovers,
      sum(t.turnover_differential) turnover_differential,
      sum(t.point_differential) point_differential,
      avg(t.point_differential) point_differential_per_game
    FROM nfl_team_games t
    JOIN nfl_games g
      ON g.game_id=t.game_id
    ${w}
    GROUP BY t.team,g.season
  `
}

function condition(
  conditions: Condition[],
  alias: Record<string, string>,
  offset: number,
) {
  const c: string[] = []
  const v: any[] = []

  for (const x of conditions) {
    if (
      x.operator === 'any' ||
      x.value === undefined ||
      !alias[x.statistic]
    ) {
      continue
    }

    const col = alias[x.statistic]

    if (
      x.operator === 'between' &&
      x.secondValue !== undefined
    ) {
      v.push(
        x.value,
        x.secondValue,
      )

      c.push(
        `${col} BETWEEN
          LEAST(
            $${offset + v.length - 1},
            $${offset + v.length}
          )
          AND
          GREATEST(
            $${offset + v.length - 1},
            $${offset + v.length}
          )`,
      )
    } else {
      v.push(x.value)

      c.push(
        `${col} ${
          x.operator === 'gte'
            ? '>='
            : x.operator === 'lte'
              ? '<='
              : '='
        } $${offset + v.length}`,
      )
    }
  }

  return {
    sql: c.length
      ? `WHERE ${c.join(' AND ')}`
      : '',
    values: v,
  }
}

const aggScale: Record<string, number> = {
  fantasyPointsStandard4: 75,
  fantasyPointsStandard4PerGame: 5,
  fantasyPointsStandard6: 75,
  fantasyPointsStandard6PerGame: 5,
  fantasyPointsHalfPpr4: 75,
  fantasyPointsHalfPpr4PerGame: 5,
  fantasyPointsHalfPpr6: 75,
  fantasyPointsHalfPpr6PerGame: 5,
  fantasyPointsPpr4: 75,
  fantasyPointsPpr4PerGame: 5,
  fantasyPointsPpr6: 75,
  fantasyPointsPpr6PerGame: 5,
  gamesPlayed: 3,
  seasonsPlayed: 2,
  passingYards: 500,
  passingYardsPerGame: 25,
  passingAttempts: 75,
  completions: 50,
  passingTouchdowns: 5,
  passingInterceptions: 3,
  sacksTaken: 5,
  completionPercentage: 4,
  passerRating: 8,
  rushingAttempts: 50,
  rushingYards: 250,
  rushingYardsPerGame: 15,
  rushingTouchdowns: 3,
  yardsPerCarry: 0.75,
  targets: 30,
  receptions: 25,
  receivingYards: 250,
  receivingYardsPerGame: 15,
  receivingTouchdowns: 3,
  yardsPerReception: 2,
  tackles: 20,
  soloTackles: 15,
  assistedTackles: 10,
  sacks: 3,
  defensiveInterceptions: 2,
  forcedFumbles: 2,
  fumbleRecoveries: 2,
  defensiveTouchdowns: 1,
  fieldGoalsMade: 5,
  fieldGoalsAttempted: 5,
  fieldGoalPct: 0.05,
  longestFieldGoal: 5,
  extraPointsMade: 7,
  extraPointsAttempted: 7,
  extraPointPct: 0.05,
  wins: 3,
  losses: 3,
  draws: 1,
  winPct: 0.08,
  points: 75,
  pointsPerGame: 5,
  touchdowns: 10,
  totalYards: 750,
  totalYardsPerGame: 50,
  pointsAllowed: 75,
  pointsAllowedPerGame: 5,
  yardsAllowed: 750,
  yardsAllowedPerGame: 50,
  takeaways: 5,
  turnovers: 5,
  turnoverDifferential: 5,
  pointDifferential: 75,
  pointDifferentialPerGame: 5,
}

function closestExpressions(
  conditions: Condition[],
  alias: Record<string, string>,
  offset: number,
) {
  const values: any[] = []
  const terms: string[] = []
  const mets: string[] = []

  for (const c of conditions) {
    if (
      c.operator === 'any' ||
      c.value === undefined ||
      !alias[c.statistic]
    ) {
      continue
    }

    const col =
      alias[c.statistic]

    const scale =
      aggScale[c.statistic] ?? 5

    values.push(c.value)

    const p1 =
      `$${offset + values.length}`

    if (c.operator === 'gte') {
      terms.push(
        `CASE
          WHEN ${col}>=${p1}
          THEN 0
          ELSE (${p1}-${col})/${scale}::numeric
        END`,
      )

      mets.push(
        `CASE
          WHEN ${col}>=${p1}
          THEN 1
          ELSE 0
        END`,
      )
    } else if (
      c.operator === 'lte'
    ) {
      terms.push(
        `CASE
          WHEN ${col}<=${p1}
          THEN 0
          ELSE (${col}-${p1})/${scale}::numeric
        END`,
      )

      mets.push(
        `CASE
          WHEN ${col}<=${p1}
          THEN 1
          ELSE 0
        END`,
      )
    } else if (
      c.operator === 'eq'
    ) {
      terms.push(
        `abs(${col}-${p1})/${scale}::numeric`,
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
      values.push(
        c.secondValue,
      )

      const p2 =
        `$${offset + values.length}`

      terms.push(
        `CASE
          WHEN ${col}
            BETWEEN LEAST(${p1},${p2})
            AND GREATEST(${p1},${p2})
          THEN 0
          ELSE LEAST(
            abs(${col}-${p1}),
            abs(${col}-${p2})
          )/${scale}::numeric
        END`,
      )

      mets.push(
        `CASE
          WHEN ${col}
            BETWEEN LEAST(${p1},${p2})
            AND GREATEST(${p1},${p2})
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
  const actual =
    stats[c.statistic]

  const v =
    c.value ?? 0

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
              actual >= Math.min(
                v,
                c.secondValue,
              ) &&
              actual <= Math.max(
                v,
                c.secondValue,
              )
    )

  return {
    statistic: c.statistic,
    actual: actual ?? null,
    met,
    targetText: target,
    missText: met
      ? undefined
      : `needed ${target}`,
    normalizedMiss: met
      ? 0
      : 1,
  }
}

function rec(
  row: any,
  body: Body,
  alias: Record<string, string>,
) {
  const stats:
    Record<string, number> = {}

  for (
    const [k, col]
    of Object.entries(alias)
  ) {
    if (
      row[col] !== null &&
      row[col] !== undefined
    ) {
      const x =
        Number(row[col])

      if (
        Number.isFinite(x)
      ) {
        stats[k] =
          Math.round(
            x * 1000,
          ) / 1000
      }
    }
  }

  const season =
    body.scope === 'Season'
      ? row.season
      : `${row.start_season} – ${row.end_season}`

  return {
    id:
      `NFL-${body.scope}-` +
      `${row.row_id}-${season}`,
    gameId: '',
    sport: 'NFL',
    searchType:
      body.searchType,
    scope:
      body.scope,
    entityName:
      row.entity_name,
    team:
      row.team,
    opponent: '—',
    date: '',
    season,
    gameStage:
      body.gameStage === 'Playoffs'
        ? 'Playoffs'
        : 'Regular Season',
    homeAway: 'Home',
    result: 'D',
    finalScore:
      `${row.games_played} GP`,
    gamesPlayed:
      Number(row.games_played),
    seasonsPlayed:
      Number(row.seasons_played),
    careerYear:
      row.career_year === null ||
      row.career_year === undefined
        ? undefined
        : Number(row.career_year),
    stageLabel:
      body.gameStage ?? 'Any',
    stats,
  }
}

export async function searchNflAggregate(
  body: Body,
) {
  if (
    body.scope === 'Career' &&
    body.searchType === 'Team'
  ) {
    throw new Error(
      'NFL Team Career requires franchise mapping and is not enabled yet.',
    )
  }

  const prefix =
    body.searchType === 'Player'
      ? 'p'
      : 't'

  const useCareerYear =
    body.searchType === 'Player' &&
    body.careerYearOperator !== undefined &&
    body.careerYearOperator !== 'Any' &&
    careerYearNumber(
      body.careerYearValue,
    ) !== undefined

  const b =
    base(
      body,
      prefix,
    )

  const cte =
    body.searchType === 'Player'
      ? playerAgg(
          body.scope,
          b.sql,
          useCareerYear,
        )
      : teamAgg(
          b.sql,
        )

  const alias =
    body.searchType === 'Player'
      ? pAlias
      : tAlias

  const cw =
    condition(
      body.conditions ?? [],
      alias,
      b.values.length,
    )

  const withPrefix =
    useCareerYear
      ? `WITH ${careerSeasonCte}, agg AS (${cte})`
      : `WITH agg AS (${cte})`

  const total =
    Number(
      (
        await pool.query(
          `${withPrefix}
           SELECT count(*) count
           FROM agg
           ${cw.sql}`,
          [
            ...b.values,
            ...cw.values,
          ],
        )
      ).rows[0]?.count ?? 0,
    )

  const sortMap:
    Record<string, string> = {
      season:
        'start_season',
      entity:
        'entity_name',
      team:
        'team',
      ...alias,
    }

  const sort =
    sortMap[
      body.sortBy ?? ''
    ] ??
    (
      body.scope === 'Season'
        ? 'start_season'
        : body.searchType === 'Player'
          ? 'passing_yards'
          : 'wins'
    )

  const dir =
    body.sortDirection === 'asc'
      ? 'ASC'
      : 'DESC'

  const limit =
    Math.min(
      body.limit ?? 50,
      200,
    )

  const offset =
    Math.max(
      body.offset ?? 0,
      0,
    )

  const rows =
    await pool.query(
      `${withPrefix}
       SELECT *
       FROM agg
       ${cw.sql}
       ORDER BY
         ${sort} ${dir}
         NULLS LAST,
         entity_name ASC
       LIMIT $${b.values.length + cw.values.length + 1}
       OFFSET $${b.values.length + cw.values.length + 2}`,
      [
        ...b.values,
        ...cw.values,
        limit,
        offset,
      ],
    )

  let closest: any[] = []

  const active =
    (
      body.conditions ?? []
    ).filter(
      c =>
        c.operator !== 'any' &&
        c.value !== undefined,
    )

  if (
    total === 0 &&
    active.length
  ) {
    const ce =
      closestExpressions(
        active,
        alias,
        b.values.length,
      )

    const cr =
      await pool.query(
        `${withPrefix}
         SELECT
           *,
           ${ce.distance}
             normalized_distance,
           ${ce.met}
             conditions_met
         FROM agg
         ORDER BY
           normalized_distance ASC,
           conditions_met DESC,
           entity_name ASC
         LIMIT 5`,
        [
          ...b.values,
          ...ce.values,
        ],
      )

    closest =
      cr.rows.map(r => {
        const record =
          rec(
            r,
            body,
            alias,
          )

        const distance =
          Number(
            r.normalized_distance ?? 0,
          )

        return {
          record,
          distance,
          similarity:
            Math.round(
              100 /
              (
                1 +
                distance
              ),
            ),
          conditionsMet:
            Number(
              r.conditions_met ?? 0,
            ),
          conditionCount:
            active.length,
          explanations:
            active.map(
              c =>
                explain(
                  record.stats,
                  c,
                ),
            ),
        }
      })
  }

  const meta =
    (
      await pool.query(
        'SELECT min(season) min,max(season) max FROM nfl_games',
      )
    ).rows[0]

  return {
    total,
    records:
      rows.rows.map(
        r =>
          rec(
            r,
            body,
            alias,
          ),
      ),
    closest,
    coverage: {
      startSeason:
        String(meta.min),
      endSeason:
        String(meta.max),
      startYear:
        Number(meta.min),
      endYear:
        Number(meta.max),
      limitingStatistic:
        null,
      message:
        body.searchType === 'Team'
          ? 'NFL team season coverage uses historical game-level data for 1970-1998 and standardized nflverse data from 1999 onward. Historical field availability varies by statistic.'
          : 'NFL player season/career coverage uses historical game-level data for 1970-1998 and standardized nflverse data from 1999 onward. Historical field availability varies by statistic.',
    },
  }
}