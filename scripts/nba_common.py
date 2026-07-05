# -*- coding: utf-8 -*-
"""
Wolves Tracker - NBA API 共用模組

fetch_data.py（每日）與 backfill_history.py（歷史回補）共用的
連線設定、欄位設定表與抓取函式。

新增數據的三種情境：
1. 既有 API 的新欄位  → 在對應的 *_FIELDS 設定表加一行 (輸出欄名, API 欄名, 是否百分比)
2. leaguedashptstats 的新類型 → TRACKING_TYPES 加名稱 + TRACKING_FIELDS 加對應欄位列表
3. 全新 endpoint      → 仿照 fetch_clutch() 寫一支新函式（fetch_with_retry 處理重試）
"""

from curl_cffi import requests
import json
import os
import random
import time
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta

# ==========================================
# 常數
# ==========================================
TEAM_ID = 1610612750  # 灰狼

PLAY_TYPES = [
    "Transition", "Isolation", "PRBallHandler", "PRRollMan",
    "Postup", "Spotup", "Handoff", "Cut", "OffScreen", "OffRebound", "Misc"
]

TRACKING_TYPES = [
    "Drives", "CatchShoot", "PullUpShot", "Passing", "Possessions", "Rebounding"
]

# leaguedashptstats 欄位設定表：(輸出欄名, API 欄名, 是否百分比)
# 百分比欄位會 *100 並四捨五入到小數 1 位
TRACKING_FIELDS = {
    "Drives": [
        ("DRIVES", "DRIVES", False),
        ("DRIVE_FGM", "DRIVE_FGM", False),
        ("DRIVE_FG_PCT", "DRIVE_FG_PCT", True),
        ("DRIVE_PTS_PCT", "DRIVE_PTS_PCT", True),
        ("DRIVE_AST_PCT", "DRIVE_AST_PCT", True),
        ("DRIVE_TOV_PCT", "DRIVE_TOV_PCT", True),
    ],
    "CatchShoot": [
        ("CATCH_SHOOT_FGA", "CATCH_SHOOT_FGA", False),
        ("CATCH_SHOOT_FG3_PCT", "CATCH_SHOOT_FG3_PCT", True),
        ("CATCH_SHOOT_EFG_PCT", "CATCH_SHOOT_EFG_PCT", True),
    ],
    "PullUpShot": [
        ("PULL_UP_FGA", "PULL_UP_FGA", False),
        ("PULL_UP_FG3_PCT", "PULL_UP_FG3_PCT", True),
        ("PULL_UP_EFG_PCT", "PULL_UP_EFG_PCT", True),
    ],
    "Passing": [
        ("PASSES_MADE", "PASSES_MADE", False),
        ("AST", "AST", False),
        ("POTENTIAL_AST", "POTENTIAL_AST", False),
        ("AST_PTS_CREATED", "AST_POINTS_CREATED", False),
        ("SECONDARY_AST", "SECONDARY_AST", False),
    ],
    "Possessions": [
        ("TOUCHES", "TOUCHES", False),
        ("FRONT_CT_TOUCHES", "FRONT_CT_TOUCHES", False),
        ("TIME_OF_POSS", "TIME_OF_POSS", False),
        ("PTS_PER_TOUCH", "PTS_PER_TOUCH", False),
    ],
    "Rebounding": [
        ("REB", "REB", False),
        ("OREB", "OREB", False),
        ("DREB", "DREB", False),
        ("REB_CONTEST", "REB_CONTEST", False),
        ("REB_UNCONTEST", "REB_UNCONTEST", False),
        ("REB_CONTEST_PCT", "REB_CONTEST_PCT", True),
        ("REB_CHANCES", "REB_CHANCES", False),
        # 舊欄名 REB_COLLECT_PCT 已不存在於 API，正確來源為 REB_CHANCE_PCT；
        # 輸出欄名沿用 REB_COL_PCT 以相容既有前端與歷史資料
        ("REB_COL_PCT", "REB_CHANCE_PCT", True),
        ("AVG_REB_DIST", "AVG_REB_DIST", False),
    ],
}

# leaguedash{player|team}ptshot（投籃拆分）欄位
PT_SHOT_FIELDS = [
    ("FGA", "FGA", False),
    ("FG_PCT", "FG_PCT", True),
    ("EFG_PCT", "EFG_PCT", True),
    ("FG2A_FREQ", "FG2A_FREQUENCY", True),
    ("FG2_PCT", "FG2_PCT", True),
    ("FG3A_FREQ", "FG3A_FREQUENCY", True),
    ("FG3_PCT", "FG3_PCT", True),
]

