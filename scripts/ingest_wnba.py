#!/usr/bin/env python3
"""Load verified WNBA / NBA.com game + traditional box-score data into PostgreSQL.

Examples:

    # Automatically determine the current WNBA season and load only new games
    python scripts/ingest_wnba.py

    # Load/update a specific season
    python scripts/ingest_wnba.py --season 2025

    # Force every game's box score to be fetched again
    python scripts/ingest_wnba.py --season 2025 --force
"""

import argparse
import os
import time
from datetime import datetime, date

import psycopg
from nba_api.stats.endpoints import leaguegamelog, boxscoretraditionalv3


DB = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/stat_finder",
)


WNBA_TEAM_ALIASES = {
    "PHO": "PHX",
}


def normalize_team(team):
    """Normalize a WNBA team abbreviation for storage in Stat Finder."""
    if team is None:
        return None

    team = str(team).strip()
    return WNBA_TEAM_ALIASES.get(team, team)


def num(v, default=None):
    if v in (None, "", "-"):
        return default

    try:
        return float(v)
    except Exception:
        return default


def mins(v):
    if v in (None, ""):
        return None

    s = str(v)

    if ":" in s:
        a, b = s.split(":", 1)

        try:
            return round(float(a) + float(b) / 60, 3)
        except Exception:
            return None

    return num(v)


def automatic_season():
    """Return the current WNBA season as a calendar year."""
    return str(date.today().year)


def fetch_team_log(season, stage):
    for attempt in range(5):
        try:
            result = leaguegamelog.LeagueGameLog(
                season=season,
                season_type_all_star=stage,
                player_or_team_abbreviation="T",
                league_id="10",
                timeout=60,
            )

            return result.get_data_frames()[0].to_dict("records")

        except Exception as e:
            if attempt == 4:
                raise

            print(f"  team log retry {attempt + 1}: {e}")
            time.sleep(3 * (attempt + 1))


def fetch_box(game_id):
    for attempt in range(5):
        try:
            result = boxscoretraditionalv3.BoxScoreTraditionalV3(
                game_id=game_id,
                timeout=60,
            )

            frames = result.get_data_frames()

            return (
                frames[0].to_dict("records"),
                frames[2].to_dict("records"),
            )

        except Exception as e:
            if attempt == 4:
                raise

            print(f"  box score {game_id} retry {attempt + 1}: {e}")
            time.sleep(3 * (attempt + 1))


