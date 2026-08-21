import { pool } from './db.js'
import { coverageFor, NBA_PLAYER_COVERAGE, NBA_TEAM_COVERAGE, seasonLabel } from './nbaCoverage.js'

type Condition = { statistic: string; operator: 'any'|'gte'|'eq'|'lte'|'between'; value?: number; secondValue?: number }
type SearchBody = {
  searchType: 'Player'|'Team'
  gameStage?: 'Any'|'Regular Season'|'Playoffs'
  seasonOperator?: 'Any'|'Exactly'|'Before'|'After'|'Between'
  seasonValue?: string
  seasonSecondValue?: string
  careerYearOperator?: 'Any'|'Exactly'|'Before'|'After'|'Between'
  careerYearValue?: string
  careerYearSecondValue?: string
  team?: string
  opponent?: string
  player?: string
  position?: string
  resultFilter?: 'Any'|'W'|'L'|'D'
  dayOfWeek?: string
  month?: string
  specificDate?: string
  playoffRound?: string
  conditions?: Condition[]
  limit?: number
  offset?: number
  sortBy?: string
  sortDirection?: 'asc'|'desc'
}

const playerStats: Record<string,string> = {
  points:'p.points', rebounds:'p.rebounds', assists:'p.assists', steals:'p.steals', blocks:'p.blocks',
  threePointersMade:'p.three_made', fieldGoalsMade:'p.fg_made', fieldGoalsAttempted:'p.fg_attempted',
  freeThrowsMade:'p.ft_made', freeThrowsAttempted:'p.ft_attempted', offensiveRebounds:'p.offensive_rebounds',
  defensiveRebounds:'p.defensive_rebounds', turnovers:'p.turnovers', personalFouls:'p.personal_fouls', minutes:'p.minutes',
  fieldGoalPct:'p.fg_pct', threePointPct:'p.three_pct', freeThrowPct:'p.ft_pct', plusMinus:'p.plus_minus'
}
const teamStats: Record<string,string> = {
  points:'t.points', rebounds:'t.rebounds', assists:'t.assists', steals:'t.steals', blocks:'t.blocks',
  threePointersMade:'t.three_made', threePointersAttempted:'t.three_attempted', fieldGoalsMade:'t.fg_made', fieldGoalsAttempted:'t.fg_attempted',
  freeThrowsMade:'t.ft_made', freeThrowsAttempted:'t.ft_attempted', fieldGoalPct:'t.fg_pct', threePointPct:'t.three_pct', freeThrowPct:'t.ft_pct', offensiveRebounds:'t.offensive_rebounds', defensiveRebounds:'t.defensive_rebounds',
  turnovers:'t.turnovers', personalFouls:'t.personal_fouls', pointDifferential:'t.plus_minus', opponentPoints:'opp.points'
}

function seasonStart(s?: string) { return s ? Number(s.slice(0,4)) : undefined }
function careerYearNumber(v?: string) { const n=Number(v); return Number.isInteger(n) && n > 0 ? n : undefined }

function nbaPositionClause(column:string, position?:string){
  if(!position || position==='Any') return null
  if(position==='Guard') return `upper(coalesce(${column},'')) ~ '(^|[^A-Z])(PG|SG|G)([^A-Z]|$)' OR upper(coalesce(${column},'')) LIKE '%GUARD%'`
  if(position==='Forward') return `upper(coalesce(${column},'')) ~ '(^|[^A-Z])(SF|PF|F)([^A-Z]|$)' OR upper(coalesce(${column},'')) LIKE '%FORWARD%'`
  if(position==='Center') return `upper(coalesce(${column},'')) ~ '(^|[^A-Z])C([^A-Z]|$)' OR upper(coalesce(${column},'')) LIKE '%CENTER%'`
  return null
}

const nbaCareerSeasonCte = `career_seasons AS (
  SELECT player_id, season, dense_rank() OVER (PARTITION BY player_id ORDER BY substring(season,1,4)::int) AS career_year
  FROM (
    SELECT DISTINCT p.player_id, g.season
    FROM nba_player_games p
    JOIN nba_games g ON g.game_id=p.game_id
    WHERE p.played IS TRUE
  ) seasons_played
)`

