#!/usr/bin/env python3
"""Load nflverse NFL schedules, player weekly stats, and team weekly stats into PostgreSQL.

Examples:
  python3 scripts/ingest_nfl.py --season 2025
  python3 scripts/ingest_nfl.py --start 1999 --end 2025

The script is idempotent: reruns UPSERT existing rows.
It downloads season-level nflverse assets rather than one request per game.
"""
import argparse
import math
import os
import time
from datetime import datetime

import nflreadpy as nfl
import psycopg

DB = os.getenv('DATABASE_URL', 'postgresql://localhost/stat_finder')

TEAM_ALIASES = {
    'JAC': 'JAX',
    'WSH': 'WAS',
    'SD': 'LAC',
    'STL': 'LA',
    'OAK': 'LV',
}

def normalize_team(team):
    if not team:
        return team
    value = str(team).strip()
    return TEAM_ALIASES.get(value, value)


def clean(v):
    if v is None:
        return None
    try:
        if isinstance(v, float) and math.isnan(v):
            return None
    except Exception:
        pass
    return v


def n(row, *keys):
    for key in keys:
        v = clean(row.get(key))
        if v is not None:
            try:
                return float(v)
            except Exception:
                pass
    return None


def s(row, *keys):
    for key in keys:
        v = clean(row.get(key))
        if v is not None and str(v).strip():
            return str(v).strip()
    return None


def records(frame):
    return frame.to_dicts()


def retry(label, fn, attempts=4):
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:
            last_error = exc
            if attempt == attempts:
                break
            wait = 3 * attempt
            print(f'  {label} retry {attempt}/{attempts - 1}: {exc}')
            print(f'  waiting {wait}s...')
            time.sleep(wait)
    raise RuntimeError(f'{label} failed after {attempts} attempts: {last_error}')


def load_player_week(season):
    # nflreadpy 0.1.x defaults to weekly player stats. Keep a compatibility
    # fallback for versions that expose the nflreadr-style summary_level arg.
    try:
        return nfl.load_player_stats([season], summary_level='week')
    except TypeError:
        return nfl.load_player_stats([season])


def load_team_week(season):
    try:
        return nfl.load_team_stats([season], summary_level='week')
    except TypeError:
        return nfl.load_team_stats([season])


def calc_passer_rating(cmp, att, yds, td, ints):
    if not att or att <= 0:
        return None
    a = max(0, min(2.375, ((cmp / att) - .3) * 5))
    b = max(0, min(2.375, ((yds / att) - 3) * .25))
    c = max(0, min(2.375, (td / att) * 20))
    d = max(0, min(2.375, 2.375 - ((ints / att) * 25)))
    return round(((a + b + c + d) / 6) * 100, 2)


def season_stage(game_type):
    return 'Regular Season' if str(game_type).upper() == 'REG' else 'Playoffs'


def default_end_season():
    now = datetime.now()
    # Before the NFL regular season starts, the most recently completed season
    # is the prior calendar year. From September onward, allow the current year.
    return now.year if now.month >= 9 else now.year - 1


GAME_SQL = '''
INSERT INTO nfl_games(
    game_id,season,week,game_date,season_type,game_type,
    home_team,away_team,home_score,away_score,neutral_site,overtime
)
VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
ON CONFLICT(game_id) DO UPDATE SET
    season=EXCLUDED.season,
    week=EXCLUDED.week,
    game_date=EXCLUDED.game_date,
    season_type=EXCLUDED.season_type,
    game_type=EXCLUDED.game_type,
    home_team=EXCLUDED.home_team,
    away_team=EXCLUDED.away_team,
    home_score=EXCLUDED.home_score,
    away_score=EXCLUDED.away_score,
    neutral_site=EXCLUDED.neutral_site,
    overtime=EXCLUDED.overtime
'''

