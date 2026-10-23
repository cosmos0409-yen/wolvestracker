# -*- coding: utf-8 -*-
"""
Wolves Tracker - 投籃熱圖抓取（每週執行）

逐球員抓取 shotchartdetail 出手座標，寫入 Firestore 集合 wolves_shotcharts，
doc id 為 {playerId}_{season}_{regular|playoffs}（整季覆寫，非每日快照）。

此為專案中唯一逐球員的 endpoint（全隊 ~18 個 request），
為避免被 NBA 擋，不進每日排程，由 Windows 排程每週執行一次，
且球員間間隔拉長為 3 秒。
"""

import json
import sys
import os
import time
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nba_common import (
    TEAM_ID,
    get_season_type,
    get_current_season,
    get_roster_season,
    init_firebase,
    fetch_roster_with_ids,
    fetch_with_retry,
    fetch_assisted_pct,
)

SEASON = get_current_season()        # 資料賽季（10/20 起切換）
CURRENT_SEASON = get_roster_season()  # 現役名單來源（7/1 起切換）：讓新援在舊東家的出手也被抓進來


def _norm_gdate(raw):
    """shotchartdetail 的 GAME_DATE 通常為 'YYYYMMDD'，正規化為 'YYYY-MM-DD'。"""
    s = str(raw)
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:]}"
    return s


def fetch_player_shotchart(player_id, player_name, season, season_type_api, team_id=None, game_id=""):
    """
    抓取出手座標。player_id=0 時搭配 TeamID 抓「全隊」出手（球隊熱圖用）。
    team_id 省略＝灰狼（維持既有語意）；新援在舊東家的出手需傳 0 才拿得到。
    game_id 指定時只抓該場（每日增量用：一個 request 拿到該場全隊出手）。
    回傳 list of dict：x/y 為場地座標（0.1 呎），made 為是否命中，
    dist 為出手距離（呎），zone 為 NBA 官方分區名，
    action 為出手方式（ACTION_TYPE），gdate 為比賽日期（YYYY-MM-DD），
    pid/pname 為出手球員（增量拆球員用；encode_shots 不寫入文件）。
    """
    url = (f"https://stats.nba.com/stats/shotchartdetail"
           f"?AheadBehind=&ClutchTime=&ContextFilter=&ContextMeasure=FGA"
           f"&DateFrom=&DateTo=&EndPeriod=&EndRange=&GameID={game_id}&GameSegment="
           f"&LastNGames=0&LeagueID=00&Location=&Month=0&OpponentTeamID=0"
           f"&Outcome=&Period=0&PlayerID={player_id}&PlayerPosition=&PointDiff="
           f"&Position=&RangeType=&RookieYear=&Season={season}&SeasonSegment="
           f"&SeasonType={season_type_api}&StartPeriod=&StartRange="
           f"&TeamID={TEAM_ID if team_id is None else team_id}&VsConference=&VsDivision=")
    data = fetch_with_retry(url, f"ShotChart {player_name}")
    if data is None:
        return None
    headers_list = data['resultSets'][0]['headers']
    idx = {name: headers_list.index(name) for name in
           ["LOC_X", "LOC_Y", "SHOT_MADE_FLAG", "SHOT_DISTANCE", "SHOT_ZONE_BASIC",
            "ACTION_TYPE", "GAME_DATE", "PLAYER_ID", "PLAYER_NAME"]}
    return [
        {
            "x": row[idx["LOC_X"]],
            "y": row[idx["LOC_Y"]],
            "made": row[idx["SHOT_MADE_FLAG"]],
            "dist": row[idx["SHOT_DISTANCE"]],
            "zone": row[idx["SHOT_ZONE_BASIC"]],
            "action": row[idx["ACTION_TYPE"]],
            "gdate": _norm_gdate(row[idx["GAME_DATE"]]),
            "pid": row[idx["PLAYER_ID"]],
            "pname": row[idx["PLAYER_NAME"]],
        }
        for row in data['resultSets'][0]['rowSet']
    ]