function buildWhere(body: SearchBody, alias: 'p'|'t', stats: Record<string,string>, includeConditions = true, coverageStart?: number) {
  const clauses:string[]=[]; const values:unknown[]=[]
  const add=(sql:string,v:unknown)=>{values.push(v);clauses.push(sql.replace('?',`$${values.length}`))}
  if(alias==='p') clauses.push('p.played IS TRUE')
  if(coverageStart!==undefined) add("substring(g.season,1,4)::int >= ?",coverageStart)
  if(body.gameStage && body.gameStage!=='Any') add('g.season_type = ?',body.gameStage)
  if(body.team && body.team!=='Any') add(`${alias}.team = ?`,body.team)
  if(body.opponent && body.opponent!=='Any') add(`${alias}.opponent = ?`,body.opponent)
  if(alias==='p' && body.player && body.player!=='Any') add('p.player_name = ?',body.player)
  if(alias==='p' && body.position && body.position!=='Any') {
    const normalized=nbaPositionClause('p.position',body.position)
    if(normalized) clauses.push(`(${normalized})`)
    else add('p.position = ?',body.position)
  }
  if(alias==='p' && body.careerYearOperator && body.careerYearOperator!=='Any') {
    const c1=careerYearNumber(body.careerYearValue), c2=careerYearNumber(body.careerYearSecondValue)
    if(c1!==undefined){
      if(body.careerYearOperator==='Exactly') add('cy.career_year = ?',c1)
      if(body.careerYearOperator==='Before') add('cy.career_year < ?',c1)
      if(body.careerYearOperator==='After') add('cy.career_year > ?',c1)
      if(body.careerYearOperator==='Between' && c2!==undefined){values.push(Math.min(c1,c2),Math.max(c1,c2));clauses.push(`cy.career_year BETWEEN $${values.length-1} AND $${values.length}`)}
    }
  }
  if(body.resultFilter && body.resultFilter!=='Any') {
    const teamScore = `CASE WHEN ${alias}.team = g.home_team THEN g.home_score ELSE g.away_score END`
    const oppScore = `CASE WHEN ${alias}.team = g.home_team THEN g.away_score ELSE g.home_score END`
    const op = body.resultFilter==='W' ? '>' : body.resultFilter==='L' ? '<' : '='
    clauses.push(`${teamScore} ${op} ${oppScore}`)
  }
  if(body.dayOfWeek && body.dayOfWeek!=='Any') {
    const day=Number(body.dayOfWeek)
    if(Number.isInteger(day) && day>=0 && day<=6) add('EXTRACT(DOW FROM g.game_date)::int = ?',day)
  }
  if(body.month && body.month!=='Any') {
    const month=Number(body.month)
    if(Number.isInteger(month) && month>=1 && month<=12) add('EXTRACT(MONTH FROM g.game_date)::int = ?',month)
  }
  if(body.specificDate && /^\d{2}-\d{2}$/.test(body.specificDate)) {
    const [specificMonth,specificDay]=body.specificDate.split('-').map(Number)
    if(Number.isInteger(specificMonth) && specificMonth>=1 && specificMonth<=12 && Number.isInteger(specificDay) && specificDay>=1 && specificDay<=31) {
      add('EXTRACT(MONTH FROM g.game_date)::int = ?',specificMonth)
      add('EXTRACT(DAY FROM g.game_date)::int = ?',specificDay)
    }
  }
  if(body.playoffRound && body.playoffRound!=='Any') {
    const round=Number(body.playoffRound)
    if(Number.isInteger(round) && round>=1 && round<=4){ add("substring(g.game_id,8,1)::int = ?",round); clauses.push("g.season_type = 'Playoffs'") }
  }
  const s1=seasonStart(body.seasonValue), s2=seasonStart(body.seasonSecondValue)
  if(body.seasonOperator && body.seasonOperator!=='Any' && s1!==undefined){
    if(body.seasonOperator==='Exactly') add("substring(g.season,1,4)::int = ?",s1)
    if(body.seasonOperator==='Before') add("substring(g.season,1,4)::int < ?",s1)
    if(body.seasonOperator==='After') add("substring(g.season,1,4)::int > ?",s1)
    if(body.seasonOperator==='Between' && s2!==undefined){ values.push(Math.min(s1,s2),Math.max(s1,s2)); clauses.push(`substring(g.season,1,4)::int BETWEEN $${values.length-1} AND $${values.length}`) }
  }
  if (includeConditions) for(const c of body.conditions ?? []){
    if(c.operator==='any') continue
    const col=stats[c.statistic]; if(!col || c.value===undefined) continue
    if(c.operator==='between' && c.secondValue!==undefined){values.push(c.value,c.secondValue);clauses.push(`${col} BETWEEN $${values.length-1} AND $${values.length}`)}
    else { const op=c.operator==='gte'?'>=':c.operator==='lte'?'<=':'='; add(`${col} ${op} ?`,c.value) }
  }
  return {sql: clauses.length?`WHERE ${clauses.join(' AND ')}`:'', values}
}

