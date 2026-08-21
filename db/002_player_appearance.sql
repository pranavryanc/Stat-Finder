ALTER TABLE nba_player_games ADD COLUMN IF NOT EXISTS played BOOLEAN;
ALTER TABLE nba_player_games ADD COLUMN IF NOT EXISTS participation_comment TEXT;

-- Modern seasons: minutes identify actual appearances reliably.
UPDATE nba_player_games p
SET played = COALESCE(p.minutes > 0, FALSE)
FROM nba_games g
WHERE g.game_id = p.game_id
  AND substring(g.season,1,4)::int >= 1951;

CREATE INDEX IF NOT EXISTS idx_nba_player_games_played ON nba_player_games(played);
