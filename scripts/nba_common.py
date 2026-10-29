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
import time
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta

# ==========================================
# 常數
# ==========================================
TEAM_ID = 1610612750  # 灰狼

# 薪資資料來源：Google Sheet「Wolves Tracker 薪資資料」發佈到網路的 CSV（公開唯讀，非機密）
# 每個分頁用 gid 取：{SALARY_SHEET_PUB}?gid=<gid>&single=true&output=csv；sync_salary.py 讀取
SALARY_SHEET_PUB = ("https://docs.google.com/spreadsheets/d/e/"
                    "2PACX-1vSvujkKyJ0bqE9wU8_Wnj02hQOuW0MXkZAxouQ20CQpJLCwL2BdfMUT3SpEEJbHhsh7AXewedGDSa-8/pub")
SALARY_SHEET_GIDS = {
    "contracts": 718360859, "dead": 4688222, "thresholds": 50931558, "tax_rates": 1979221895,
    "rules": 732556980, "picks": 631729626, "settings": 1385596547, "tax_history": 854944861,
}

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
        ("DRIVE_FGA", "DRIVE_FGA", False),        # 分母（供區間加權重算 DRIVE_FG_PCT）
        ("DRIVE_FG_PCT", "DRIVE_FG_PCT", True),
        ("DRIVE_PTS", "DRIVE_PTS", False),        # 分子（供區間加權）
        ("DRIVE_PTS_PCT", "DRIVE_PTS_PCT", True),
        ("DRIVE_AST_PCT", "DRIVE_AST_PCT", True),
        ("DRIVE_TOV", "DRIVE_TOV", False),        # 分子（供區間加權）
        ("DRIVE_TOV_PCT", "DRIVE_TOV_PCT", True),
    ],
    "CatchShoot": [
        ("CATCH_SHOOT_FGM", "CATCH_SHOOT_FGM", False),      # 分子（eFG 加權）
        ("CATCH_SHOOT_FGA", "CATCH_SHOOT_FGA", False),
        ("CATCH_SHOOT_FG3M", "CATCH_SHOOT_FG3M", False),    # 分子（eFG 加權）
        ("CATCH_SHOOT_FG3A", "CATCH_SHOOT_FG3A", False),
        ("CATCH_SHOOT_PTS", "CATCH_SHOOT_PTS", False),
        ("CATCH_SHOOT_FG3_PCT", "CATCH_SHOOT_FG3_PCT", True),
        ("CATCH_SHOOT_EFG_PCT", "CATCH_SHOOT_EFG_PCT", True),
    ],
    "PullUpShot": [
        ("PULL_UP_FGM", "PULL_UP_FGM", False),      # 分子（eFG 加權）
        ("PULL_UP_FGA", "PULL_UP_FGA", False),
        ("PULL_UP_FG3M", "PULL_UP_FG3M", False),    # 分子（eFG 加權）
        ("PULL_UP_FG3A", "PULL_UP_FG3A", False),
        ("PULL_UP_PTS", "PULL_UP_PTS", False),
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

# leaguedash{player|team}stats?MeasureType=Base 傳統基本數據（單場/區間加總的主體）
# 皆為每場計數（PerMode=PerGame），百分比欄位 *100
BASE_FIELDS = [
    ("GP", "GP", False),
    ("W", "W", False),
    ("L", "L", False),
    ("MIN", "MIN", False),
    ("PTS", "PTS", False),
    ("FGM", "FGM", False),
    ("FGA", "FGA", False),
    ("FG_PCT", "FG_PCT", True),
    ("FG3M", "FG3M", False),
    ("FG3A", "FG3A", False),
    ("FG3_PCT", "FG3_PCT", True),
    ("FTM", "FTM", False),
    ("FTA", "FTA", False),
    ("FT_PCT", "FT_PCT", True),
    ("OREB", "OREB", False),
    ("DREB", "DREB", False),
    ("REB", "REB", False),
    ("AST", "AST", False),
    ("STL", "STL", False),
    ("BLK", "BLK", False),
    ("TOV", "TOV", False),
    ("PF", "PF", False),
    ("PLUS_MINUS", "PLUS_MINUS", False),
]

# leaguedash{player|team}stats?MeasureType=Scoring 受助攻比例（投籃分頁用；皆為比例 *100）
ASSISTED_FIELDS = [
    ("PCT_AST_2PM", "PCT_AST_2PM", True),
    ("PCT_UAST_2PM", "PCT_UAST_2PM", True),
    ("PCT_AST_3PM", "PCT_AST_3PM", True),
    ("PCT_UAST_3PM", "PCT_UAST_3PM", True),
    ("PCT_AST_FGM", "PCT_AST_FGM", True),
    ("PCT_UAST_FGM", "PCT_UAST_FGM", True),
]

# teamplayeronoffdetails?MeasureType=Advanced 在場/不在場（球員專屬；非百分比，效率值原樣）
# fetch_onoff 會為 On/Off 兩態各加前綴 ON_ / OFF_
ONOFF_FIELDS = [
    ("OFF_RATING", "OFF_RATING", False),
    ("DEF_RATING", "DEF_RATING", False),
    ("NET_RATING", "NET_RATING", False),
    ("PACE", "PACE", False),
    ("MIN", "MIN", False),
]

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
# 注意：此 endpoint 的 MIN 一律是「總分鐘」——實測 PerMode=PerGame 與 Totals 回傳相同（2026-10 驗證），前端標示為總分鐘
LINEUP_FIELDS = [
    ("GP", "GP", False),
    ("MIN", "MIN", False),
    ("OFF_RATING", "OFF_RATING", False),
    ("DEF_RATING", "DEF_RATING", False),
    ("NET_RATING", "NET_RATING", False),
    ("TS_PCT", "TS_PCT", True),
]

# ── 防守數據欄位設定表 ──
# leaguedashptdefend 最近防守者（NBA.com Defense Dashboard，非 leagueseasonmatchups 的對位資料）：Overall（D_FG_PCT = 被此人防守時對手命中率；PCT_PLUSMINUS 負=守得好）
MATCHUP_OVERALL_FIELDS = [
    ("D_FGM", "D_FGM", False),        # 分子（供區間加權重算 D_FG_PCT）
    ("D_FGA", "D_FGA", False),
    ("D_FG_PCT", "D_FG_PCT", True),
    ("NORMAL_FG_PCT", "NORMAL_FG_PCT", True),
    ("PCT_PLUSMINUS", "PCT_PLUSMINUS", True),
]
# leaguedashptdefend 對位防守：3 Pointers（NS_FG3_PCT = 對手平常三分命中率）
MATCHUP_3PT_FIELDS = [
    ("D_FG3M", "FG3M", False),        # 分子（供區間加權重算 D_FG3_PCT）
    ("D_FG3A", "FG3A", False),
    ("D_FG3_PCT", "FG3_PCT", True),
    ("NORMAL_FG3_PCT", "NS_FG3_PCT", True),
    ("D_FG3_PLUSMINUS", "PLUSMINUS", True),
]
# leaguehustlestats{player|team} 拼勁數據：計數為每場平均，PCT_* 為比例（×100）
# 2026-10-23 補欄位。endpoint 另有 6 欄刻意不抓（已與使用者確認）：
#   BOX_OUT_PLAYER_TEAM_REBS、PCT_BOX_OUTS_TEAM_REB——實測恆等於 BOX_OUTS／100%（NBA 只在球隊搶到籃板時記卡位）
#   PCT_BOX_OUTS_OFF/DEF、PCT_LOOSE_BALLS_RECOVERED_OFF/DEF——可由進攻／防守次數推得
HUSTLE_FIELDS = [
    ("CONTESTED_SHOTS", "CONTESTED_SHOTS", False),
    ("CONTESTED_2PT", "CONTESTED_SHOTS_2PT", False),
    ("CONTESTED_3PT", "CONTESTED_SHOTS_3PT", False),
    ("DEFLECTIONS", "DEFLECTIONS", False),
    ("CHARGES_DRAWN", "CHARGES_DRAWN", False),
    ("SCREEN_ASSISTS", "SCREEN_ASSISTS", False),
    ("SCREEN_AST_PTS", "SCREEN_AST_PTS", False),
    ("LOOSE_BALLS", "LOOSE_BALLS_RECOVERED", False),
    ("OFF_LOOSE_BALLS", "OFF_LOOSE_BALLS_RECOVERED", False),
    ("DEF_LOOSE_BALLS", "DEF_LOOSE_BALLS_RECOVERED", False),
    ("BOX_OUTS", "BOX_OUTS", False),
    ("OFF_BOXOUTS", "OFF_BOXOUTS", False),
    ("DEF_BOXOUTS", "DEF_BOXOUTS", False),
    ("BOX_OUT_REBS", "BOX_OUT_PLAYER_REBS", False),
    ("PCT_BOX_OUTS_REB", "PCT_BOX_OUTS_REB", True),
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
# leaguedashteamstats?MeasureType=Advanced 全隊進階（僅球隊；API 的比例欄皆為 0～1，*100）
ADVANCED_FIELDS = [
    ("OFF_RATING", "OFF_RATING", False),
    ("DEF_RATING", "DEF_RATING", False),
    ("NET_RATING", "NET_RATING", False),
    ("PACE", "PACE", False),
    ("TS_PCT", "TS_PCT", True),
    ("EFG_PCT", "EFG_PCT", True),
    ("AST_PCT", "AST_PCT", True),
    ("TM_TOV_PCT", "TM_TOV_PCT", True),
    ("OREB_PCT", "OREB_PCT", True),
    ("DREB_PCT", "DREB_PCT", True),
]

# ── 聯盟名次（每日快照 ranks 欄位，見 league_ranks）──
# 預設「數值大＝第 1」（次數類也照數量排，對應「出手數聯盟第 4」的寫法）。
# 新增全隊欄位時判斷方向：越低越好 → 加進 RANK_LOWER_BETTER；排名沒有意義 → 加進 RANK_SKIP。
# 兩表的項目以 * 開頭代表「欄名結尾符合」（例 *_OPP_FG_PCT 涵蓋各分區）
RANK_LOWER_BETTER = {
    "L", "TOV", "PF", "DEF_RATING", "TM_TOV_PCT", "DRIVE_TOV", "DRIVE_TOV_PCT",
    "OPP_PTS_PAINT", "OPP_PTS_FB", "OPP_PTS_2ND", "*_OPP_FG_PCT",
}
RANK_SKIP = {"GP", "MIN", "AVG_REB_DIST", "*_OPP_FGA"}

# 瀏覽器指紋（curl_cffi impersonate）：stats.nba.com 前面的 Akamai 會擋特定 TLS 指紋，被擋時不回 403、
# 直接讓請求逾時（2026-10-29 chrome110 全部逾時、safari15_5 正常）。這次執行第一項就失敗時依序換下一個各試 1 次，
# 成功的記在 FINGERPRINT_PATH（本機產物、不進版控），下次從它開始；刪掉該檔就從清單第一個重來。
# 可用名稱依 curl_cffi 版本而定（0.6.2：curl_cffi.requests.BrowserType）；挑跨瀏覽器家族，避免一次全被擋
FINGERPRINTS = ["safari15_5", "safari17_0", "chrome120", "edge101", "chrome110"]
FINGERPRINT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "nba_fingerprint.json")


def _load_fingerprint():
    try:
        with open(FINGERPRINT_PATH, encoding="utf-8") as f:
            fp = json.load(f).get("current")
        if fp in FINGERPRINTS:
            return fp
    except (OSError, ValueError):
        pass
    return FINGERPRINTS[0]


_fp = {"current": _load_fingerprint(), "tried_all": False}
_fp["start"] = _fp["current"]


def fingerprint_info():
    """這次執行用的指紋、有沒有中途換過、是不是全部換過都沒回應：
    {'fingerprint': 'safari15_5', 'switchedFrom': 'chrome110' 或 '', 'triedAll': bool}"""
    switched = _fp["current"] != _fp["start"]
    return {"fingerprint": _fp["current"], "switchedFrom": _fp["start"] if switched else "",
            "triedAll": _fp["tried_all"] and not switched}


def _save_fingerprint(prev):
    try:
        with open(FINGERPRINT_PATH, "w", encoding="utf-8") as f:
            json.dump({"current": _fp["current"], "switchedFrom": prev,
                       "updatedAt": datetime.now().isoformat(timespec="seconds")}, f, ensure_ascii=False, indent=2)
    except OSError as e:
        print(f"⚠️ 指紋紀錄寫入失敗：{e}")


# User-Agent 不另外設：由 impersonate 帶出與 TLS 指紋相符的 UA（舊版每次隨機換 UA，常與指紋對不上，反而像機器人）
SESSION = requests.Session()
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


def _team_key(team_id):
    """球隊模式結果的 key：灰狼固定 'MIN'（既有文件格式），其他隊用 TEAM_ID 字串（單場抓對手用）"""
    return "MIN" if int(team_id) == TEAM_ID else str(team_id)


def _with_date(url, game_date):
    """把 leaguedash URL 的空 DateFrom/DateTo 換成指定單日（MM/DD/YYYY）以抓單場；
    game_date=None 時原樣回傳（不過濾）。Synergy 不吃日期，不適用此函式。"""
    if not game_date:
        return url
    return url.replace("DateFrom=&DateTo=", f"DateFrom={game_date}&DateTo={game_date}")


def nba_get(url, timeout=30, impersonate=None):
    """以目前的瀏覽器指紋（或指定的 impersonate）發送 GET 請求"""
    return SESSION.get(url, timeout=timeout, impersonate=impersonate or _fp["current"])


def _try_other_fingerprints(url, label):
    """這次執行還沒成功過、第一項重試耗盡 → 依序換其他指紋各試 1 次；成功就記住並回傳資料，全失敗回 None
    （每次執行只試一輪；全失敗多半是 IP 被擋或伺服器問題，交給 block guard 收手）"""
    _fp["tried_all"] = True
    prev = _fp["current"]
    for fp in FINGERPRINTS:
        if fp == prev:
            continue
        print(f"🔁 指紋 {prev} 沒回應，改試 {fp}：{label}")
        try:
            res = nba_get(url, impersonate=fp)
            res.raise_for_status()
            data = res.json()
        except Exception as e:
            print(f"Error fetching {label} [{fp}]: {e}")
            time.sleep(2)
            continue
        _fp["current"] = fp
        _save_fingerprint(prev)
        print(f"🔁 指紋 {prev} 沒回應，改用 {fp}（已記住）")
        return data
    print(f"🔁 {len(FINGERPRINTS)} 個指紋都沒回應（多半是 IP 被擋或伺服器問題，不是指紋）")
    return None


class NBABlockedError(Exception):
    """開頭連續 BLOCK_ABORT_AFTER 項都失敗、且這次執行還沒有任何一項成功 → 疑似被 NBA 擋"""


BLOCK_ABORT_AFTER = 3  # 被擋時每項要等 3×30 秒逾時，整次完整抓取會拖 2 小時、送出幾百個 request
_block_guard = {"on": False, "ok": 0, "fails": 0}


def enable_block_guard():
    """開啟後 fetch_with_retry 在「開頭連續失敗」時丟 NBABlockedError 讓呼叫端提早結束；
    中途零星失敗（已有成功項目）不影響。目前只有 fetch_data.py 開啟"""
    _block_guard.update(on=True, ok=0, fails=0)


def _block_guard_update(ok):
    g = _block_guard
    if ok:
        g["ok"] += 1
        g["fails"] = 0
        return
    g["fails"] += 1
    if g["on"] and g["ok"] == 0 and g["fails"] >= BLOCK_ABORT_AFTER:
        raise NBABlockedError(f"開頭連續 {g['fails']} 項都失敗")


def fetch_with_retry(url, label, max_retries=3):
    """
    帶重試的抓取，回傳解析後的 JSON dict；重試耗盡回傳 None 並印出 [FAILED] 標記。
    每次呼叫（無論成敗）尾端休息 2 秒防擋。開了 enable_block_guard() 時，開頭連續失敗會丟 NBABlockedError
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
    if data is None and _block_guard["ok"] == 0 and not _fp["tried_all"]:
        data = _try_other_fingerprints(url, label)
    if data is None:
        print(f"[FAILED] {label}: {max_retries} 次重試皆失敗，本項資料將缺漏")
    _block_guard_update(data is not None)
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


def _season_str(start_year):
    return f"{start_year}-{(start_year + 1) % 100:02d}"


def get_current_season():
    """資料賽季（每日快照/投籃熱圖/前端「當季」）：10/20 例行賽起點切換，與 get_season_type 同界。
    休賽期仍指向剛打完的那季（前端顯示「最終」）。前端 constants.js 的 seasonForDate 為同一規則，改界線要兩邊一起改。"""
    east_time = datetime.utcnow() - timedelta(hours=5)
    y, m, d = east_time.year, east_time.month, east_time.day
    return _season_str(y if (m, d) >= (10, 20) else y - 1)


def get_roster_season():
    """名冊賽季（新援判定/isCurrentRoster、薪資當季）：7/1 切換，休賽期即看下一季的新名冊。
    前端 constants.js 的 capSeasonForDate 為同一規則，改界線要兩邊一起改。"""
    east_time = datetime.utcnow() - timedelta(hours=5)
    return _season_str(east_time.year if east_time.month >= 7 else east_time.year - 1)


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
    # 走 fetch_with_retry：--games-only 時名冊是第一個請求，要能觸發換指紋與 block guard
    data = fetch_with_retry(url, f"{season} 灰狼名單")
    if data is None:
        return []
    headers_list = data['resultSets'][0]['headers']
    rows = data['resultSets'][0]['rowSet']
    roster = [
        {'id': row[headers_list.index("PLAYER_ID")], 'name': row[headers_list.index("PLAYER")]}
        for row in rows
    ]
    print(f"✅ {season} 共 {len(roster)} 位球員: {', '.join(p['name'] for p in roster)}")
    return roster


def fetch_team_game_log(season, season_type_api):
    """灰狼賽程（teamgamelog），回傳 [(doc_date 'YYYY-MM-DD', api_date 'MM/DD/YYYY', matchup, wl, game_id), ...]，由舊到新。
    供單場回補（每場日期）與每日單場擷取（找當天 matchup/wl + 寫比賽索引）共用。"""
    url = (f"https://stats.nba.com/stats/teamgamelog?LeagueID=00&Season={season}"
           f"&SeasonType={season_type_api}&TeamID={TEAM_ID}")
    data = fetch_with_retry(url, "TeamGameLog")
    if data is None:
        return []
    h = data['resultSets'][0]['headers']
    rows = data['resultSets'][0]['rowSet']
    out = []
    for r in rows:
        gd = datetime.strptime(r[h.index("GAME_DATE")], "%b %d, %Y")
        out.append((gd.strftime("%Y-%m-%d"), gd.strftime("%m/%d/%Y"),
                    r[h.index("MATCHUP")], r[h.index("WL")], r[h.index("Game_ID")]))
    out.reverse()  # 由舊到新
    return out


# ==========================================
# Synergy PlayType（攻守戰術數據）
# ==========================================
def fetch_synergy_data(season, season_type_api, player_or_team="T"):
    """
    抓取 Synergy 戰術數據（進攻與防守）
    player_or_team: 'T' 查球隊（過濾出灰狼）, 'P' 查球員（保留全聯盟，由呼叫端以名單過濾）
    回傳 list，球員項目含 playerId / playerName

    使用 PerMode=Totals 抓整數總量（gp/possTotal/ptsTotal/fgmTotal/fgaTotal），
    供未來單場 PlayType 相減還原；顯示用的 poss（每場）由總量 / GP 推導，
    比率（freq/ppp/fgPct/percentile）與 PerGame 模式相同。Synergy 不支援日期篩選。
    """
    results = []
    for side in ["offensive", "defensive"]:
        for ptype in PLAY_TYPES:
            if side == "defensive" and (ptype == "Cut" or ptype == "Misc"):
                continue  # 防守沒有這兩項
            url = (f"https://stats.nba.com/stats/synergyplaytypes"
                   f"?LeagueID=00&PerMode=Totals&PlayType={ptype}"
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
                # 門檻過濾：只要有任何球權（POSS 總量 > 0）就算達到門檻
                poss_total = row[headers_list.index("POSS")]
                if poss_total <= 0:
                    continue
                gp = safe_col(row, headers_list, "GP")
                item = {
                    "playType": ptype,
                    "side": side,
                    "poss": round(poss_total / gp, 1) if gp else 0,  # 顯示用每場球權
                    "freq": round(row[headers_list.index("POSS_PCT")] * 100, 1),
                    "ppp": round(row[headers_list.index("PPP")], 2),
                    "fgPct": safe_col(row, headers_list, "FG_PCT", pct=True),
                    "percentile": safe_col(row, headers_list, "PERCENTILE", pct=True),
                    # 單場相減還原用整數總量
                    "gp": gp,
                    "possTotal": poss_total,
                    "ptsTotal": safe_col(row, headers_list, "PTS"),
                    "fgmTotal": safe_col(row, headers_list, "FGM"),
                    "fgaTotal": safe_col(row, headers_list, "FGA"),
                }
                if player_or_team == "P":
                    item["playerId"] = row[headers_list.index("PLAYER_ID")]
                    item["playerName"] = row[headers_list.index("PLAYER_NAME")]
                results.append(item)
    return results


# ==========================================
# Tracking（leaguedashptstats 進階數據）
# ==========================================
def fetch_tracking_data(season, season_type_api, player_or_team="Team", game_date=None, team_id=TEAM_ID):
    """
    抓取 Tracking 進階數據（欄位由 TRACKING_FIELDS 設定表決定）
    球員模式回傳 dict，key 為 PlayerID 字串，值含 playerName（抓全聯盟，由呼叫端過濾）
    球隊模式回傳 dict，key 為 'MIN'（team_id=0 時含當天所有球隊，其他隊 key 為 TEAM_ID 字串）
    game_date（MM/DD/YYYY）指定時抓該單場（單場回補用）
    """
    results = {}
    for measure_type in TRACKING_TYPES:
        # 球員模式抓全聯盟（TeamID=0），解決季中轉隊數據歸屬未更新的問題
        team_id_param = team_id if player_or_team == "Team" else 0
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
                ident = _team_key(row[headers_list.index("TEAM_ID")])
                if ident not in results:
                    results[ident] = {}
            apply_fields(results[ident], row, headers_list, TRACKING_FIELDS[measure_type])
    return results


# ==========================================
# 投籃數據：分區命中率 + 投籃拆分
# ==========================================
def fetch_shot_locations(season, season_type_api, player_or_team="Player", game_date=None, team_id=TEAM_ID):
    """
    抓取分區投籃數據（leaguedash{player|team}shotlocations, DistanceRange=By Zone）
    此 endpoint 的 resultSets 為 dict 且 headers 為雙層（區域層 + 欄位層），需獨立解析。
    回傳結構同 fetch_tracking_data：球員以 PlayerID 字串為 key，球隊為 'MIN'。
    輸出欄位：{區域前綴}_FGM / _FGA / _FG_PCT（見 SHOT_ZONES）
    game_date（MM/DD/YYYY）指定時抓該單場
    """
    endpoint = "leaguedashplayershotlocations" if player_or_team == "Player" else "leaguedashteamshotlocations"
    team_id_param = team_id if player_or_team == "Team" else 0
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
            ident = _team_key(row[flat_columns.index("TEAM_ID")])
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


def fetch_pt_shots(season, season_type_api, player_or_team="Player", team_id=TEAM_ID):
    """
    抓取投籃拆分（leaguedash{player|team}ptshot, GeneralRange=Overall）：
    eFG%、2 分/3 分出手佔比與命中率。回傳結構同 fetch_shot_locations。
    球隊模式 team_id=0 時回傳全聯盟（排名用）。
    """
    endpoint = "leaguedashplayerptshot" if player_or_team == "Player" else "leaguedashteamptshot"
    team_id_param = team_id if player_or_team == "Team" else 0
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
            ident = _team_key(row[headers_list.index("TEAM_ID")])
            results[ident] = {}
        apply_fields(results[ident], row, headers_list, PT_SHOT_FIELDS)
    return results


# ==========================================
# Clutch（最後 5 分鐘分差 5 分內）
# ==========================================
def fetch_clutch(season, season_type_api, player_or_team="Player", team_id=TEAM_ID):
    """抓取關鍵時刻數據（leaguedash{player|team}clutch）。回傳結構同 fetch_pt_shots。"""
    endpoint = "leaguedashplayerclutch" if player_or_team == "Player" else "leaguedashteamclutch"
    team_id_param = team_id if player_or_team == "Team" else 0
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
            ident = _team_key(row[headers_list.index("TEAM_ID")])
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
def fetch_matchup_defense(season, season_type_api, game_date=None, team_id=TEAM_ID):
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
               f"&DefenseCategory={category}&Season={season}&SeasonType={season_type_api}&TeamID={team_id}"), game_date)
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
def fetch_hustle(season, season_type_api, player_or_team="Player", game_date=None, team_id=TEAM_ID):
    """抓取拼勁數據。球員以 PlayerID 字串為 key（含 playerName），球隊為 'MIN'。
    game_date（MM/DD/YYYY）指定時抓該單場。"""
    endpoint = "leaguehustlestatsplayer" if player_or_team == "Player" else "leaguehustlestatsteam"
    team_id_param = team_id if player_or_team == "Team" else 0
    url = _with_date((f"https://stats.nba.com/stats/{endpoint}?{LEAGUE_DASH_COMMON}"
           f"&PlayerOrTeam={player_or_team}&Season={season}&SeasonType={season_type_api}&TeamID={team_id_param}"), game_date)
    results = {}
    data = fetch_with_retry(url, f"Hustle [{player_or_team}]")
    if data is None:
        return results
    headers_list = data['resultSets'][0]['headers']
    # 只寫 endpoint 真的有的欄位：球隊版沒有 BOX_OUT_PLAYER_REBS／PCT_BOX_OUTS_REB，
    # 走 apply_fields 會被 safe_col 補成 0，前端就顯示成假的「0」
    hustle_fields = [f for f in HUSTLE_FIELDS if f[1] in headers_list]
    for row in data['resultSets'][0]['rowSet']:
        if player_or_team == "Player":
            ident = str(row[headers_list.index("PLAYER_ID")])
            results[ident] = {"playerName": row[headers_list.index("PLAYER_NAME")]}
        else:
            ident = _team_key(row[headers_list.index("TEAM_ID")])
            results[ident] = {}
        apply_fields(results[ident], row, headers_list, hustle_fields)
    return results


# ==========================================
# 防守：防守 box（leaguedash{player|team}stats?MeasureType=Defense）
# ==========================================
def fetch_defense_box(season, season_type_api, player_or_team="Player", team_id=TEAM_ID):
    """防守 box（防守效率、抄截、阻攻、對手各類得分）。回傳結構同 fetch_hustle。"""
    endpoint = "leaguedashplayerstats" if player_or_team == "Player" else "leaguedashteamstats"
    team_id_param = team_id if player_or_team == "Team" else 0
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
            ident = _team_key(row[headers_list.index("TEAM_ID")])
            results[ident] = {}
        apply_fields(results[ident], row, headers_list, DEFENSE_BOX_FIELDS)
    return results


# ==========================================
# 全隊進階（leaguedashteamstats?MeasureType=Advanced，僅球隊）
# ==========================================
def fetch_team_advanced(season, season_type_api, team_id=TEAM_ID):
    """全隊進階效率（OffRtg/DefRtg/NetRtg/Pace/TS%/eFG%/AST%/TOV%/OREB%/DREB%，欄位見 ADVANCED_FIELDS）。
    回傳 {'MIN': {...}}；team_id=0 時含全聯盟（其他隊 key 為 TEAM_ID 字串，排名用）。"""
    url = (f"https://stats.nba.com/stats/leaguedashteamstats?{LEAGUE_DASH_COMMON}"
           f"&MeasureType=Advanced&PaceAdjust=N&PlusMinus=N&Rank=N&Period=0"
           f"&ShotClockRange=&GameSegment=&PlayerOrTeam=Team"
           f"&Season={season}&SeasonType={season_type_api}&TeamID={team_id}")
    results = {}
    data = fetch_with_retry(url, "Advanced [Team]")
    if data is None:
        return results
    headers_list = data['resultSets'][0]['headers']
    for row in data['resultSets'][0]['rowSet']:
        ident = _team_key(row[headers_list.index("TEAM_ID")])
        results[ident] = {}
        apply_fields(results[ident], row, headers_list, ADVANCED_FIELDS)
    return results


# ==========================================
# 傳統基本數據（leaguedash{player|team}stats?MeasureType=Base）
# ==========================================
def fetch_base_box(season, season_type_api, player_or_team="Player", game_date=None,
                   with_team_abbr=False, team_id=TEAM_ID):
    """傳統基本數據（PTS/REB/AST/FG% 等，欄位見 BASE_FIELDS）。
    球員以 PlayerID 字串為 key（含 playerName），球隊為 'MIN'。
    game_date（MM/DD/YYYY）指定時抓該單場（單場回補用）。

    with_team_abbr=True 時額外輸出 teamAbbr（歷史回補標示新援的舊東家用）。
    預設關閉：每日快照與單場文件的 to_name_keyed / pid_to_name 只 pop playerName，
    多出來的 key 會流進文件汙染 schema，並讓 fetch_data 的去重比對永遠不相等。"""
    endpoint = "leaguedashplayerstats" if player_or_team == "Player" else "leaguedashteamstats"
    team_id_param = team_id if player_or_team == "Team" else 0
    url = _with_date((f"https://stats.nba.com/stats/{endpoint}?{LEAGUE_DASH_COMMON}"
           f"&MeasureType=Base&PaceAdjust=N&PlusMinus=N&Rank=N&Period=0"
           f"&ShotClockRange=&GameSegment=&PlayerOrTeam={player_or_team}"
           f"&Season={season}&SeasonType={season_type_api}&TeamID={team_id_param}"), game_date)
    results = {}
    data = fetch_with_retry(url, f"BaseBox [{player_or_team}]")
    if data is None:
        return results
    headers_list = data['resultSets'][0]['headers']
    for row in data['resultSets'][0]['rowSet']:
        if player_or_team == "Player":
            ident = str(row[headers_list.index("PLAYER_ID")])
            # teamAbbr 為 metadata 非統計欄位，比照 playerName 直接設值（不走 *_FIELDS，
            # apply_fields 會對值做數值處理，字串欄位不適用）
            results[ident] = {"playerName": row[headers_list.index("PLAYER_NAME")]}
            if with_team_abbr:
                results[ident]["teamAbbr"] = row[headers_list.index("TEAM_ABBREVIATION")]
        else:
            ident = _team_key(row[headers_list.index("TEAM_ID")])
            results[ident] = {}
        apply_fields(results[ident], row, headers_list, BASE_FIELDS)
    return results


def fetch_player_season_teams(player_id, type_key="regular"):
    """查球員生涯各季所屬球隊，回傳 {season_id: "GSW/ATL"}。

    用途：leaguedashplayerstats 對季中換隊球員回的是整季合併值，但 TEAM_ABBREVIATION
    只標最後一隊（例：Kuminga 2025-26 GP=36 = GSW 20 + ATL 16，卻標成 ATL），
    會誤導。改用 playercareerstats 的逐隊列還原正確的多隊標記。

    type_key 為 regular / playoffs——兩者必須分開查，否則同一個 season_id 會互相覆寫。
    """
    url = (f"https://stats.nba.com/stats/playercareerstats"
           f"?PerMode=Totals&PlayerID={player_id}&LeagueID=00")
    data = fetch_with_retry(url, f"CareerTeams [{player_id}]")
    if data is None:
        return {}
    rs_name = "SeasonTotalsPostSeason" if type_key == "playoffs" else "SeasonTotalsRegularSeason"
    rs = next((r for r in data['resultSets'] if r['name'] == rs_name), None)
    if not rs:
        return {}
    headers_list = rs['headers']
    si, ti = headers_list.index("SEASON_ID"), headers_list.index("TEAM_ABBREVIATION")
    per_season = {}
    for row in rs['rowSet']:
        # TOT 是 NBA 自己的合併列，不是真的球隊，排除
        if row[ti] == "TOT":
            continue
        per_season.setdefault(row[si], []).append(row[ti])
    # 同季多隊 → "GSW/ATL"（保留出現順序，playercareerstats 已依時序排列）
    return {s: "/".join(dict.fromkeys(t)) for s, t in per_season.items()}


# ==========================================
# 受助攻比例（leaguedash{player|team}stats?MeasureType=Scoring）
# ==========================================
def fetch_assisted_pct(season, season_type_api, player_or_team="Player"):
    """受助攻/無助攻比例（2分/3分/整體，欄位見 ASSISTED_FIELDS）。單一 request 拿全聯盟。
    球員以 PlayerID 字串為 key（含 playerName），球隊為 'MIN'。投籃分頁的受助攻卡用。"""
    endpoint = "leaguedashplayerstats" if player_or_team == "Player" else "leaguedashteamstats"
    team_id_param = TEAM_ID if player_or_team == "Team" else 0
    url = (f"https://stats.nba.com/stats/{endpoint}?{LEAGUE_DASH_COMMON}"
           f"&MeasureType=Scoring&PaceAdjust=N&PlusMinus=N&Rank=N&Period=0"
           f"&ShotClockRange=&GameSegment=&PlayerOrTeam={player_or_team}"
           f"&Season={season}&SeasonType={season_type_api}&TeamID={team_id_param}")
    results = {}
    data = fetch_with_retry(url, f"Assisted [{player_or_team}]")
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
        apply_fields(results[ident], row, headers_list, ASSISTED_FIELDS)
    return results


# ==========================================
# 在場/不在場進階效率（teamplayeronoffdetails，僅球員）
# ==========================================
def fetch_onoff(season, season_type_api, game_date=None):
    """在場/不在場進階效率（球隊在該球員上/下場時的 OFF/DEF/NET_RATING/PACE）。
    回傳 {PlayerID字串: {ON_OFF_RATING, ON_DEF_RATING, ..., OFF_OFF_RATING, ...}}。
    此 endpoint 的 PLAYER_NAME 為 'Last, First' 格式，故不回傳 playerName，
    由呼叫端以 PlayerID 對照名單取名（避免與其他 endpoint 的 'First Last' 不一致）。
    game_date（MM/DD/YYYY）：只算那一天＝單場（2026-10-29 實測 GP=1、On 與進階 box 一致；舊註解說沒有單場版本是錯的）。"""
    url = _with_date(f"https://stats.nba.com/stats/teamplayeronoffdetails?{LEAGUE_DASH_COMMON}"
           f"&MeasureType=Advanced&PaceAdjust=N&PlusMinus=N&Rank=N&Period=0"
           f"&ShotClockRange=&GameSegment=&Season={season}&SeasonType={season_type_api}&TeamID={TEAM_ID}", game_date)
    results = {}
    data = fetch_with_retry(url, f"OnOff [Team]{' ' + game_date if game_date else ''}")
    if data is None:
        return results
    # resultSets[1]=在場(On), [2]=不在場(Off)；皆以 VS_PLAYER_ID 為主鍵
    for rs, prefix in [(data['resultSets'][1], "ON"), (data['resultSets'][2], "OFF")]:
        headers_list = rs['headers']
        prefixed = [(f"{prefix}_{out}", api, pct) for out, api, pct in ONOFF_FIELDS]
        for row in rs['rowSet']:
            ident = str(row[headers_list.index("VS_PLAYER_ID")])
            results.setdefault(ident, {})
            apply_fields(results[ident], row, headers_list, prefixed)
    return results


# ==========================================
# 防守：對手分區命中（leaguedashteamshotlocations?MeasureType=Opponent，僅球隊）
# ==========================================
def fetch_opp_shot_locations(season, season_type_api, team_id=TEAM_ID):
    """
    對手在各區的出手與命中率（球隊防守熱圖用）。雙層 header，比照 fetch_shot_locations。
    輸出 {'MIN': {區域前綴_OPP_FGA / _OPP_FG_PCT}}；team_id=0 時含全聯盟（排名用）。
    """
    url = (f"https://stats.nba.com/stats/leaguedashteamshotlocations?{LEAGUE_DASH_COMMON}"
           f"&DistanceRange=By+Zone&MeasureType=Opponent&PaceAdjust=N&PlusMinus=N&Rank=N"
           f"&Period=0&ShotClockRange=&GameSegment="
           f"&Season={season}&SeasonType={season_type_api}&TeamID={team_id}")
    results = {}
    data = fetch_with_retry(url, "OppShotLocations [Team]")
    if data is None:
        return results
    rs = data['resultSets']
    zone_header = rs['headers'][0]
    flat_columns = rs['headers'][1]['columnNames']
    skip = zone_header['columnsToSkip']
    span = zone_header['columnSpan']
    zone_names = zone_header['columnNames']
    for row in rs['rowSet']:
        ident = _team_key(row[flat_columns.index("TEAM_ID")])
        results[ident] = {}
        for prefix, zone_name in SHOT_ZONES:
            if zone_name not in zone_names:
                continue
            offset = skip + zone_names.index(zone_name) * span
            fga, fg_pct = row[offset + 1], row[offset + 2]  # OPP_FGM, OPP_FGA, OPP_FG_PCT
            results[ident][f"{prefix}_OPP_FGA"] = fga if fga is not None else 0
            results[ident][f"{prefix}_OPP_FG_PCT"] = round(fg_pct * 100, 1) if fg_pct is not None else 0
    return results


# ==========================================
# 資料整形（三支腳本共用；CLAUDE.md：邏輯集中在 nba_common.py）
# ==========================================
def merge_maps(*maps):
    """合併多個同 key 結構的 dict（後者欄位補進前者）"""
    merged = {}
    for m in maps:
        for ident, data in m.items():
            merged.setdefault(ident, {}).update(data)
    return merged


def _rank_rule_match(field, rules):
    """欄名是否符合 RANK_LOWER_BETTER／RANK_SKIP（* 開頭為結尾比對）"""
    return any(field.endswith(r[1:]) if r.startswith("*") else field == r for r in rules)


def league_ranks(team_map):
    """全聯盟球隊 dict（key 'MIN' 與其他隊 TEAM_ID 字串）→ 灰狼各欄位的聯盟名次 {欄位: 名次}。
    方向依 RANK_LOWER_BETTER／RANK_SKIP；同分取最小名次（1、2、2、4）；
    以存進文件的值（已四捨五入）排，畫面上同值就同名次。非數值欄位與灰狼缺值的欄位略過。
    另寫 _n＝參與排名的隊數（開季初 Clutch 等類別可能不足 30 隊）；灰狼無資料時回空 dict。"""
    mine = team_map.get("MIN") or {}
    if not mine:
        return {}
    ranks = {"_n": len(team_map)}
    for field, v in mine.items():
        if not isinstance(v, (int, float)) or isinstance(v, bool) or _rank_rule_match(field, RANK_SKIP):
            continue
        vals = [d.get(field) for d in team_map.values()]
        vals = [x for x in vals if isinstance(x, (int, float)) and not isinstance(x, bool)]
        if _rank_rule_match(field, RANK_LOWER_BETTER):
            ranks[field] = 1 + sum(1 for x in vals if x < v)
        else:
            ranks[field] = 1 + sum(1 for x in vals if x > v)
    return ranks


def split_league(team_map):
    """全聯盟球隊 dict → (灰狼那份 dict, 灰狼的聯盟名次 dict)"""
    return team_map.get("MIN", {}), league_ranks(team_map)


def pid_to_name_keyed(pid_map, keep=None, casefold=False, keep_ids=None):
    """
    PlayerID 為 key 的 dict → 球員名稱為 key（每日/單場快照的既有格式）。
    名稱取自數據 API 的 playerName（前端以 nameKey 比對，句點/重音差異不影響）。

    keep_ids：保留的 PlayerID 字串集合（None 或空 = 不過濾）。**過濾灰狼球員優先用這個**：
        名冊 API（commonteamroster）與數據 API（leaguedash*/synergyplaytypes）的名字寫法可能不同，
        例 2025-26 名冊 "Terrence Shannon Jr." vs 數據 "Terrence Shannon Jr"，用名字比對會整個人漏掉。
    keep：保留名單（None 或空 = 不過濾）。只給沒有 PlayerID 名單的情境（單場 box 抓不到時的後備、回補 rotation）。
    casefold：以小寫比對（keep 也必須是小寫）。
        兩種比對方式刻意保留：fetch_data.py 的 normalized_active 是小寫清單，
        backfill_games.py 的 rotation 名單是原樣，收斂時若統一成其中一種會
        悄悄改變另一支腳本的過濾結果。呼叫端自己決定，不在這裡猜。
    """
    out = {}
    for pid_str, data in pid_map.items():
        if keep_ids and pid_str not in keep_ids:
            continue
        data = dict(data)
        name = (data.pop("playerName", "") or "").strip()
        if not name:
            continue
        if keep and (name.lower() if casefold else name) not in keep:
            continue
        out[name] = {"playerId": int(pid_str), **data}
    return out


# ==========================================
# 單場 box score（boxscoretraditionalv3 + boxscoresummaryv3，以 GameID 查）
# ==========================================
# box score 球員/球隊數據欄位：(輸出欄名, v3 statistics 欄名, 是否百分比)。輸出名沿用 BASE_FIELDS 慣例。
# 想多存欄位：在這裡加一行即可（v3 欄名見 boxscoretraditionalv3 的 statistics）
BOX_STAT_FIELDS = [
    ("MIN", "minutes", False),            # 字串 "38:01"（DNP 為空字串）
    ("PTS", "points", False),
    ("FGM", "fieldGoalsMade", False), ("FGA", "fieldGoalsAttempted", False), ("FG_PCT", "fieldGoalsPercentage", True),
    ("FG3M", "threePointersMade", False), ("FG3A", "threePointersAttempted", False), ("FG3_PCT", "threePointersPercentage", True),
    ("FTM", "freeThrowsMade", False), ("FTA", "freeThrowsAttempted", False), ("FT_PCT", "freeThrowsPercentage", True),
    ("OREB", "reboundsOffensive", False), ("DREB", "reboundsDefensive", False), ("REB", "reboundsTotal", False),
    ("AST", "assists", False), ("STL", "steals", False), ("BLK", "blocks", False),
    ("TOV", "turnovers", False), ("PF", "foulsPersonal", False), ("PLUS_MINUS", "plusMinusPoints", False),
]


# boxscoreadvancedv3 進階欄位（每場 1 request，兩隊球員＋球隊）：比例欄 API 為 0～1 → ×100。
# OFF/DEF/NET_RATING 對球員是「在場時」球隊每 100 回合得失分，與 teamplayeronoffdetails 單場的 On 完全一致（2026-10-29 驗證）
BOX_ADV_FIELDS = [
    ("OFF_RATING", "offensiveRating", False), ("DEF_RATING", "defensiveRating", False), ("NET_RATING", "netRating", False),
    ("POSS", "possessions", False), ("PACE", "pace", False),
    ("USG_PCT", "usagePercentage", True), ("TS_PCT", "trueShootingPercentage", True),
    ("AST_PCT", "assistPercentage", True),
    ("OREB_PCT", "offensiveReboundPercentage", True), ("DREB_PCT", "defensiveReboundPercentage", True),
    ("REB_PCT", "reboundPercentage", True), ("PIE", "PIE", True),
]
# 單場 On/Off 只存「不在場」（在場＝進階 box 的 OFF/DEF/NET_RATING）；只有灰狼球員。
# 不能用「全隊－在場」推：NBA 依每段上場分開算回合數，在場＋不在場回合 ≠ 全隊回合，推算差 7～16 分（2026-10-29 實測）
BOX_ONOFF_KEYS = ["OFF_OFF_RATING", "OFF_DEF_RATING", "OFF_NET_RATING", "OFF_MIN"]


def _box_stats(st, fields=BOX_STAT_FIELDS):
    out = {}
    for name, key, pct in fields:
        v = (st or {}).get(key)
        out[name] = (round(v * 100, 1) if v is not None else 0) if pct else (v if v is not None else 0)
    return out


def _full_name(pl):
    return f"{pl.get('firstName', '')} {pl.get('familyName', '')}".strip()


def fetch_boxscore(game_id):
    """單場完整 box score（兩隊）。回傳 (box, complete)；traditional 抓不到回 (None, False)。
    box = {gameId, homeTeamId, awayTeamId, arena, attendance, duration, officials[],
           teams: [{teamId, tricode, name, home, score, periods[{period,type,pts}], totals{}}],
           players: [{personId, name, nameI, tricode, jersey, starter, position, comment, stats{}}]（DNP 的 stats 為空）,
           inactives: [{personId, name, tricode, jersey}]}
    先發判定：v3 只有先發球員有 position（F/C/G），替補為空字串。背號只有 summary 有。
    complete=False 表示 summary（每節比分/傷停/背號）沒抓到，呼叫端應視為 partial。"""
    trad = fetch_with_retry(
        f"https://stats.nba.com/stats/boxscoretraditionalv3?GameID={game_id}"
        f"&StartPeriod=0&EndPeriod=0&StartRange=0&EndRange=0&RangeType=0", f"BoxScore {game_id}")
    if not trad or "boxScoreTraditional" not in trad:
        return None, False
    summ = fetch_with_retry(f"https://stats.nba.com/stats/boxscoresummaryv3?GameID={game_id}", f"BoxSummary {game_id}")
    bt = trad["boxScoreTraditional"]
    sm = (summ or {}).get("boxScoreSummary") or {}
    jersey = {}
    for side in ("homeTeam", "awayTeam"):
        for pl in (sm.get(side) or {}).get("players") or []:
            jersey[pl.get("personId")] = (pl.get("jerseyNum") or "").strip()
    box = {"gameId": game_id, "homeTeamId": bt.get("homeTeamId"), "awayTeamId": bt.get("awayTeamId"),
           "teams": [], "players": [], "inactives": []}
    if sm:
        arena = sm.get("arena") or {}
        box["arena"] = ", ".join(x for x in (arena.get("arenaName"), arena.get("arenaCity")) if x)
        box["attendance"] = sm.get("attendance") or 0
        box["duration"] = sm.get("duration") or ""
        box["officials"] = [o.get("name", "") for o in sm.get("officials") or []]
    for side in ("homeTeam", "awayTeam"):
        t = bt.get(side) or {}
        st = sm.get(side) or {}
        tri = t.get("teamTricode", "")
        box["teams"].append({
            "teamId": t.get("teamId"), "tricode": tri, "home": side == "homeTeam",
            "name": f"{t.get('teamCity', '')} {t.get('teamName', '')}".strip(),
            "score": st.get("score", (t.get("statistics") or {}).get("points", 0)),
            "periods": [{"period": x.get("period"), "type": x.get("periodType"), "pts": x.get("score")}
                        for x in st.get("periods") or []],
            "totals": _box_stats(t.get("statistics")),
        })
        for pl in t.get("players") or []:
            played = bool((pl.get("statistics") or {}).get("minutes"))
            box["players"].append({
                "personId": pl.get("personId"), "tricode": tri, "name": _full_name(pl), "nameI": pl.get("nameI", ""),
                "jersey": jersey.get(pl.get("personId"), ""), "position": pl.get("position", ""),
                "starter": bool(pl.get("position")), "comment": pl.get("comment", ""),
                "stats": _box_stats(pl.get("statistics")) if played else {},
            })
        for pl in st.get("inactives") or []:
            box["inactives"].append({"personId": pl.get("personId"), "tricode": tri, "name": _full_name(pl),
                                     "jersey": (pl.get("jerseyNum") or "").strip()})
    # summary 偶爾回傳空殼（2025-11-19 實例：有回應但兩隊 periods 皆空、無背號/傷停/場館），
    # 只看 bool(sm) 會誤判完整 → 以「兩隊都有每節比分」為準
    adv_ok = add_box_advanced(box, game_id)
    complete = bool(sm) and all(t["periods"] for t in box["teams"]) and adv_ok
    return box, complete


def add_box_advanced(box, game_id):
    """抓 boxscoreadvancedv3，把 BOX_ADV_FIELDS 併進 box 的球員 stats 與球隊 totals（就地修改）。
    DNP（stats 為空）不併。回傳是否抓到（False → 呼叫端視為 partial）。"""
    adv = fetch_with_retry(
        f"https://stats.nba.com/stats/boxscoreadvancedv3?GameID={game_id}"
        f"&StartPeriod=0&EndPeriod=0&StartRange=0&EndRange=0&RangeType=0", f"BoxAdvanced {game_id}")
    ba = (adv or {}).get("boxScoreAdvanced")
    if not ba:
        return False
    players, teams = {}, {}
    for side in ("homeTeam", "awayTeam"):
        t = ba.get(side) or {}
        teams[t.get("teamId")] = _box_stats(t.get("statistics"), BOX_ADV_FIELDS)
        for pl in t.get("players") or []:
            if (pl.get("statistics") or {}).get("minutes"):
                players[pl.get("personId")] = _box_stats(pl.get("statistics"), BOX_ADV_FIELDS)
    for t in box["teams"]:
        t["totals"].update(teams.get(t["teamId"]) or {})
    for pl in box["players"]:
        if pl["stats"] and pl["personId"] in players:
            pl["stats"].update(players[pl["personId"]])
    return bool(players)


def box_oncourt_totals(box):
    """逐場 bundle 用：灰狼球員本場「在場」的得分／失分／回合數（由進階 box 的效率 × 回合數還原）。
    前端 GameAgg 以 Σ得分 ÷ Σ回合 重算任意期間的在場效率（ON_OFF_RATING／ON_DEF_RATING）；
    2026-10-29 驗證：本季前 4 場加權的進攻效率與 On/Off 整季快照一致，防守效率差 ≤ 0.9（NBA 防守回合另計）。
    回傳 {personId字串: {ON_PTS, ON_OPP_PTS, ON_POSS}}；沒有進階欄位的場次回 {}。"""
    out = {}
    for pl in (box or {}).get("players", []):
        s = pl.get("stats") or {}
        if pl.get("tricode") == "MIN" and s.get("POSS") and isinstance(s.get("OFF_RATING"), (int, float)):
            out[str(pl["personId"])] = {"ON_PTS": round(s["OFF_RATING"] * s["POSS"] / 100, 2),
                                        "ON_OPP_PTS": round(s["DEF_RATING"] * s["POSS"] / 100, 2),
                                        "ON_POSS": s["POSS"]}
    return out


def add_box_onoff(box, season, season_type_api, api_date):
    """單場 On/Off（teamplayeronoffdetails 帶單場日期，1 request）：灰狼球員的「不在場」併進 box 球員 stats。
    回傳是否抓到（False → 呼叫端視為 partial）。"""
    oo = fetch_onoff(season, season_type_api, game_date=api_date)
    for pl in box["players"]:
        v = oo.get(str(pl["personId"]))
        if pl["stats"] and pl["tricode"] == "MIN" and v:
            pl["stats"].update({k: v[k] for k in BOX_ONOFF_KEYS if k in v})
    return bool(oo)


# ==========================================
# 單場擷取（每日 fetch_data.py 與 backfill_games.py 共用）
# ==========================================
ZERO_FILL_PREFIXES = ("CATCH_SHOOT_", "PULL_UP_")


def tracking_zero_filled(stats):
    """NBA 單場 Tracking 還沒釋出時，CatchShoot／PullUpShot 會回「整組 0」而不是空的，
    同時 Possessions（TOUCHES）整個缺——來源「有值」所以舊的 partial 判定抓不到。
    缺 TOUCHES 且任一組前綴欄位全是 0 → True（球隊整場不可能 0 次接球跳投）。
    前端 gamesData.cleanGameStats 用同一規則把這種 0 顯示成「—」。"""
    if not stats or stats.get("TOUCHES") is not None:
        return False
    for pre in ZERO_FILL_PREFIXES:
        vals = [v for k, v in stats.items() if k.startswith(pre)]
        if vals and all(v == 0 for v in vals):
            return True
    return False

def fetch_single_game(season, season_type_api, api_date, game_id, keep=None, casefold=False, keep_is_fallback=True):
    """抓指定日期（MM/DD/YYYY）、GameID 的單場數據（灰狼＋對手），回傳 dict：
      player / team          灰狼球員（球員名 key）/ 灰狼球隊
                             球員以 box score 上場名單的 PlayerID 過濾（不靠名字：名冊 API 與數據 API 的寫法
                             可能不同，例 "Terrence Shannon Jr." vs "Terrence Shannon Jr"，用名字會整個人漏掉）。
                             keep（名字清單，語意同 pid_to_name_keyed）只在 box 抓不到時當後備；
                             keep_is_fallback=False 時另外再套用（回補 --min-gp 用）
      opp_players / opp_team 對手球員（以 box score 上場名單篩，球員名 key）/ 對手球隊
      opp_id / opp_abbr      對手 TEAM_ID / 三碼縮寫（取自 box score）
      box                    完整 box score（見 fetch_boxscore）
      partial                某來源缺漏（NBA 單場資料偶爾晚更新；Tracking 回整組 0 也算，見 tracking_zero_filled），
                             寫入時標記、每日腳本下次重抓
    request 數約 26：box 3（傳統＋summary＋進階）+ 單場 On/Off 1 + 球員 11（全聯盟）+ 對手對位防守 2 + 球隊 9（TeamID=0 一次拿兩隊）。"""
    box, box_complete = fetch_boxscore(game_id)
    if box and not add_box_onoff(box, season, season_type_api, api_date):
        box_complete = False
    opp = next((t for t in (box or {}).get("teams", []) if t.get("teamId") != TEAM_ID), None)
    opp_id = opp["teamId"] if opp else None
    p_sources = [
        fetch_base_box(season, season_type_api, "Player", game_date=api_date),
        fetch_tracking_data(season, season_type_api, "Player", game_date=api_date),
        fetch_matchup_defense(season, season_type_api, game_date=api_date),
        fetch_hustle(season, season_type_api, "Player", game_date=api_date),
        fetch_shot_locations(season, season_type_api, "Player", game_date=api_date),
    ]
    opp_def = fetch_matchup_defense(season, season_type_api, game_date=api_date, team_id=opp_id) if opp_id else {}
    t_sources = [
        fetch_base_box(season, season_type_api, "Team", game_date=api_date, team_id=0),
        fetch_tracking_data(season, season_type_api, "Team", game_date=api_date, team_id=0),
        fetch_hustle(season, season_type_api, "Team", game_date=api_date, team_id=0),
        fetch_shot_locations(season, season_type_api, "Team", game_date=api_date, team_id=0),
    ]
    league = merge_maps(*p_sources)
    min_pids = {str(pl["personId"]) for pl in (box or {}).get("players", [])
                if pl.get("tricode") == "MIN" and pl.get("stats")}
    if min_pids:
        player = pid_to_name_keyed({pid: v for pid, v in league.items() if pid in min_pids},
                                   None if keep_is_fallback else keep, casefold=casefold)
    else:
        player = pid_to_name_keyed(league, keep, casefold=casefold)
    teams = merge_maps(*t_sources)
    team = teams.get("MIN", {})
    opp_team = teams.get(str(opp_id), {}) if opp_id else {}
    # 對手球員：box score 中該隊有上場者（DNP 不列）；對位防守另以對手 TeamID 抓
    opp_tri = (opp or {}).get("tricode")
    opp_pids = {str(pl["personId"]) for pl in (box or {}).get("players", [])
                if pl.get("tricode") == opp_tri and pl.get("stats")}
    opp_players = pid_to_name_keyed(merge_maps(
        {pid: v for pid, v in league.items() if pid in opp_pids},
        {pid: v for pid, v in opp_def.items() if pid in opp_pids}))
    # 球隊來源看兩隊那列（全聯盟有別場時 dict 不會空）；球員來源全聯盟，看非空即可
    # Tracking 回「整組 0」也算缺漏（看兩隊球隊數據即可，球員跟著球隊一起缺）
    partial = bool(player or team) and (
        any(not s for s in p_sources) or any(not s.get("MIN") for s in t_sources)
        or not box_complete or not opp_id or not opp_def
        or any(not s.get(str(opp_id)) for s in t_sources)
        or tracking_zero_filled(team) or (bool(opp_team) and tracking_zero_filled(opp_team)))
    return {"player": player, "team": team, "opp_players": opp_players, "opp_team": opp_team,
            "opp_id": opp_id, "opp_abbr": opp_tri or "", "box": box, "partial": partial}


def game_docs(date, season_type_label, matchup, wl, g, extra=None):
    """由 fetch_single_game 結果組 wolves_player_games / wolves_team_games 文件（每日與回補共用格式）。
    extra：額外欄位（每日擷取的 partial/final/captureTries）。回傳 (player_doc, team_doc)。"""
    common = {"date": date, "seasonType": season_type_label, "type": "單場", "matchup": matchup, "wl": wl,
              "timestamp": int(datetime.now().timestamp() * 1000), **(extra or {})}
    meta = {"gameId": (g["box"] or {}).get("gameId", ""), "oppId": g["opp_id"], "oppAbbr": g["opp_abbr"]}
    player_doc = {**common, **meta, "players": g["player"], "oppPlayers": g["opp_players"]}
    team_doc = {**common, **meta, "stats": g["team"], "opp": g["opp_team"], "box": g["box"]}
    return player_doc, team_doc