# leaguedash{player|team}shotlocations 分區 →（輸出欄位前綴, API 區域名）
# API 另有 Left/Right Corner 3 與 Backcourt，前者已由合併的 Corner 3 涵蓋
SHOT_ZONES = [
    ("RA", "Restricted Area"),
    ("PAINT", "In The Paint (Non-RA)"),
    ("MID", "Mid-Range"),
    ("C3", "Corner 3"),
    ("AB3", "Above the Break 3"),
]

# leaguedash{player|team}clutch（最後 5 分鐘分差 5 分內）欄位
CLUTCH_FIELDS = [
    ("GP", "GP", False),
    ("MIN", "MIN", False),
    ("PTS", "PTS", False),
    ("FG_PCT", "FG_PCT", True),
    ("FG3_PCT", "FG3_PCT", True),
    ("FT_PCT", "FT_PCT", True),
    ("AST", "AST", False),
    ("TOV", "TOV", False),
    ("REB", "REB", False),
    ("PLUS_MINUS", "PLUS_MINUS", False),
]

# leaguedashlineups（MeasureType=Advanced）欄位
LINEUP_FIELDS = [
    ("GP", "GP", False),
    ("MIN", "MIN", False),
    ("OFF_RATING", "OFF_RATING", False),
    ("DEF_RATING", "DEF_RATING", False),
    ("NET_RATING", "NET_RATING", False),
    ("TS_PCT", "TS_PCT", True),
]

# ── 防守數據欄位設定表 ──
# leaguedashptdefend 對位防守：Overall（D_FG_PCT = 被此人防守時對手命中率；PCT_PLUSMINUS 負=守得好）
MATCHUP_OVERALL_FIELDS = [
    ("D_FGA", "D_FGA", False),
    ("D_FG_PCT", "D_FG_PCT", True),
    ("NORMAL_FG_PCT", "NORMAL_FG_PCT", True),
    ("PCT_PLUSMINUS", "PCT_PLUSMINUS", True),
]
# leaguedashptdefend 對位防守：3 Pointers（NS_FG3_PCT = 對手平常三分命中率）
MATCHUP_3PT_FIELDS = [
    ("D_FG3A", "FG3A", False),
    ("D_FG3_PCT", "FG3_PCT", True),
    ("NORMAL_FG3_PCT", "NS_FG3_PCT", True),
    ("D_FG3_PLUSMINUS", "PLUSMINUS", True),
]
# leaguehustlestats{player|team} 拼勁數據（皆為每場計數，非百分比）
HUSTLE_FIELDS = [
    ("CONTESTED_SHOTS", "CONTESTED_SHOTS", False),
    ("CONTESTED_3PT", "CONTESTED_SHOTS_3PT", False),
    ("DEFLECTIONS", "DEFLECTIONS", False),
    ("CHARGES_DRAWN", "CHARGES_DRAWN", False),
    ("SCREEN_ASSISTS", "SCREEN_ASSISTS", False),
    ("LOOSE_BALLS", "LOOSE_BALLS_RECOVERED", False),
    ("BOX_OUTS", "BOX_OUTS", False),
]
# leaguedash{player|team}stats?MeasureType=Defense 防守 box
DEFENSE_BOX_FIELDS = [
    ("DEF_RATING", "DEF_RATING", False),
    ("STL", "STL", False),
    ("BLK", "BLK", False),
    ("DREB", "DREB", False),
    ("DREB_PCT", "DREB_PCT", True),
    ("OPP_PTS_PAINT", "OPP_PTS_PAINT", False),
    ("OPP_PTS_FB", "OPP_PTS_FB", False),
    ("OPP_PTS_2ND", "OPP_PTS_2ND_CHANCE", False),
]

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

# leaguedash* 系列共用的過濾參數（全部留空 = 不過濾）
LEAGUE_DASH_COMMON = (
    "College=&Conference=&Country=&DateFrom=&DateTo=&Division=&DraftPick=&DraftYear="
    "&GameScope=&Height=&LastNGames=0&LeagueID=00&Location=&Month=0&OpponentTeamID=0"
    "&Outcome=&PORound=0&PerMode=PerGame&PlayerExperience=&PlayerPosition="
    "&SeasonSegment=&StarterBench=&VsConference=&VsDivision=&Weight="
)


