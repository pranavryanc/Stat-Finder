import os

import nflreadpy as nfl
import psycopg


DB = os.environ.get(
    "DATABASE_URL",
    "postgresql://localhost/stat_finder",
)

TEAM_ALIASES = {
    "JAC": "JAX",
    "WSH": "WAS",
    "SD": "LAC",
    "STL": "LA",
    "OAK": "LV",
}

GAP_GAMES = [
    "2001_01_PIT_JAX",
    "2001_02_TEN_JAX",
    "2001_03_CLE_JAX",
    "2001_06_BUF_JAX",
    "2001_09_CIN_JAX",
    "2001_11_BAL_JAX",
    "2001_12_GB_JAX",
    "2001_16_KC_JAX",
    "2002_01_IND_JAX",
    "2002_04_NYJ_JAX",
    "2002_05_PHI_JAX",
    "2002_08_HOU_JAX",
    "2002_10_WAS_JAX",
    "2002_13_PIT_JAX",
    "2002_14_CLE_JAX",
    "2002_16_TEN_JAX",
]

STATIC_GAP_GAMES = [
    "1999_01_BAL_STL",
    "2000_03_SD_KC",
    "2000_06_BUF_MIA",
]

ALL_GAP_GAMES = STATIC_GAP_GAMES + GAP_GAMES

STATIC_ROWS = [
    # 1999 Week 1: Baltimore Ravens at St. Louis Rams
    (
        "1999_01_BAL_STL",
        "BAL",
        "LA",
        10,
        1,
        1,
        17,
        40,
        188,
        1,
        2,
        15,
        60,
        0,
        223,
        13,
        None,
        27,
        343,
        309,
        59,
        3,
        2,
        None,
        3,
        2,
        -1,
        -17,
    ),
    (
        "1999_01_BAL_STL",
        "LA",
        "BAL",
        27,
        3,
        2,
        28,
        44,
        309,
        3,
        2,
        25,
        59,
        0,
        343,
        19,
        None,
        10,
        223,
        188,
        60,
        5,
        2,
        None,
        2,
        3,
        1,
        17,
    ),

    # 2000 Week 3: San Diego Chargers at Kansas City Chiefs
    (
        "2000_03_SD_KC",
        "LAC",
        "KC",
        10,
        1,
        1,
        17,
        35,
        169,
        0,
        1,
        14,
        49,
        0,
        187,
        10,
        None,
        42,
        349,
        235,
        117,
        2,
        1,
        None,
        1,
        2,
        1,
        -32,
    ),
    (
        "2000_03_SD_KC",
        "KC",
        "LAC",
        42,
        6,
        0,
        20,
        33,
        235,
        5,
        1,
        34,
        117,
        1,
        349,
        20,
        None,
        10,
        187,
        169,
        49,
        6,
        1,
        None,
        2,
        1,
        -1,
        32,
    ),

    # 2000 Week 6: Buffalo Bills at Miami Dolphins
    (
        "2000_06_BUF_MIA",
        "BUF",
        "MIA",
        13,
        1,
        2,
        14,
        32,
        222,
        0,
        1,
        21,
        76,
        1,
        254,
        13,
        None,
        22,
        254,
        142,
        120,
        1,
        1,
        None,
        1,
        2,
        1,
        -9,
    ),
    (
        "2000_06_BUF_MIA",
        "MIA",
        "BUF",
        22,
        2,
        2,
        14,
        24,
        142,
        1,
        1,
        37,
        120,
        0,
        254,
        13,
        None,
        13,
        254,
        222,
        76,
        6,
        1,
        None,
        2,
        1,
        -1,
        9,
    ),
]


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
    %s, %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s, %s
)
ON CONFLICT (game_id, team) DO UPDATE SET
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


def normalize_team(team):
    if team is None:
        return None

    value = str(team).strip()
    return TEAM_ALIASES.get(value, value)


def number(value):
    if value is None:
        return 0.0

    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def indicator(row, key):
    return number(row.get(key))


def team_rows(rows, team, field):
    return [
        row
        for row in rows
        if normalize_team(row.get(field)) == team
    ]