def game_is_complete(conn, game_id):
    """Check whether Stat Finder already has a usable complete game."""

    game_exists = conn.execute(
        """
        SELECT EXISTS(
            SELECT 1
            FROM wnba_games
            WHERE game_id = %s
        )
        """,
        (game_id,),
    ).fetchone()[0]

    if not game_exists:
        return False

    team_count = conn.execute(
        """
        SELECT COUNT(*)
        FROM wnba_team_games
        WHERE game_id = %s
        """,
        (game_id,),
    ).fetchone()[0]

    player_count = conn.execute(
        """
        SELECT COUNT(*)
        FROM wnba_player_games
        WHERE game_id = %s
        """,
        (game_id,),
    ).fetchone()[0]

    return team_count >= 2 and player_count > 0


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--season",
        default="auto",
        help="WNBA season such as 2026, or 'auto'",
    )

    parser.add_argument(
        "--delay",
        type=float,
        default=0.65,
        help="Delay between WNBA / NBA.com box-score requests",
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download box scores even when the game already exists",
    )

    args = parser.parse_args()

    season = (
        automatic_season()
        if args.season.lower() == "auto"
        else args.season
    )

    print(f"WNBA season: {season}")

    inserted_or_updated = 0
    skipped_existing = 0

    with psycopg.connect(DB) as conn:

        for stage in ("Regular Season", "Playoffs"):

            print(f"\nDownloading {season} {stage} team game log...")

            rows = fetch_team_log(season, stage)

            by_game = {}

            for row in rows:
                by_game.setdefault(
                    str(row["GAME_ID"]),
                    [],
                ).append(row)

            print(f"Found {len(by_game)} games")

            for i, (game_id, pair) in enumerate(
                sorted(by_game.items()),
                1,
            ):

                if len(pair) < 2:
                    print(
                        f"  [{i}/{len(by_game)}] "
                        f"skipping incomplete {game_id}"
                    )
                    continue

                home = next(
                    (
                        row
                        for row in pair
                        if "vs." in str(row["MATCHUP"])
                    ),
                    None,
                )

                away = next(
                    (
                        row
                        for row in pair
                        if "@" in str(row["MATCHUP"])
                    ),
                    None,
                )

                if not home or not away:
                    print(
                        f"  [{i}/{len(by_game)}] "
                        f"cannot resolve home/away {game_id}"
                    )
                    continue

                if not args.force and game_is_complete(conn, game_id):
                    skipped_existing += 1

                    print(
                        f"  [{i}/{len(by_game)}] "
                        f"already stored: "
                        f'{normalize_team(away["TEAM_ABBREVIATION"])} @ '
                        f'{normalize_team(home["TEAM_ABBREVIATION"])}'
                    )

                    continue

                game_date = datetime.strptime(
                    str(home["GAME_DATE"])[:10],
                    "%Y-%m-%d",
                ).date()

                conn.execute(
                    """
                    INSERT INTO wnba_games(
                        game_id,
                        season,
                        game_date,
                        season_type,
                        home_team_id,
                        home_team,
                        away_team_id,
                        away_team,
                        home_score,
                        away_score
                    )
                    VALUES(
                        %s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                    )
                    ON CONFLICT(game_id)
                    DO UPDATE SET
                        season = EXCLUDED.season,
                        game_date = EXCLUDED.game_date,
                        season_type = EXCLUDED.season_type,
                        home_team_id = EXCLUDED.home_team_id,
                        home_team = EXCLUDED.home_team,
                        away_team_id = EXCLUDED.away_team_id,
                        away_team = EXCLUDED.away_team,
                        home_score = EXCLUDED.home_score,
                        away_score = EXCLUDED.away_score
                    """,
                    (
                        game_id,
                        season,
                        game_date,
                        stage,
                        int(home["TEAM_ID"]),
                        normalize_team(home["TEAM_ABBREVIATION"]),
                        int(away["TEAM_ID"]),
                        normalize_team(away["TEAM_ABBREVIATION"]),
                        int(home["PTS"]),
                        int(away["PTS"]),
                    ),
                )

                players, teams = fetch_box(game_id)

                team_ids = {
                    int(home["TEAM_ID"]): (
                        int(away["TEAM_ID"]),
                        normalize_team(away["TEAM_ABBREVIATION"]),
                    ),
                    int(away["TEAM_ID"]): (
                        int(home["TEAM_ID"]),
                        normalize_team(home["TEAM_ABBREVIATION"]),
                    ),
                }

                for team in teams:
                    tid = int(team["teamId"])
                    oppid, opponent = team_ids[tid]

                    vals = (
                        game_id,
                        tid,
                        normalize_team(team["teamTricode"]),
                        oppid,
                        opponent,
                        team["points"],
                        team["reboundsTotal"],
                        team["assists"],
                        team["steals"],
                        team["blocks"],
                        team["fieldGoalsMade"],
                        team["fieldGoalsAttempted"],
                        num(team["fieldGoalsPercentage"]),
                        team["threePointersMade"],
                        team["threePointersAttempted"],
                        num(team["threePointersPercentage"]),
                        team["freeThrowsMade"],
                        team["freeThrowsAttempted"],
                        num(team["freeThrowsPercentage"]),
                        team["reboundsOffensive"],
                        team["reboundsDefensive"],
                        team["turnovers"],
                        team["foulsPersonal"],
                        num(team["plusMinusPoints"]),
                    )

                    conn.execute(
                        """
                        INSERT INTO wnba_team_games(
                            game_id,
                            team_id,
                            team,
                            opponent_id,
                            opponent,
                            points,
                            rebounds,
                            assists,
                            steals,
                            blocks,
                            fg_made,
                            fg_attempted,
                            fg_pct,
                            three_made,
                            three_attempted,
                            three_pct,
                            ft_made,
                            ft_attempted,
                            ft_pct,
                            offensive_rebounds,
                            defensive_rebounds,
                            turnovers,
                            personal_fouls,
                            plus_minus
                        )
                        VALUES(
                            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                            %s,%s,%s,%s
                        )
                        ON CONFLICT(game_id, team_id)
                        DO UPDATE SET
                            team = EXCLUDED.team,
                            opponent_id = EXCLUDED.opponent_id,
                            opponent = EXCLUDED.opponent,
                            points = EXCLUDED.points,
                            rebounds = EXCLUDED.rebounds,
                            assists = EXCLUDED.assists,
                            steals = EXCLUDED.steals,
                            blocks = EXCLUDED.blocks,
                            fg_made = EXCLUDED.fg_made,
                            fg_attempted = EXCLUDED.fg_attempted,
                            fg_pct = EXCLUDED.fg_pct,
                            three_made = EXCLUDED.three_made,
                            three_attempted = EXCLUDED.three_attempted,
                            three_pct = EXCLUDED.three_pct,
                            ft_made = EXCLUDED.ft_made,
                            ft_attempted = EXCLUDED.ft_attempted,
                            ft_pct = EXCLUDED.ft_pct,
                            offensive_rebounds = EXCLUDED.offensive_rebounds,
                            defensive_rebounds = EXCLUDED.defensive_rebounds,
                            turnovers = EXCLUDED.turnovers,
                            personal_fouls = EXCLUDED.personal_fouls,
                            plus_minus = EXCLUDED.plus_minus
                        """,
                        vals,
                    )

                for player in players:

                    if not player.get("personId"):
                        continue

                    tid = int(player["teamId"])
                    oppid, opponent = team_ids[tid]

                    name = (
                        str(player.get("firstName", ""))
                        + " "
                        + str(player.get("familyName", ""))
                    ).strip()

                    player_minutes = mins(player.get("minutes"))
                    played = player_minutes is not None

                    vals = (
                        game_id,
                        int(player["personId"]),
                        name,
                        tid,
                        normalize_team(player["teamTricode"]),
                        oppid,
                        opponent,
                        player.get("position"),
                        None,
                        player_minutes,
                        player["points"],
                        player["reboundsTotal"],
                        player["assists"],
                        player["steals"],
                        player["blocks"],
                        player["fieldGoalsMade"],
                        player["fieldGoalsAttempted"],
                        num(player["fieldGoalsPercentage"]),
                        player["threePointersMade"],
                        player["threePointersAttempted"],
                        num(player["threePointersPercentage"]),
                        player["freeThrowsMade"],
                        player["freeThrowsAttempted"],
                        num(player["freeThrowsPercentage"]),
                        player["reboundsOffensive"],
                        player["reboundsDefensive"],
                        player["turnovers"],
                        player["foulsPersonal"],
                        num(player["plusMinusPoints"]),
                        played,
                    )

                    conn.execute(
                        """
                        INSERT INTO wnba_player_games(
                            game_id,
                            player_id,
                            player_name,
                            team_id,
                            team,
                            opponent_id,
                            opponent,
                            position,
                            starter,
                            minutes,
                            points,
                            rebounds,
                            assists,
                            steals,
                            blocks,
                            fg_made,
                            fg_attempted,
                            fg_pct,
                            three_made,
                            three_attempted,
                            three_pct,
                            ft_made,
                            ft_attempted,
                            ft_pct,
                            offensive_rebounds,
                            defensive_rebounds,
                            turnovers,
                            personal_fouls,
                            plus_minus,
                            played
                        )
                        VALUES(
                            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                        )
                        ON CONFLICT(game_id, player_id)
                        DO UPDATE SET
                            player_name = EXCLUDED.player_name,
                            team_id = EXCLUDED.team_id,
                            team = EXCLUDED.team,
                            opponent_id = EXCLUDED.opponent_id,
                            opponent = EXCLUDED.opponent,
                            position = EXCLUDED.position,
                            minutes = EXCLUDED.minutes,
                            points = EXCLUDED.points,
                            rebounds = EXCLUDED.rebounds,
                            assists = EXCLUDED.assists,
                            steals = EXCLUDED.steals,
                            blocks = EXCLUDED.blocks,
                            fg_made = EXCLUDED.fg_made,
                            fg_attempted = EXCLUDED.fg_attempted,
                            fg_pct = EXCLUDED.fg_pct,
                            three_made = EXCLUDED.three_made,
                            three_attempted = EXCLUDED.three_attempted,
                            three_pct = EXCLUDED.three_pct,
                            ft_made = EXCLUDED.ft_made,
                            ft_attempted = EXCLUDED.ft_attempted,
                            ft_pct = EXCLUDED.ft_pct,
                            offensive_rebounds = EXCLUDED.offensive_rebounds,
                            defensive_rebounds = EXCLUDED.defensive_rebounds,
                            turnovers = EXCLUDED.turnovers,
                            personal_fouls = EXCLUDED.personal_fouls,
                            plus_minus = EXCLUDED.plus_minus,
                            played = EXCLUDED.played
                        """,
                        vals,
                    )

                conn.commit()

                inserted_or_updated += 1

                print(
                    f"  [{i}/{len(by_game)}] "
                    f'{normalize_team(away["TEAM_ABBREVIATION"])} '
                    f'{away["PTS"]} @ '
                    f'{normalize_team(home["TEAM_ABBREVIATION"])} '
                    f'{home["PTS"]}'
                )

                time.sleep(args.delay)

    print("\nWNBA ingestion complete.")
    print(f"New/updated games: {inserted_or_updated}")
    print(f"Existing complete games skipped: {skipped_existing}")


if __name__ == "__main__":
    main()