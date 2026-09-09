import type { GameStage, SearchType, Sport, StatCondition } from '../types/search'

export type ExploreCategory = 'Scoring' | 'All-Around' | 'Playoffs' | 'Team' | 'Calendar' | 'Defense' | 'Passing' | 'Rushing' | 'Receiving' | 'Kicking'

export type ExploreSearch = {
  id: string
  title: string
  description: string
  category: ExploreCategory
  sport: Sport
  searchType: SearchType
  conditions: StatCondition[]
  gameStage?: GameStage
  month?: string
  specificDate?: string
  featuredLabel?: string
}

export const exploreSearches: ExploreSearch[] = [
  // NBA classics
  { id:'nba-50-point-triple-double', title:'50+ Point Triple-Doubles', description:'The rare intersection of huge scoring and complete box-score production.', category:'All-Around', sport:'NBA', searchType:'Player', conditions:[{statistic:'points',operator:'gte',value:50},{statistic:'rebounds',operator:'gte',value:10},{statistic:'assists',operator:'gte',value:10}] },
  { id:'nba-20-assists', title:'20+ Assist Games', description:'Find the biggest single-game playmaking performances in NBA history.', category:'All-Around', sport:'NBA', searchType:'Player', conditions:[{statistic:'assists',operator:'gte',value:20}] },
  { id:'nba-50-20', title:'50 Points + 20 Rebounds', description:'Elite scoring combined with overwhelming work on the glass.', category:'Scoring', sport:'NBA', searchType:'Player', conditions:[{statistic:'points',operator:'gte',value:50},{statistic:'rebounds',operator:'gte',value:20}] },
  { id:'nba-10-blocks', title:'10+ Block Games', description:'Search for the most dominant rim-protection performances on record.', category:'Defense', sport:'NBA', searchType:'Player', conditions:[{statistic:'blocks',operator:'gte',value:10}] },
  { id:'nba-60-points', title:'60+ Point Games', description:'Explore the NBA’s highest-volume individual scoring nights.', category:'Scoring', sport:'NBA', searchType:'Player', conditions:[{statistic:'points',operator:'gte',value:60}] },
  { id:'nba-40-playoff-points', title:'40+ Point Playoff Games', description:'High-scoring performances when the postseason stakes are highest.', category:'Playoffs', sport:'NBA', searchType:'Player', gameStage:'Playoffs', conditions:[{statistic:'points',operator:'gte',value:40}] },
  { id:'nba-25-team-threes', title:'Teams Making 25+ Threes', description:'Find the most extreme three-point shooting games by an NBA team.', category:'Team', sport:'NBA', searchType:'Team', conditions:[{statistic:'threePointersMade',operator:'gte',value:25}] },
  { id:'nba-150-team-points', title:'Teams Scoring 150+', description:'Explore offensive explosions of at least 150 points in a game.', category:'Team', sport:'NBA', searchType:'Team', conditions:[{statistic:'points',operator:'gte',value:150}] },
  { id:'nba-christmas-40', title:'Christmas Day 40+ Point Games', description:'Which players have dropped 40 or more on December 25?', category:'Calendar', sport:'NBA', searchType:'Player', specificDate:'12-25', conditions:[{statistic:'points',operator:'gte',value:40}] },
  { id:'nba-five-by-five', title:'5×5 Games', description:'At least five points, rebounds, assists, steals, and blocks in one game.', category:'All-Around', sport:'NBA', searchType:'Player', conditions:[{statistic:'points',operator:'gte',value:5},{statistic:'rebounds',operator:'gte',value:5},{statistic:'assists',operator:'gte',value:5},{statistic:'steals',operator:'gte',value:5},{statistic:'blocks',operator:'gte',value:5}] },

  // NFL classics
  { id:'nfl-400-4-0', title:'400+ Yards, 4+ TD, 0 INT', description:'Find elite quarterback games combining huge volume, touchdowns, and mistake-free passing.', category:'Passing', sport:'NFL', searchType:'Player', conditions:[{statistic:'passingYards',operator:'gte',value:400},{statistic:'passingTouchdowns',operator:'gte',value:4},{statistic:'interceptions',operator:'eq',value:0}] },
  { id:'nfl-500-pass', title:'500+ Passing Yard Games', description:'The biggest single-game passing outputs across the loaded NFL historical database.', category:'Passing', sport:'NFL', searchType:'Player', conditions:[{statistic:'passingYards',operator:'gte',value:500}] },
  { id:'nfl-200-rush', title:'200+ Rushing Yard Games', description:'Search for dominant ground performances of 200 or more rushing yards.', category:'Rushing', sport:'NFL', searchType:'Player', conditions:[{statistic:'rushingYards',operator:'gte',value:200}] },
  { id:'nfl-200-receiving', title:'200+ Receiving Yard Games', description:'Find the most explosive receiving performances in the database.', category:'Receiving', sport:'NFL', searchType:'Player', conditions:[{statistic:'receivingYards',operator:'gte',value:200}] },
  { id:'nfl-3-rec-td', title:'3+ Receiving Touchdowns', description:'Multi-touchdown receiving explosions with at least three scores.', category:'Receiving', sport:'NFL', searchType:'Player', conditions:[{statistic:'receivingTouchdowns',operator:'gte',value:3}] },
  { id:'nfl-3-sacks', title:'3+ Sack Games', description:'Individual defensive games with at least three sacks.', category:'Defense', sport:'NFL', searchType:'Player', conditions:[{statistic:'sacks',operator:'gte',value:3}] },
  { id:'nfl-2-def-int', title:'2+ Defensive Interceptions', description:'Find games where one defender intercepted at least two passes.', category:'Defense', sport:'NFL', searchType:'Player', conditions:[{statistic:'defensiveInterceptions',operator:'gte',value:2}] },
  { id:'nfl-5-fg', title:'5+ Field Goals Made', description:'Big kicking days with five or more made field goals.', category:'Kicking', sport:'NFL', searchType:'Player', conditions:[{statistic:'fieldGoalsMade',operator:'gte',value:5}] },
  { id:'nfl-team-40-zero-turnovers', title:'40+ Points, 0 Turnovers', description:'Team offensive explosions without giving the ball away.', category:'Team', sport:'NFL', searchType:'Team', conditions:[{statistic:'points',operator:'gte',value:40},{statistic:'turnovers',operator:'eq',value:0}] },
  { id:'nfl-team-500-yards', title:'500+ Total Yard Team Games', description:'Search for the largest all-around offensive team performances.', category:'Team', sport:'NFL', searchType:'Team', conditions:[{statistic:'totalYards',operator:'gte',value:500}] },
  { id:'nfl-playoff-350-3', title:'350+ Pass Yards + 3 TD in Playoffs', description:'High-end postseason quarterback production.', category:'Playoffs', sport:'NFL', searchType:'Player', gameStage:'Playoffs', conditions:[{statistic:'passingYards',operator:'gte',value:350},{statistic:'passingTouchdowns',operator:'gte',value:3}] },
]

