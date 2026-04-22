"""
Wolves Tracker - 歷史賽季回補腳本

Usage:
    python backfill_history.py --season 2022-23 --type regular
    python backfill_history.py --season 2023-24 --type playoffs

說明：
    - 抓取指定歷史賽季的灰狼球隊與球員數據（賽季末終點快照）
    - 球員資料以 PlayerID 為主鍵，並標記是否為現役球員
    - API 不加 TeamID 篩選，改用歷史名單 PlayerID 過濾，確保整季數據完整（含轉隊球員）
"""

from curl_cffi import requests
import json
import os
import sys
import time
import random
import argparse
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# ==========================================
# 常數
# ==========================================
TEAM_ID = 1610612750  # 灰狼
CURRENT_SEASON = "2025-26"  # 用來抓現役名單作為 isCurrentRoster 對照

PLAY_TYPES = [
    "Transition", "Isolation", "PRBallHandler", "PRRollMan",
    "Postup", "Spotup", "Handoff", "Cut", "OffScreen", "OffRebound", "Misc"
]

TRACKING_TYPES = [
    "Drives", "CatchShoot", "PullUpShot", "Passing", "Possessions", "Rebounding"
]

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/122.0.0.0 Safari/537.36',
]

SESSION = requests.Session(impersonate="chrome110")
SESSION.headers.update({
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token': 'true',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com',
    'Connection': 'keep-alive',
})


def nba_get(url, timeout=30):
    SESSION.headers['User-Agent'] = random.choice(USER_AGENTS)
    return SESSION.get(url, timeout=timeout)


def safe_col(row, headers_list, col_name, default=0, pct=False):
    if col_name not in headers_list:
        return default
    val = row[headers_list.index(col_name)]
    if val is None:
        return default
    if pct:
        return round(val * 100, 1)
    return val


# ==========================================
# Firebase 初始化
# ==========================================
def init_firebase():
    firebase_cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if firebase_cred_json:
        cred = credentials.Certificate(json.loads(firebase_cred_json))
    elif os.path.exists("firebase-key.json"):
        cred = credentials.Certificate("firebase-key.json")
        print("使用本地 firebase-key.json 進行 Firebase 驗證")
    else:
        print("找不到 firebase-key.json，本次將跳過 Firebase 寫入")
        return None
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    return firestore.client()


# ==========================================
# 名單抓取（支援指定賽季）
# ==========================================
def fetch_roster_with_ids(season):
    """抓取指定賽季的灰狼名單，返回 [{'id': int, 'name': str}, ...]"""
    url = f"https://stats.nba.com/stats/commonteamroster?LeagueID=00&Season={season}&TeamID={TEAM_ID}"
    for attempt in range(3):
        try:
            print(f"Fetching {season} 灰狼名單 (Attempt {attempt+1}/3)...")
            res = requests.get(url, headers=SESSION.headers, impersonate="safari15_5", timeout=15)
            res.raise_for_status()
            data = res.json()
            headers_list = data['resultSets'][0]['headers']
            rows = data['resultSets'][0]['rowSet']
            roster = [
                {'id': row[headers_list.index("PLAYER_ID")], 'name': row[headers_list.index("PLAYER")]}
                for row in rows
            ]
            print(f"  ✅ {season} 共 {len(roster)} 位球員：{', '.join(p['name'] for p in roster)}")
            return roster
        except Exception as e:
            print(f"  Error: {e}")
            time.sleep(3)
    return []


