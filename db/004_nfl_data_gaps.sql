CREATE TABLE IF NOT EXISTS nfl_data_gaps (
    game_id TEXT PRIMARY KEY REFERENCES nfl_games(game_id),
    gap_type TEXT NOT NULL,
    note TEXT
);

-- These historical nflverse team-stat gaps have been repaired.
-- Keep this migration for compatibility with databases that previously
-- registered the affected games as exclusions.

DELETE FROM nfl_data_gaps
WHERE game_id IN (
    '1999_01_BAL_STL',
    '2000_03_SD_KC',
    '2000_06_BUF_MIA',
    '2001_01_PIT_JAX',
    '2001_02_TEN_JAX',
    '2001_03_CLE_JAX',
    '2001_06_BUF_JAX',
    '2001_09_CIN_JAX',
    '2001_11_BAL_JAX',
    '2001_12_GB_JAX',
    '2001_16_KC_JAX',
    '2002_01_IND_JAX',
    '2002_04_NYJ_JAX',
    '2002_05_PHI_JAX',
    '2002_08_HOU_JAX',
    '2002_10_WAS_JAX',
    '2002_13_PIT_JAX',
    '2002_14_CLE_JAX',
    '2002_16_TEN_JAX'
);