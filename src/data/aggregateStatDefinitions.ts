import type { SearchType, StatDefinition } from '../types/search'

const playerCommon: StatDefinition[] = [
  ['gamesPlayed','Games Played','Volume'],
  ['fantasyPoints','Fantasy Points (Yahoo Default)','Fantasy'], ['fantasyPointsPerGame','Fantasy Points Per Game (Yahoo Default)','Fantasy'],
  ['points','Points','Totals'], ['pointsPerGame','Points Per Game','Rates'],
  ['rebounds','Rebounds','Totals'], ['reboundsPerGame','Rebounds Per Game','Rates'],
  ['assists','Assists','Totals'], ['assistsPerGame','Assists Per Game','Rates'],
  ['steals','Steals','Totals'], ['stealsPerGame','Steals Per Game','Rates'],
  ['blocks','Blocks','Totals'], ['blocksPerGame','Blocks Per Game','Rates'],
  ['threePointersMade','3-Pointers Made','Shooting'], ['threePointersPerGame','3-Pointers Made Per Game','Rates'],
  ['threePointersAttempted','3-Pointers Attempted','Shooting'], ['threePointersAttemptedPerGame','3-Pointers Attempted Per Game','Rates'],
  ['fieldGoalsMade','Field Goals Made','Shooting'], ['fieldGoalsMadePerGame','Field Goals Made Per Game','Rates'],
  ['fieldGoalsAttempted','Field Goals Attempted','Shooting'], ['fieldGoalsAttemptedPerGame','Field Goals Attempted Per Game','Rates'],
  ['fieldGoalPct','Field Goal %','Rates'],
  ['threePointPct','3-Point %','Rates'],
  ['freeThrowsMade','Free Throws Made','Shooting'], ['freeThrowsMadePerGame','Free Throws Made Per Game','Rates'],
  ['freeThrowsAttempted','Free Throws Attempted','Shooting'], ['freeThrowsAttemptedPerGame','Free Throws Attempted Per Game','Rates'],
  ['freeThrowPct','Free Throw %','Rates'],
  ['offensiveRebounds','Offensive Rebounds','Totals'], ['offensiveReboundsPerGame','Offensive Rebounds Per Game','Rates'],
  ['defensiveRebounds','Defensive Rebounds','Totals'], ['defensiveReboundsPerGame','Defensive Rebounds Per Game','Rates'],
  ['turnovers','Turnovers','Totals'], ['turnoversPerGame','Turnovers Per Game','Rates'],
  ['personalFouls','Personal Fouls','Totals'], ['personalFoulsPerGame','Personal Fouls Per Game','Rates'],
  ['minutes','Minutes','Totals'], ['minutesPerGame','Minutes Per Game','Rates'],
  ['plusMinus','Plus/Minus','Totals'], ['plusMinusPerGame','Plus/Minus Per Game','Rates'],
].map(([key,label,section])=>({key,label,section}))