# ==========================================
# Synergy 數據抓取（指定賽季與類型）
# ==========================================
def fetch_synergy_data(season, season_type_api, player_or_team="T"):
    results = []
    for side in ["offensive", "defensive"]:
        for ptype in PLAY_TYPES:
            if side == "defensive" and (ptype == "Cut" or ptype == "Misc"):
                continue
            url = (f"https://stats.nba.com/stats/synergyplaytypes"
                   f"?LeagueID=00&PerMode=PerGame&PlayType={ptype}"
                   f"&PlayerOrTeam={player_or_team}&SeasonType={season_type_api}"
                   f"&SeasonYear={season}&TypeGrouping={side}")
            for attempt in range(3):
                try:
                    print(f"  Synergy {ptype} ({side}) [{player_or_team}] (Attempt {attempt+1}/3)")
                    res = nba_get(url)
                    res.raise_for_status()
                    data = res.json()
                    headers_list = data['resultSets'][0]['headers']
                    rows = data['resultSets'][0]['rowSet']
                    # 球隊查詢時過濾出灰狼；球員查詢保留全聯盟，後續以 PlayerID 過濾
                    if player_or_team == "T":
                        rows = [r for r in rows if r[headers_list.index("TEAM_ID")] == TEAM_ID]
                    for row in rows:
                        poss = row[headers_list.index("POSS")]
                        if poss <= 0:
                            continue
                        item = {
                            "playType": ptype,
                            "side": side,
                            "poss": poss,
                            "freq": round(row[headers_list.index("POSS_PCT")] * 100, 1),
                            "ppp": round(row[headers_list.index("PPP")], 2),
                            "fgPct": round(row[headers_list.index("FG_PCT")] * 100, 1) if row[headers_list.index("FG_PCT")] is not None else 0,
                            "percentile": round(row[headers_list.index("PERCENTILE")] * 100, 1) if row[headers_list.index("PERCENTILE")] is not None else 0
                        }
                        if player_or_team == "P":
                            item["playerId"] = row[headers_list.index("PLAYER_ID")]
                            item["playerName"] = row[headers_list.index("PLAYER_NAME")]
                        results.append(item)
                    break
                except Exception as e:
                    print(f"  Error: {e}")
                    time.sleep(3)
            time.sleep(2)
    return results


