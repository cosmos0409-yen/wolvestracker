# -*- coding: utf-8 -*-
"""
Wolves Tracker - 歷史賽季回補腳本

Usage:
    python backfill_history.py --season 2022-23 --type regular
    python backfill_history.py --season 2023-24 --type playoffs

說明：
    - 抓取指定歷史賽季的灰狼球隊與球員數據（賽季末終點快照）
    - 球員資料以 PlayerID 為主鍵，並標記是否為現役球員
    - API 不加 TeamID 篩選，改用歷史名單 PlayerID 過濾，確保整季數據完整（含轉隊球員）
    - 抓取邏輯與欄位設定表共用 nba_common.py
"""

import json
import sys
import os
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nba_common import (
    init_firebase,
    fetch_roster_with_ids,
    fetch_synergy_data,
    fetch_tracking_data,
)

CURRENT_SEASON = "2025-26"  # 用來抓現役名單作為 isCurrentRoster 對照


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