const nbaDailySpotlights: Omit<ExploreSearch, 'id' | 'specificDate' | 'featuredLabel'>[] = [
  { title:'Daily Spotlight: 45+ PTS + 10+ REB', description:'Today’s featured scoring-and-rebounding challenge across NBA history.', category:'Scoring', sport:'NBA', searchType:'Player', conditions:[{statistic:'points',operator:'gte',value:45},{statistic:'rebounds',operator:'gte',value:10}] },
  { title:'Daily Spotlight: 30+ PTS + 15+ AST', description:'Today’s featured scoring-and-playmaking challenge across NBA history.', category:'All-Around', sport:'NBA', searchType:'Player', conditions:[{statistic:'points',operator:'gte',value:30},{statistic:'assists',operator:'gte',value:15}] },
  { title:'Daily Spotlight: 30+ PTS + 5+ STL', description:'Today’s featured two-way stat combination across NBA history.', category:'Defense', sport:'NBA', searchType:'Player', conditions:[{statistic:'points',operator:'gte',value:30},{statistic:'steals',operator:'gte',value:5}] },
  { title:'Daily Spotlight: 20+ REB + 10+ AST', description:'Today’s featured rebounding-and-playmaking combination across NBA history.', category:'All-Around', sport:'NBA', searchType:'Player', conditions:[{statistic:'rebounds',operator:'gte',value:20},{statistic:'assists',operator:'gte',value:10}] },
  { title:'Daily Spotlight: Team 140+ PTS + 20+ 3PM', description:'Today’s featured team offensive explosion search.', category:'Team', sport:'NBA', searchType:'Team', conditions:[{statistic:'points',operator:'gte',value:140},{statistic:'threePointersMade',operator:'gte',value:20}] },
  { title:'Daily Spotlight: 35+ PTS + 15+ REB + 10+ AST', description:'Today’s featured high-volume all-around performance search.', category:'All-Around', sport:'NBA', searchType:'Player', conditions:[{statistic:'points',operator:'gte',value:35},{statistic:'rebounds',operator:'gte',value:15},{statistic:'assists',operator:'gte',value:10}] },
]