# ==========================================
# Tracking 數據抓取（指定賽季與類型）
# ==========================================
def fetch_tracking_data(season, season_type_api, player_or_team="Team"):
    """
    球員模式回傳 dict，key 為 PlayerID（str），方便後續以 PlayerID 過濾
    球隊模式回傳 dict，key 為 'MIN'
    """
    results = {}
    for measure_type in TRACKING_TYPES:
        # 球員模式抓全聯盟（TeamID=0），球隊模式抓灰狼
        team_id_param = TEAM_ID if player_or_team == "Team" else 0
        url = (f"https://stats.nba.com/stats/leaguedashptstats"
               f"?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear="
               f"&GameScope=&Height=&LastNGames=0&LeagueID=00&Location=&Month=0&OpponentTeamID=0"
               f"&Outcome=&PORound=0&PerMode=PerGame&PlayerExperience="
               f"&PlayerOrTeam={player_or_team}&PtMeasureType={measure_type}"
               f"&Season={season}&SeasonSegment=&SeasonType={season_type_api}"
               f"&StarterBench=&TeamID={team_id_param}"
               f"&VsConference=&VsDivision=&Weight=")
        for attempt in range(3):
            try:
                print(f"  Tracking {measure_type} [{player_or_team}] (Attempt {attempt+1}/3)")
                res = nba_get(url)
                res.raise_for_status()
                data = res.json()
                headers_list = data['resultSets'][0]['headers']
                rows = data['resultSets'][0]['rowSet']
                for row in rows:
                    if player_or_team == "Player":
                        ident = str(row[headers_list.index("PLAYER_ID")])
                        if ident not in results:
                            results[ident] = {"playerName": row[headers_list.index("PLAYER_NAME")]}
                    else:
                        ident = "MIN"
                        if ident not in results:
                            results[ident] = {}

                    if measure_type == "Drives":
                        results[ident]["DRIVES"] = safe_col(row, headers_list, "DRIVES")
                        results[ident]["DRIVE_FGM"] = safe_col(row, headers_list, "DRIVE_FGM")
                        results[ident]["DRIVE_FG_PCT"] = safe_col(row, headers_list, "DRIVE_FG_PCT", pct=True)
                        results[ident]["DRIVE_PTS_PCT"] = safe_col(row, headers_list, "DRIVE_PTS_PCT", pct=True)
                        results[ident]["DRIVE_AST_PCT"] = safe_col(row, headers_list, "DRIVE_AST_PCT", pct=True)
                        results[ident]["DRIVE_TOV_PCT"] = safe_col(row, headers_list, "DRIVE_TOV_PCT", pct=True)
                    elif measure_type == "CatchShoot":
                        results[ident]["CATCH_SHOOT_FGA"] = safe_col(row, headers_list, "CATCH_SHOOT_FGA")
                        results[ident]["CATCH_SHOOT_FG3_PCT"] = safe_col(row, headers_list, "CATCH_SHOOT_FG3_PCT", pct=True)
                        results[ident]["CATCH_SHOOT_EFG_PCT"] = safe_col(row, headers_list, "CATCH_SHOOT_EFG_PCT", pct=True)
                    elif measure_type == "PullUpShot":
                        results[ident]["PULL_UP_FGA"] = safe_col(row, headers_list, "PULL_UP_FGA")
                        results[ident]["PULL_UP_FG3_PCT"] = safe_col(row, headers_list, "PULL_UP_FG3_PCT", pct=True)
                        results[ident]["PULL_UP_EFG_PCT"] = safe_col(row, headers_list, "PULL_UP_EFG_PCT", pct=True)
                    elif measure_type == "Passing":
                        results[ident]["PASSES_MADE"] = safe_col(row, headers_list, "PASSES_MADE")
                        results[ident]["AST"] = safe_col(row, headers_list, "AST")
                        results[ident]["POTENTIAL_AST"] = safe_col(row, headers_list, "POTENTIAL_AST")
                        results[ident]["AST_PTS_CREATED"] = safe_col(row, headers_list, "AST_POINTS_CREATED")
                        results[ident]["SECONDARY_AST"] = safe_col(row, headers_list, "SECONDARY_AST")
                    elif measure_type == "Possessions":
                        results[ident]["TOUCHES"] = safe_col(row, headers_list, "TOUCHES")
                        results[ident]["FRONT_CT_TOUCHES"] = safe_col(row, headers_list, "FRONT_CT_TOUCHES")
                        results[ident]["TIME_OF_POSS"] = safe_col(row, headers_list, "TIME_OF_POSS")
                        results[ident]["PTS_PER_TOUCH"] = safe_col(row, headers_list, "PTS_PER_TOUCH")
                    elif measure_type == "Rebounding":
                        results[ident]["REB"] = safe_col(row, headers_list, "REB")
                        results[ident]["REB_CHANCES"] = safe_col(row, headers_list, "REB_CHANCES")
                        results[ident]["REB_COL_PCT"] = safe_col(row, headers_list, "REB_COLLECT_PCT", pct=True)
                        results[ident]["REB_CONTEST_PCT"] = safe_col(row, headers_list, "REB_CONTEST_PCT", pct=True)
                break
            except Exception as e:
                print(f"  Error: {e}")
                time.sleep(3)
        time.sleep(2)
    return results


