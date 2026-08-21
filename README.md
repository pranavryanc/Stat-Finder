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
- Source: nflverse weekly player/team stats + schedules
- Initial standardized coverage: 1999–2025

Team Career remains disabled for both leagues until franchise-history mapping is explicitly defined.

## NFL data source

The NFL importer uses `nflreadpy`, the Python interface for nflverse. It loads:
- schedules/results
- week-level unified player stats (offense, defense, kicking)
- week-level team stats

No NFL statistics in the UI are synthetic after the NFL tables are populated.

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

As of this build, the standardized nflverse player/team stat files support 1999 onward. The 2026 regular season has not started yet, so the historical import currently ends with 2025.

One command:

```bash
python3 scripts/ingest_nfl.py --start 1999 --end 2025
```

or:

```bash
npm run ingest:nfl
```

The script processes seasons sequentially and UPSERTs rows, so rerunning it is safe.

To test one season first:

```bash
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

NFL Team Game includes scoring, passing, rushing, total offense, opponent/defensive production, takeaways/turnovers, and differentials where nflverse supplies or supports the metric.

NFL Player Season/Career and NFL Team Season aggregate directly from the verified game-level tables. Rarity, closest performances, sorting, pagination, history, date/team/opponent/result filters, and box-score drill-down reuse the existing Stat Finder behavior.

## Intentional data-quality limits

- NFL historical claims currently begin in 1999 because that is the standardized range of the nflverse player/team stats used here.
- Third-down conversions are left out of the live NFL filter catalog for now rather than fabricating them from incomplete summary fields. They can be added later from play-by-play enrichment.
- Team Career is deferred until franchise relocation/name history is mapped explicitly.
- NFL Team total yards are computed as net passing yards (passing yards minus sack yards lost) plus rushing yards.
- Career passer rating is calculated from career aggregate passing totals, not as a simple average of game passer ratings.

## NFL known team-stat gaps

A small set of 19 NFL games in the nflverse standardized team-stat files are missing one or both team rows. Apply the gap registry after `db/003_nfl.sql`:

```bash
psql stat_finder < db/004_nfl_data_gaps.sql
```

NFL Team Game and Team Season searches exclude these known incomplete games from result counts, rarity, closest-performance calculations, and season aggregation. NFL Player searches are unaffected. The API coverage message reports the number of excluded team games.

The NFL importer also normalizes historical team abbreviations (`SD`→`LAC`, `STL`→`LA`, `OAK`→`LV`, `JAC`→`JAX`, `WSH`→`WAS`) so schedule and weekly-stat rows join consistently.


## Career Year + normalized NBA positions

Player searches now support a **Career Year** filter in Game, Season, and Career windows. Career Year is ordinal by seasons actually played (1st season played = Year 1, next season played = Year 2), so a fully missed season does not advance the counter. `Exactly`, `Before`, `After`, and `Between` are supported. In Career mode, the aggregate is calculated only over the selected career-year window.

NBA positions are normalized into **Guard / Forward / Center** groups so hybrid recorded positions such as `G-F`, `F-G`, and `F-C` behave as users expect. The **Reset Filters** button clears stat and additional filters while keeping the current sport, Player/Team selection, and Game/Season/Career window.

## NFL completeness update

This version expands the real NFL layer without changing the 1999+ standardized nflverse coverage boundary.

New items:
- Position-aware ordering of NFL Player stat sections (all stats remain searchable).
- NFL Data QA tab with season inventory, known team gaps, unexpected gaps, and field-presence checks.
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

The existing `nfl_data_gaps` exclusions remain in effect for the 19 known incomplete team-stat games.

## Phase 5.1 — NFL Explore + Featured Today

Explore is now sport-aware. Use the NBA/NFL toggle on the Explore page to browse a separate curated library for each league.

NFL Featured Today includes:
- one deterministic Daily Spotlight that changes each calendar day,
- On This Day 300+ passing-yard searches,
- On This Day 100+ rushing-yard searches,
- On This Day team 30+ point searches.

If no NFL game in the loaded 1999+ database was played on the current month/day, the API finds the nearest calendar date with an NFL game and the UI switches to Around This Day automatically.

The permanent NFL Explore library includes passing, rushing, receiving, defense, kicking, team, and playoff searches. Clicking a card loads the conditions into Stat Finder without automatically running the search.

No database migration or data re-import is required for this update.
