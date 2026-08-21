import type { SearchType, Sport, StatDefinition } from '../types/search'

export const statDefinitions: Record<Sport, Record<SearchType, StatDefinition[]>> = {
  NBA: {
    Player: [
      ['points','Points','Scoring'], ['rebounds','Rebounds','Core'], ['assists','Assists','Core'],
      ['steals','Steals','Defense'], ['blocks','Blocks','Defense'], ['threePointersMade','3-Pointers Made','Shooting'],
      ['fieldGoalsMade','Field Goals Made','Shooting'], ['fieldGoalsAttempted','Field Goals Attempted','Shooting'],
      ['freeThrowsMade','Free Throws Made','Shooting'], ['freeThrowsAttempted','Free Throws Attempted','Shooting'],
      ['fieldGoalPct','Field Goal %','Shooting'], ['threePointPct','3-Point %','Shooting'], ['freeThrowPct','Free Throw %','Shooting'],
      ['offensiveRebounds','Offensive Rebounds','Rebounding'], ['defensiveRebounds','Defensive Rebounds','Rebounding'],
      ['turnovers','Turnovers','Other'], ['personalFouls','Personal Fouls','Other'], ['minutes','Minutes Played','Other'], ['plusMinus','Plus/Minus','Other']
    ].map(([key,label,section]) => ({ key, label, section })),
    Team: [
      ['points','Points','Scoring'], ['rebounds','Rebounds','Core'], ['assists','Assists','Core'], ['steals','Steals','Defense'],
      ['blocks','Blocks','Defense'], ['threePointersMade','3-Pointers Made','Shooting'], ['threePointersAttempted','3-Pointers Attempted','Shooting'],
      ['fieldGoalsMade','Field Goals Made','Shooting'], ['fieldGoalsAttempted','Field Goals Attempted','Shooting'],
      ['freeThrowsMade','Free Throws Made','Shooting'], ['freeThrowsAttempted','Free Throws Attempted','Shooting'],
      ['fieldGoalPct','Field Goal %','Shooting'], ['threePointPct','3-Point %','Shooting'], ['freeThrowPct','Free Throw %','Shooting'],
      ['offensiveRebounds','Offensive Rebounds','Rebounding'], ['defensiveRebounds','Defensive Rebounds','Rebounding'],
      ['turnovers','Turnovers','Other'], ['personalFouls','Personal Fouls','Other'], ['pointDifferential','Point Differential','Game'],
      ['opponentPoints','Opponent Points','Game']
    ].map(([key,label,section]) => ({ key, label, section }))
  },
  NFL: {
    Player: [
      ['passingYards','Passing Yards','Passing'], ['passingAttempts','Passing Attempts','Passing'], ['completions','Completions','Passing'],
      ['passingTouchdowns','Passing Touchdowns','Passing'], ['interceptions','Interceptions','Passing'], ['completionPercentage','Completion %','Passing'],
      ['sacksTaken','Sacks Taken','Passing'], ['passerRating','Passer Rating','Passing'],
      ['rushingAttempts','Rushing Attempts','Rushing'], ['rushingYards','Rushing Yards','Rushing'], ['rushingTouchdowns','Rushing Touchdowns','Rushing'],
      ['yardsPerCarry','Yards Per Carry','Rushing'], ['targets','Targets','Receiving'], ['receptions','Receptions','Receiving'],
      ['receivingYards','Receiving Yards','Receiving'], ['receivingTouchdowns','Receiving Touchdowns','Receiving'], ['yardsPerReception','Yards Per Reception','Receiving'],
      ['tackles','Tackles','Defense'], ['soloTackles','Solo Tackles','Defense'], ['assistedTackles','Assisted Tackles','Defense'], ['sacks','Sacks','Defense'], ['defensiveInterceptions','Interceptions (Defense)','Defense'],
      ['forcedFumbles','Forced Fumbles','Defense'], ['fumbleRecoveries','Fumble Recoveries','Defense'], ['defensiveTouchdowns','Defensive Touchdowns','Defense'],
      ['fieldGoalsMade','Field Goals Made','Kicking'], ['fieldGoalsAttempted','Field Goals Attempted','Kicking'], ['fieldGoalPct','Field Goal %','Kicking'], ['longestFieldGoal','Longest Field Goal','Kicking'], ['extraPointsMade','Extra Points Made','Kicking'], ['extraPointsAttempted','Extra Points Attempted','Kicking'], ['extraPointPct','Extra Point %','Kicking']
    ].map(([key,label,section]) => ({ key, label, section })),
    Team: [
      ['points','Points','Scoring'], ['touchdowns','Touchdowns','Scoring'], ['fieldGoals','Field Goals','Scoring'],
      ['passingYards','Passing Yards','Passing'], ['passingAttempts','Passing Attempts','Passing'], ['passingTouchdowns','Passing Touchdowns','Passing'],
      ['interceptionsThrown','Interceptions Thrown','Passing'], ['rushingYards','Rushing Yards','Rushing'], ['rushingAttempts','Rushing Attempts','Rushing'],
      ['rushingTouchdowns','Rushing Touchdowns','Rushing'], ['totalYards','Total Yards','Offense'], ['firstDowns','First Downs','Offense'],
      ['pointsAllowed','Points Allowed','Defense'], ['yardsAllowed','Yards Allowed','Defense'],
      ['passingYardsAllowed','Passing Yards Allowed','Defense'], ['rushingYardsAllowed','Rushing Yards Allowed','Defense'], ['sacks','Sacks','Defense'],
      ['interceptions','Interceptions','Defense'], ['forcedFumbles','Forced Fumbles','Defense'], ['takeaways','Takeaways','Defense'],
      ['turnovers','Turnovers','Game'], ['turnoverDifferential','Turnover Differential','Game'], ['pointDifferential','Point Differential','Game']
    ].map(([key,label,section]) => ({ key, label, section }))
  }
}
