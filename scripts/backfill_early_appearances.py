#!/usr/bin/env python3
"""Backfill nba_player_games.played for early NBA seasons using player game logs.

Example:
    python3 scripts/backfill_early_appearances.py --start 1946 --end 1950 --delay 0.25
"""
import argparse
import os
import time

import psycopg
from nba_api.stats.endpoints import leaguegamelog

DB = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/stat_finder")


def season_string(start_year: int) -> str:
    return f"{start_year}-{(start_year + 1) % 100:02d}"


def fetch_player_log(season: str, stage: str):
    last_error = None
    for attempt in range(5):
        try:
            response = leaguegamelog.LeagueGameLog(
                season=season,
                season_type_all_star=stage,
                player_or_team_abbreviation="P",
                timeout=60,
            )
            frame = response.get_data_frames()[0]
            return [] if frame.empty else frame.to_dict("records")
        except Exception as exc:
            last_error = exc
            print(f"  player log retry {attempt + 1}/5 for {season} {stage}: {exc}")
            if attempt < 4:
                time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"Could not fetch {season} {stage}: {last_error}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=1946)
    parser.add_argument("--end", type=int, default=1950)
    parser.add_argument("--delay", type=float, default=0.25)
    args = parser.parse_args()
    if args.end < args.start:
        raise ValueError("--end must be >= --start")

    with psycopg.connect(DB) as conn:
        for start_year in range(args.start, args.end + 1):
            season = season_string(start_year)
            print(f"\n========== {season} ==========")
            reset = conn.execute(
                """UPDATE nba_player_games p SET played=FALSE FROM nba_games g
                   WHERE g.game_id=p.game_id AND g.season=%s""",
                (season,),
            )
            conn.commit()
            print(f"Reset played flag for {reset.rowcount} stored rows")

            total_log_rows = matched_rows = unmatched_rows = 0
            for stage in ("Regular Season", "Playoffs"):
                print(f"Downloading {season} {stage} player game log...")
                rows = fetch_player_log(season, stage)
                print(f"Found {len(rows)} player-game log rows")
                total_log_rows += len(rows)
                for row in rows:
                    game_id = str(row.get("GAME_ID", "")).strip()
                    player_id = row.get("PLAYER_ID")
                    if not game_id or player_id is None:
                        unmatched_rows += 1
                        continue
                    try:
                        player_id = int(player_id)
                    except (TypeError, ValueError):
                        unmatched_rows += 1
                        continue
                    result = conn.execute(
                        "UPDATE nba_player_games SET played=TRUE WHERE game_id=%s AND player_id=%s",
                        (game_id, player_id),
                    )
                    if result.rowcount:
                        matched_rows += result.rowcount
                    else:
                        unmatched_rows += 1
                conn.commit()
                time.sleep(args.delay)

            total_rows, played_rows, not_played_rows = conn.execute(
                """SELECT COUNT(*), COUNT(*) FILTER (WHERE p.played=TRUE),
                          COUNT(*) FILTER (WHERE p.played=FALSE)
                   FROM nba_player_games p JOIN nba_games g ON g.game_id=p.game_id
                   WHERE g.season=%s""",
                (season,),
            ).fetchone()
            print(f"{season} complete:")
            print(f"  stored rows:      {total_rows}")
            print(f"  player-log rows:  {total_log_rows}")
            print(f"  matched updates:  {matched_rows}")
            print(f"  unmatched rows:   {unmatched_rows}")
            print(f"  played=true:      {played_rows}")
            print(f"  played=false:     {not_played_rows}")

    print("\nEarly-era appearance backfill complete.")


if __name__ == "__main__":
    main()