def encode_shots(shots):
    """把逐球的 action/gdate 字串抽成去重清單，每球改存索引，壓縮體積避免逼近 Firestore 1MiB。
    回傳 (encoded_shots, actionTypes, gameDates)。"""
    action_types, game_dates = [], []
    a_idx, g_idx = {}, {}
    encoded = []
    for s in shots:
        act, gd = s["action"], s["gdate"]
        if act not in a_idx:
            a_idx[act] = len(action_types)
            action_types.append(act)
        if gd not in g_idx:
            g_idx[gd] = len(game_dates)
            game_dates.append(gd)
        encoded.append({
            "x": s["x"], "y": s["y"], "made": s["made"], "dist": s["dist"], "zone": s["zone"],
            "a": a_idx[act], "g": g_idx[gd],
        })
    return encoded, action_types, game_dates


def _shot_doc(base, shots, assisted):
    """組裝 shotchart 文件：編碼出手 + 附上 actionTypes/gameDates 去重清單與受助攻比例。"""
    encoded, action_types, game_dates = encode_shots(shots)
    return {
        **base,
        "timestamp": int(datetime.now().timestamp() * 1000),
        "shots": encoded,
        "actionTypes": action_types,
        "gameDates": game_dates,
        "assisted": assisted,
    }


def _decode_shots(d):
    """encode_shots 的反向：把文件裡的索引還原成 action/gdate 字串（增量合併用）。"""
    at, gd = d.get("actionTypes") or [], d.get("gameDates") or []
    return [{"x": s["x"], "y": s["y"], "made": s["made"], "dist": s["dist"], "zone": s["zone"],
             "action": at[s["a"]], "gdate": gd[s["g"]]} for s in d.get("shots") or []]


def capture_game_shots(db, season, season_type_api, season_type_label, gdate, game_id):
    """每日增量：抓單場全隊出手（1 個 request），依 PLAYER_ID 拆開，併入各球員與全隊的整季文件。
    同日期的舊出手先移除再加入（重抓不會重複）。受助攻比例沿用文件既有值，由每週整季重抓更新。
    全隊文件最後寫：其 gameDates 是「這場已併入」的記號，中途失敗下次會整場重來。回傳是否成功。"""
    shots = fetch_player_shotchart(0, f"灰狼全隊 {gdate}", season, season_type_api, game_id=game_id)
    if not shots:
        print(f"[FAILED] {gdate} 單場出手{'抓取失敗' if shots is None else '為空（NBA 尚未釋出？）'}，下次再試")
        return False
    type_key = "regular" if season_type_api == "Regular+Season" else "playoffs"
    by_pid = {}
    for s in shots:
        by_pid.setdefault(s["pid"], []).append(s)
    targets = [(str(pid), {"playerId": pid, "playerName": ss[0]["pname"]}, ss) for pid, ss in by_pid.items()]
    targets.append(("TEAM", {"playerId": 0, "playerName": "Minnesota Timberwolves"}, shots))
    for who, base, new in targets:
        ref = db.collection("wolves_shotcharts").document(f"{who}_{season}_{type_key}")
        snap = ref.get()
        prev = snap.to_dict() if snap.exists else {}
        merged = sorted([s for s in _decode_shots(prev) if s["gdate"] != gdate] + new, key=lambda s: s["gdate"])
        ref.set(_shot_doc({**base, "playerName": prev.get("playerName") or base["playerName"],
                           "season": season, "seasonType": season_type_label},
                          merged, prev.get("assisted") or {}))
    print(f"✅ {gdate} 出手已併入 wolves_shotcharts（全隊 {len(shots)} 球、{len(by_pid)} 位球員）")
    return True