def _with_date(url, game_date):
    """把 leaguedash URL 的空 DateFrom/DateTo 換成指定單日（MM/DD/YYYY）以抓單場；
    game_date=None 時原樣回傳（不過濾）。Synergy 不吃日期，不適用此函式。"""
    if not game_date:
        return url
    return url.replace("DateFrom=&DateTo=", f"DateFrom={game_date}&DateTo={game_date}")


def nba_get(url, timeout=30):
    """發送帶有隨機 User-Agent 的 GET 請求"""
    SESSION.headers['User-Agent'] = random.choice(USER_AGENTS)
    return SESSION.get(url, timeout=timeout)


def fetch_with_retry(url, label, max_retries=3):
    """
    帶重試的抓取，回傳解析後的 JSON dict；重試耗盡回傳 None 並印出 [FAILED] 標記。
    每次呼叫（無論成敗）尾端休息 2 秒防擋。
    """
    data = None
    for attempt in range(max_retries):
        try:
            print(f"Fetching {label} (Attempt {attempt+1}/{max_retries})")
            res = nba_get(url)
            res.raise_for_status()
            data = res.json()
            break
        except Exception as e:
            print(f"Error fetching {label}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response Body: {e.response.text[:300]}")
            time.sleep(3 * (attempt + 1))  # 遞增等待，提高連續 500 時的成功率
    if data is None:
        print(f"[FAILED] {label}: {max_retries} 次重試皆失敗，本項資料將缺漏")
    time.sleep(2)
    return data


def safe_col(row, headers_list, col_name, default=0, pct=False):
    """安全取得欄位值，若欄位不存在或為 None 則回傳 default"""
    if col_name not in headers_list:
        return default
    val = row[headers_list.index(col_name)]
    if val is None:
        return default
    if pct:
        return round(val * 100, 1)
    return val


def apply_fields(target, row, headers_list, fields):
    """依設定表 (輸出欄名, API 欄名, 是否百分比) 將欄位寫入 target dict"""
    for out_name, api_name, is_pct in fields:
        target[out_name] = safe_col(row, headers_list, api_name, pct=is_pct)


# ==========================================
# 日期與賽別（以 UTC-5 美東時間為基準）
# ==========================================
def get_today_str():
    east_time = datetime.utcnow() - timedelta(hours=5)
    return east_time.strftime('%Y-%m-%d')


# 例行賽: 10/20 ~ 4/15，季後賽: 4/16 ~ 6/20
def get_season_type():
    east_time = datetime.utcnow() - timedelta(hours=5)
    m, d = east_time.month, east_time.day
    if (m == 10 and d >= 20) or m in [11, 12, 1, 2, 3] or (m == 4 and d <= 15):
        return "Regular+Season", "例行賽"
    elif (m == 4 and d >= 16) or m == 5 or (m == 6 and d <= 20):
        return "Playoffs", "季後賽"
    else:
        return None, None  # 休賽期


# ==========================================
# Firebase 初始化
# ==========================================
def init_firebase():
    """使用環境變數 FIREBASE_SERVICE_ACCOUNT 或本地 firebase-key.json 初始化"""
    firebase_cred_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if firebase_cred_json:
        cred = credentials.Certificate(json.loads(firebase_cred_json))
    elif os.path.exists("firebase-key.json"):
        cred = credentials.Certificate("firebase-key.json")
        print("🔑 使用本地 firebase-key.json 進行 Firebase 驗證")
    else:
        print("找不到 FIREBASE_SERVICE_ACCOUNT 環境變數或本地 firebase-key.json，將跳過 Firebase 寫入。")
        return None
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    return firestore.client()


# ==========================================
# 球隊名單
# ==========================================
def fetch_roster_with_ids(season):
    """抓取指定賽季的灰狼名單，回傳 [{'id': int, 'name': str}, ...]"""
    url = f"https://stats.nba.com/stats/commonteamroster?LeagueID=00&Season={season}&TeamID={TEAM_ID}"
    for attempt in range(3):
        try:
            print(f"Fetching {season} 灰狼名單 (Attempt {attempt+1}/3)...")
            # commonteamroster 用 safari15_5 比較不會被擋，故不用共用 SESSION
            res = requests.get(url, headers=SESSION.headers, impersonate="safari15_5", timeout=15)
            res.raise_for_status()
            data = res.json()
            headers_list = data['resultSets'][0]['headers']
            rows = data['resultSets'][0]['rowSet']
            roster = [
                {'id': row[headers_list.index("PLAYER_ID")], 'name': row[headers_list.index("PLAYER")]}
                for row in rows
            ]
            print(f"✅ {season} 共 {len(roster)} 位球員: {', '.join(p['name'] for p in roster)}")
            return roster
        except Exception as e:
            print(f"Error fetching roster: {e}")
            time.sleep(3)
    print(f"[FAILED] {season} 灰狼名單: 3 次重試皆失敗")
    return []


