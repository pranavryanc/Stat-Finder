import type { BoxScorePlayer, GameBoxScore, GameRecord } from '../types/search'

// Synthetic Phase 1 box scores. These records exist only to demonstrate navigation and UI behavior.
export const mockBoxScores: GameBoxScore[] = [
  {
    gameId: 'nba-g-1', sport: 'NBA', season: '2024-25', date: '2025-02-11', gameStage: 'Regular Season',
    homeTeam: 'BOS', awayTeam: 'NYK', homeScore: 128, awayScore: 117,
    teamStats: [
      { team:'BOS', score:128, result:'W', stats:{ points:128, rebounds:47, assists:31, steals:8, blocks:6, threePointersMade:17, threePointersAttempted:42, fieldGoalsMade:46, fieldGoalsAttempted:91, freeThrowsMade:19, freeThrowsAttempted:23, turnovers:11 } },
      { team:'NYK', score:117, result:'L', stats:{ points:117, rebounds:43, assists:27, steals:6, blocks:4, threePointersMade:14, threePointersAttempted:37, fieldGoalsMade:43, fieldGoalsAttempted:89, freeThrowsMade:17, freeThrowsAttempted:21, turnovers:13 } },
    ],
    playerStats: [
      { id:'nba-g-1-p1', name:'Sample Guard A', team:'BOS', position:'G', starter:true, stats:{ minutes:39, points:42, rebounds:11, assists:10, steals:2, blocks:3, fieldGoalsMade:15, fieldGoalsAttempted:27, threePointersMade:6, turnovers:4 } },
      { id:'nba-g-1-p2', name:'Sample Wing D', team:'BOS', position:'F', starter:true, stats:{ minutes:35, points:24, rebounds:7, assists:4, steals:1, blocks:0, fieldGoalsMade:9, fieldGoalsAttempted:17, threePointersMade:4, turnovers:2 } },
      { id:'nba-g-1-p3', name:'Sample Center E', team:'BOS', position:'C', starter:true, stats:{ minutes:32, points:18, rebounds:12, assists:3, steals:0, blocks:2, fieldGoalsMade:8, fieldGoalsAttempted:11, threePointersMade:0, turnovers:1 } },
      { id:'nba-g-1-p4', name:'Sample Guard F', team:'NYK', position:'G', starter:true, stats:{ minutes:40, points:33, rebounds:5, assists:8, steals:2, blocks:0, fieldGoalsMade:12, fieldGoalsAttempted:24, threePointersMade:5, turnovers:3 } },
      { id:'nba-g-1-p5', name:'Sample Forward G', team:'NYK', position:'F', starter:true, stats:{ minutes:37, points:27, rebounds:10, assists:3, steals:1, blocks:1, fieldGoalsMade:10, fieldGoalsAttempted:19, threePointersMade:2, turnovers:2 } },
    ],
  },
  {
    gameId: 'nba-g-3', sport: 'NBA', season: '2023-24', date: '2024-04-28', gameStage: 'Playoffs',
    homeTeam: 'LAL', awayTeam: 'MIA', homeScore: 119, awayScore: 110,
    teamStats: [
      { team:'LAL', score:119, result:'W', stats:{ points:119, rebounds:48, assists:26, steals:7, blocks:8, threePointersMade:12, threePointersAttempted:33, fieldGoalsMade:45, fieldGoalsAttempted:88, freeThrowsMade:17, freeThrowsAttempted:22, turnovers:10 } },
      { team:'MIA', score:110, result:'L', stats:{ points:110, rebounds:41, assists:24, steals:5, blocks:3, threePointersMade:15, threePointersAttempted:39, fieldGoalsMade:40, fieldGoalsAttempted:86, freeThrowsMade:15, freeThrowsAttempted:19, turnovers:12 } },
    ],
    playerStats: [
      { id:'nba-g-3-p1', name:'Sample Center C', team:'LAL', position:'C', starter:true, stats:{ minutes:38, points:46, rebounds:13, assists:8, steals:0, blocks:4, fieldGoalsMade:17, fieldGoalsAttempted:29, threePointersMade:1, turnovers:2 } },
      { id:'nba-g-3-p2', name:'Sample Guard H', team:'LAL', position:'G', starter:true, stats:{ minutes:36, points:25, rebounds:4, assists:9, steals:2, blocks:0, fieldGoalsMade:9, fieldGoalsAttempted:18, threePointersMade:4, turnovers:3 } },
      { id:'nba-g-3-p3', name:'Sample Wing I', team:'MIA', position:'F', starter:true, stats:{ minutes:41, points:31, rebounds:8, assists:6, steals:1, blocks:1, fieldGoalsMade:11, fieldGoalsAttempted:22, threePointersMade:5, turnovers:4 } },
      { id:'nba-g-3-p4', name:'Sample Guard J', team:'MIA', position:'G', starter:true, stats:{ minutes:39, points:23, rebounds:3, assists:10, steals:2, blocks:0, fieldGoalsMade:8, fieldGoalsAttempted:16, threePointersMade:3, turnovers:2 } },
    ],
  },
  {
    gameId: 'nfl-g-1', sport: 'NFL', season: '2025', date: '2025-10-12', gameStage: 'Regular Season',
    homeTeam: 'KC', awayTeam: 'BUF', homeScore: 38, awayScore: 31,
    teamStats: [
      { team:'KC', score:38, result:'W', stats:{ points:38, touchdowns:5, fieldGoals:1, passingYards:421, rushingYards:121, totalYards:542, firstDowns:28, turnovers:0, sacks:3, takeaways:2 } },
      { team:'BUF', score:31, result:'L', stats:{ points:31, touchdowns:4, fieldGoals:1, passingYards:339, rushingYards:146, totalYards:485, firstDowns:25, turnovers:2, sacks:2, takeaways:0 } },
    ],
    playerStats: [
      { id:'nfl-g-1-p1', name:'Sample QB A', team:'KC', position:'QB', starter:true, stats:{ passingYards:421, passingAttempts:44, completions:31, passingTouchdowns:5, interceptions:0, sacksTaken:2, rushingAttempts:5, rushingYards:31 } },
      { id:'nfl-g-1-p2', name:'Sample RB K', team:'KC', position:'RB', starter:true, stats:{ rushingAttempts:18, rushingYards:84, rushingTouchdowns:1, targets:4, receptions:3, receivingYards:29 } },
      { id:'nfl-g-1-p3', name:'Sample WR L', team:'KC', position:'WR', starter:true, stats:{ targets:11, receptions:8, receivingYards:143, receivingTouchdowns:2 } },
      { id:'nfl-g-1-p4', name:'Sample QB M', team:'BUF', position:'QB', starter:true, stats:{ passingYards:339, passingAttempts:39, completions:25, passingTouchdowns:3, interceptions:2, sacksTaken:3, rushingAttempts:8, rushingYards:51, rushingTouchdowns:1 } },
      { id:'nfl-g-1-p5', name:'Sample WR N', team:'BUF', position:'WR', starter:true, stats:{ targets:13, receptions:9, receivingYards:126, receivingTouchdowns:1 } },
    ],
  },
  {
    gameId: 'nfl-g-2', sport: 'NFL', season: '2024', date: '2025-01-12', gameStage: 'Playoffs',
    homeTeam: 'BAL', awayTeam: 'CIN', homeScore: 38, awayScore: 34,
    teamStats: [
      { team:'BAL', score:38, result:'W', stats:{ points:38, touchdowns:5, fieldGoals:1, passingYards:310, rushingYards:188, totalYards:498, firstDowns:27, turnovers:1, sacks:3, takeaways:0 } },
      { team:'CIN', score:34, result:'L', stats:{ points:34, touchdowns:4, fieldGoals:2, passingYards:428, rushingYards:93, totalYards:521, firstDowns:29, turnovers:0, sacks:4, takeaways:1 } },
    ],
    playerStats: [
      { id:'nfl-g-2-p1', name:'Sample QB B', team:'CIN', position:'QB', starter:true, stats:{ passingYards:428, passingAttempts:50, completions:34, passingTouchdowns:4, interceptions:0, sacksTaken:3, rushingAttempts:3, rushingYards:12 } },
      { id:'nfl-g-2-p2', name:'Sample WR O', team:'CIN', position:'WR', starter:true, stats:{ targets:14, receptions:10, receivingYards:167, receivingTouchdowns:2 } },
      { id:'nfl-g-2-p3', name:'Sample QB P', team:'BAL', position:'QB', starter:true, stats:{ passingYards:310, passingAttempts:32, completions:22, passingTouchdowns:3, interceptions:1, sacksTaken:4, rushingAttempts:11, rushingYards:79, rushingTouchdowns:1 } },
      { id:'nfl-g-2-p4', name:'Sample RB Q', team:'BAL', position:'RB', starter:true, stats:{ rushingAttempts:22, rushingYards:109, rushingTouchdowns:2, targets:3, receptions:2, receivingYards:18 } },
    ],
  },
]

