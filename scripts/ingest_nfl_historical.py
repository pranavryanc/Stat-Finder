#!/usr/bin/env python3

import argparse
import json
import os
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import psycopg


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://localhost/stat_finder",
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DEFAULT_GAMES_PATH = (
    PROJECT_ROOT
    / "data"
    / "historical_nfl"
    / "games_1512362753.8735218.json"
)

DEFAULT_PROFILES_PATH = (
    PROJECT_ROOT
    / "data"
    / "historical_nfl"
    / "profiles_1512362725.022629.json"
)


# The historical dataset uses older PFR-style abbreviations.
# Normalize common relocated/renamed franchises to the abbreviations
# already used by Stat Finder.
TEAM_ALIASES = {
    "GNB": "GB",
    "KAN": "KC",
    "NWE": "NE",
    "NOR": "NO",
    "SFO": "SF",
    "TAM": "TB",
    "SD": "LAC",
    "SDG": "LAC",
    "STL": "LA",
    "OAK": "LV",
    "JAC": "JAX",
    "WSH": "WAS",
}


GAME_SQL = """
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
    %(game_id)s,
    %(season)s,
    %(week)s,
    %(game_date)s,
    %(season_type)s,
    %(game_type)s,
    %(home_team)s,
    %(away_team)s,
    %(home_score)s,
    %(away_score)s,
    %(neutral_site)s,
    %(overtime)s,
    %(source)s
)
ON CONFLICT (game_id)
DO UPDATE SET
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


PLAYER_SQL = """
INSERT INTO nfl_player_games (
    game_id,
    player_id,
    player_name,
    team,
    opponent,
    position,
    position_group,
    completions,
    passing_attempts,
    passing_yards,
    passing_touchdowns,
    passing_interceptions,
    sacks_taken,
    passer_rating,
    completion_percentage,
    rushing_attempts,
    rushing_yards,
    rushing_touchdowns,
    yards_per_carry,
    targets,
    receptions,
    receiving_yards,
    receiving_touchdowns,
    yards_per_reception,
    tackles,
    solo_tackles,
    assisted_tackles,
    sacks,
    defensive_interceptions,
    forced_fumbles,
    fumble_recoveries,
    defensive_touchdowns,
    field_goals_made,
    field_goals_attempted,
    longest_field_goal,
    extra_points_made,
    extra_points_attempted
)
VALUES (
    %(game_id)s,
    %(player_id)s,
    %(player_name)s,
    %(team)s,
    %(opponent)s,
    %(position)s,
    %(position_group)s,
    %(completions)s,
    %(passing_attempts)s,
    %(passing_yards)s,
    %(passing_touchdowns)s,
    %(passing_interceptions)s,
    %(sacks_taken)s,
    %(passer_rating)s,
    %(completion_percentage)s,
    %(rushing_attempts)s,
    %(rushing_yards)s,
    %(rushing_touchdowns)s,
    %(yards_per_carry)s,
    %(targets)s,
    %(receptions)s,
    %(receiving_yards)s,
    %(receiving_touchdowns)s,
    %(yards_per_reception)s,
    %(tackles)s,
    %(solo_tackles)s,
    %(assisted_tackles)s,
    %(sacks)s,
    %(defensive_interceptions)s,
    %(forced_fumbles)s,
    %(fumble_recoveries)s,
    %(defensive_touchdowns)s,
    %(field_goals_made)s,
    %(field_goals_attempted)s,
    %(longest_field_goal)s,
    %(extra_points_made)s,
    %(extra_points_attempted)s
)
ON CONFLICT (game_id, player_id)
DO UPDATE SET
    player_name = EXCLUDED.player_name,
    team = EXCLUDED.team,
    opponent = EXCLUDED.opponent,
    position = EXCLUDED.position,
    position_group = EXCLUDED.position_group,
    completions = EXCLUDED.completions,
    passing_attempts = EXCLUDED.passing_attempts,
    passing_yards = EXCLUDED.passing_yards,
    passing_touchdowns = EXCLUDED.passing_touchdowns,
    passing_interceptions = EXCLUDED.passing_interceptions,
    sacks_taken = EXCLUDED.sacks_taken,
    passer_rating = EXCLUDED.passer_rating,
    completion_percentage = EXCLUDED.completion_percentage,
    rushing_attempts = EXCLUDED.rushing_attempts,
    rushing_yards = EXCLUDED.rushing_yards,
    rushing_touchdowns = EXCLUDED.rushing_touchdowns,
    yards_per_carry = EXCLUDED.yards_per_carry,
    targets = EXCLUDED.targets,
    receptions = EXCLUDED.receptions,
    receiving_yards = EXCLUDED.receiving_yards,
    receiving_touchdowns = EXCLUDED.receiving_touchdowns,
    yards_per_reception = EXCLUDED.yards_per_reception,
    tackles = EXCLUDED.tackles,
    solo_tackles = EXCLUDED.solo_tackles,
    assisted_tackles = EXCLUDED.assisted_tackles,
    sacks = EXCLUDED.sacks,
    defensive_interceptions = EXCLUDED.defensive_interceptions,
    forced_fumbles = EXCLUDED.forced_fumbles,
    fumble_recoveries = EXCLUDED.fumble_recoveries,
    defensive_touchdowns = EXCLUDED.defensive_touchdowns,
    field_goals_made = EXCLUDED.field_goals_made,
    field_goals_attempted = EXCLUDED.field_goals_attempted,
    longest_field_goal = EXCLUDED.longest_field_goal,
    extra_points_made = EXCLUDED.extra_points_made,
    extra_points_attempted = EXCLUDED.extra_points_attempted