# ==========================================
# Synergy PlayType（攻守戰術數據）
# ==========================================
def fetch_synergy_data(season, season_type_api, player_or_team="T"):
    """
    抓取 Synergy 戰術數據（進攻與防守）
    player_or_team: 'T' 查球隊（過濾出灰狼）, 'P' 查球員（保留全聯盟，由呼叫端以名單過濾）
    回傳 list，球員項目含 playerId / playerName
    """
    results = []
    for side in ["offensive", "defensive"]:
        for ptype in PLAY_TYPES:
            if side == "defensive" and (ptype == "Cut" or ptype == "Misc"):
                continue  # 防守沒有這兩項
            url = (f"https://stats.nba.com/stats/synergyplaytypes"
                   f"?LeagueID=00&PerMode=PerGame&PlayType={ptype}"
                   f"&PlayerOrTeam={player_or_team}&SeasonType={season_type_api}"
                   f"&SeasonYear={season}&TypeGrouping={side}")
            data = fetch_with_retry(url, f"Synergy {ptype} ({side}) [{player_or_team}]")
            if data is None:
                continue
            headers_list = data['resultSets'][0]['headers']
            rows = data['resultSets'][0]['rowSet']
            if player_or_team == "T":
                rows = [r for r in rows if r[headers_list.index("TEAM_ID")] == TEAM_ID]
            for row in rows:
                # 門檻過濾：只要有任何球權資料 (POSS > 0) 就算達到門檻
                poss = row[headers_list.index("POSS")]
                if poss <= 0:
                    continue
                item = {
                    "playType": ptype,
                    "side": side,
                    "poss": poss,
                    "freq": round(row[headers_list.index("POSS_PCT")] * 100, 1),
                    "ppp": round(row[headers_list.index("PPP")], 2),
                    "fgPct": safe_col(row, headers_list, "FG_PCT", pct=True),
                    "percentile": safe_col(row, headers_list, "PERCENTILE", pct=True),
                }
                if player_or_team == "P":
                    item["playerId"] = row[headers_list.index("PLAYER_ID")]
                    item["playerName"] = row[headers_list.index("PLAYER_NAME")]
                results.append(item)
    return results


# ==========================================
# Tracking（leaguedashptstats 進階數據）
# ==========================================
def fetch_tracking_data(season, season_type_api, player_or_team="Team", game_date=None):
    """
    抓取 Tracking 進階數據（欄位由 TRACKING_FIELDS 設定表決定）
    球員模式回傳 dict，key 為 PlayerID 字串，值含 playerName（抓全聯盟，由呼叫端過濾）
    球隊模式回傳 dict，key 為 'MIN'
    game_date（MM/DD/YYYY）指定時抓該單場（單場回補用）
    """
    results = {}
    for measure_type in TRACKING_TYPES:
        # 球員模式抓全聯盟（TeamID=0），解決季中轉隊數據歸屬未更新的問題
        team_id_param = TEAM_ID if player_or_team == "Team" else 0
        url = _with_date((f"https://stats.nba.com/stats/leaguedashptstats?{LEAGUE_DASH_COMMON}"
               f"&PlayerOrTeam={player_or_team}&PtMeasureType={measure_type}"
               f"&Season={season}&SeasonType={season_type_api}&TeamID={team_id_param}"), game_date)
        data = fetch_with_retry(url, f"Tracking {measure_type} [{player_or_team}]")
        if data is None:
            continue
        headers_list = data['resultSets'][0]['headers']
        for row in data['resultSets'][0]['rowSet']:
            if player_or_team == "Player":
                ident = str(row[headers_list.index("PLAYER_ID")])
                if ident not in results:
                    results[ident] = {"playerName": row[headers_list.index("PLAYER_NAME")]}
            else:
                ident = "MIN"
                if ident not in results:
                    results[ident] = {}
            apply_fields(results[ident], row, headers_list, TRACKING_FIELDS[measure_type])
    return results


