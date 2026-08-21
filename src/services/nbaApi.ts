import type { ClosestPerformance, GameBoxScore, GameRecord, StatCondition, SearchScope } from '../types/search'

type NbaMeta={seasons:string[];teams:string[];players:string[];opponents:string[];positions:string[];counts:{games:number;player_games:number;team_games:number};source:string}
export type NbaCoverage={startSeason:string;endSeason:string;startYear:number;endYear:number;limitingStatistic:string|null;message:string}
export type ResultFilter='Any'|'W'|'L'|'D'
export type SortDirection='asc'|'desc'
export type SearchPayload={
  searchType:'Player'|'Team'
  gameStage:string
  seasonOperator:string
  seasonValue:string
  seasonSecondValue:string
  careerYearOperator:string
  careerYearValue:string
  careerYearSecondValue:string
  team:string
  opponent:string
  player:string
  position:string
  resultFilter:ResultFilter
  dayOfWeek:string
  month:string
  specificDate:string
  playoffRound:string
  conditions:StatCondition[]
  limit:number
  offset:number
  sortBy:string
  sortDirection:SortDirection
}

const API_BASE=(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'')
async function json<T>(url:string,init?:RequestInit):Promise<T>{const response=await fetch(url,init);if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error??`Request failed (${response.status})`)}return response.json()}
export const getNbaMeta=()=>json<NbaMeta>(`${API_BASE}/api/nba/meta`)
export const searchNba=(payload:SearchPayload)=>json<{total:number;records:GameRecord[];closest:ClosestPerformance[];coverage:NbaCoverage}>(`${API_BASE}/api/nba/search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
export const getNbaBoxScore=(gameId:string)=>json<GameBoxScore>(`${API_BASE}/api/nba/games/${gameId}`)

export type NbaCalendarDay={exact:boolean;month:number;day:number;distanceDays:number|null}
export const getNbaNearestCalendarDay=(month:number,day:number)=>json<NbaCalendarDay>(`${API_BASE}/api/nba/calendar-day?month=${month}&day=${day}`)

export type NbaQaReport={
  generatedAt:string
  overview:{games:number;seasons:number;earliestSeason:string;latestSeason:string;playerGames:number;playedPlayerGames:number;teamGames:number}
  integrity:{gamesMissingTwoTeamRows:number;gamesWithoutPlayerRows:number;gamesWithoutPlayedPlayers:number}
  seasons:{season:string;games:number;regularSeason:number;playoffs:number;playedPlayerGames:number}[]
  coverage:{player:{statistic:string;label:string;startSeason:string}[];team:{statistic:string;label:string;startSeason:string}[]}
}
export const getNbaQa=()=>json<NbaQaReport>(`${API_BASE}/api/nba/qa`)

export type AggregateSearchPayload=Omit<SearchPayload,'opponent'|'resultFilter'> & {scope:Exclude<SearchScope,'Game'>}
export const searchNbaAggregate=(payload:AggregateSearchPayload)=>json<{total:number;records:GameRecord[];closest:ClosestPerformance[];coverage:NbaCoverage}>(`${API_BASE}/api/nba/aggregate-search`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