def aggregate_game(rows, team, opponent):
    offense = team_rows(rows, team, "posteam")
    defense = team_rows(rows, team, "defteam")

    raw_pass_attempts = sum(
        indicator(row, "pass_attempt")
        for row in offense
    )

    sacks_taken = sum(
        indicator(row, "sack")
        for row in offense
    )

    passing_attempts = raw_pass_attempts - sacks_taken

    completions = sum(
        indicator(row, "complete_pass")
        for row in offense
    )

    passing_yards = sum(
        indicator(row, "passing_yards")
        for row in offense
    )

    passing_touchdowns = sum(
        indicator(row, "pass_touchdown")
        for row in offense
    )

    interceptions_thrown = sum(
        indicator(row, "interception")
        for row in offense
    )

    rushing_rows = [
        row
        for row in offense
        if "official measurement"
        not in str(row.get("desc") or "").lower()
    ]

    rushing_attempts = sum(
        indicator(row, "rush_attempt")
        for row in rushing_rows
    )

    rushing_yards = sum(
        indicator(row, "rushing_yards")
        for row in rushing_rows
    )

    rushing_touchdowns = sum(
        indicator(row, "rush_touchdown")
        for row in offense
    )

    sack_yards = sum(
        indicator(row, "yards_gained")
        for row in offense
        if indicator(row, "sack") == 1
    )

    net_passing_yards = passing_yards + sack_yards
    total_yards = net_passing_yards + rushing_yards

    first_downs = sum(
        indicator(row, "first_down_pass")
        + indicator(row, "first_down_rush")
        for row in offense
    )

    third_down_conversions = None

    field_goals = sum(
        1
        for row in offense
        if str(row.get("field_goal_result") or "").lower() == "made"
    )

    defensive_sacks = sum(
        indicator(row, "sack")
        for row in defense
    )

    defensive_interceptions = sum(
        indicator(row, "interception")
        for row in defense
    )

    fumbles_lost = sum(
        indicator(row, "fumble_lost")
        for row in offense
    )

    opponent_fumbles_lost = sum(
        indicator(row, "fumble_lost")
        for row in defense
    )

    turnovers = interceptions_thrown + fumbles_lost
    takeaways = defensive_interceptions + opponent_fumbles_lost

    forced_fumbles = None

    touchdowns = 0

    for row in rows:
        if indicator(row, "touchdown") != 1:
            continue

        posteam = normalize_team(row.get("posteam"))
        defteam = normalize_team(row.get("defteam"))

        if (
            indicator(row, "pass_touchdown") == 1
            or indicator(row, "rush_touchdown") == 1
        ):
            scoring_team = posteam
        elif indicator(row, "return_touchdown") == 1:
            scoring_team = defteam
        else:
            scoring_team = None

        if scoring_team == team:
            touchdowns += 1

    return {
        "team": team,
        "opponent": opponent,
        "touchdowns": touchdowns,
        "field_goals": field_goals,
        "completions": completions,
        "passing_attempts": passing_attempts,
        "passing_yards": passing_yards,
        "passing_touchdowns": passing_touchdowns,
        "interceptions_thrown": interceptions_thrown,
        "rushing_attempts": rushing_attempts,
        "rushing_yards": rushing_yards,
        "rushing_touchdowns": rushing_touchdowns,
        "total_yards": total_yards,
        "first_downs": first_downs,
        "third_down_conversions": third_down_conversions,
        "sacks": defensive_sacks,
        "interceptions": defensive_interceptions,
        "forced_fumbles": forced_fumbles,
        "takeaways": takeaways,
        "turnovers": turnovers,
    }


def as_db_number(value):
    if value is None:
        return None

    value = float(value)

    if value.is_integer():
        return int(value)

    return value


