export type NbaSearchType = 'Player' | 'Team'

export type CoverageRule = { start: number; label: string }

const BASE_START = 1946

export const NBA_PLAYER_COVERAGE: Record<string, CoverageRule> = {
  points:{start:1946,label:'Points'}, assists:{start:1946,label:'Assists'}, fieldGoalsMade:{start:1946,label:'Field Goals Made'},
  fieldGoalsAttempted:{start:1946,label:'Field Goals Attempted'}, fieldGoalPct:{start:1946,label:'Field Goal %'},
  freeThrowsMade:{start:1946,label:'Free Throws Made'}, freeThrowsAttempted:{start:1946,label:'Free Throws Attempted'}, freeThrowPct:{start:1946,label:'Free Throw %'},
  personalFouls:{start:1946,label:'Personal Fouls'}, rebounds:{start:1950,label:'Rebounds'}, minutes:{start:1951,label:'Minutes Played'},
  steals:{start:1973,label:'Steals'}, blocks:{start:1973,label:'Blocks'}, offensiveRebounds:{start:1973,label:'Offensive Rebounds'},
  defensiveRebounds:{start:1973,label:'Defensive Rebounds'}, turnovers:{start:1977,label:'Turnovers'},
  threePointersMade:{start:1979,label:'3-Pointers Made'}, threePointersAttempted:{start:1979,label:'3-Pointers Attempted'}, threePointPct:{start:1979,label:'3-Point %'},
  plusMinus:{start:1996,label:'Plus/Minus'},
}

export const NBA_TEAM_COVERAGE: Record<string, CoverageRule> = {
  points:{start:1946,label:'Points'}, assists:{start:1946,label:'Assists'}, fieldGoalsMade:{start:1946,label:'Field Goals Made'},
  fieldGoalsAttempted:{start:1946,label:'Field Goals Attempted'}, fieldGoalPct:{start:1946,label:'Field Goal %'},
  freeThrowsMade:{start:1946,label:'Free Throws Made'}, freeThrowsAttempted:{start:1946,label:'Free Throws Attempted'}, freeThrowPct:{start:1946,label:'Free Throw %'},
  personalFouls:{start:1946,label:'Personal Fouls'}, pointDifferential:{start:1946,label:'Point Differential'}, opponentPoints:{start:1946,label:'Opponent Points'},
  rebounds:{start:1950,label:'Rebounds'}, steals:{start:1973,label:'Steals'}, blocks:{start:1973,label:'Blocks'},
  offensiveRebounds:{start:1973,label:'Offensive Rebounds'}, defensiveRebounds:{start:1973,label:'Defensive Rebounds'}, turnovers:{start:1977,label:'Turnovers'},
  threePointersMade:{start:1979,label:'3-Pointers Made'}, threePointersAttempted:{start:1979,label:'3-Pointers Attempted'}, threePointPct:{start:1979,label:'3-Point %'},
}

export function seasonLabel(start:number){ return `${start}-${String((start+1)%100).padStart(2,'0')}` }

export function coverageFor(searchType:NbaSearchType, activeStats:string[], dbStart=BASE_START, dbEnd=2025){
  const registry=searchType==='Player'?NBA_PLAYER_COVERAGE:NBA_TEAM_COVERAGE
  let start=dbStart
  let limiting:CoverageRule|undefined
  for(const stat of activeStats){
    const rule=registry[stat]
    if(rule && rule.start>start){ start=rule.start; limiting=rule }
  }
  const end=dbEnd
  return {
    startSeason:seasonLabel(start), endSeason:seasonLabel(end), startYear:start, endYear:end,
    limitingStatistic:limiting?.label ?? null,
    message: limiting ? `Coverage begins in ${seasonLabel(start)} because ${limiting.label} is not treated as historically available before that season.` : `Coverage uses all NBA seasons currently available in the database.`,
  }
}