const playerJson = `jsonb_build_object('points',p.points,'rebounds',p.rebounds,'assists',p.assists,'steals',p.steals,'blocks',p.blocks,'threePointersMade',p.three_made,'fieldGoalsMade',p.fg_made,'fieldGoalsAttempted',p.fg_attempted,'freeThrowsMade',p.ft_made,'freeThrowsAttempted',p.ft_attempted,'offensiveRebounds',p.offensive_rebounds,'defensiveRebounds',p.defensive_rebounds,'turnovers',p.turnovers,'personalFouls',p.personal_fouls,'minutes',p.minutes,'fieldGoalPct',p.fg_pct,'threePointPct',p.three_pct,'freeThrowPct',p.ft_pct,'plusMinus',p.plus_minus)`
const teamJson = `jsonb_build_object('points',t.points,'rebounds',t.rebounds,'assists',t.assists,'steals',t.steals,'blocks',t.blocks,'threePointersMade',t.three_made,'threePointersAttempted',t.three_attempted,'fieldGoalsMade',t.fg_made,'fieldGoalsAttempted',t.fg_attempted,'freeThrowsMade',t.ft_made,'freeThrowsAttempted',t.ft_attempted,'fieldGoalPct',t.fg_pct,'threePointPct',t.three_pct,'freeThrowPct',t.ft_pct,'offensiveRebounds',t.offensive_rebounds,'defensiveRebounds',t.defensive_rebounds,'turnovers',t.turnovers,'personalFouls',t.personal_fouls,'pointDifferential',t.plus_minus,'opponentPoints',opp.points)`