def main():
    parser = argparse.ArgumentParser(description="Wolves Tracker 投籃熱圖抓取")
    parser.add_argument("--season", default=None, help="例：2024-25（省略=當季）")
    parser.add_argument("--type", choices=["regular", "playoffs"], default=None,
                        help="regular 或 playoffs（省略=依當前日期）")
    args = parser.parse_args()

    if args.season or args.type:
        season = args.season or SEASON
        type_key = args.type or "regular"
        season_type_api = "Regular+Season" if type_key == "regular" else "Playoffs"
        season_type_label = "例行賽" if type_key == "regular" else "季後賽"
    else:
        season_type_api, season_type_label = get_season_type()
        if season_type_api is None:
            print("目前為休賽期，不需要抓取投籃熱圖，結束執行。")
            return
        season = SEASON
        type_key = "regular" if season_type_api == "Regular+Season" else "playoffs"

    print(f"=== 開始抓取灰狼隊投籃熱圖（{season} {season_type_label}）===")

    roster = fetch_roster_with_ids(season)
    if not roster:
        print("❌ 無法取得名單，終止")
        sys.exit(1)

    # 抓取對象 = 該季灰狼名單（TeamID 維持灰狼，語意與既有資料完全一致）
    #          ∪ 現役新援（該季在別隊，須傳 TeamID=0 才拿得到舊東家的出手）
    # 必須在任何 Firestore 寫入之前決定：否則名單抓失敗時已經寫過球隊熱圖，
    # 會留下「球隊是新的、球員是舊的」的半完成狀態
    season_ids = {p["id"] for p in roster}
    if season == CURRENT_SEASON:
        newcomers = []          # 同一季不會有新援，省一次 request
    else:
        current_roster = fetch_roster_with_ids(CURRENT_SEASON)
        if not current_roster:
            # 不可靜默降級：名單抓失敗會讓新援整批被漏掉，而腳本照樣印「完成」
            print(f"❌ 無法取得 {CURRENT_SEASON} 現役名單，終止（避免靜默漏抓新援）")
            sys.exit(1)
        newcomers = [p for p in current_roster if p["id"] not in season_ids]

    # 受助攻比例（全聯盟單一 request，球員 + 球隊各一）
    assisted_player = fetch_assisted_pct(season, season_type_api, "Player")
    assisted_team = fetch_assisted_pct(season, season_type_api, "Team").get("MIN", {})

    db = init_firebase()
    summary = {}

    # 先抓全隊出手（PlayerID=0 + TeamID）→ 球隊熱圖
    team_shots = fetch_player_shotchart(0, "灰狼全隊", season, season_type_api)
    if team_shots is None:
        summary["TEAM"] = "FAILED"
    else:
        summary["TEAM"] = len(team_shots)
        if db:
            doc_id = f"TEAM_{season}_{type_key}"
            db.collection("wolves_shotcharts").document(doc_id).set(_shot_doc({
                "playerId": 0, "playerName": "Minnesota Timberwolves",
                "season": season, "seasonType": season_type_label,
            }, team_shots, assisted_team))
            print(f"✅ 全隊: {len(team_shots)} 次出手已寫入 wolves_shotcharts/{doc_id}")
    time.sleep(1)

    targets = [(p, None) for p in roster] + [(p, 0) for p in newcomers]
    if newcomers:
        print(f"--- 另含 {len(newcomers)} 位新援（跨隊查詢）：{', '.join(p['name'] for p in newcomers)} ---")

    for p, team_id in targets:
        shots = fetch_player_shotchart(p["id"], p["name"], season, season_type_api, team_id=team_id)
        if shots is None:
            summary[p["name"]] = "FAILED"
            continue
        if team_id == 0 and not shots:
            # 新援該季可能根本沒在 NBA 出賽（新秀 / 海外聯賽）→ 不寫空文件。
            # 只對新援套用；留隊球員即使 0 次出手仍照舊寫入，維持既有行為
            summary[p["name"]] = 0
            print(f"⏭️  {p['name']}: 該季無出手紀錄，略過")
            time.sleep(1)
            continue
        summary[p["name"]] = len(shots)
        p_assist = dict(assisted_player.get(str(p["id"]), {}))
        p_assist.pop("playerName", None)
        if db:
            doc_id = f"{p['id']}_{season}_{type_key}"
            db.collection("wolves_shotcharts").document(doc_id).set(_shot_doc({
                "playerId": p["id"], "playerName": p["name"],
                "season": season, "seasonType": season_type_label,
            }, shots, p_assist))
            print(f"✅ {p['name']}: {len(shots)} 次出手已寫入 wolves_shotcharts/{doc_id}")
        # fetch_with_retry 已內含 2 秒間隔，再加 1 秒 → 球員間共 3 秒
        time.sleep(1)

    failed = [name for name, v in summary.items() if v == "FAILED"]
    print(f"\n=== 完成：{len(summary) - len(failed)}/{len(summary)} 位球員 ===")
    if failed:
        print(f"[FAILED] 以下球員抓取失敗：{', '.join(failed)}")

    # 本地驗證輸出（只存筆數摘要，完整座標在 Firestore）
    with open("local_shotchart_summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print("📁 已更新 local_shotchart_summary.json")


if __name__ == "__main__":
    main()