PLAYER_SQL = '''
INSERT INTO nfl_player_games(
    game_id,player_id,player_name,team,opponent,position,position_group,
    completions,passing_attempts,passing_yards,passing_touchdowns,
    passing_interceptions,sacks_taken,passer_rating,completion_percentage,
    rushing_attempts,rushing_yards,rushing_touchdowns,yards_per_carry,
    targets,receptions,receiving_yards,receiving_touchdowns,yards_per_reception,
    tackles,solo_tackles,assisted_tackles,sacks,defensive_interceptions,
    forced_fumbles,fumble_recoveries,defensive_touchdowns,
    field_goals_made,field_goals_attempted,longest_field_goal,extra_points_made,extra_points_attempted
)
VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
ON CONFLICT(game_id,player_id) DO UPDATE SET
    player_name=EXCLUDED.player_name,
    team=EXCLUDED.team,
    opponent=EXCLUDED.opponent,
    position=EXCLUDED.position,
    position_group=EXCLUDED.position_group,
    completions=EXCLUDED.completions,
    passing_attempts=EXCLUDED.passing_attempts,
    passing_yards=EXCLUDED.passing_yards,
    passing_touchdowns=EXCLUDED.passing_touchdowns,
    passing_interceptions=EXCLUDED.passing_interceptions,
    sacks_taken=EXCLUDED.sacks_taken,
    passer_rating=EXCLUDED.passer_rating,
    completion_percentage=EXCLUDED.completion_percentage,
    rushing_attempts=EXCLUDED.rushing_attempts,
    rushing_yards=EXCLUDED.rushing_yards,
    rushing_touchdowns=EXCLUDED.rushing_touchdowns,
    yards_per_carry=EXCLUDED.yards_per_carry,
    targets=EXCLUDED.targets,
    receptions=EXCLUDED.receptions,
    receiving_yards=EXCLUDED.receiving_yards,
    receiving_touchdowns=EXCLUDED.receiving_touchdowns,
    yards_per_reception=EXCLUDED.yards_per_reception,
    tackles=EXCLUDED.tackles,
    solo_tackles=EXCLUDED.solo_tackles,
    assisted_tackles=EXCLUDED.assisted_tackles,
    sacks=EXCLUDED.sacks,
    defensive_interceptions=EXCLUDED.defensive_interceptions,
    forced_fumbles=EXCLUDED.forced_fumbles,
    fumble_recoveries=EXCLUDED.fumble_recoveries,
    defensive_touchdowns=EXCLUDED.defensive_touchdowns,
    field_goals_made=EXCLUDED.field_goals_made,
    field_goals_attempted=EXCLUDED.field_goals_attempted,
    longest_field_goal=EXCLUDED.longest_field_goal,
    extra_points_made=EXCLUDED.extra_points_made,
    extra_points_attempted=EXCLUDED.extra_points_attempted
'''

