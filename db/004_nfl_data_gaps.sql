CREATE TABLE IF NOT EXISTS nfl_data_gaps (
    game_id TEXT PRIMARY KEY REFERENCES nfl_games(game_id),
    gap_type TEXT NOT NULL,
    note TEXT
);

INSERT INTO nfl_data_gaps (game_id, gap_type, note) VALUES
('1999_01_BAL_STL', 'incomplete_team_stats', 'No standardized team rows available'),
('2000_03_SD_KC', 'incomplete_team_stats', 'No standardized team rows available'),
('2000_06_BUF_MIA', 'incomplete_team_stats', 'No standardized team rows available'),
('2001_01_PIT_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2001_02_TEN_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2001_03_CLE_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2001_06_BUF_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2001_09_CIN_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2001_11_BAL_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2001_12_GB_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2001_16_KC_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2002_01_IND_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2002_04_NYJ_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2002_05_PHI_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2002_08_HOU_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2002_10_WAS_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2002_13_PIT_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2002_14_CLE_JAX', 'incomplete_team_stats', 'Jacksonville team row missing'),
('2002_16_TEN_JAX', 'incomplete_team_stats', 'Jacksonville team row missing')
ON CONFLICT (game_id) DO UPDATE SET
    gap_type = EXCLUDED.gap_type,
    note = EXCLUDED.note;