"""


TEAM_SQL = """
INSERT INTO nfl_team_games (
    game_id,
    team,
    opponent,
    points,
    touchdowns,
    field_goals,
    completions,
    passing_attempts,
    passing_yards,
    passing_touchdowns,
    interceptions_thrown,
    rushing_attempts,
    rushing_yards,
    rushing_touchdowns,
    total_yards,
    first_downs,
    third_down_conversions,
    points_allowed,
    yards_allowed,
    passing_yards_allowed,
    rushing_yards_allowed,
    sacks,
    interceptions,
    forced_fumbles,
    takeaways,
    turnovers,
    turnover_differential,
    point_differential
)
VALUES (
    %(game_id)s,
    %(team)s,
    %(opponent)s,
    %(points)s,
    %(touchdowns)s,
    %(field_goals)s,
    %(completions)s,
    %(passing_attempts)s,
    %(passing_yards)s,
    %(passing_touchdowns)s,
    %(interceptions_thrown)s,
    %(rushing_attempts)s,
    %(rushing_yards)s,
    %(rushing_touchdowns)s,
    %(total_yards)s,
    %(first_downs)s,
    %(third_down_conversions)s,
    %(points_allowed)s,
    %(yards_allowed)s,
    %(passing_yards_allowed)s,
    %(rushing_yards_allowed)s,
    %(sacks)s,
    %(interceptions)s,
    %(forced_fumbles)s,
    %(takeaways)s,
    %(turnovers)s,
    %(turnover_differential)s,
    %(point_differential)s
)
ON CONFLICT (game_id, team)
DO UPDATE SET
    opponent = EXCLUDED.opponent,
    points = EXCLUDED.points,
    touchdowns = EXCLUDED.touchdowns,
    field_goals = EXCLUDED.field_goals,
    completions = EXCLUDED.completions,
    passing_attempts = EXCLUDED.passing_attempts,
    passing_yards = EXCLUDED.passing_yards,
    passing_touchdowns = EXCLUDED.passing_touchdowns,
    interceptions_thrown = EXCLUDED.interceptions_thrown,
    rushing_attempts = EXCLUDED.rushing_attempts,
    rushing_yards = EXCLUDED.rushing_yards,
    rushing_touchdowns = EXCLUDED.rushing_touchdowns,
    total_yards = EXCLUDED.total_yards,
    first_downs = EXCLUDED.first_downs,
    third_down_conversions = EXCLUDED.third_down_conversions,
    points_allowed = EXCLUDED.points_allowed,
    yards_allowed = EXCLUDED.yards_allowed,
    passing_yards_allowed = EXCLUDED.passing_yards_allowed,
    rushing_yards_allowed = EXCLUDED.rushing_yards_allowed,
    sacks = EXCLUDED.sacks,
    interceptions = EXCLUDED.interceptions,
    forced_fumbles = EXCLUDED.forced_fumbles,
    takeaways = EXCLUDED.takeaways,
    turnovers = EXCLUDED.turnovers,
    turnover_differential = EXCLUDED.turnover_differential,
    point_differential = EXCLUDED.point_differential