const teamSeason: StatDefinition[] = [
  ['gamesPlayed','Games Played','Record'], ['wins','Wins','Record'], ['losses','Losses','Record'], ['winPct','Win %','Record'],
  ['points','Points','Totals'], ['pointsPerGame','Points Per Game','Rates'],
  ['opponentPoints','Opponent Points','Totals'], ['opponentPointsPerGame','Opponent Points Per Game','Rates'],
  ['pointDifferential','Point Differential','Totals'], ['pointDifferentialPerGame','Point Differential Per Game','Rates'],
  ['rebounds','Rebounds','Totals'], ['reboundsPerGame','Rebounds Per Game','Rates'],
  ['assists','Assists','Totals'], ['assistsPerGame','Assists Per Game','Rates'],
  ['steals','Steals','Totals'], ['stealsPerGame','Steals Per Game','Rates'],
  ['blocks','Blocks','Totals'], ['blocksPerGame','Blocks Per Game','Rates'],
  ['threePointersMade','3-Pointers Made','Shooting'], ['threePointersPerGame','3-Pointers Made Per Game','Rates'],
  ['threePointersAttempted','3-Pointers Attempted','Shooting'], ['threePointersAttemptedPerGame','3-Pointers Attempted Per Game','Rates'],
  ['fieldGoalsMade','Field Goals Made','Shooting'], ['fieldGoalsMadePerGame','Field Goals Made Per Game','Rates'],
  ['fieldGoalsAttempted','Field Goals Attempted','Shooting'], ['fieldGoalsAttemptedPerGame','Field Goals Attempted Per Game','Rates'],
  ['fieldGoalPct','Field Goal %','Rates'],
  ['threePointPct','3-Point %','Rates'],
  ['freeThrowsMade','Free Throws Made','Shooting'], ['freeThrowsMadePerGame','Free Throws Made Per Game','Rates'],
  ['freeThrowsAttempted','Free Throws Attempted','Shooting'], ['freeThrowsAttemptedPerGame','Free Throws Attempted Per Game','Rates'],
  ['freeThrowPct','Free Throw %','Rates'],
  ['offensiveRebounds','Offensive Rebounds','Totals'], ['offensiveReboundsPerGame','Offensive Rebounds Per Game','Rates'],
  ['defensiveRebounds','Defensive Rebounds','Totals'], ['defensiveReboundsPerGame','Defensive Rebounds Per Game','Rates'],
  ['turnovers','Turnovers','Totals'], ['turnoversPerGame','Turnovers Per Game','Rates'],
  ['personalFouls','Personal Fouls','Totals'], ['personalFoulsPerGame','Personal Fouls Per Game','Rates'],
  ['plusMinus','Plus/Minus','Totals'], ['plusMinusPerGame','Plus/Minus Per Game','Rates'],
].map(([key,label,section])=>({key,label,section}))

export const aggregateStatDefinitions: Record<'Season'|'Career', Partial<Record<SearchType,StatDefinition[]>>> = {
  Season:{Player:playerCommon,Team:teamSeason},
  Career:{Player:[{key:'seasonsPlayed',label:'Seasons Played',section:'Volume'},...playerCommon]},
}