# ==========================================
# 投籃數據：分區命中率 + 投籃拆分
# ==========================================
def fetch_shot_locations(season, season_type_api, player_or_team="Player", game_date=None):
    """
    抓取分區投籃數據（leaguedash{player|team}shotlocations, DistanceRange=By Zone）
    此 endpoint 的 resultSets 為 dict 且 headers 為雙層（區域層 + 欄位層），需獨立解析。
    回傳結構同 fetch_tracking_data：球員以 PlayerID 字串為 key，球隊為 'MIN'。
    輸出欄位：{區域前綴}_FGM / _FGA / _FG_PCT（見 SHOT_ZONES）
    game_date（MM/DD/YYYY）指定時抓該單場
    """
    endpoint = "leaguedashplayershotlocations" if player_or_team == "Player" else "leaguedashteamshotlocations"
    team_id_param = TEAM_ID if player_or_team == "Team" else 0
    url = _with_date((f"https://stats.nba.com/stats/{endpoint}?{LEAGUE_DASH_COMMON}"
           f"&DistanceRange=By+Zone&MeasureType=Base&PaceAdjust=N&PlusMinus=N&Rank=N"
           f"&Period=0&ShotClockRange=&GameSegment="
           f"&Season={season}&SeasonType={season_type_api}&TeamID={team_id_param}"), game_date)
    results = {}
    data = fetch_with_retry(url, f"ShotLocations [{player_or_team}]")
    if data is None:
        return results
    rs = data['resultSets']  # dict 格式
    zone_header = rs['headers'][0]   # 區域層：columnsToSkip + columnSpan + columnNames
    flat_columns = rs['headers'][1]['columnNames']
    skip = zone_header['columnsToSkip']
    span = zone_header['columnSpan']
    zone_names = zone_header['columnNames']
    for row in rs['rowSet']:
        if player_or_team == "Player":
            ident = str(row[flat_columns.index("PLAYER_ID")])
            results[ident] = {"playerName": row[flat_columns.index("PLAYER_NAME")]}
        else:
            ident = "MIN"
            results[ident] = {}
        for prefix, zone_name in SHOT_ZONES:
            if zone_name not in zone_names:
                continue
            offset = skip + zone_names.index(zone_name) * span
            fgm, fga, fg_pct = row[offset], row[offset + 1], row[offset + 2]
            results[ident][f"{prefix}_FGM"] = fgm if fgm is not None else 0
            results[ident][f"{prefix}_FGA"] = fga if fga is not None else 0
            results[ident][f"{prefix}_FG_PCT"] = round(fg_pct * 100, 1) if fg_pct is not None else 0
    return results


def fetch_pt_shots(season, season_type_api, player_or_team="Player"):
    """
    抓取投籃拆分（leaguedash{player|team}ptshot, GeneralRange=Overall）：
    eFG%、2 分/3 分出手佔比與命中率。回傳結構同 fetch_shot_locations。
    """
    endpoint = "leaguedashplayerptshot" if player_or_team == "Player" else "leaguedashteamptshot"
    team_id_param = TEAM_ID if player_or_team == "Team" else 0
    url = (f"https://stats.nba.com/stats/{endpoint}?{LEAGUE_DASH_COMMON}"
           f"&CloseDefDistRange=&DribbleRange=&GeneralRange=Overall&Period=0"
           f"&ShotClockRange=&ShotDistRange=&TouchTimeRange="
           f"&Season={season}&SeasonType={season_type_api}&TeamID={team_id_param}")
    results = {}
    data = fetch_with_retry(url, f"PtShots [{player_or_team}]")
    if data is None:
        return results
    headers_list = data['resultSets'][0]['headers']
    for row in data['resultSets'][0]['rowSet']:
        if player_or_team == "Player":
            ident = str(row[headers_list.index("PLAYER_ID")])
            results[ident] = {"playerName": row[headers_list.index("PLAYER_NAME")]}
        else:
            ident = "MIN"
            results[ident] = {}
        apply_fields(results[ident], row, headers_list, PT_SHOT_FIELDS)
    return results


