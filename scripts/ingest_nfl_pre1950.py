#!/usr/bin/env python3
"""
Import pre-1950 NFL/AAFC game and team-result data into Stat Finder.

Source:
    data/historical_nfl/nfl_results_1920-1969.csv

This importer intentionally writes only statistics that are actually present in
the source file. For team rows, that means:
    - points
    - points_allowed
    - point_differential

All other team-stat columns remain NULL rather than being filled with zero.
No player-game rows are created by this importer.

Supported pre-1950 range: 1920-1949.
"""

from __future__ import annotations

import argparse
import os
import re
from pathlib import Path
from typing import Iterable

import pandas as pd
import psycopg


DEFAULT_DATA_PATH = Path("data/historical_nfl/nfl_results_1920-1969.csv")
DEFAULT_START = 1920
DEFAULT_END = 1949
SOURCE_NAME = "nfl_elo_1920_1969"


GAME_COLUMNS = [
    "pg",
    "date",
    "season",
    "neutral",
    "playoff",
    "visitor",
    "visitor.abbr",
    "home",
    "home.abbr",
    "visitor.score",
    "home.score",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import pre-1950 NFL/AAFC game and team-result data."
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--season", type=int, help="Import one season.")
    group.add_argument("--all", action="store_true", help="Import 1920-1949.")
    group.add_argument(
        "--range",
        nargs=2,
        type=int,
        metavar=("START", "END"),
        help="Import an inclusive season range.",
    )

    parser.add_argument(
        "--start",
        type=int,
        help="Inclusive start season. Use together with --end.",
    )
    parser.add_argument(
        "--end",
        type=int,
        help="Inclusive end season. Use together with --start.",
    )
    parser.add_argument(
        "--data",
        type=Path,
        default=DEFAULT_DATA_PATH,
        help=f"CSV path (default: {DEFAULT_DATA_PATH}).",
    )
    return parser.parse_args()


def resolve_seasons(args: argparse.Namespace) -> list[int]:
    # Support the same convenient --start/--end form used by the other
    # historical importer, even though argparse cannot place those options in
    # the mutually-exclusive group cleanly.
    if args.start is not None or args.end is not None:
        if args.season is not None or args.all or args.range is not None:
            raise SystemExit(
                "Use either --season, --all, --range, or --start/--end; do not combine them."
            )
        if args.start is None or args.end is None:
            raise SystemExit("--start and --end must be supplied together.")
        start, end = args.start, args.end
    elif args.season is not None:
        start = end = args.season
    elif args.all:
        start, end = DEFAULT_START, DEFAULT_END
    elif args.range is not None:
        start, end = args.range
    else:
        raise SystemExit(
            "Choose --season YEAR, --all, --range START END, or --start START --end END."
        )

    if start > end:
        raise SystemExit("Start season cannot be greater than end season.")

    if start < DEFAULT_START or end > DEFAULT_END:
        raise SystemExit(
            f"This importer is currently limited to {DEFAULT_START}-{DEFAULT_END}."
        )

    return list(range(start, end + 1))


def load_source(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"Historical results file not found: {path}\n"
            "Expected data/historical_nfl/nfl_results_1920-1969.csv"
        )

    print("Loading pre-1950 game-results dataset ...")
    df = pd.read_csv(path)

    missing = [column for column in GAME_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"Source CSV is missing required columns: {missing}")

    df = df.copy()
    df["season"] = pd.to_numeric(df["season"], errors="raise").astype(int)
    df["date"] = pd.to_datetime(df["date"], errors="raise").dt.date

    print(f"Loaded {len(df):,} source games.")
    return df


def clean_team(value: object) -> str:
    if pd.isna(value):
        raise ValueError("Encountered a game with a missing team abbreviation.")
    team = str(value).strip()
    if not team:
        raise ValueError("Encountered a blank team abbreviation.")
    return team


def clean_int(value: object, field: str) -> int:
    if pd.isna(value):
        raise ValueError(f"Encountered a missing {field}.")
    return int(value)


def clean_bool(value: object) -> bool:
    if pd.isna(value):
        return False

    if isinstance(value, bool):
        return value

    if isinstance(value, (int, float)):
        return bool(int(value))

    text = str(value).strip().lower()
    if text in {"1", "true", "t", "yes", "y"}:
        return True
    if text in {"0", "false", "f", "no", "n", ""}:
        return False
    raise ValueError(f"Could not interpret boolean value: {value!r}")


def make_game_id(row: pd.Series) -> str:
    """
    Prefer the PFR box-score slug because it is stable and uniquely identifies
    the source game. Fall back to date/team abbreviations if necessary.
    """
    pg = "" if pd.isna(row["pg"]) else str(row["pg"]).strip()
    match = re.search(r"/boxscores/([^/?#]+)\.htm", pg)
    if match:
        return f"pre1950_{match.group(1)}"

    game_date = row["date"].isoformat()
    away = clean_team(row["visitor.abbr"])
    home = clean_team(row["home.abbr"])
    return f"pre1950_{game_date}_{away}_{home}"


def build_rows(
    source: pd.DataFrame, seasons: Iterable[int]
) -> tuple[list[tuple], list[tuple], dict[int, dict[str, int]]]:
    wanted = set(seasons)
    df = source[source["season"].isin(wanted)].copy()

    if df.empty:
        raise ValueError("No source games matched the requested season range.")

    game_rows: list[tuple] = []
    team_rows: list[tuple] = []
    summaries: dict[int, dict[str, int]] = {}

    seen_ids: set[str] = set()

    for _, row in df.sort_values(["season", "date", "pg"]).iterrows():
        season = int(row["season"])
        game_id = make_game_id(row)

        if game_id in seen_ids:
            raise ValueError(f"Duplicate generated game_id: {game_id}")
        seen_ids.add(game_id)

        home = clean_team(row["home.abbr"])
        away = clean_team(row["visitor.abbr"])
        home_score = clean_int(row["home.score"], "home score")
        away_score = clean_int(row["visitor.score"], "visitor score")
        neutral = clean_bool(row["neutral"])
        playoff = clean_bool(row["playoff"])

        season_type = "Playoffs" if playoff else "Regular Season"
        game_type = "POST" if playoff else "REG"

        # The source's `week` field is not a historical NFL week ordinal
        # (values such as 681, 993, 1513 appear), so we deliberately store NULL.
        week = None

        # Overtime is not represented by this dataset; preserve it as unknown.
        overtime = None

        game_rows.append(
            (
                game_id,
                season,
                week,
                row["date"],
                season_type,
                game_type,
                home,
                away,
                home_score,
                away_score,
                neutral,
                overtime,
                SOURCE_NAME,
            )
        )

        home_diff = home_score - away_score
        away_diff = away_score - home_score

        # Only columns supported by the source are populated. Everything else
        # remains NULL so historical searches do not treat unavailable stats as 0.
        team_rows.append(
            (
                game_id,
                home,
                away,
                home_score,
                away_score,
                home_diff,
            )
        )
        team_rows.append(
            (
                game_id,
                away,
                home,
                away_score,
                home_score,
                away_diff,
            )
        )

        summary = summaries.setdefault(
            season, {"games": 0, "regular": 0, "playoffs": 0, "team_rows": 0}
        )
        summary["games"] += 1
        summary["regular" if not playoff else "playoffs"] += 1
        summary["team_rows"] += 2

    validate_rows(game_rows, team_rows, summaries, wanted)
    return game_rows, team_rows, summaries


def validate_rows(
    game_rows: list[tuple],
    team_rows: list[tuple],
    summaries: dict[int, dict[str, int]],
    wanted: set[int],
) -> None:
    game_ids = [row[0] for row in game_rows]

    if len(game_ids) != len(set(game_ids)):
        raise ValueError("Generated duplicate game IDs.")

    if len(team_rows) != 2 * len(game_rows):
        raise ValueError(
            f"Expected exactly 2 team rows per game; got "
            f"{len(team_rows)} team rows for {len(game_rows)} games."
        )

    counts: dict[str, int] = {}
    for row in team_rows:
        counts[row[0]] = counts.get(row[0], 0) + 1

    bad = [game_id for game_id, count in counts.items() if count != 2]
    if bad:
        raise ValueError(
            f"{len(bad)} games do not have exactly two team rows. Example: {bad[:5]}"
        )

    missing_seasons = sorted(wanted - set(summaries))
    if missing_seasons:
        raise ValueError(f"No games found for seasons: {missing_seasons}")

    for season in sorted(wanted):
        summary = summaries[season]
        if summary["games"] <= 0:
            raise ValueError(f"{season}: no games found.")
        if summary["regular"] <= 0:
            raise ValueError(f"{season}: no regular-season games found.")
        if summary["team_rows"] != 2 * summary["games"]:
            raise ValueError(f"{season}: team-row count validation failed.")


GAME_UPSERT = """
INSERT INTO nfl_games (
    game_id,
    season,
    week,
    game_date,
    season_type,
    game_type,
    home_team,
    away_team,
    home_score,
    away_score,
    neutral_site,
    overtime,
    source
)
VALUES (
    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
)
ON CONFLICT (game_id) DO UPDATE SET
    season = EXCLUDED.season,
    week = EXCLUDED.week,
    game_date = EXCLUDED.game_date,
    season_type = EXCLUDED.season_type,
    game_type = EXCLUDED.game_type,
    home_team = EXCLUDED.home_team,
    away_team = EXCLUDED.away_team,
    home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score,
    neutral_site = EXCLUDED.neutral_site,
    overtime = EXCLUDED.overtime,
    source = EXCLUDED.source
"""


TEAM_UPSERT = """
INSERT INTO nfl_team_games (
    game_id,
    team,
    opponent,
    points,
    points_allowed,
    point_differential
)
VALUES (%s, %s, %s, %s, %s, %s)
ON CONFLICT (game_id, team) DO UPDATE SET
    opponent = EXCLUDED.opponent,
    points = EXCLUDED.points,
    points_allowed = EXCLUDED.points_allowed,
    point_differential = EXCLUDED.point_differential
"""


def database_url() -> str:
    return os.getenv("DATABASE_URL", "postgresql:///stat_finder")


def write_rows(
    game_rows: list[tuple],
    team_rows: list[tuple],
) -> None:
    with psycopg.connect(database_url()) as conn:
        with conn.cursor() as cur:
            cur.executemany(GAME_UPSERT, game_rows)
            cur.executemany(TEAM_UPSERT, team_rows)
        conn.commit()


def main() -> None:
    args = parse_args()

    # argparse's mutually exclusive group requires one option. To preserve the
    # familiar --start/--end interface, detect that case from raw argv before
    # parse_args rejects it. This block is never reached for that case in the
    # initial parser design, so parse_args is patched below in __main__.
    seasons = resolve_seasons(args)
    source = load_source(args.data)

    game_rows, team_rows, summaries = build_rows(source, seasons)

    print("\nValidating and writing seasons:")
    for season in seasons:
        s = summaries[season]
        print(
            f"  {season}: {s['games']:,} games | "
            f"{s['regular']:,} regular | "
            f"{s['playoffs']:,} playoffs | "
            f"{s['team_rows']:,} team rows"
        )

    write_rows(game_rows, team_rows)

    print("\nPre-1950 NFL/AAFC ingestion complete.")
    print(f"  Seasons:        {seasons[0]}-{seasons[-1]}")
    print(f"  Games written:  {len(game_rows):,}")
    print(f"  Team-game rows: {len(team_rows):,}")
    print("  Player rows:    0 (not available from this source)")
    print(
        "\nNote: team statistics unavailable in the source remain NULL; "
        "they are not stored as zero."
    )


# Rebuild the parser entry point slightly so --start/--end works exactly like
# the user's existing historical importer.
if __name__ == "__main__":
    import sys

    if "--start" in sys.argv or "--end" in sys.argv:
        parser = argparse.ArgumentParser(
            description="Import pre-1950 NFL/AAFC game and team-result data."
        )
        parser.add_argument("--start", type=int, required=True)
        parser.add_argument("--end", type=int, required=True)
        parser.add_argument(
            "--data",
            type=Path,
            default=DEFAULT_DATA_PATH,
            help=f"CSV path (default: {DEFAULT_DATA_PATH}).",
        )
        args = parser.parse_args()

        if args.start > args.end:
            raise SystemExit("Start season cannot be greater than end season.")
        if args.start < DEFAULT_START or args.end > DEFAULT_END:
            raise SystemExit(
                f"This importer is currently limited to {DEFAULT_START}-{DEFAULT_END}."
            )

        seasons = list(range(args.start, args.end + 1))
        source = load_source(args.data)
        game_rows, team_rows, summaries = build_rows(source, seasons)

        print("\nValidating and writing seasons:")
        for season in seasons:
            s = summaries[season]
            print(
                f"  {season}: {s['games']:,} games | "
                f"{s['regular']:,} regular | "
                f"{s['playoffs']:,} playoffs | "
                f"{s['team_rows']:,} team rows"
            )

        write_rows(game_rows, team_rows)

        print("\nPre-1950 NFL/AAFC ingestion complete.")
        print(f"  Seasons:        {seasons[0]}-{seasons[-1]}")
        print(f"  Games written:  {len(game_rows):,}")
        print(f"  Team-game rows: {len(team_rows):,}")
        print("  Player rows:    0 (not available from this source)")
        print(
            "\nNote: team statistics unavailable in the source remain NULL; "
            "they are not stored as zero."
        )
    else:
        main()