const nflPlayerCommon: StatDefinition[] = [
  ['gamesPlayed','Games Played','Volume'],
  ['fantasyPointsStandard4','Fantasy Points — Standard, 4-pt Pass TD','Fantasy'], ['fantasyPointsStandard4PerGame','Fantasy Points / Game — Standard, 4-pt Pass TD','Fantasy'],
  ['fantasyPointsStandard6','Fantasy Points — Standard, 6-pt Pass TD','Fantasy'], ['fantasyPointsStandard6PerGame','Fantasy Points / Game — Standard, 6-pt Pass TD','Fantasy'],
  ['fantasyPointsHalfPpr4','Fantasy Points — Half-PPR, 4-pt Pass TD','Fantasy'], ['fantasyPointsHalfPpr4PerGame','Fantasy Points / Game — Half-PPR, 4-pt Pass TD','Fantasy'],
  ['fantasyPointsHalfPpr6','Fantasy Points — Half-PPR, 6-pt Pass TD','Fantasy'], ['fantasyPointsHalfPpr6PerGame','Fantasy Points / Game — Half-PPR, 6-pt Pass TD','Fantasy'],
  ['fantasyPointsPpr4','Fantasy Points — PPR, 4-pt Pass TD','Fantasy'], ['fantasyPointsPpr4PerGame','Fantasy Points / Game — PPR, 4-pt Pass TD','Fantasy'],
  ['fantasyPointsPpr6','Fantasy Points — PPR, 6-pt Pass TD','Fantasy'], ['fantasyPointsPpr6PerGame','Fantasy Points / Game — PPR, 6-pt Pass TD','Fantasy'],
  ['passingYards','Passing Yards','Passing'], ['passingYardsPerGame','Passing Yards / Game','Rates'], ['passingAttempts','Passing Attempts','Passing'], ['completions','Completions','Passing'], ['passingTouchdowns','Passing Touchdowns','Passing'], ['passingInterceptions','Passing Interceptions','Passing'], ['sacksTaken','Sacks Taken','Passing'], ['completionPercentage','Completion %','Rates'], ['passerRating','Passer Rating','Rates'],
  ['rushingAttempts','Rushing Attempts','Rushing'], ['rushingYards','Rushing Yards','Rushing'], ['rushingYardsPerGame','Rushing Yards / Game','Rates'], ['rushingTouchdowns','Rushing Touchdowns','Rushing'], ['yardsPerCarry','Yards Per Carry','Rates'],
  ['targets','Targets','Receiving'], ['receptions','Receptions','Receiving'], ['receivingYards','Receiving Yards','Receiving'], ['receivingYardsPerGame','Receiving Yards / Game','Rates'], ['receivingTouchdowns','Receiving Touchdowns','Receiving'], ['yardsPerReception','Yards Per Reception','Rates'],
  ['tackles','Tackles','Defense'], ['soloTackles','Solo Tackles','Defense'], ['assistedTackles','Assisted Tackles','Defense'], ['sacks','Sacks','Defense'], ['defensiveInterceptions','Defensive Interceptions','Defense'], ['forcedFumbles','Forced Fumbles','Defense'], ['fumbleRecoveries','Fumble Recoveries','Defense'], ['defensiveTouchdowns','Defensive Touchdowns','Defense'],
  ['fieldGoalsMade','Field Goals Made','Kicking'], ['fieldGoalsAttempted','Field Goals Attempted','Kicking'], ['fieldGoalPct','Field Goal %','Rates'], ['longestFieldGoal','Longest Field Goal','Kicking'], ['extraPointsMade','Extra Points Made','Kicking'], ['extraPointsAttempted','Extra Points Attempted','Kicking'], ['extraPointPct','Extra Point %','Rates'],
].map(([key,label,section])=>({key,label,section}))

const nflTeamSeason: StatDefinition[] = [
  ['gamesPlayed','Games Played','Record'], ['wins','Wins','Record'], ['losses','Losses','Record'], ['draws','Draws','Record'], ['winPct','Win %','Record'],
  ['points','Points','Scoring'], ['pointsPerGame','Points / Game','Rates'], ['touchdowns','Touchdowns','Scoring'],
  ['passingYards','Passing Yards','Passing'], ['passingYardsPerGame','Passing Yards / Game','Rates'], ['passingTouchdowns','Passing Touchdowns','Passing'], ['interceptionsThrown','Interceptions Thrown','Passing'],
  ['rushingYards','Rushing Yards','Rushing'], ['rushingYardsPerGame','Rushing Yards / Game','Rates'], ['rushingTouchdowns','Rushing Touchdowns','Rushing'],
  ['totalYards','Total Yards','Offense'], ['totalYardsPerGame','Total Yards / Game','Rates'],
  ['pointsAllowed','Points Allowed','Defense'], ['pointsAllowedPerGame','Points Allowed / Game','Rates'], ['yardsAllowed','Yards Allowed','Defense'], ['yardsAllowedPerGame','Yards Allowed / Game','Rates'], ['sacks','Sacks','Defense'], ['interceptions','Interceptions','Defense'], ['takeaways','Takeaways','Defense'],
  ['turnovers','Turnovers','Game'], ['turnoverDifferential','Turnover Differential','Game'], ['pointDifferential','Point Differential','Game'], ['pointDifferentialPerGame','Point Differential / Game','Rates'],
].map(([key,label,section])=>({key,label,section}))

export const nflAggregateStatDefinitions: Record<'Season'|'Career', Partial<Record<SearchType,StatDefinition[]>>> = {
  Season:{Player:nflPlayerCommon,Team:nflTeamSeason},
  Career:{Player:[{key:'seasonsPlayed',label:'Seasons Played',section:'Volume'},...nflPlayerCommon]},
}