# ==========================================
# Clutch（最後 5 分鐘分差 5 分內）
# ==========================================
def fetch_clutch(season, season_type_api, player_or_team="Player"):
    """抓取關鍵時刻數據（leaguedash{player|team}clutch）。回傳結構同 fetch_pt_shots。"""
    endpoint = "leaguedashplayerclutch" if player_or_team == "Player" else "leaguedashteamclutch"
    team_id_param = TEAM_ID if player_or_team == "Team" else 0
    url = (f"https://stats.nba.com/stats/{endpoint}?{LEAGUE_DASH_COMMON}"
           f"&AheadBehind=Ahead+or+Behind&ClutchTime=Last+5+Minutes&PointDiff=5"
           f"&MeasureType=Base&PaceAdjust=N&PlusMinus=N&Rank=N&Period=0"
           f"&ShotClockRange=&GameSegment="
           f"&Season={season}&SeasonType={season_type_api}&TeamID={team_id_param}")
    results = {}
    data = fetch_with_retry(url, f"Clutch [{player_or_team}]")
    if data is None:
        return results
    headers_list = data['resultSets'][0]['headers']
    for row in data['resultSets'][0]['rowSet']:
        if player_or_team == "Player":
            ident = str(row[headers_list.index("PLAYER_ID")])
            results[ident] = {"playerName": row[headers_list.index("PLAYER_NAME")]}
        else:
            ident = "MIN"
            results[ident] = {}
        apply_fields(results[ident], row, headers_list, CLUTCH_FIELDS)
    return results


# ==========================================
# 陣容（五人組合）
# ==========================================
def fetch_lineups(season, season_type_api, top_n=10):
    """
    抓取灰狼五人陣容進階數據（leaguedashlineups, MeasureType=Advanced）。
    注意：此 endpoint 的 TeamID 參數實測無效（仍回傳全聯盟），故在程式端過濾。
    回傳依上場時間排序的前 top_n 組 list。
    """
    url = (f"https://stats.nba.com/stats/leaguedashlineups?{LEAGUE_DASH_COMMON}"
           f"&GroupQuantity=5&MeasureType=Advanced&PaceAdjust=N&PlusMinus=N&Rank=N"
           f"&Period=0&ShotClockRange=&GameSegment="
           f"&Season={season}&SeasonType={season_type_api}&TeamID={TEAM_ID}")
    results = []
    data = fetch_with_retry(url, "Lineups [Team]")
    if data is None:
        return results
    headers_list = data['resultSets'][0]['headers']
    for row in data['resultSets'][0]['rowSet']:
        if row[headers_list.index("TEAM_ID")] != TEAM_ID:
            continue
        item = {"players": row[headers_list.index("GROUP_NAME")]}
        apply_fields(item, row, headers_list, LINEUP_FIELDS)
        results.append(item)
    results.sort(key=lambda x: x.get("MIN", 0), reverse=True)
    return results[:top_n]


# ==========================================
# 防守：對位防守（leaguedashptdefend，僅球員）
# ==========================================
def fetch_matchup_defense(season, season_type_api, game_date=None):
    """
    對位防守（被該球員防守時對手的命中率）。此 endpoint 以 defender 為主鍵，僅球員層級。
    合併 Overall 與 3 Pointers 兩類。回傳 {PlayerID字串: {playerName, ...}}。
    game_date（MM/DD/YYYY）指定時抓該單場
    """
    results = {}
    for category, fields, label in [
        ("Overall", MATCHUP_OVERALL_FIELDS, "Overall"),
        ("3+Pointers", MATCHUP_3PT_FIELDS, "3PT"),
    ]:
        url = _with_date((f"https://stats.nba.com/stats/leaguedashptdefend?{LEAGUE_DASH_COMMON}"
               f"&DefenseCategory={category}&Season={season}&SeasonType={season_type_api}&TeamID={TEAM_ID}"), game_date)
        data = fetch_with_retry(url, f"MatchupDefense {label}")
        if data is None:
            continue
        headers_list = data['resultSets'][0]['headers']
        for row in data['resultSets'][0]['rowSet']:
            ident = str(row[headers_list.index("CLOSE_DEF_PERSON_ID")])
            if ident not in results:
                results[ident] = {"playerName": row[headers_list.index("PLAYER_NAME")]}
            apply_fields(results[ident], row, headers_list, fields)
    return results


