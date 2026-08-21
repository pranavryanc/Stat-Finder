CREATE TABLE IF NOT EXISTS nfl_games (
  game_id text PRIMARY KEY,
  season integer NOT NULL,
  week integer,
  game_date date NOT NULL,
  season_type text NOT NULL CHECK (season_type IN ('Regular Season','Playoffs')),
  game_type text,
  home_team text NOT NULL,
  away_team text NOT NULL,
  home_score integer,
  away_score integer,
  neutral_site boolean NOT NULL DEFAULT false,
  overtime boolean,
  source text NOT NULL DEFAULT 'nflverse'
);

CREATE TABLE IF NOT EXISTS nfl_player_games (
  game_id text NOT NULL REFERENCES nfl_games(game_id) ON DELETE CASCADE,
  player_id text NOT NULL,
  player_name text NOT NULL,
  team text NOT NULL,
  opponent text NOT NULL,
  position text,
  position_group text,
  completions numeric,
  passing_attempts numeric,
  passing_yards numeric,
  passing_touchdowns numeric,
  passing_interceptions numeric,
  sacks_taken numeric,
  passer_rating numeric,
  completion_percentage numeric,
  rushing_attempts numeric,
  rushing_yards numeric,
  rushing_touchdowns numeric,
  yards_per_carry numeric,
  targets numeric,
  receptions numeric,
  receiving_yards numeric,
  receiving_touchdowns numeric,
  yards_per_reception numeric,
  tackles numeric,
  solo_tackles numeric,
  assisted_tackles numeric,
  sacks numeric,
  defensive_interceptions numeric,
  forced_fumbles numeric,
  fumble_recoveries numeric,
  defensive_touchdowns numeric,
  field_goals_made numeric,
  field_goals_attempted numeric,
  longest_field_goal numeric,
  extra_points_made numeric,
  PRIMARY KEY (game_id, player_id)
);

CREATE TABLE IF NOT EXISTS nfl_team_games (
  game_id text NOT NULL REFERENCES nfl_games(game_id) ON DELETE CASCADE,
  team text NOT NULL,
  opponent text NOT NULL,
  points numeric,
  touchdowns numeric,
  field_goals numeric,
  completions numeric,
  passing_attempts numeric,
  passing_yards numeric,
  passing_touchdowns numeric,
  interceptions_thrown numeric,
  rushing_attempts numeric,
  rushing_yards numeric,
  rushing_touchdowns numeric,
  total_yards numeric,
  first_downs numeric,
  third_down_conversions numeric,
  points_allowed numeric,
  yards_allowed numeric,
  passing_yards_allowed numeric,
  rushing_yards_allowed numeric,
  sacks numeric,
  interceptions numeric,
  forced_fumbles numeric,
  takeaways numeric,
  turnovers numeric,
  turnover_differential numeric,
  point_differential numeric,
  PRIMARY KEY (game_id, team)
);

CREATE INDEX IF NOT EXISTS nfl_games_season_date_idx ON nfl_games(season, game_date DESC);
CREATE INDEX IF NOT EXISTS nfl_games_stage_idx ON nfl_games(season_type, game_date DESC);
CREATE INDEX IF NOT EXISTS nfl_player_games_player_idx ON nfl_player_games(player_name, game_id);
CREATE INDEX IF NOT EXISTS nfl_player_games_team_idx ON nfl_player_games(team, game_id);
CREATE INDEX IF NOT EXISTS nfl_player_games_position_idx ON nfl_player_games(position, game_id);
CREATE INDEX IF NOT EXISTS nfl_player_games_pass_idx ON nfl_player_games(passing_yards, passing_touchdowns);
CREATE INDEX IF NOT EXISTS nfl_player_games_rush_idx ON nfl_player_games(rushing_yards, rushing_touchdowns);
CREATE INDEX IF NOT EXISTS nfl_player_games_rec_idx ON nfl_player_games(receiving_yards, receiving_touchdowns);
CREATE INDEX IF NOT EXISTS nfl_team_games_team_idx ON nfl_team_games(team, game_id);
CREATE INDEX IF NOT EXISTS nfl_team_games_points_idx ON nfl_team_games(points, point_differential);
