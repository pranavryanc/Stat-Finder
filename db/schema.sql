CREATE TABLE IF NOT EXISTS nba_games (
  game_id TEXT PRIMARY KEY,
  season TEXT NOT NULL,
  game_date DATE NOT NULL,
  season_type TEXT NOT NULL CHECK (season_type IN ('Regular Season','Playoffs')),
  home_team_id BIGINT NOT NULL,
  home_team TEXT NOT NULL,
  away_team_id BIGINT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER NOT NULL,
  away_score INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'NBA Stats'
);

CREATE TABLE IF NOT EXISTS nba_player_games (
  game_id TEXT NOT NULL REFERENCES nba_games(game_id) ON DELETE CASCADE,
  player_id BIGINT NOT NULL,
  player_name TEXT NOT NULL,
  team_id BIGINT NOT NULL,
  team TEXT NOT NULL,
  opponent_id BIGINT NOT NULL,
  opponent TEXT NOT NULL,
  position TEXT,
  starter BOOLEAN,
  minutes NUMERIC,
  played BOOLEAN,
  participation_comment TEXT,
  points INTEGER,
  rebounds INTEGER,
  assists INTEGER,
  steals INTEGER,
  blocks INTEGER,
  fg_made INTEGER,
  fg_attempted INTEGER,
  fg_pct NUMERIC,
  three_made INTEGER,
  three_attempted INTEGER,
  three_pct NUMERIC,
  ft_made INTEGER,
  ft_attempted INTEGER,
  ft_pct NUMERIC,
  offensive_rebounds INTEGER,
  defensive_rebounds INTEGER,
  turnovers INTEGER,
  personal_fouls INTEGER,
  plus_minus NUMERIC,
  PRIMARY KEY (game_id, player_id)
);

CREATE TABLE IF NOT EXISTS nba_team_games (
  game_id TEXT NOT NULL REFERENCES nba_games(game_id) ON DELETE CASCADE,
  team_id BIGINT NOT NULL,
  team TEXT NOT NULL,
  opponent_id BIGINT NOT NULL,
  opponent TEXT NOT NULL,
  points INTEGER,
  rebounds INTEGER,
  assists INTEGER,
  steals INTEGER,
  blocks INTEGER,
  fg_made INTEGER,
  fg_attempted INTEGER,
  fg_pct NUMERIC,
  three_made INTEGER,
  three_attempted INTEGER,
  three_pct NUMERIC,
  ft_made INTEGER,
  ft_attempted INTEGER,
  ft_pct NUMERIC,
  offensive_rebounds INTEGER,
  defensive_rebounds INTEGER,
  turnovers INTEGER,
  personal_fouls INTEGER,
  plus_minus NUMERIC,
  PRIMARY KEY (game_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_nba_games_season_date ON nba_games(season, game_date DESC);
CREATE INDEX IF NOT EXISTS idx_nba_games_type ON nba_games(season_type);
CREATE INDEX IF NOT EXISTS idx_nba_player_games_player ON nba_player_games(player_id);
CREATE INDEX IF NOT EXISTS idx_nba_player_games_played ON nba_player_games(played);
CREATE INDEX IF NOT EXISTS idx_nba_player_games_team ON nba_player_games(team_id);
CREATE INDEX IF NOT EXISTS idx_nba_player_games_pts_reb_ast ON nba_player_games(points, rebounds, assists);
CREATE INDEX IF NOT EXISTS idx_nba_player_games_stl_blk ON nba_player_games(steals, blocks);
CREATE INDEX IF NOT EXISTS idx_nba_team_games_team ON nba_team_games(team_id);
CREATE INDEX IF NOT EXISTS idx_nba_team_games_pts_ast_three ON nba_team_games(points, assists, three_made);