# ==========================================
# 防守：Hustle 拼勁（leaguehustlestats{player|team}）
# ==========================================
def fetch_hustle(season, season_type_api, player_or_team="Player", game_date=None):
    """抓取拼勁數據。球員以 PlayerID 字串為 key（含 playerName），球隊為 'MIN'。
    game_date（MM/DD/YYYY）指定時抓該單場。"""
    endpoint = "leaguehustlestatsplayer" if player_or_team == "Player" else "leaguehustlestatsteam"
    team_id_param = TEAM_ID if player_or_team == "Team" else 0
    url = _with_date((f"https://stats.nba.com/stats/{endpoint}?{LEAGUE_DASH_COMMON}"
           f"&PlayerOrTeam={player_or_team}&Season={season}&SeasonType={season_type_api}&TeamID={team_id_param}"), game_date)
    results = {}
    data = fetch_with_retry(url, f"Hustle [{player_or_team}]")
    if data is None:
        return results
    headers_list = data['resultSets'][0]['headers']
    for row in data['resultSets'][0]['rowSet']:
        if player_or_team == "Player":
            ident = str(row[headers_list.index("PLAYER_ID")])
            results[ident] = {"playerName": row[headers_list.index("PLAYER_NAME")]}
        else:
            ident = "MIN"
            results[ident] = {}
        apply_fields(results[ident], row, headers_list, HUSTLE_FIELDS)
    return results


# ==========================================
# 防守：防守 box（leaguedash{player|team}stats?MeasureType=Defense）
# ==========================================
def fetch_defense_box(season, season_type_api, player_or_team="Player"):
    """防守 box（防守效率、抄截、阻攻、對手各類得分）。回傳結構同 fetch_hustle。"""
    endpoint = "leaguedashplayerstats" if player_or_team == "Player" else "leaguedashteamstats"
    team_id_param = TEAM_ID if player_or_team == "Team" else 0
    url = (f"https://stats.nba.com/stats/{endpoint}?{LEAGUE_DASH_COMMON}"
           f"&MeasureType=Defense&PaceAdjust=N&PlusMinus=N&Rank=N&Period=0"
           f"&ShotClockRange=&GameSegment=&PlayerOrTeam={player_or_team}"
           f"&Season={season}&SeasonType={season_type_api}&TeamID={team_id_param}")
    results = {}
    data = fetch_with_retry(url, f"DefenseBox [{player_or_team}]")
    if data is None:
        return results
    headers_list = data['resultSets'][0]['headers']
    for row in data['resultSets'][0]['rowSet']:
        if player_or_team == "Player":
            ident = str(row[headers_list.index("PLAYER_ID")])
            results[ident] = {"playerName": row[headers_list.index("PLAYER_NAME")]}
        else:
            ident = "MIN"
            results[ident] = {}
        apply_fields(results[ident], row, headers_list, DEFENSE_BOX_FIELDS)
    return results


# ==========================================
# 防守：對手分區命中（leaguedashteamshotlocations?MeasureType=Opponent，僅球隊）
# ==========================================
def fetch_opp_shot_locations(season, season_type_api):
    """
    對手在各區的出手與命中率（球隊防守熱圖用）。雙層 header，比照 fetch_shot_locations。
    輸出 {'MIN': {區域前綴_OPP_FGA / _OPP_FG_PCT}}。
    """
    url = (f"https://stats.nba.com/stats/leaguedashteamshotlocations?{LEAGUE_DASH_COMMON}"
           f"&DistanceRange=By+Zone&MeasureType=Opponent&PaceAdjust=N&PlusMinus=N&Rank=N"
           f"&Period=0&ShotClockRange=&GameSegment="
           f"&Season={season}&SeasonType={season_type_api}&TeamID={TEAM_ID}")
    results = {}
    data = fetch_with_retry(url, "OppShotLocations [Team]")
    if data is None:
        return results
    rs = data['resultSets']
    zone_header = rs['headers'][0]
    skip = zone_header['columnsToSkip']
    span = zone_header['columnSpan']
    zone_names = zone_header['columnNames']
    for row in rs['rowSet']:
        results["MIN"] = {}
        for prefix, zone_name in SHOT_ZONES:
            if zone_name not in zone_names:
                continue
            offset = skip + zone_names.index(zone_name) * span
            fga, fg_pct = row[offset + 1], row[offset + 2]  # OPP_FGM, OPP_FGA, OPP_FG_PCT
            results["MIN"][f"{prefix}_OPP_FGA"] = fga if fga is not None else 0
            results["MIN"][f"{prefix}_OPP_FG_PCT"] = round(fg_pct * 100, 1) if fg_pct is not None else 0
    return results
