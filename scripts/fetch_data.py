from curl_cffi import requests
import json
import os
import time
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta

# ==========================================
# 參數與常數設定
# ==========================================
TEAM_ID = 1610612750 # 灰狼隊
SEASON = "2024-25"

PLAY_TYPES = [
    "Transition", "Isolation", "PRBallHandler", "PRRollMan", 
    "Postup", "Spotup", "Handoff", "Cut", "OffScreen", "OffRebound", "Misc"
]

TRACKING_TYPES = [
    "Drives", "CatchShoot", "PullUpShot", "Passing", "Touches", "Rebounding"
]

import random

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
]

# 使用 curl_cffi 模擬真實瀏覽器 TLS 指紋，避免被 NBA API 阻擋
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
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
})

def nba_get(url):
    """發送帶有隨機 User-Agent 的 GET 請求，timeout=15s"""
    SESSION.headers['User-Agent'] = random.choice(USER_AGENTS)
    return SESSION.get(url, timeout=30)

def safe_col(row, headers_list, col_name, default=0, pct=False):
    """安全取得欄位值，若欄位不存在則回傳 default"""
    if col_name not in headers_list:
        return default
    val = row[headers_list.index(col_name)]
    if val is None:
        return default
    if pct:
        return round(val * 100, 1)
    return val

# 記錄日期的輔助函式 (為了搭配前端的時區觀念)
def get_today_str():
    # 使用 UTC-5 (美東時間) 來作為基準，確保賽事日期的正確性
    east_time = datetime.utcnow() - timedelta(hours=5)
    return east_time.strftime('%Y-%m-%d')


# ==========================================
# Firebase 初始化
# ==========================================
def init_firebase():
    """使用儲存在 GitHub Secrets 的 Service Account 進行初始化"""
    firebase_cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not firebase_cred_json:
        print("沒有找到 FIREBASE_SERVICE_ACCOUNT 環境變數。這將於本地測試時跳過 Firebase 寫入。")
        return None
    
    cred_dict = json.loads(firebase_cred_json)
    cred = credentials.Certificate(cred_dict)
    
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    
    return firestore.client()


# ==========================================
# API 抓取邏輯：Synergy PlayType (攻守)
# ==========================================
def fetch_synergy_data(player_or_team="T"):
    """
    抓取 Synergy 戰術數據 (包含進攻與防守)
    player_or_team: 'T' 查球隊, 'P' 查球員
    """
    results = []
    sides = ["offensive", "defensive"]
    
    for side in sides:
        for ptype in PLAY_TYPES:
            if side == "defensive" and (ptype == "Cut" or ptype == "Misc"):
                continue # 防守沒有這兩項
            
            url = f"https://stats.nba.com/stats/synergyplaytypes?LeagueID=00&PerMode=PerGame&PlayType={ptype}&PlayerOrTeam={player_or_team}&SeasonType=Regular%20Season&SeasonYear={SEASON}&TypeGrouping={side}"
            
            # 加入 Retry 機制防禦 NBA 官網 API
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    print(f"Fetching PlayType: {ptype} ({side}) [{player_or_team}] (Attempt {attempt+1}/{max_retries})")
                    res = nba_get(url)
                    res.raise_for_status()
                    data = res.json()
                    
                    headers_list = data['resultSets'][0]['headers']
                    rows = data['resultSets'][0]['rowSet']
                    
                    # 過濾出灰狼隊
                    wolves_rows = [r for r in rows if r[headers_list.index("TEAM_ID")] == TEAM_ID]
                    
                    for row in wolves_rows:
                        item = {
                            "playType": ptype,
                            "side": side,
                            "poss": row[headers_list.index("POSS")],
                            "freq": round(row[headers_list.index("POSS_PCT")] * 100, 1),
                            "ppp": round(row[headers_list.index("PPP")], 2),
                            "fgPct": round(row[headers_list.index("FG_PCT")] * 100, 1) if row[headers_list.index("FG_PCT")] is not None else 0,
                            "percentile": round(row[headers_list.index("PERCENTILE")] * 100, 1) if row[headers_list.index("PERCENTILE")] is not None else 0
                        }
                        
                        if player_or_team == "P":
                            item["playerName"] = row[headers_list.index("PLAYER_NAME")]
                            item["playerId"] = row[headers_list.index("PLAYER_ID")]
                            
                        results.append(item)
                    break # 成功抓取跳出 retry loop
                        
                except Exception as e:
                    print(f"Error fetching {ptype} ({side}): {e}")
                    time.sleep(3) # 失敗休息 3 秒再試
            
            time.sleep(2) # 每個 Request 中間休息 2 秒，防擋
                
    return results

