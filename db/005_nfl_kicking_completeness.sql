ALTER TABLE nfl_player_games
  ADD COLUMN IF NOT EXISTS extra_points_attempted numeric;

ALTER TABLE nfl_player_games
  ADD COLUMN IF NOT EXISTS field_goal_pct numeric
  GENERATED ALWAYS AS (
    CASE WHEN field_goals_attempted > 0
      THEN field_goals_made / field_goals_attempted
      ELSE NULL
    END
  ) STORED;

ALTER TABLE nfl_player_games
  ADD COLUMN IF NOT EXISTS extra_point_pct numeric
  GENERATED ALWAYS AS (
    CASE WHEN extra_points_attempted > 0
      THEN extra_points_made / extra_points_attempted
      ELSE NULL
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS nfl_player_games_kicking_idx
  ON nfl_player_games(field_goals_made, field_goals_attempted, extra_points_made, extra_points_attempted);
