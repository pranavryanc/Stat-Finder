# Stat Finder — Real NBA + NFL

Stat Finder searches verified game-level sports data for exact statistical combinations. This build keeps the existing NBA implementation and adds the first complete real NFL layer.

## Search modes

### NBA
- Player: Game / Season / Career
- Team: Game / Season
- Source: ingested NBA Stats data

### NFL
- Player: Game / Season / Career
- Team: Game / Season
- Historical source: static historical player-game data for 1970–1998
- Standardized source: nflverse weekly player/team stats + schedules for 1999–2025
- Loaded game-level coverage: 1970–2025

Team Career remains disabled for both leagues until franchise-history mapping is explicitly defined.

## NFL data sources

NFL data is loaded from two non-overlapping sources:

- **1970–1998:** a static historical player-game dataset derived from the `zynicide/nfl-football-player-stats` dataset. The historical importer reconstructs games, joins player profiles, aggregates supported team statistics, and loads the results into PostgreSQL.
- **1999–2025:** standardized nflverse data loaded through `nflreadpy`, including schedules/results, unified weekly player statistics, and weekly team statistics.

The two sources meet at the 1998/1999 boundary without overlap. Historical field availability varies by statistic, so the presence of a season in the database does not imply that every modern NFL statistic is equally complete for that season.

## Existing NBA database

The NFL migration is additive. It does **not** delete, recreate, or re-import your existing NBA tables.

## Setup in a new project folder

```bash
npm install
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/requirements.txt
```

Make sure Postgres.app is running and `DATABASE_URL` points to the existing `stat_finder` database. If you have been using the local default, this is enough:

```bash
export DATABASE_URL=postgresql://localhost/stat_finder
```

## Add the NFL tables

Run once:

```bash
psql stat_finder < db/003_nfl.sql
```

or, if `DATABASE_URL` is exported:

```bash
npm run db:nfl
```

This creates:
- `nfl_games`
- `nfl_player_games`
- `nfl_team_games`

## Import all currently supported NFL history

The loaded NFL database spans 1970–2025 using two import pipelines.

For 1970–1998, place the historical source JSON files in `data/historical_nfl/` and run:

```bash
python3 scripts/ingest_nfl_historical.py --start 1970 --end 1998
```

The historical source files are intentionally gitignored and are not committed to the repository.

For standardized nflverse coverage from 1999–2025, run:

```bash
python3 scripts/ingest_nfl.py --start 1999 --end 2025
```

or:

```bash
npm run ingest:nfl
```

Both importers UPSERT rows, so rerunning an already loaded season does not create duplicate records.

To test individual seasons:

```bash
python3 scripts/ingest_nfl_historical.py --season 1998
python3 scripts/ingest_nfl.py --season 2025
```

## Verify the NFL import

```bash
psql stat_finder
```

Then:

```sql
SELECT MIN(season), MAX(season), COUNT(DISTINCT season), COUNT(*)
FROM nfl_games;

SELECT season, season_type, COUNT(*) AS games
FROM nfl_games
GROUP BY season, season_type
ORDER BY season DESC, season_type;

SELECT COUNT(*) FROM nfl_player_games;
SELECT COUNT(*) FROM nfl_team_games;
```

A useful player sanity check:

```sql
SELECT
  p.player_name,
  p.team,
  p.opponent,
  p.passing_yards,
  p.passing_touchdowns,
  g.game_date
FROM nfl_player_games p
JOIN nfl_games g ON g.game_id = p.game_id
WHERE p.passing_yards >= 400
ORDER BY g.game_date DESC
LIMIT 20;
```

Exit with `\q`.