"""


def normalize_team(value: Any) -> str:
    team = str(value or "").strip().upper()
    return TEAM_ALIASES.get(team, team)


def as_number(value: Any) -> float:
    if value in (None, ""):
        return 0.0

    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def ratio(
    numerator: float,
    denominator: float,
) -> float | None:
    if denominator == 0:
        return None

    return numerator / denominator


def regular_season_games(season: int) -> int:
    """
    Number of scheduled regular-season games per team.

    1970-1977: 14 games
    1978-1981: 16 games
    1982:       9 games because of the players' strike
    1983-1986: 16 games
    1987:      15 games because of the players' strike
    1988-1998: 16 games
    """
    if 1970 <= season <= 1977:
        return 14

    if 1978 <= season <= 1981:
        return 16

    if season == 1982:
        return 9

    if 1983 <= season <= 1986:
        return 16

    if season == 1987:
        return 15

    if 1988 <= season <= 1998:
        return 16

    raise ValueError(
        f"Historical importer does not support season {season}."
    )


def position_group(position: Any) -> str | None:
    if not position:
        return None

    pos = str(position).upper()

    if "QB" in pos:
        return "QB"

    if any(token in pos for token in ("RB", "FB", "HB")):
        return "RB"

    if "WR" in pos:
        return "WR"

    if "TE" in pos:
        return "TE"

    if pos == "K":
        return "K"

    if pos == "P":
        return "P"

    if any(token in pos for token in ("DB", "CB", "S")):
        return "DB"

    if "LB" in pos:
        return "LB"

    if any(token in pos for token in ("DE", "DT", "DL", "NT")):
        return "DL"

    if any(token in pos for token in ("T", "G", "C", "OL")):
        return "OL"

    return pos


def season_rows(
    all_games: list[dict[str, Any]],
    season: int,
) -> list[dict[str, Any]]:
    return [
        row
        for row in all_games
        if str(row.get("year")) == str(season)
    ]


def raw_game_key(
    row: dict[str, Any],
) -> tuple[str, str, str]:
    game_date = str(row["date"])

    team = normalize_team(
        row["team"]
    )

    opponent = normalize_team(
        row["opponent"]
    )

    team_a, team_b = sorted(
        (team, opponent)
    )

    return (
        game_date,
        team_a,
        team_b,
    )

def historical_game_id(
    row: dict[str, Any],
) -> str:
    game_date, team_a, team_b = (
        raw_game_key(row)
    )

    return (
        f"hist_{game_date}_"
        f"{team_a}_{team_b}"
    )

def group_playoff_dates(
    playoff_dates: list[str],
) -> list[list[str]]:
    """
    Convert individual Saturday/Sunday playoff dates into rounds.

    Example:

    [
        ["1997-12-27", "1997-12-28"],
        ["1998-01-03", "1998-01-04"],
        ["1998-01-11"],
        ["1998-01-25"],
    ]

    Each pair of adjacent dates is treated as one postseason round.
    """
    if not playoff_dates:
        return []

    parsed = [
        date.fromisoformat(value)
        for value in sorted(playoff_dates)
    ]

    rounds: list[list[date]] = []
    current_round = [parsed[0]]

    for current in parsed[1:]:
        previous = current_round[-1]

        if current - previous <= timedelta(days=2):
            current_round.append(current)
        else:
            rounds.append(current_round)
            current_round = [current]

    rounds.append(current_round)

    return [
        [
            value.isoformat()
            for value in round_dates
        ]
        for round_dates in rounds
    ]


def playoff_types_by_date(
    season: int,
    playoff_dates: list[str],
) -> dict[str, str]:
    rounds = group_playoff_dates(playoff_dates)

    # 1970-1977 had no Wild Card round.
    if len(rounds) == 3:
        round_types = [
            "DIV",
            "CON",
            "SB",
        ]

    # Most later seasons, including the special 1982 tournament,
    # contain four postseason rounds. For consistency with the
    # application's existing schema, we map them to:
    # WC -> DIV -> CON -> SB.
    elif len(rounds) == 4:
        round_types = [
            "WC",
            "DIV",
            "CON",
            "SB",
        ]

    else:
        raise ValueError(
            f"Unexpected postseason structure for {season}. "
            f"Found {len(rounds)} postseason rounds: {rounds}"
        )

    result: dict[str, str] = {}

    for round_dates, game_type in zip(
        rounds,
        round_types,
    ):
        for game_date in round_dates:
            result[game_date] = game_type

    return result


def build_game_metadata(
    rows: list[dict[str, Any]],
    season: int,
) -> dict[str, dict[str, Any]]:
    grouped: dict[
        str,
        list[dict[str, Any]],
    ] = defaultdict(list)

    for row in rows:
        grouped[
            historical_game_id(row)
        ].append(row)

    regular_game_limit = (
        regular_season_games(season)
    )

    playoff_ids: set[str] = set()

    for game_id, game_rows in grouped.items():
        if any(
            int(
                row.get("game_number") or 0
            ) > regular_game_limit
            for row in game_rows
        ):
            playoff_ids.add(game_id)

    playoff_dates = sorted(
        {
            str(
                grouped[game_id][0]["date"]
            )
            for game_id in playoff_ids
        }
    )

    game_type_by_date = (
        playoff_types_by_date(
            season,
            playoff_dates,
        )
    )

    result: dict[
        str,
        dict[str, Any],
    ] = {}

    for game_id, game_rows in grouped.items():
        sample = game_rows[0]

        game_date = str(
            sample["date"]
        )

        teams_in_game = {
            normalize_team(row["team"])
            for row in game_rows
        }

        if len(teams_in_game) != 2:
            raise ValueError(
                f"Game {game_id} does not "
                f"contain exactly two teams. "
                f"Found: "
                f"{sorted(teams_in_game)}"
            )

        team_a, team_b = sorted(
            teams_in_game
        )

        home_votes: dict[str, int] = (
            defaultdict(int)
        )

        neutral_votes = 0

        for row in game_rows:
            team = normalize_team(
                row["team"]
            )

            opponent = normalize_team(
                row["opponent"]
            )

            location = str(
                row.get(
                    "game_location"
                ) or ""
            ).upper()

            if location == "H":
                home_votes[team] += 1

            elif location == "A":
                home_votes[opponent] += 1

            elif location == "N":
                neutral_votes += 1

        # A true neutral-site game should have neutral
        # markings across the game records. Using a
        # majority protects against isolated bad rows.
        neutral = (
            neutral_votes
            > len(game_rows) / 2
        )

        if neutral:
            # Historical source does not identify a
            # meaningful home side for neutral games.
            away_team, home_team = sorted(
                (team_a, team_b)
            )

        else:
            if not home_votes:
                raise ValueError(
                    f"Could not determine "
                    f"home team for {game_id}."
                )

            home_team = max(
                home_votes,
                key=home_votes.get,
            )

            away_team = (
                team_b
                if home_team == team_a
                else team_a
            )

        # Collect all reported score pairs and choose
        # the most common one. Some source rows contain
        # isolated incorrect scores.
        score_votes: dict[
            tuple[int, int],
            int,
        ] = defaultdict(int)

        for row in game_rows:
            row_team = normalize_team(
                row["team"]
            )

            row_score = int(
                as_number(
                    row.get(
                        "player_team_score"
                    )
                )
            )

            opponent_score = int(
                as_number(
                    row.get(
                        "opponent_score"
                    )
                )
            )

            if row_team == home_team:
                score_pair = (
                    row_score,
                    opponent_score,
                )
            else:
                score_pair = (
                    opponent_score,
                    row_score,
                )

            score_votes[
                score_pair
            ] += 1

        if not score_votes:
            raise ValueError(
                f"Could not determine score "
                f"for {game_id}."
            )

        (
            home_score,
            away_score,
        ) = max(
            score_votes,
            key=score_votes.get,
        )

        is_playoff = (
            game_id in playoff_ids
        )

        if is_playoff:
            game_type = (
                game_type_by_date.get(
                    game_date
                )
            )

            if game_type is None:
                raise ValueError(
                    f"Could not classify "
                    f"playoff game {game_id}."
                )

            season_type = "Playoffs"

        else:
            game_type = "REG"
            season_type = (
                "Regular Season"
            )

        result[game_id] = {
            "game_id": game_id,
            "season": season,
            "week": None,

            "game_date": (
                date.fromisoformat(
                    game_date
                )
            ),

            "season_type": season_type,
            "game_type": game_type,

            "home_team": home_team,
            "away_team": away_team,

            "home_score": home_score,
            "away_score": away_score,

            "neutral_site": neutral,
            "overtime": None,

            "source": (
                "kaggle-zynicide-historical"
            ),
        }

    return result

def build_player_rows(
    rows: list[dict[str, Any]],
    profiles: dict[int, dict[str, Any]],
) -> list[dict[str, Any]]:
    output: list[
        dict[str, Any]
    ] = []

    for row in rows:
        raw_player_id = int(
            row["player_id"]
        )

        profile = profiles.get(
            raw_player_id,
            {},
        )

        player_name = str(
            profile.get("name") or ""
        ).strip()

        if not player_name:
            player_name = (
                f"Historical Player "
                f"{raw_player_id}"
            )

        position = profile.get(
            "position"
        )

        # IMPORTANT:
        # The source labels passing attempts/completions
        # backwards. This reversal was validated against
        # real 1998 quarterback game lines.
        completions = as_number(
            row.get(
                "passing_attempts"
            )
        )

        passing_attempts = as_number(
            row.get(
                "passing_completions"
            )
        )

        passing_yards = as_number(
            row.get("passing_yards")
        )

        passing_touchdowns = as_number(
            row.get(
                "passing_touchdowns"
            )
        )

        passing_interceptions = as_number(
            row.get(
                "passing_interceptions"
            )
        )

        sacks_taken = as_number(
            row.get("passing_sacks")
        )

        passer_rating = as_number(
            row.get("passing_rating")
        )

        rushing_attempts = as_number(
            row.get(
                "rushing_attempts"
            )
        )

        rushing_yards = as_number(
            row.get("rushing_yards")
        )

        rushing_touchdowns = as_number(
            row.get(
                "rushing_touchdowns"
            )
        )

        targets = as_number(
            row.get(
                "receiving_targets"
            )
        )

        receptions = as_number(
            row.get(
                "receiving_receptions"
            )
        )

        receiving_yards = as_number(
            row.get(
                "receiving_yards"
            )
        )

        receiving_touchdowns = as_number(
            row.get(
                "receiving_touchdowns"
            )
        )

        tackles = as_number(
            row.get(
                "defense_tackles"
            )
        )

        assisted_tackles = as_number(
            row.get(
                "defense_tackle_assists"
            )
        )

        sacks = as_number(
            row.get(
                "defense_sacks"
            )
        )

        defensive_interceptions = as_number(
            row.get(
                "defense_interceptions"
            )
        )

        defensive_touchdowns = as_number(
            row.get(
                "defense_interception_touchdowns"
            )
        )

        field_goals_made = as_number(
            row.get(
                "field_goal_makes"
            )
        )

        field_goals_attempted = as_number(
            row.get(
                "field_goal_attempts"
            )
        )

        extra_points_made = as_number(
            row.get(
                "point_after_makes"
            )
        )

        # The source itself misspells "attempts".
        extra_points_attempted = as_number(
            row.get(
                "point_after_attemps"
            )
        )

        output.append(
            {
                "game_id": (
                    historical_game_id(row)
                ),

                "player_id": (
                    f"hist:{raw_player_id}"
                ),

                "player_name": player_name,

                "team": normalize_team(
                    row["team"]
                ),

                "opponent": normalize_team(
                    row["opponent"]
                ),

                "position": position,

                "position_group": (
                    position_group(position)
                ),

                "completions": completions,

                "passing_attempts": (
                    passing_attempts
                ),

                "passing_yards": (
                    passing_yards
                ),

                "passing_touchdowns": (
                    passing_touchdowns
                ),

                "passing_interceptions": (
                    passing_interceptions
                ),

                "sacks_taken": sacks_taken,

                "passer_rating": (
                    passer_rating
                ),

                "completion_percentage": (
                    ratio(
                        completions * 100.0,
                        passing_attempts,
                    )
                    if passing_attempts > 0
                    else None
                ),

                "rushing_attempts": (
                    rushing_attempts
                ),

                "rushing_yards": (
                    rushing_yards
                ),

                "rushing_touchdowns": (
                    rushing_touchdowns
                ),

                "yards_per_carry": (
                    ratio(
                        rushing_yards,
                        rushing_attempts,
                    )
                    if rushing_attempts > 0
                    else None
                ),

                "targets": targets,
                "receptions": receptions,

                "receiving_yards": (
                    receiving_yards
                ),

                "receiving_touchdowns": (
                    receiving_touchdowns
                ),

                "yards_per_reception": (
                    ratio(
                        receiving_yards,
                        receptions,
                    )
                    if receptions > 0
                    else None
                ),

                # This source does not establish that
                # defense_tackles means solo tackles.
                "tackles": tackles,
                "solo_tackles": None,

                "assisted_tackles": (
                    assisted_tackles
                ),

                "sacks": sacks,

                "defensive_interceptions": (
                    defensive_interceptions
                ),

                # Not reliably present in this source.
                "forced_fumbles": None,
                "fumble_recoveries": None,

                "defensive_touchdowns": (
                    defensive_touchdowns
                ),

                "field_goals_made": (
                    field_goals_made
                ),

                "field_goals_attempted": (
                    field_goals_attempted
                ),

                "longest_field_goal": None,

                "extra_points_made": (
                    extra_points_made
                ),

                "extra_points_attempted": (
                    extra_points_attempted
                ),
            }
        )

    return output


def build_team_rows(
    raw_rows: list[dict[str, Any]],
    games: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    grouped: dict[
        tuple[str, str],
        list[dict[str, Any]],
    ] = defaultdict(list)

    for row in raw_rows:
        game_id = historical_game_id(
            row
        )

        team = normalize_team(
            row["team"]
        )

        grouped[
            (game_id, team)
        ].append(row)

    output: list[
        dict[str, Any]
    ] = []

    for (
        game_id,
        team,
    ), rows in grouped.items():
        sample = rows[0]

        opponent = normalize_team(
            sample["opponent"]
        )

        points = int(
            as_number(
                sample.get(
                    "player_team_score"
                )
            )
        )

        points_allowed = int(
            as_number(
                sample.get(
                    "opponent_score"
                )
            )
        )

        # Passing labels are reversed
        # in the source.
        completions = sum(
            as_number(
                row.get(
                    "passing_attempts"
                )
            )
            for row in rows
        )

        passing_attempts = sum(
            as_number(
                row.get(
                    "passing_completions"
                )
            )
            for row in rows
        )

        passing_yards = sum(
            as_number(
                row.get(
                    "passing_yards"
                )
            )
            for row in rows
        )

        passing_touchdowns = sum(
            as_number(
                row.get(
                    "passing_touchdowns"
                )
            )
            for row in rows
        )

        interceptions_thrown = sum(
            as_number(
                row.get(
                    "passing_interceptions"
                )
            )
            for row in rows
        )

        rushing_attempts = sum(
            as_number(
                row.get(
                    "rushing_attempts"
                )
            )
            for row in rows
        )

        rushing_yards = sum(
            as_number(
                row.get(
                    "rushing_yards"
                )
            )
            for row in rows
        )

        rushing_touchdowns = sum(
            as_number(
                row.get(
                    "rushing_touchdowns"
                )
            )
            for row in rows
        )

        field_goals = sum(
            as_number(
                row.get(
                    "field_goal_makes"
                )
            )
            for row in rows
        )

        sacks = sum(
            as_number(
                row.get(
                    "defense_sacks"
                )
            )
            for row in rows
        )

        interceptions = sum(
            as_number(
                row.get(
                    "defense_interceptions"
                )
            )
            for row in rows
        )

        output.append(
            {
                "game_id": game_id,
                "team": team,
                "opponent": opponent,

                "points": points,

                # Cannot reliably reconstruct
                # every historical TD type.
                "touchdowns": None,

                "field_goals": field_goals,

                "completions": completions,

                "passing_attempts": (
                    passing_attempts
                ),

                "passing_yards": (
                    passing_yards
                ),

                "passing_touchdowns": (
                    passing_touchdowns
                ),

                "interceptions_thrown": (
                    interceptions_thrown
                ),

                "rushing_attempts": (
                    rushing_attempts
                ),

                "rushing_yards": (
                    rushing_yards
                ),

                "rushing_touchdowns": (
                    rushing_touchdowns
                ),

                # Official team passing offense
                # includes sack yardage. Do not
                # fake total offense here.
                "total_yards": None,

                "first_downs": None,

                "third_down_conversions": None,

                "points_allowed": (
                    points_allowed
                ),

                "yards_allowed": None,

                "passing_yards_allowed": None,

                "rushing_yards_allowed": None,

                "sacks": sacks,

                "interceptions": interceptions,

                "forced_fumbles": None,
                "takeaways": None,
                "turnovers": None,
                "turnover_differential": None,

                "point_differential": (
                    points - points_allowed
                ),
            }
        )

    expected = len(games) * 2

    if len(output) != expected:
        raise ValueError(
            f"Expected {expected} "
            f"team-game rows but "
            f"built {len(output)}."
        )

    return output


def validate_season(
    season: int,
    raw_rows: list[dict[str, Any]],
    games: dict[str, dict[str, Any]],
    player_rows: list[dict[str, Any]],
    team_rows: list[dict[str, Any]],
) -> None:
    if not raw_rows:
        raise ValueError(
            f"No historical rows found "
            f"for {season}."
        )

    if not games:
        raise ValueError(
            f"No games reconstructed "
            f"for {season}."
        )

    if len(player_rows) != len(raw_rows):
        raise ValueError(
            f"Player-row mismatch for {season}. "
            f"Raw rows: {len(raw_rows):,}; "
            f"built rows: {len(player_rows):,}."
        )

    expected_team_rows = (
        len(games) * 2
    )

    if len(team_rows) != expected_team_rows:
        raise ValueError(
            f"Team-row mismatch for {season}. "
            f"Expected {expected_team_rows:,}; "
            f"found {len(team_rows):,}."
        )

    regular_games = [
        game
        for game in games.values()
        if (
            game["season_type"]
            == "Regular Season"
        )
    ]

    playoff_games = [
        game
        for game in games.values()
        if (
            game["season_type"]
            == "Playoffs"
        )
    ]

    if not regular_games:
        raise ValueError(
            f"No regular-season games "
            f"found for {season}."
        )

    if not playoff_games:
        raise ValueError(
            f"No playoff games found "
            f"for {season}."
        )

    impossible_passers = [
        row
        for row in player_rows
        if (
            row["completions"]
            is not None
            and row["passing_attempts"]
            is not None
            and row["completions"]
            > row["passing_attempts"]
        )
    ]

    if impossible_passers:
        sample = impossible_passers[0]

        raise ValueError(
            f"Passing validation failed "
            f"for {season}. "
            f"Example: "
            f"{sample['player_name']} "
            f"{sample['completions']}/"
            f"{sample['passing_attempts']}"
        )

    team_rows_by_game: dict[
        str,
        list[dict[str, Any]],
    ] = defaultdict(list)

    for row in team_rows:
        team_rows_by_game[
            row["game_id"]
        ].append(row)

    for game_id, rows in team_rows_by_game.items():
        if len(rows) != 2:
            raise ValueError(
                f"Game {game_id} has "
                f"{len(rows)} team rows "
                f"instead of 2."
            )

        first, second = rows

        if (
            first["team"]
            != second["opponent"]
            or second["team"]
            != first["opponent"]
        ):
            raise ValueError(
                f"Opponent mismatch "
                f"in game {game_id}."
            )

        if (
            first["points"]
            != second["points_allowed"]
            or second["points"]
            != first["points_allowed"]
        ):
            raise ValueError(
                f"Score mismatch "
                f"in game {game_id}."
            )

    print(
        f"  {season}: "
        f"{len(games):,} games | "
        f"{len(regular_games):,} regular | "
        f"{len(playoff_games):,} playoffs | "
        f"{len(player_rows):,} player rows | "
        f"{len(team_rows):,} team rows"
    )


def ingest(
    seasons: list[int],
    games_path: Path,
    profiles_path: Path,
) -> None:
    if not games_path.exists():
        raise FileNotFoundError(
            f"Historical games file "
            f"not found: {games_path}"
        )

    if not profiles_path.exists():
        raise FileNotFoundError(
            f"Historical profiles file "
            f"not found: {profiles_path}"
        )

    for season in seasons:
        if not 1970 <= season <= 1998:
            raise ValueError(
                "This importer currently "
                "supports 1970 through 1998."
            )

    print(
        "Loading historical "
        "player profiles ..."
    )

    with profiles_path.open() as f:
        raw_profiles = json.load(f)

    profiles = {
        int(profile["player_id"]): profile
        for profile in raw_profiles
    }

    print(
        f"Loaded {len(profiles):,} profiles."
    )

    print(
        "Loading historical "
        "player-game dataset ..."
    )

    with games_path.open() as f:
        all_games = json.load(f)

    print(
        f"Loaded {len(all_games):,} "
        f"raw records."
    )

    print()
    print(
        "Validating and writing seasons:"
    )

    total_games = 0
    total_player_rows = 0
    total_team_rows = 0

    # One transaction for the entire requested range.
    # If any season fails validation or insertion,
    # PostgreSQL rolls the entire run back.
    with psycopg.connect(
        DATABASE_URL
    ) as conn:
        with conn.cursor() as cur:
            for season in seasons:
                rows = season_rows(
                    all_games,
                    season,
                )

                games = build_game_metadata(
                    rows,
                    season,
                )

                player_rows = build_player_rows(
                    rows,
                    profiles,
                )

                team_rows = build_team_rows(
                    rows,
                    games,
                )

                validate_season(
                    season,
                    rows,
                    games,
                    player_rows,
                    team_rows,
                )

                cur.executemany(
                    GAME_SQL,
                    list(
                        games.values()
                    ),
                )

                cur.executemany(
                    PLAYER_SQL,
                    player_rows,
                )

                cur.executemany(
                    TEAM_SQL,
                    team_rows,
                )

                total_games += len(
                    games
                )

                total_player_rows += len(
                    player_rows
                )

                total_team_rows += len(
                    team_rows
                )

        conn.commit()

    print()
    print(
        "Historical NFL ingestion complete."
    )

    print(
        f"  Seasons:          "
        f"{seasons[0]}-{seasons[-1]}"
    )

    print(
        f"  Games written:    "
        f"{total_games:,}"
    )

    print(
        f"  Player-game rows: "
        f"{total_player_rows:,}"
    )

    print(
        f"  Team-game rows:   "
        f"{total_team_rows:,}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Import historical NFL "
            "player/game data from "
            "1970 through 1998."
        )
    )

    group = parser.add_mutually_exclusive_group()

    group.add_argument(
        "--season",
        type=int,
        help=(
            "Import one NFL season, "
            "for example --season 1998."
        ),
    )

    group.add_argument(
        "--all",
        action="store_true",
        help=(
            "Import every supported "
            "historical season "
            "from 1970 through 1998."
        ),
    )

    parser.add_argument(
        "--start",
        type=int,
        help=(
            "First season in a range."
        ),
    )

    parser.add_argument(
        "--end",
        type=int,
        help=(
            "Last season in a range."
        ),
    )

    parser.add_argument(
        "--games-file",
        type=Path,
        default=DEFAULT_GAMES_PATH,
    )

    parser.add_argument(
        "--profiles-file",
        type=Path,
        default=DEFAULT_PROFILES_PATH,
    )

    return parser.parse_args()


def requested_seasons(
    args: argparse.Namespace,
) -> list[int]:
    if args.season is not None:
        if (
            args.start is not None
            or args.end is not None
        ):
            raise ValueError(
                "Do not combine --season "
                "with --start or --end."
            )

        return [args.season]

    if args.all:
        if (
            args.start is not None
            or args.end is not None
        ):
            raise ValueError(
                "Do not combine --all "
                "with --start or --end."
            )

        return list(
            range(
                1970,
                1999,
            )
        )

    if (
        args.start is not None
        or args.end is not None
    ):
        if (
            args.start is None
            or args.end is None
        ):
            raise ValueError(
                "Both --start and --end "
                "are required for a range."
            )

        if args.start > args.end:
            raise ValueError(
                "--start cannot be "
                "greater than --end."
            )

        return list(
            range(
                args.start,
                args.end + 1,
            )
        )

    raise ValueError(
        "Choose --season YEAR, "
        "--start YEAR --end YEAR, "
        "or --all."
    )


if __name__ == "__main__":
    args = parse_args()

    seasons = requested_seasons(
        args
    )

    ingest(
        seasons=seasons,
        games_path=args.games_file,
        profiles_path=args.profiles_file,
    )