def main():
    print("Loading nflverse PBP for 2001 and 2002...")

    pbp_by_season = {
        2001: nfl.load_pbp([2001]),
        2002: nfl.load_pbp([2002]),
    }

    repaired_rows = []

    with psycopg.connect(DB) as conn:
        for game_id in GAP_GAMES:
            season = int(game_id[:4])

            game = conn.execute(
                """
                SELECT
                    home_team,
                    away_team,
                    home_score,
                    away_score
                FROM nfl_games
                WHERE game_id = %s
                """,
                (game_id,),
            ).fetchone()

            if game is None:
                raise RuntimeError(
                    f"{game_id}: game not found in nfl_games"
                )

            home, away, home_score, away_score = game
            home = normalize_team(home)
            away = normalize_team(away)

            pbp = pbp_by_season[season]
            game_pbp = pbp.filter(
                pbp["game_id"] == game_id
            )

            if game_pbp.height == 0:
                raise RuntimeError(
                    f"{game_id}: no nflverse PBP found"
                )

            rows = game_pbp.to_dicts()

            home_stats = aggregate_game(
                rows,
                home,
                away,
            )

            away_stats = aggregate_game(
                rows,
                away,
                home,
            )

            home_stats["points"] = home_score
            home_stats["points_allowed"] = away_score

            away_stats["points"] = away_score
            away_stats["points_allowed"] = home_score

            home_stats["yards_allowed"] = away_stats["total_yards"]
            home_stats["passing_yards_allowed"] = away_stats["passing_yards"]
            home_stats["rushing_yards_allowed"] = away_stats["rushing_yards"]

            away_stats["yards_allowed"] = home_stats["total_yards"]
            away_stats["passing_yards_allowed"] = home_stats["passing_yards"]
            away_stats["rushing_yards_allowed"] = home_stats["rushing_yards"]

            home_stats["turnover_differential"] = (
                home_stats["turnovers"]
                - away_stats["turnovers"]
            )

            away_stats["turnover_differential"] = (
                away_stats["turnovers"]
                - home_stats["turnovers"]
            )

            home_stats["point_differential"] = (
                home_score - away_score
            )

            away_stats["point_differential"] = (
                away_score - home_score
            )

            for stats in [home_stats, away_stats]:
                repaired_rows.append((
                    game_id,
                    stats["team"],
                    stats["opponent"],
                    stats["points"],
                    stats["touchdowns"],
                    stats["field_goals"],
                    stats["completions"],
                    stats["passing_attempts"],
                    stats["passing_yards"],
                    stats["passing_touchdowns"],
                    stats["interceptions_thrown"],
                    stats["rushing_attempts"],
                    stats["rushing_yards"],
                    stats["rushing_touchdowns"],
                    stats["total_yards"],
                    stats["first_downs"],
                    stats["third_down_conversions"],
                    stats["points_allowed"],
                    stats["yards_allowed"],
                    stats["passing_yards_allowed"],
                    stats["rushing_yards_allowed"],
                    stats["sacks"],
                    stats["interceptions"],
                    stats["forced_fumbles"],
                    stats["takeaways"],
                    stats["turnovers"],
                    stats["turnover_differential"],
                    stats["point_differential"],
                ))

            print(
                f"{game_id}: "
                f"{away} {away_stats['points']} - "
                f"{home} {home_stats['points']} "
                f"[{away_stats['total_yards']} / "
                f"{home_stats['total_yards']} yards]"
            )

        repaired_rows.extend(STATIC_ROWS)

        print()
        print(
            f"Added {len(STATIC_ROWS)} audited static "
            "team-game rows."
        )

        repaired_rows = [
            tuple(
                as_db_number(value)
                if isinstance(value, float)
                else value
                for value in row
            )
            for row in repaired_rows
        ]

        if len(repaired_rows) != 38:
            raise RuntimeError(
                f"Expected 38 repaired rows, got {len(repaired_rows)}"
            )

        with conn.cursor() as cur:
            cur.executemany(
                TEAM_SQL,
                repaired_rows,
            )

        conn.commit()

        print()
        print(f"Upserted {len(repaired_rows)} team-game rows.")

        invalid = conn.execute(
            """
            SELECT
                g.game_id,
                COUNT(t.team)
            FROM nfl_games g
            LEFT JOIN nfl_team_games t
                ON t.game_id = g.game_id
            WHERE g.game_id = ANY(%s)
            GROUP BY g.game_id
            HAVING COUNT(t.team) <> 2
            ORDER BY g.game_id
            """,
            (ALL_GAP_GAMES,),
        ).fetchall()

        if invalid:
            raise RuntimeError(
                f"Games without exactly two team rows: {invalid}"
            )

        print(
            "All 19 repaired games now have exactly two team rows."
        )
        print("NFL team-gap repair complete.")


if __name__ == "__main__":
    main()