## Run the app

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev:web
```

## Real NFL functionality in this build

NFL Player Game supports passing, rushing, receiving, defense, and kicking filters including:
- passing yards/attempts/completions/TD/INT, completion %, sacks taken, passer rating
- carries/rushing yards/rushing TD/yards per carry
- targets/receptions/receiving yards/TD/yards per reception
- tackles/solo/assisted tackles, sacks, defensive INT, forced fumbles, recoveries, defensive TD
- field goals made/attempted, long FG, extra points made

NFL Team Game includes scoring, passing, rushing, total offense, opponent/defensive production, takeaways/turnovers, and differentials where the underlying source supplies or supports the metric. Field availability varies in the 1970–1998 historical dataset.

NFL Player Season/Career and NFL Team Season aggregate directly from the verified game-level tables. Rarity, closest performances, sorting, pagination, history, date/team/opponent/result filters, and box-score drill-down reuse the existing Stat Finder behavior.

## Intentional data-quality limits

- NFL game-level coverage currently begins in 1970. The 1970–1998 historical source does not provide every modern statistic with equal completeness; standardized nflverse weekly player/team statistics begin in 1999.
- Third-down conversions are left out of the live NFL filter catalog for now rather than fabricating them from incomplete summary fields. They can be added later from play-by-play enrichment.
- Team Career is deferred until franchise relocation/name history is mapped explicitly.
- NFL Team total yards are computed as net passing yards plus rushing yards. nflverse reports `sack_yards_lost` as negative values, so net passing yards are calculated as gross passing yards plus `sack_yards_lost`.
- Career passer rating is calculated from career aggregate passing totals, not as a simple average of game passer ratings.

## NFL team-stat gap repair

The 19 previously identified incomplete nflverse team-stat games have been repaired and are now included in NFL Team Game and Team Season searches.

The repair is implemented in `scripts/repair_nfl_team_gaps.py`.

- 16 Jacksonville games from 2001–2002 are reconstructed from nflverse play-by-play.
- 3 games with no usable nflverse team/play-by-play data are restored from audited archival box-score statistics: `1999_01_BAL_STL`, `2000_03_SD_KC`, and `2000_06_BUF_MIA`.
- The repair UPSERTs both team rows where needed and validates that all 19 games have exactly two team rows.

Run the repair after standardized NFL ingestion:

```bash
python3 scripts/repair_nfl_team_gaps.py
```

`db/004_nfl_data_gaps.sql` is retained for compatibility with databases that previously registered these games as exclusions, but the obsolete exclusions are no longer used by NFL searches.

The NFL importer also normalizes historical team abbreviations (`SD`→`LAC`, `STL`→`LA`, `OAK`→`LV`, `JAC`→`JAX`, `WSH`→`WAS`) so schedule and weekly-stat rows join consistently.


## Career Year + normalized NBA positions

Player searches now support a **Career Year** filter in Game, Season, and Career windows. Career Year is ordinal by seasons actually played (1st season played = Year 1, next season played = Year 2), so a fully missed season does not advance the counter. `Exactly`, `Before`, `After`, and `Between` are supported. In Career mode, the aggregate is calculated only over the selected career-year window.

NBA positions are normalized into **Guard / Forward / Center** groups so hybrid recorded positions such as `G-F`, `F-G`, and `F-C` behave as users expect. The **Reset Filters** button clears stat and additional filters while keeping the current sport, Player/Team selection, and Game/Season/Career window.

## NFL completeness update

This version expands searchable NFL game-level history to 1970 while retaining 1999 as the boundary for standardized nflverse weekly player/team statistics.

New items:
- Position-aware ordering of NFL Player stat sections (all stats remain searchable).
- NFL Data QA tab with season inventory, linkage-integrity checks, coverage boundaries, and field-presence checks.
- Expanded kicking support: field-goal percentage, XP attempts, XP percentage, and longest field goal in Season/Career aggregation.
- Sacks taken is now available in NFL Player Season/Career searches.
- Third-down conversions are intentionally hidden from the public Team filter catalog until their historical completeness is separately validated.

Apply the additive kicking migration once:

```bash
psql stat_finder < db/005_nfl_kicking_completeness.sql
```

Then rerun the standardized NFL import to populate XP attempts across the loaded history (UPSERTs prevent duplication):

```bash
source .venv/bin/activate
python3 scripts/ingest_nfl.py --start 1999 --end 2025
```

The 19 previously excluded nflverse team-stat games have been repaired and are now included in NFL Team searches.

## Phase 5.1 — NFL Explore + Featured Today

Explore is now sport-aware. Use the NBA/NFL toggle on the Explore page to browse a separate curated library for each league.

NFL Featured Today includes:
- one deterministic Daily Spotlight that changes each calendar day,
- On This Day 300+ passing-yard searches,
- On This Day 100+ rushing-yard searches,
- On This Day team 30+ point searches.

If no NFL game in the loaded 1970–2025 database was played on the current month/day, the API finds the nearest calendar date with an NFL game and the UI switches to Around This Day automatically.

The permanent NFL Explore library includes passing, rushing, receiving, defense, kicking, team, and playoff searches. Clicking a card loads the conditions into Stat Finder without automatically running the search.

No database migration or data re-import is required for this update.

## Phase 5 filter expansion
- Reset Filters defaults Season/Career searches to Regular Season.
- NFL supports regular-season Week 1-18 and playoff-round filters (Wild Card, Divisional, Conference Championship, Super Bowl).
- NBA supports encoded playoff-round filters (First Round, Conference Semifinals, Conference Finals, NBA Finals).
- Day-of-week, month, and month/day filters apply to Game, Season, and Career. For Season/Career, matching games are filtered before aggregation.