TEAM_SQL = '''
INSERT INTO nfl_team_games(
    game_id,team,opponent,points,touchdowns,field_goals,completions,
    passing_attempts,passing_yards,passing_touchdowns,interceptions_thrown,
    rushing_attempts,rushing_yards,rushing_touchdowns,total_yards,first_downs,
    third_down_conversions,points_allowed,yards_allowed,passing_yards_allowed,
    rushing_yards_allowed,sacks,interceptions,forced_fumbles,takeaways,
    turnovers,turnover_differential,point_differential
)
VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
ON CONFLICT(game_id,team) DO UPDATE SET
    opponent=EXCLUDED.opponent,
    points=EXCLUDED.points,
    touchdowns=EXCLUDED.touchdowns,
    field_goals=EXCLUDED.field_goals,
    completions=EXCLUDED.completions,
    passing_attempts=EXCLUDED.passing_attempts,
    passing_yards=EXCLUDED.passing_yards,
    passing_touchdowns=EXCLUDED.passing_touchdowns,
    interceptions_thrown=EXCLUDED.interceptions_thrown,
    rushing_attempts=EXCLUDED.rushing_attempts,
    rushing_yards=EXCLUDED.rushing_yards,
    rushing_touchdowns=EXCLUDED.rushing_touchdowns,
    total_yards=EXCLUDED.total_yards,
    first_downs=EXCLUDED.first_downs,
    third_down_conversions=EXCLUDED.third_down_conversions,
    points_allowed=EXCLUDED.points_allowed,
    yards_allowed=EXCLUDED.yards_allowed,
    passing_yards_allowed=EXCLUDED.passing_yards_allowed,
    rushing_yards_allowed=EXCLUDED.rushing_yards_allowed,
    sacks=EXCLUDED.sacks,
    interceptions=EXCLUDED.interceptions,
    forced_fumbles=EXCLUDED.forced_fumbles,
    takeaways=EXCLUDED.takeaways,
    turnovers=EXCLUDED.turnovers,
    turnover_differential=EXCLUDED.turnover_differential,
    point_differential=EXCLUDED.point_differential
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--season', type=int)
    ap.add_argument('--start', type=int, default=1999)
    ap.add_argument('--end', type=int)
    args = ap.parse_args()

    if args.season is not None:
        seasons = [args.season]
    else:
        end = args.end if args.end is not None else default_end_season()
        if args.start < 1999:
            raise ValueError('Standardized nflverse weekly player/team stats are supported from 1999 onward.')
        if end < args.start:
            raise ValueError('--end must be >= --start')
        seasons = list(range(args.start, end + 1))

    with psycopg.connect(DB) as conn:
        for season in seasons:
            print(f'========== NFL {season} ==========')

            print('Downloading nflverse schedules...')
            schedule = records(retry('schedule download', lambda: nfl.load_schedules([season])))
            schedule = [
                r for r in schedule
                if clean(r.get('home_score')) is not None
                and clean(r.get('away_score')) is not None
            ]

            game_rows = []
            game_info = {}
            for g in schedule:
                game_id = s(g, 'game_id')
                home = normalize_team(s(g, 'home_team'))
                away = normalize_team(s(g, 'away_team'))
                if not game_id or not home or not away:
                    continue
                home_score = int(n(g, 'home_score') or 0)
                away_score = int(n(g, 'away_score') or 0)
                game_type = s(g, 'game_type') or 'REG'
                game_rows.append((
                    game_id,
                    season,
                    int(n(g, 'week') or 0),
                    s(g, 'gameday'),
                    season_stage(game_type),
                    game_type,
                    home,
                    away,
                    home_score,
                    away_score,
                    str(s(g, 'location') or '').lower() == 'neutral',
                    bool(n(g, 'overtime') or 0),
                ))
                game_info[game_id] = (home, away, home_score, away_score)

            with conn.cursor() as cur:
                cur.executemany(GAME_SQL, game_rows)
            conn.commit()
            print(f'Completed games upserted: {len(game_rows)}')

            completed_ids = set(game_info)

            print('Downloading nflverse player weekly stats...')
            player_rows = records(retry('player stats download', lambda: load_player_week(season)))
            player_vals = []
            for r in player_rows:
                game_id = s(r, 'game_id')
                player_id = s(r, 'player_id')
                team = normalize_team(s(r, 'team'))
                opponent = normalize_team(s(r, 'opponent_team'))
                if not game_id or game_id not in completed_ids or not player_id or not team or not opponent:
                    continue

                cmp = n(r, 'completions') or 0
                att = n(r, 'attempts') or 0
                py = n(r, 'passing_yards') or 0
                ptd = n(r, 'passing_tds') or 0
                pint = n(r, 'passing_interceptions') or 0
                ratt = n(r, 'carries', 'rushing_attempts') or 0
                ry = n(r, 'rushing_yards') or 0
                rec = n(r, 'receptions') or 0
                recy = n(r, 'receiving_yards') or 0

                completion_pct = round(cmp / att * 100, 2) if att else None
                ypc = round(ry / ratt, 3) if ratt else None
                ypr = round(recy / rec, 3) if rec else None

                tackles_solo = n(r, 'def_tackles_solo', 'tackles_solo')
                tackles_assist = n(r, 'def_tackle_assists', 'def_tackles_with_assist', 'tackle_assists')
                tackles = n(r, 'def_tackles', 'tackles')
                if tackles is None and (tackles_solo is not None or tackles_assist is not None):
                    tackles = (tackles_solo or 0) + (tackles_assist or 0)

                player_vals.append((
                    game_id,
                    player_id,
                    s(r, 'player_display_name', 'player_name') or player_id,
                    team,
                    opponent,
                    s(r, 'position'),
                    s(r, 'position_group'),
                    cmp,
                    att,
                    py,
                    ptd,
                    pint,
                    n(r, 'sacks_suffered'),
                    calc_passer_rating(cmp, att, py, ptd, pint),
                    completion_pct,
                    ratt,
                    ry,
                    n(r, 'rushing_tds'),
                    ypc,
                    n(r, 'targets'),
                    rec,
                    recy,
                    n(r, 'receiving_tds'),
                    ypr,
                    tackles,
                    tackles_solo,
                    tackles_assist,
                    n(r, 'def_sacks', 'sacks'),
                    n(r, 'def_interceptions'),
                    n(r, 'def_fumbles_forced', 'fumbles_forced'),
                    n(r, 'def_fumble_recovery_opp', 'def_fumbles_recovered', 'fumbles_recovered'),
                    n(r, 'def_tds'),
                    n(r, 'fg_made'),
                    n(r, 'fg_att', 'fg_attempts'),
                    n(r, 'fg_long', 'longest_fg'),
                    n(r, 'pat_made', 'xp_made'),
                    n(r, 'pat_att', 'xp_attempts'),
                ))

            with conn.cursor() as cur:
                cur.executemany(PLAYER_SQL, player_vals)
            conn.commit()
            print(f'Player-game rows upserted: {len(player_vals)}')

            print('Downloading nflverse team weekly stats...')
            team_rows = records(retry('team stats download', lambda: load_team_week(season)))
            by_game_team = {
                (s(r, 'game_id'), normalize_team(s(r, 'team'))): r
                for r in team_rows
                if s(r, 'game_id') and s(r, 'team')
            }

            team_vals = []
            for r in team_rows:
                game_id = s(r, 'game_id')
                team = normalize_team(s(r, 'team'))
                opponent = normalize_team(s(r, 'opponent_team'))
                if not game_id or game_id not in game_info or not team or not opponent:
                    continue

                home, away, home_score, away_score = game_info[game_id]
                if team == home:
                    points, points_allowed = home_score, away_score
                elif team == away:
                    points, points_allowed = away_score, home_score
                else:
                    continue

                opp = by_game_team.get((game_id, opponent), {})
                pass_y = n(r, 'passing_yards') or 0
                rush_y = n(r, 'rushing_yards') or 0
                opp_pass = n(opp, 'passing_yards') or 0
                opp_rush = n(opp, 'rushing_yards') or 0

                pass_int = n(r, 'passing_interceptions') or 0
                fumbles_lost = n(r, 'fumbles_lost')
                if fumbles_lost is None:
                    fumbles_lost = (
                        (n(r, 'rushing_fumbles_lost') or 0)
                        + (n(r, 'receiving_fumbles_lost') or 0)
                        + (n(r, 'sack_fumbles_lost') or 0)
                    )
                turnovers = pass_int + fumbles_lost

                def_int = n(r, 'def_interceptions') or 0
                fumble_rec = n(r, 'def_fumble_recovery_opp', 'def_fumbles_recovered') or 0
                takeaways = def_int + fumble_rec

                opp_int = n(opp, 'passing_interceptions') or 0
                opp_fl = n(opp, 'fumbles_lost')
                if opp_fl is None:
                    opp_fl = (
                        (n(opp, 'rushing_fumbles_lost') or 0)
                        + (n(opp, 'receiving_fumbles_lost') or 0)
                        + (n(opp, 'sack_fumbles_lost') or 0)
                    )
                opp_turnovers = opp_int + opp_fl

                first_downs = n(r, 'first_downs')
                if first_downs is None:
                    passing_fd = n(r, 'passing_first_downs')
                    rushing_fd = n(r, 'rushing_first_downs')
                    if passing_fd is not None or rushing_fd is not None:
                        first_downs = (passing_fd or 0) + (rushing_fd or 0)

                net_pass = pass_y - (n(r, 'sack_yards_lost') or 0)
                opp_net_pass = opp_pass - (n(opp, 'sack_yards_lost') or 0)

                team_vals.append((
                    game_id,
                    team,
                    opponent,
                    points,
                    n(r, 'total_tds', 'touchdowns'),
                    n(r, 'fg_made'),
                    n(r, 'completions'),
                    n(r, 'attempts'),
                    pass_y,
                    n(r, 'passing_tds'),
                    pass_int,
                    n(r, 'carries', 'rushing_attempts'),
                    rush_y,
                    n(r, 'rushing_tds'),
                    net_pass + rush_y,
                    first_downs,
                    n(r, 'third_down_conversions'),
                    points_allowed,
                    opp_net_pass + opp_rush,
                    opp_pass,
                    opp_rush,
                    n(r, 'def_sacks'),
                    def_int,
                    n(r, 'def_fumbles_forced'),
                    takeaways,
                    turnovers,
                    turnovers - opp_turnovers,
                    points - points_allowed,
                ))

            with conn.cursor() as cur:
                cur.executemany(TEAM_SQL, team_vals)
            conn.commit()
            print(f'Team-game rows upserted: {len(team_vals)}')

    print('NFL ingestion complete.')


if __name__ == '__main__':
    main()
