#!/usr/bin/env python3
"""Load verified NBA.com game + traditional box-score data into PostgreSQL.
Usage: python scripts/ingest_nba.py --season 2025-26
"""
import argparse, os, time
from datetime import datetime
import psycopg
from nba_api.stats.endpoints import leaguegamelog, boxscoretraditionalv3

DB=os.getenv('DATABASE_URL','postgresql://postgres:postgres@localhost:5432/stat_finder')

def num(v, default=None):
    if v in (None,'','-'): return default
    try: return float(v)
    except: return default

def mins(v):
    if v in (None,''): return None
    s=str(v)
    if ':' in s:
        a,b=s.split(':',1)
        try:return round(float(a)+float(b)/60,3)
        except:return None
    return num(v)

def fetch_team_log(season, stage):
    for attempt in range(5):
        try:
            r=leaguegamelog.LeagueGameLog(season=season,season_type_all_star=stage,player_or_team_abbreviation='T',timeout=60)
            return r.get_data_frames()[0].to_dict('records')
        except Exception as e:
            if attempt==4: raise
            print(f'  team log retry {attempt+1}: {e}');time.sleep(3*(attempt+1))

def fetch_box(game_id):
    for attempt in range(5):
        try:
            r=boxscoretraditionalv3.BoxScoreTraditionalV3(game_id=game_id,timeout=60)
            frames=r.get_data_frames(); return frames[0].to_dict('records'), frames[2].to_dict('records')
        except Exception as e:
            if attempt==4: raise
            print(f'  box score {game_id} retry {attempt+1}: {e}');time.sleep(3*(attempt+1))

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--season',default='2025-26');ap.add_argument('--delay',type=float,default=.65);args=ap.parse_args()
    with psycopg.connect(DB) as conn:
      for stage in ('Regular Season','Playoffs'):
        print(f'Downloading {args.season} {stage} team game log...')
        rows=fetch_team_log(args.season,stage); by_game={}
        for r in rows: by_game.setdefault(str(r['GAME_ID']),[]).append(r)
        print(f'Found {len(by_game)} games')
        for i,(game_id,pair) in enumerate(sorted(by_game.items()),1):
            if len(pair)<2: print('  skipping incomplete',game_id);continue
            home=next((r for r in pair if 'vs.' in str(r['MATCHUP'])),None); away=next((r for r in pair if '@' in str(r['MATCHUP'])),None)
            if not home or not away: print('  cannot resolve home/away',game_id);continue
            game_date=datetime.strptime(str(home['GAME_DATE'])[:10],'%Y-%m-%d').date()
            conn.execute('''INSERT INTO nba_games(game_id,season,game_date,season_type,home_team_id,home_team,away_team_id,away_team,home_score,away_score)
              VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(game_id) DO UPDATE SET season=EXCLUDED.season,game_date=EXCLUDED.game_date,season_type=EXCLUDED.season_type,home_score=EXCLUDED.home_score,away_score=EXCLUDED.away_score''',
              (game_id,args.season,game_date,stage,int(home['TEAM_ID']),home['TEAM_ABBREVIATION'],int(away['TEAM_ID']),away['TEAM_ABBREVIATION'],int(home['PTS']),int(away['PTS'])))
            players,teams=fetch_box(game_id)
            team_ids={int(home['TEAM_ID']):(int(away['TEAM_ID']),away['TEAM_ABBREVIATION']),int(away['TEAM_ID']):(int(home['TEAM_ID']),home['TEAM_ABBREVIATION'])}
            for t in teams:
                tid=int(t['teamId']);oppid,opp=team_ids[tid]
                vals=(game_id,tid,t['teamTricode'],oppid,opp,t['points'],t['reboundsTotal'],t['assists'],t['steals'],t['blocks'],t['fieldGoalsMade'],t['fieldGoalsAttempted'],num(t['fieldGoalsPercentage']),t['threePointersMade'],t['threePointersAttempted'],num(t['threePointersPercentage']),t['freeThrowsMade'],t['freeThrowsAttempted'],num(t['freeThrowsPercentage']),t['reboundsOffensive'],t['reboundsDefensive'],t['turnovers'],t['foulsPersonal'],num(t['plusMinusPoints']))
                conn.execute('''INSERT INTO nba_team_games(game_id,team_id,team,opponent_id,opponent,points,rebounds,assists,steals,blocks,fg_made,fg_attempted,fg_pct,three_made,three_attempted,three_pct,ft_made,ft_attempted,ft_pct,offensive_rebounds,defensive_rebounds,turnovers,personal_fouls,plus_minus)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(game_id,team_id) DO UPDATE SET points=EXCLUDED.points,rebounds=EXCLUDED.rebounds,assists=EXCLUDED.assists,steals=EXCLUDED.steals,blocks=EXCLUDED.blocks,plus_minus=EXCLUDED.plus_minus''',vals)
            for p in players:
                if not p.get('personId'): continue
                tid=int(p['teamId']);oppid,opp=team_ids[tid];name=(str(p.get('firstName',''))+' '+str(p.get('familyName',''))).strip()
                vals=(game_id,int(p['personId']),name,tid,p['teamTricode'],oppid,opp,p.get('position'),None,mins(p.get('minutes')),p['points'],p['reboundsTotal'],p['assists'],p['steals'],p['blocks'],p['fieldGoalsMade'],p['fieldGoalsAttempted'],num(p['fieldGoalsPercentage']),p['threePointersMade'],p['threePointersAttempted'],num(p['threePointersPercentage']),p['freeThrowsMade'],p['freeThrowsAttempted'],num(p['freeThrowsPercentage']),p['reboundsOffensive'],p['reboundsDefensive'],p['turnovers'],p['foulsPersonal'],num(p['plusMinusPoints']))
                conn.execute('''INSERT INTO nba_player_games(game_id,player_id,player_name,team_id,team,opponent_id,opponent,position,starter,minutes,points,rebounds,assists,steals,blocks,fg_made,fg_attempted,fg_pct,three_made,three_attempted,three_pct,ft_made,ft_attempted,ft_pct,offensive_rebounds,defensive_rebounds,turnovers,personal_fouls,plus_minus)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(game_id,player_id) DO UPDATE SET minutes=EXCLUDED.minutes,points=EXCLUDED.points,rebounds=EXCLUDED.rebounds,assists=EXCLUDED.assists,steals=EXCLUDED.steals,blocks=EXCLUDED.blocks,plus_minus=EXCLUDED.plus_minus''',vals)
            conn.commit()
            print(f'  [{i}/{len(by_game)}] {away["TEAM_ABBREVIATION"]} {away["PTS"]} @ {home["TEAM_ABBREVIATION"]} {home["PTS"]}')
            time.sleep(args.delay)
    print('NBA ingestion complete.')
if __name__=='__main__': main()