# ==========================================
# API 抓取邏輯：Tracking (進階數據)
# ==========================================
def fetch_tracking_data(player_or_team="Team"):
    """
    抓取 Tracking 進階數據 (Drives, Catch & Shoot, ...)
    player_or_team: 'Team' 查球隊, 'Player' 查球員
    """
    results = {}
    
    for measure_type in TRACKING_TYPES:
        url = f"https://stats.nba.com/stats/leaguedashptstats?College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear=&GameScope=&Height=&LastNGames=0&LeagueID=00&Location=&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PerMode=PerGame&PlayerExperience=&PlayerOrTeam={player_or_team}&PtMeasureType={measure_type}&Season={SEASON}&SeasonSegment=&SeasonType=Regular%20Season&StarterBench=&TeamID={TEAM_ID}&VsConference=&VsDivision=&Weight="
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"Fetching Tracking: {measure_type} [{player_or_team}] (Attempt {attempt+1}/{max_retries})")
                res = nba_get(url)
                res.raise_for_status()
                data = res.json()
                
                headers_list = data['resultSets'][0]['headers']
                rows = data['resultSets'][0]['rowSet']
                
                # API 已經加上 TeamID 條件，理論上出來的都是灰狼
                for row in rows:
                    if player_or_team == "Player":
                        player_name = row[headers_list.index("PLAYER_NAME")]
                        player_id = row[headers_list.index("PLAYER_ID")]
                        ident = player_name
                    else:
                        ident = "MIN" # Team
                        player_id = None
                    
                    if ident not in results:
                        results[ident] = {"playerId": player_id}
                    
                    # 依據 MeasureType 寫入核心欄位
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
                    
                    elif measure_type == "Touches":
                        results[ident]["TOUCHES"] = safe_col(row, headers_list, "TOUCHES")
                        results[ident]["FRONT_CT_TOUCHES"] = safe_col(row, headers_list, "FRONT_CT_TOUCHES")
                        results[ident]["TIME_OF_POSS"] = safe_col(row, headers_list, "TIME_OF_POSS")
                        results[ident]["PTS_PER_TOUCH"] = safe_col(row, headers_list, "PTS_PER_TOUCH")
                    
                    elif measure_type == "Rebounding":
                        results[ident]["REB"] = safe_col(row, headers_list, "REB")
                        results[ident]["REB_CHANCES"] = safe_col(row, headers_list, "REB_CHANCES")
                        results[ident]["REB_COL_PCT"] = safe_col(row, headers_list, "REB_COLLECT_PCT", pct=True)
                        results[ident]["REB_CONTEST_PCT"] = safe_col(row, headers_list, "REB_CONTEST_PCT", pct=True)
                
                break # 成功跳出
            except Exception as e:
                print(f"Error fetching {measure_type}: {e}")
                time.sleep(3)
        
        time.sleep(2) # 每一種暫停2秒
            
    return results

# ==========================================
# 主程式
# ==========================================
def main():
    print("=== 開始抓取灰狼隊 Synergy 與 Tracking 數據 ===")
    
    # 1. 抓取球隊資料
    team_synergy = fetch_synergy_data("T")
    team_tracking = fetch_tracking_data("Team")
    team_tracking_data = team_tracking.get("MIN", {})
    
    final_team_data = {
        "date": get_today_str(),
        "type": "官方數據",
        "timestamp": int(datetime.now().timestamp() * 1000),
        "stats": team_synergy,      # Array
        "tracking": team_tracking_data # Dict
    }
    
    # 2. 抓取球員資料
    player_synergy = fetch_synergy_data("P")
    player_tracking = fetch_tracking_data("Player")
    
    # 將 Synergy 資料轉換以球員名稱為 key 的 dict
    player_stats_map = {}
    for item in player_synergy:
        pname = item.pop("playerName")
        if pname not in player_stats_map:
            player_stats_map[pname] = []
        player_stats_map[pname].append(item)
        
    final_player_data = {
        "date": get_today_str(),
        "type": "官方數據",
        "timestamp": int(datetime.now().timestamp() * 1000),
        "stats": player_stats_map,      # Dict of Arrays
        "tracking": player_tracking     # Dict of Dicts
    }
    
    print("=== 資料整理完成，準備寫入 Firebase ===")
    
    # 防止 API 抓取失敗導致洗掉資料庫
    if not team_synergy and not player_synergy:
        print("❌ 警告：未成功抓取任何 Synergy 數據，可能遭到 NBA API 阻擋，本次終止寫入。")
        return

    db = init_firebase()
    if db:
        today = get_today_str()
        
        # 覆寫當天數據或新增
        team_doc_ref = db.collection('wolves_team_stats').document(today)
        team_doc_ref.set(final_team_data)
        print(f"✅ 球隊數據已寫入 Document: {today}")
        
        player_doc_ref = db.collection('wolves_player_stats').document(today)
        player_doc_ref.set(final_player_data)
        print(f"✅ 球員數據已寫入 Document: {today}")
        
    else:
        # 本地測試模式：寫出為 json
        with open("local_test_data.json", "w", encoding="utf-8") as f:
            json.dump({
                "team": final_team_data,
                "player": final_player_data
            }, f, ensure_ascii=False, indent=2)
        print("📁 僅匯出 local_test_data.json，未寫入 Firebase")


if __name__ == "__main__":
    main()