export async function searchNba(body: SearchBody){
  const isPlayer=body.searchType==='Player'; const alias=isPlayer?'p':'t'; const statMap=isPlayer?playerStats:teamStats
  const meta=await nbaMetadata()
  const dbYears=(meta.seasons??[]).map((s:string)=>seasonStart(s)).filter((n:any):n is number=>Number.isFinite(n))
  const activeStats=(body.conditions??[]).filter(c=>c.operator!=='any').map(c=>c.statistic)
  const coverage=coverageFor(body.searchType,activeStats,Math.min(...dbYears),Math.max(...dbYears))
  const useCareerYear=isPlayer&&body.careerYearOperator!==undefined&&body.careerYearOperator!=='Any'&&careerYearNumber(body.careerYearValue)!==undefined
  const {sql,values}=buildWhere(body,alias,statMap,true,coverage.startYear); const limit=Math.min(body.limit??100,500); const offset=Math.max(body.offset??0,0)
  const from=isPlayer ? `nba_player_games p JOIN nba_games g ON g.game_id=p.game_id${useCareerYear?' JOIN career_seasons cy ON cy.player_id=p.player_id AND cy.season=g.season':''}` : `nba_team_games t JOIN nba_games g ON g.game_id=t.game_id JOIN nba_team_games opp ON opp.game_id=t.game_id AND opp.team_id<>t.team_id`
  const entity=isPlayer?'p.player_name':'t.team'; const team=`${alias}.team`; const opponent=`${alias}.opponent`; const json=isPlayer?playerJson:teamJson
  const queryPrefix=useCareerYear?`WITH ${nbaCareerSeasonCte} `:''
  const count=await pool.query(`${queryPrefix}SELECT count(*)::int AS count FROM ${from} ${sql}`,values)
  const sortColumns:Record<string,string>={date:'g.game_date',entity:entity,team:team,opponent:opponent,season:'g.season',result:`CASE WHEN ${alias}.team = g.home_team THEN g.home_score-g.away_score ELSE g.away_score-g.home_score END`,...statMap}
  const sortColumn=sortColumns[body.sortBy??'date']??'g.game_date'
  const sortDirection=body.sortDirection==='asc'?'ASC':'DESC'
  const rows=await pool.query(`${queryPrefix}SELECT ${alias}.game_id, ${entity} AS entity_name, ${team} AS team, ${opponent} AS opponent, g.game_date, g.season, g.season_type, g.home_team, g.away_team, g.home_score, g.away_score, ${json} AS stats${useCareerYear?', cy.career_year AS career_year':''} FROM ${from} ${sql} ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, g.game_date DESC, ${entity} ASC LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,limit,offset])
  const total=count.rows[0]?.count??0
  const records=rows.rows.map(r=>toRecord(r,body.searchType))
  let closest:any[]=[]
  const activeConditions=(body.conditions??[]).filter(c=>c.operator!=='any' && c.value!==undefined)
  if(total===0 && activeConditions.length){
    const base=buildWhere(body,alias,statMap,false,coverage.startYear)
    const distanceOrder=buildDistanceOrder(activeConditions,statMap,base.values.length)
    const candidates=await pool.query(`${queryPrefix}SELECT ${alias}.game_id, ${entity} AS entity_name, ${team} AS team, ${opponent} AS opponent, g.game_date, g.season, g.season_type, g.home_team, g.away_team, g.home_score, g.away_score, ${json} AS stats, ${distanceOrder.distanceSql} AS normalized_distance, ${distanceOrder.metSql} AS conditions_met FROM ${from} ${base.sql} ORDER BY normalized_distance ASC, conditions_met DESC, g.game_date DESC LIMIT 5`,[...base.values,...distanceOrder.values])
    closest=candidates.rows.map(r=>{
      const record=toRecord(r,body.searchType)
      const explanations=activeConditions.map(c=>explainClosestCondition(record.stats,c))
      const distance=Number(r.normalized_distance??explanations.reduce((sum,item)=>sum+item.normalizedMiss,0))
      const conditionsMet=Number(r.conditions_met??explanations.filter(item=>item.met).length)
      return {record,distance,similarity:Math.round(100/(1+distance)),conditionsMet,conditionCount:activeConditions.length,explanations}
    })
  }
  return {total,records,closest,coverage}
}

function toRecord(r:any, searchType:'Player'|'Team'){
  const isHome=r.team===r.home_team; const teamScore=isHome?r.home_score:r.away_score; const oppScore=isHome?r.away_score:r.home_score
  return {id:`NBA-${searchType}-${r.game_id}-${r.entity_name}`,gameId:r.game_id,sport:'NBA',searchType,entityName:r.entity_name,team:r.team,opponent:r.opponent,date:String(r.game_date).slice(0,10),season:r.season,gameStage:r.season_type,homeAway:isHome?'Home':'Away',result:teamScore>oppScore?'W':teamScore<oppScore?'L':'D',finalScore:`${teamScore}-${oppScore}`,careerYear:r.career_year===null||r.career_year===undefined?undefined:Number(r.career_year),stats:r.stats}
}


function buildDistanceOrder(conditions:Condition[], stats:Record<string,string>, parameterOffset:number){
  const distanceTerms:string[]=[]
  const metTerms:string[]=[]
  const values:unknown[]=[]
  const param=(value:unknown)=>{values.push(value);return `$${parameterOffset+values.length}`}
  for(const c of conditions){
    const col=stats[c.statistic]
    if(!col || c.value===undefined) continue
    const scale=Math.max(normalizationScale(c.statistic),0.0001)
    const p1=param(c.value)
    if(c.operator==='gte'){
      distanceTerms.push(`CASE WHEN ${col} IS NULL THEN 5 WHEN ${col} >= ${p1} THEN 0 ELSE (${p1} - ${col}) / ${scale}::numeric END`)
      metTerms.push(`CASE WHEN ${col} >= ${p1} THEN 1 ELSE 0 END`)
    } else if(c.operator==='lte'){
      distanceTerms.push(`CASE WHEN ${col} IS NULL THEN 5 WHEN ${col} <= ${p1} THEN 0 ELSE (${col} - ${p1}) / ${scale}::numeric END`)
      metTerms.push(`CASE WHEN ${col} <= ${p1} THEN 1 ELSE 0 END`)
    } else if(c.operator==='eq'){
      distanceTerms.push(`CASE WHEN ${col} IS NULL THEN 5 ELSE ABS(${col} - ${p1}) / ${scale}::numeric END`)
      metTerms.push(`CASE WHEN ${col} = ${p1} THEN 1 ELSE 0 END`)
    } else if(c.operator==='between' && c.secondValue!==undefined){
      const p2=param(c.secondValue)
      distanceTerms.push(`CASE WHEN ${col} IS NULL THEN 5 WHEN ${col} BETWEEN LEAST(${p1},${p2}) AND GREATEST(${p1},${p2}) THEN 0 WHEN ${col} < LEAST(${p1},${p2}) THEN (LEAST(${p1},${p2})-${col}) / ${scale}::numeric ELSE (${col}-GREATEST(${p1},${p2})) / ${scale}::numeric END`)
      metTerms.push(`CASE WHEN ${col} BETWEEN LEAST(${p1},${p2}) AND GREATEST(${p1},${p2}) THEN 1 ELSE 0 END`)
    }
  }
  return {distanceSql:distanceTerms.length?distanceTerms.join(' + '):'0',metSql:metTerms.length?metTerms.join(' + '):'0',values}
}

function normalizationScale(stat:string){
  const scales:Record<string,number>={points:8,rebounds:4,assists:3,steals:1,blocks:1,threePointersMade:2,threePointersAttempted:5,fieldGoalsMade:3,fieldGoalsAttempted:5,freeThrowsMade:3,freeThrowsAttempted:4,offensiveRebounds:2,defensiveRebounds:3,turnovers:2,personalFouls:2,minutes:6,fieldGoalPct:.08,threePointPct:.10,freeThrowPct:.10,plusMinus:8,pointDifferential:10,opponentPoints:10}
  return scales[stat]??5
}

function explainClosestCondition(stats:Record<string,number|null>,c:Condition){
  const actual=stats[c.statistic]
  const value=c.value
  if(c.operator==='any' || value===undefined) return {statistic:c.statistic,actual:actual??null,met:true,targetText:'Any',normalizedMiss:0}
  const targetText=c.operator==='gte'?`≥ ${value}`:c.operator==='lte'?`≤ ${value}`:c.operator==='eq'?`= ${value}`:`between ${value} and ${c.secondValue??'?'}`
  if(actual===undefined || actual===null) return {statistic:c.statistic,actual:null,met:false,targetText,missText:'stat unavailable',normalizedMiss:5}
  const met=c.operator==='gte'?actual>=value:c.operator==='lte'?actual<=value:c.operator==='eq'?actual===value:c.operator==='between'&&c.secondValue!==undefined?actual>=Math.min(value,c.secondValue)&&actual<=Math.max(value,c.secondValue):true
  if(met) return {statistic:c.statistic,actual,met:true,targetText,normalizedMiss:0}
  let miss=0; let missText=''
  if(c.operator==='gte'){miss=value-actual;missText=`${formatGap(miss)} short; needed ${targetText}`}
  else if(c.operator==='lte'){miss=actual-value;missText=`${formatGap(miss)} over; needed ${targetText}`}
  else if(c.operator==='eq'){miss=Math.abs(actual-value);missText=`${formatGap(miss)} ${actual<value?'short':'over'}; needed ${targetText}`}
  else if(c.operator==='between'&&c.secondValue!==undefined){const low=Math.min(value,c.secondValue),high=Math.max(value,c.secondValue),nearest=actual<low?low:high;miss=Math.abs(actual-nearest);missText=`${formatGap(miss)} ${actual<low?'below':'above'} range; needed ${targetText}`}
  return {statistic:c.statistic,actual,met:false,targetText,missText,normalizedMiss:miss/Math.max(normalizationScale(c.statistic),.0001)}
}
function formatGap(value:number){return Number.isInteger(value)?String(value):value.toFixed(2).replace(/0+$/,'').replace(/\.$/,'')}

export async function nbaMetadata(){
  const [seasons,teams,players,opponents,positions,counts]=await Promise.all([
    pool.query(`SELECT DISTINCT season FROM nba_games ORDER BY season DESC`),
    pool.query(`SELECT DISTINCT team FROM nba_team_games ORDER BY team`),
    pool.query(`SELECT DISTINCT player_name FROM nba_player_games WHERE played IS TRUE ORDER BY player_name`),
    pool.query(`SELECT DISTINCT opponent FROM nba_team_games ORDER BY opponent`),
    Promise.resolve({rows:[{position:'Guard'},{position:'Forward'},{position:'Center'}]}),
    pool.query(`SELECT count(*)::int games, (SELECT count(*)::int FROM nba_player_games) player_games, (SELECT count(*)::int FROM nba_team_games) team_games FROM nba_games`),
  ])
  return {seasons:seasons.rows.map(r=>r.season),teams:teams.rows.map(r=>r.team),players:players.rows.map(r=>r.player_name),opponents:opponents.rows.map(r=>r.opponent),positions:positions.rows.map(r=>r.position),counts:counts.rows[0]??{games:0,player_games:0,team_games:0},source:'NBA Stats'}
}

export async function nbaBoxScore(gameId:string){
  const game=(await pool.query(`SELECT * FROM nba_games WHERE game_id=$1`,[gameId])).rows[0]; if(!game) return null
  const teams=(await pool.query(`SELECT * FROM nba_team_games WHERE game_id=$1 ORDER BY CASE WHEN team=$2 THEN 0 ELSE 1 END`,[gameId,game.away_team])).rows
  const players=(await pool.query(`SELECT * FROM nba_player_games WHERE game_id=$1 ORDER BY team, starter DESC NULLS LAST, minutes DESC NULLS LAST`,[gameId])).rows
  const teamStats=teams.map((t:any)=>({team:t.team,score:t.points,result:t.points>(teams.find((x:any)=>x.team!==t.team)?.points??0)?'W':'L',stats:{points:t.points,rebounds:t.rebounds,assists:t.assists,steals:t.steals,blocks:t.blocks,fieldGoalsMade:t.fg_made,fieldGoalsAttempted:t.fg_attempted,threePointersMade:t.three_made,threePointersAttempted:t.three_attempted,freeThrowsMade:t.ft_made,freeThrowsAttempted:t.ft_attempted,offensiveRebounds:t.offensive_rebounds,defensiveRebounds:t.defensive_rebounds,turnovers:t.turnovers,personalFouls:t.personal_fouls,plusMinus:t.plus_minus}}))
  const playerStats=players.map((p:any)=>({id:String(p.player_id),name:p.player_name,team:p.team,position:p.position??'',starter:p.starter,stats:{minutes:p.minutes,points:p.points,rebounds:p.rebounds,assists:p.assists,steals:p.steals,blocks:p.blocks,fieldGoalsMade:p.fg_made,fieldGoalsAttempted:p.fg_attempted,threePointersMade:p.three_made,threePointersAttempted:p.three_attempted,freeThrowsMade:p.ft_made,freeThrowsAttempted:p.ft_attempted,offensiveRebounds:p.offensive_rebounds,defensiveRebounds:p.defensive_rebounds,turnovers:p.turnovers,personalFouls:p.personal_fouls,plusMinus:p.plus_minus}}))
  return {gameId:game.game_id,sport:'NBA',season:game.season,date:String(game.game_date).slice(0,10),gameStage:game.season_type,homeTeam:game.home_team,awayTeam:game.away_team,homeScore:game.home_score,awayScore:game.away_score,teamStats,playerStats}
}

export async function nbaNearestCalendarDay(month:number, day:number){
  if(!Number.isInteger(month)||month<1||month>12||!Number.isInteger(day)||day<1||day>31){
    throw new Error('Invalid calendar date')
  }
  const target = `make_date(2000, $1::int, $2::int)`
  const query = `
    WITH available AS (
      SELECT DISTINCT
        EXTRACT(MONTH FROM game_date)::int AS month,
        EXTRACT(DAY FROM game_date)::int AS day,
        EXTRACT(DOY FROM make_date(2000, EXTRACT(MONTH FROM game_date)::int, EXTRACT(DAY FROM game_date)::int))::int AS doy
      FROM nba_games
      WHERE NOT (EXTRACT(MONTH FROM game_date)::int = 2 AND EXTRACT(DAY FROM game_date)::int = 29)
         OR EXISTS (SELECT 1 FROM nba_games g2 WHERE EXTRACT(MONTH FROM g2.game_date)::int=2 AND EXTRACT(DAY FROM g2.game_date)::int=29)
    ), target AS (
      SELECT EXTRACT(DOY FROM ${target})::int AS doy
    )
    SELECT a.month, a.day,
      LEAST(ABS(a.doy-t.doy), 366-ABS(a.doy-t.doy))::int AS distance_days,
      (a.month=$1::int AND a.day=$2::int) AS exact
    FROM available a CROSS JOIN target t
    ORDER BY distance_days ASC, a.doy ASC
    LIMIT 1`
  const result=await pool.query(query,[month,day])
  const row=result.rows[0]
  if(!row) return {exact:false,month,day,distanceDays:null}
  return {exact:Boolean(row.exact),month:Number(row.month),day:Number(row.day),distanceDays:Number(row.distance_days)}
}

export async function nbaQualityReport(){
  const [overviewResult, integrityResult, seasonsResult] = await Promise.all([
    pool.query(`SELECT
      count(*)::int AS games,
      count(DISTINCT season)::int AS seasons,
      min(season) AS earliest_season,
      max(season) AS latest_season,
      (SELECT count(*)::int FROM nba_player_games) AS player_games,
      (SELECT count(*)::int FROM nba_player_games WHERE played IS TRUE) AS played_player_games,
      (SELECT count(*)::int FROM nba_team_games) AS team_games
    FROM nba_games`),
    pool.query(`WITH team_counts AS (
      SELECT g.game_id, count(t.team_id)::int AS team_rows
      FROM nba_games g LEFT JOIN nba_team_games t ON t.game_id=g.game_id
      GROUP BY g.game_id
    ), player_counts AS (
      SELECT g.game_id,
        count(p.player_id)::int AS player_rows,
        count(p.player_id) FILTER (WHERE p.played IS TRUE)::int AS played_rows
      FROM nba_games g LEFT JOIN nba_player_games p ON p.game_id=g.game_id
      GROUP BY g.game_id
    )
    SELECT
      count(*) FILTER (WHERE tc.team_rows <> 2)::int AS games_missing_two_team_rows,
      count(*) FILTER (WHERE pc.player_rows = 0)::int AS games_without_player_rows,
      count(*) FILTER (WHERE pc.played_rows = 0)::int AS games_without_played_players
    FROM team_counts tc JOIN player_counts pc USING(game_id)`),
    pool.query(`SELECT g.season,
      count(DISTINCT g.game_id)::int AS games,
      count(DISTINCT g.game_id) FILTER (WHERE g.season_type='Regular Season')::int AS regular_season,
      count(DISTINCT g.game_id) FILTER (WHERE g.season_type='Playoffs')::int AS playoffs,
      count(p.player_id) FILTER (WHERE p.played IS TRUE)::int AS played_player_games
    FROM nba_games g LEFT JOIN nba_player_games p ON p.game_id=g.game_id
    GROUP BY g.season ORDER BY g.season DESC`),
  ])
  const o=overviewResult.rows[0]
  const i=integrityResult.rows[0]
  const coverageRows=(registry:Record<string,{start:number;label:string}>)=>Object.entries(registry)
    .map(([statistic,rule])=>({statistic,label:rule.label,startSeason:seasonLabel(rule.start)}))
    .sort((a,b)=>a.startSeason.localeCompare(b.startSeason)||a.label.localeCompare(b.label))
  return {
    generatedAt:new Date().toISOString(),
    overview:{games:o.games,seasons:o.seasons,earliestSeason:o.earliest_season,latestSeason:o.latest_season,playerGames:o.player_games,playedPlayerGames:o.played_player_games,teamGames:o.team_games},
    integrity:{gamesMissingTwoTeamRows:i.games_missing_two_team_rows,gamesWithoutPlayerRows:i.games_without_player_rows,gamesWithoutPlayedPlayers:i.games_without_played_players},
    seasons:seasonsResult.rows.map(r=>({season:r.season,games:r.games,regularSeason:r.regular_season,playoffs:r.playoffs,playedPlayerGames:r.played_player_games})),
    coverage:{player:coverageRows(NBA_PLAYER_COVERAGE),team:coverageRows(NBA_TEAM_COVERAGE)},
  }
}