const nflDailySpotlights: Omit<ExploreSearch, 'id' | 'specificDate' | 'featuredLabel'>[] = [
  { title:'Daily Spotlight: 400+ Pass Yards + 4 TD', description:'Today’s featured quarterback volume-and-touchdown search.', category:'Passing', sport:'NFL', searchType:'Player', conditions:[{statistic:'passingYards',operator:'gte',value:400},{statistic:'passingTouchdowns',operator:'gte',value:4}] },
  { title:'Daily Spotlight: 150+ Rush Yards + 2 TD', description:'Today’s featured rushing dominance search.', category:'Rushing', sport:'NFL', searchType:'Player', conditions:[{statistic:'rushingYards',operator:'gte',value:150},{statistic:'rushingTouchdowns',operator:'gte',value:2}] },
  { title:'Daily Spotlight: 150+ Receiving Yards + 2 TD', description:'Today’s featured receiving explosion search.', category:'Receiving', sport:'NFL', searchType:'Player', conditions:[{statistic:'receivingYards',operator:'gte',value:150},{statistic:'receivingTouchdowns',operator:'gte',value:2}] },
  { title:'Daily Spotlight: 3+ Sacks', description:'Today’s featured individual pass-rush performance.', category:'Defense', sport:'NFL', searchType:'Player', conditions:[{statistic:'sacks',operator:'gte',value:3}] },
  { title:'Daily Spotlight: Team 40+ PTS, 0 TO', description:'Today’s featured clean team offensive performance.', category:'Team', sport:'NFL', searchType:'Team', conditions:[{statistic:'points',operator:'gte',value:40},{statistic:'turnovers',operator:'eq',value:0}] },
  { title:'Daily Spotlight: 5+ Field Goals', description:'Today’s featured kicking performance search.', category:'Kicking', sport:'NFL', searchType:'Player', conditions:[{statistic:'fieldGoalsMade',operator:'gte',value:5}] },
]

function localDateKey(date: Date) {
  const year=date.getFullYear()
  const month=String(date.getMonth()+1).padStart(2,'0')
  const day=String(date.getDate()).padStart(2,'0')
  return `${year}-${month}-${day}`
}

function monthDay(date: Date) {
  return `${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function hashDateKey(value:string) {
  let hash=2166136261
  for (let i=0;i<value.length;i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash,16777619)
  }
  return hash >>> 0
}

export function getFeaturedToday(sport:Sport, date = new Date(), calendarDate?: string, nearby=false): ExploreSearch[] {
  const dateKey=localDateKey(date)
  const specificDate=calendarDate ?? monthDay(date)
  const seed=hashDateKey(`${sport}-${dateKey}`)
  const dayPrefix=nearby?'Around This Day':'On This Day'
  const featuredLabel=dayPrefix
  const spotlights=sport==='NBA'?nbaDailySpotlights:nflDailySpotlights
  const spotlight=spotlights[seed % spotlights.length]

  if(sport==='NBA') return [
    {...spotlight,id:`nba-daily-spotlight-${dateKey}`,featuredLabel:'Daily Spotlight'},
    {id:`nba-calendar-scoring-${dateKey}-${specificDate}`,title:`${dayPrefix}: 40+ Point Games`,description:`Search every NBA season for 40-point performances recorded on ${nearby?'the nearest historical NBA calendar date':'today’s calendar date'}.`,category:'Calendar',sport:'NBA',searchType:'Player',specificDate,featuredLabel,conditions:[{statistic:'points',operator:'gte',value:40}]},
    {id:`nba-calendar-triple-double-${dateKey}-${specificDate}`,title:`${dayPrefix}: Triple-Doubles`,description:`Find every 10+ point, 10+ rebound, 10+ assist performance recorded on ${nearby?'the nearest historical NBA calendar date':'today’s date'}.`,category:'Calendar',sport:'NBA',searchType:'Player',specificDate,featuredLabel,conditions:[{statistic:'points',operator:'gte',value:10},{statistic:'rebounds',operator:'gte',value:10},{statistic:'assists',operator:'gte',value:10}]},
    {id:`nba-calendar-team-${dateKey}-${specificDate}`,title:`${dayPrefix}: Teams Scoring 120+`,description:`Search every NBA season for team scoring performances of 120 or more on ${nearby?'the nearest historical NBA calendar date':'today’s date'}.`,category:'Calendar',sport:'NBA',searchType:'Team',specificDate,featuredLabel,conditions:[{statistic:'points',operator:'gte',value:120}]},
  ]

  return [
    {...spotlight,id:`nfl-daily-spotlight-${dateKey}`,featuredLabel:'Daily Spotlight'},
    {id:`nfl-calendar-passing-${dateKey}-${specificDate}`,title:`${dayPrefix}: 300+ Passing Yards`,description:`Search every loaded NFL season for 300-yard passing performances on ${nearby?'the nearest historical NFL calendar date':'today’s calendar date'}.`,category:'Calendar',sport:'NFL',searchType:'Player',specificDate,featuredLabel,conditions:[{statistic:'passingYards',operator:'gte',value:300}]},
    {id:`nfl-calendar-rushing-${dateKey}-${specificDate}`,title:`${dayPrefix}: 100+ Rushing Yards`,description:`Find 100-yard rushing performances on ${nearby?'the nearest historical NFL calendar date':'today’s calendar date'} across the loaded NFL historical database.`,category:'Calendar',sport:'NFL',searchType:'Player',specificDate,featuredLabel,conditions:[{statistic:'rushingYards',operator:'gte',value:100}]},
    {id:`nfl-calendar-team-${dateKey}-${specificDate}`,title:`${dayPrefix}: Teams Scoring 30+`,description:`Search loaded NFL history for team games with at least 30 points on ${nearby?'the nearest historical NFL calendar date':'today’s calendar date'}.`,category:'Calendar',sport:'NFL',searchType:'Team',specificDate,featuredLabel,conditions:[{statistic:'points',operator:'gte',value:30}]},
  ]
}
