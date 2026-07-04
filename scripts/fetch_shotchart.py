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
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nba_common import (
    TEAM_ID,
    get_season_type,
    init_firebase,
    fetch_roster_with_ids,
    fetch_with_retry,
)

SEASON = "2025-26"


def fetch_player_shotchart(player_id, player_name, season, season_type_api):
    """
    抓取單一球員整季出手座標。
    回傳 list of dict：x/y 為場地座標（0.1 呎），made 為是否命中，
    dist 為出手距離（呎），zone 為 NBA 官方分區名。
    """
    url = (f"https://stats.nba.com/stats/shotchartdetail"
           f"?AheadBehind=&ClutchTime=&ContextFilter=&ContextMeasure=FGA"
           f"&DateFrom=&DateTo=&EndPeriod=&EndRange=&GameID=&GameSegment="
           f"&LastNGames=0&LeagueID=00&Location=&Month=0&OpponentTeamID=0"
           f"&Outcome=&Period=0&PlayerID={player_id}&PlayerPosition=&PointDiff="
           f"&Position=&RangeType=&RookieYear=&Season={season}&SeasonSegment="
           f"&SeasonType={season_type_api}&StartPeriod=&StartRange="
           f"&TeamID={TEAM_ID}&VsConference=&VsDivision=")
    data = fetch_with_retry(url, f"ShotChart {player_name}")
    if data is None:
        return None
    headers_list = data['resultSets'][0]['headers']
    idx = {name: headers_list.index(name) for name in
           ["LOC_X", "LOC_Y", "SHOT_MADE_FLAG", "SHOT_DISTANCE", "SHOT_ZONE_BASIC"]}
    return [
        {
            "x": row[idx["LOC_X"]],
            "y": row[idx["LOC_Y"]],
            "made": row[idx["SHOT_MADE_FLAG"]],
            "dist": row[idx["SHOT_DISTANCE"]],
            "zone": row[idx["SHOT_ZONE_BASIC"]],
        }
        for row in data['resultSets'][0]['rowSet']
    ]


def main():
    season_type_api, season_type_label = get_season_type()
    if season_type_api is None:
        print("目前為休賽期，不需要抓取投籃熱圖，結束執行。")
        return
    type_key = "regular" if season_type_api == "Regular+Season" else "playoffs"

    print(f"=== 開始抓取灰狼隊投籃熱圖（{season_type_label}）===")

    roster = fetch_roster_with_ids(SEASON)
    if not roster:
        print("❌ 無法取得名單，終止")
        sys.exit(1)

    db = init_firebase()
    summary = {}
    for p in roster:
        shots = fetch_player_shotchart(p["id"], p["name"], SEASON, season_type_api)
        if shots is None:
            summary[p["name"]] = "FAILED"
            continue
        summary[p["name"]] = len(shots)
        doc = {
            "playerId": p["id"],
            "playerName": p["name"],
            "season": SEASON,
            "seasonType": season_type_label,
            "timestamp": int(datetime.now().timestamp() * 1000),
            "shots": shots,
        }
        if db:
            doc_id = f"{p['id']}_{SEASON}_{type_key}"
            db.collection("wolves_shotcharts").document(doc_id).set(doc)
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