export const getMockBoxScore = (record: GameRecord): GameBoxScore => {
  const existing = mockBoxScores.find(game => game.gameId === record.gameId)
  if (existing) return existing

  const [teamScoreRaw, opponentScoreRaw] = record.finalScore.split('-').map(Number)
  const teamScore = Number.isFinite(teamScoreRaw) ? teamScoreRaw : record.stats.points ?? 0
  const opponentScore = Number.isFinite(opponentScoreRaw) ? opponentScoreRaw : record.stats.opponentPoints ?? 0
  const homeTeam = record.homeAway === 'Home' ? record.team : record.opponent
  const awayTeam = record.homeAway === 'Away' ? record.team : record.opponent
  const homeScore = record.homeAway === 'Home' ? teamScore : opponentScore
  const awayScore = record.homeAway === 'Away' ? teamScore : opponentScore

  const teamStats = record.searchType === 'Team'
    ? [
        { team: record.team, score: teamScore, result: record.result, stats: { ...record.stats } },
        { team: record.opponent, score: opponentScore, result: record.result === 'W' ? 'L' as const : 'W' as const, stats: { points: opponentScore } },
      ]
    : [
        { team: record.team, score: teamScore, result: record.result, stats: { points: teamScore } },
        { team: record.opponent, score: opponentScore, result: record.result === 'W' ? 'L' as const : 'W' as const, stats: { points: opponentScore } },
      ]

  const playerStats: BoxScorePlayer[] = record.searchType === 'Player'
    ? [
        { id: `${record.gameId}-searched`, name: record.entityName, team: record.team, position: '—', starter: true, stats: { ...record.stats } },
        { id: `${record.gameId}-mate`, name: 'Sample Teammate', team: record.team, position: '—', stats: record.sport === 'NBA' ? { minutes: 31, points: 18, rebounds: 6, assists: 4 } : { receptions: 4, receivingYards: 58 } },
        { id: `${record.gameId}-opp`, name: 'Sample Opponent', team: record.opponent, position: '—', starter: true, stats: record.sport === 'NBA' ? { minutes: 36, points: 27, rebounds: 7, assists: 5 } : { passingYards: 284, passingTouchdowns: 2, interceptions: 1 } },
      ]
    : [
        { id: `${record.gameId}-team-a`, name: 'Sample Player A', team: record.team, position: '—', starter: true, stats: record.sport === 'NBA' ? { minutes: 35, points: 26, rebounds: 8, assists: 6 } : { passingYards: 305, passingTouchdowns: 3, interceptions: 0 } },
        { id: `${record.gameId}-team-b`, name: 'Sample Player B', team: record.opponent, position: '—', starter: true, stats: record.sport === 'NBA' ? { minutes: 34, points: 23, rebounds: 5, assists: 7 } : { rushingYards: 96, rushingTouchdowns: 1 } },
      ]

  return {
    gameId: record.gameId,
    sport: record.sport,
    season: record.season,
    date: record.date,
    gameStage: record.gameStage,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    teamStats,
    playerStats,
  }
}