# ==========================================
# 主程式
# ==========================================
def main():
    parser = argparse.ArgumentParser(description="Wolves Tracker 歷史賽季回補")
    parser.add_argument("--season", required=True, help="例：2022-23")
    parser.add_argument("--type", required=True, choices=["regular", "playoffs"], help="regular 或 playoffs")
    args = parser.parse_args()

    season = args.season
    type_key = args.type
    season_type_api = "Regular+Season" if type_key == "regular" else "Playoffs"
    season_type_label = "例行賽" if type_key == "regular" else "季後賽"
    doc_id = f"{season}_{type_key}"

    print(f"\n=== 開始回補 {season} {season_type_label}（{doc_id}）===\n")

    # Step 1: 抓歷史名單
    historical_roster = fetch_roster_with_ids(season)
    if not historical_roster:
        print(f"❌ 無法取得 {season} 歷史名單，終止")
        sys.exit(1)
    historical_ids = {p['id'] for p in historical_roster}
    historical_id_to_name = {p['id']: p['name'] for p in historical_roster}

    # Step 2: 抓現役名單，建立 PlayerID 對照
    print()
    current_roster = fetch_roster_with_ids(CURRENT_SEASON)
    current_ids = {p['id'] for p in current_roster}

    # Step 3: 抓球隊數據
    print(f"\n--- 抓取 {season} {season_type_label} 球隊數據 ---")
    team_synergy = fetch_synergy_data(season, season_type_api, "T")
    team_tracking = fetch_tracking_data(season, season_type_api, "Team")

    # Step 4: 抓全聯盟球員數據（待過濾）
    print(f"\n--- 抓取全聯盟球員數據（將以歷史名單過濾） ---")
    all_player_synergy = fetch_synergy_data(season, season_type_api, "P")
    all_player_tracking = fetch_tracking_data(season, season_type_api, "Player")

    # Step 5: 過濾與組裝（PlayerID 為主鍵）
    player_stats = {}

    for item in all_player_synergy:
        pid_int = item.pop("playerId")
        pname = item.pop("playerName")
        if pid_int not in historical_ids:
            continue
        pid_str = str(pid_int)
        if pid_str not in player_stats:
            player_stats[pid_str] = {
                "playerName": historical_id_to_name.get(pid_int, pname),
                "isCurrentRoster": pid_int in current_ids,
                "stats": [],
                "tracking": {}
            }
        player_stats[pid_str]["stats"].append(item)

    for pid_str, track_data in all_player_tracking.items():
        pid_int = int(pid_str)
        if pid_int not in historical_ids:
            continue
        if pid_str not in player_stats:
            player_stats[pid_str] = {
                "playerName": historical_id_to_name.get(pid_int, track_data.get("playerName", "")),
                "isCurrentRoster": pid_int in current_ids,
                "stats": [],
                "tracking": {}
            }
        track_data.pop("playerName", None)
        player_stats[pid_str]["tracking"] = track_data

    print(f"\n✅ 共組裝 {len(player_stats)} 位灰狼球員資料")
    print(f"   現役球員：{sum(1 for p in player_stats.values() if p['isCurrentRoster'])} 位")
    print(f"   已離隊：{sum(1 for p in player_stats.values() if not p['isCurrentRoster'])} 位")

    # Step 6: 寫入 Firebase
    final_team_data = {
        "season": season,
        "seasonType": season_type_label,
        "type": "歷史快照",
        "timestamp": int(datetime.now().timestamp() * 1000),
        "stats": team_synergy,
        "tracking": team_tracking.get("MIN", {})
    }
    final_player_data = {
        "season": season,
        "seasonType": season_type_label,
        "type": "歷史快照",
        "timestamp": int(datetime.now().timestamp() * 1000),
        "stats": player_stats
    }

    if not team_synergy and not player_stats:
        print("❌ 警告：未成功抓取任何數據，終止寫入")
        sys.exit(1)

    db = init_firebase()
    if db:
        db.collection("wolves_team_history").document(doc_id).set(final_team_data)
        print(f"✅ 球隊歷史數據已寫入 wolves_team_history/{doc_id}")
        db.collection("wolves_player_history").document(doc_id).set(final_player_data)
        print(f"✅ 球員歷史數據已寫入 wolves_player_history/{doc_id}")

    # 本地驗證輸出
    out_path = f"backfill_{doc_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"team": final_team_data, "player": final_player_data}, f, ensure_ascii=False, indent=2)
    print(f"📁 已寫出本地驗證檔：{out_path}")


if __name__ == "__main__":
    main()
