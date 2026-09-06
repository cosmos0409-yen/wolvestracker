# -*- coding: utf-8 -*-
"""
Wolves Tracker - 歷史賽季回補腳本

Usage:
    python backfill_history.py --season 2022-23 --type regular
    python backfill_history.py --season 2023-24 --type playoffs

說明：
    - 抓取指定歷史賽季的灰狼球隊與球員數據（賽季末終點快照，完整類別）
    - 類別：Synergy / Base / Tracking / Shooting / Clutch / Lineups / Defense / On-Off
      （比照每日快照結構，供前端「跨季比較」分頁涵蓋所有數據）
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
    fetch_shot_locations,
    fetch_pt_shots,
    fetch_clutch,
    fetch_lineups,
    fetch_matchup_defense,
    fetch_hustle,
    fetch_defense_box,
    fetch_opp_shot_locations,
    fetch_base_box,
    fetch_onoff,
    fetch_player_season_teams,
)

CURRENT_SEASON = "2026-27"  # 用來抓現役名單：作為 isCurrentRoster 對照，並讓新援納入回補

# 球員終點快照的類別欄位（除 synergy 走 stats[] 陣列外，其餘為 dict）
PLAYER_CATEGORY_KEYS = ["base", "tracking", "shooting", "clutch", "defense", "onoff"]


def merge_maps(*maps):
    """合併多個同 key 結構的 dict（後者欄位補進前者）"""
    merged = {}
    for m in maps:
        for ident, data in m.items():
            merged.setdefault(ident, {}).update(data)
    return merged


def main():
    parser = argparse.ArgumentParser(description="Wolves Tracker 歷史賽季回補")
    parser.add_argument("--season", required=True, help="例：2022-23")
    parser.add_argument("--type", required=True, choices=["regular", "playoffs"], help="regular 或 playoffs")
    parser.add_argument("--dry-run", action="store_true",
                        help="只寫本地驗證檔，不寫入 Firestore（供上線前比對用）")
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
    if not current_roster:
        # 不可降級：current_ids 為空會讓所有球員 isCurrentRoster/isNewcomer 皆為 False、
        # 新援全被過濾掉，然後把這份殘缺資料寫進 Firestore 覆蓋掉正確的 doc
        print(f"❌ 無法取得 {CURRENT_SEASON} 現役名單，終止（避免寫入缺少新援的殘缺快照）")
        sys.exit(1)
    current_ids = {p['id'] for p in current_roster}

    # Step 3: 抓球隊數據（完整類別終點快照，比照每日快照結構）
    print(f"\n--- 抓取 {season} {season_type_label} 球隊數據 ---")
    team_synergy = fetch_synergy_data(season, season_type_api, "T")
    team_tracking = fetch_tracking_data(season, season_type_api, "Team").get("MIN", {})
    team_base = fetch_base_box(season, season_type_api, "Team").get("MIN", {})
    team_shooting = merge_maps(
        fetch_shot_locations(season, season_type_api, "Team"),
        fetch_pt_shots(season, season_type_api, "Team"),
    ).get("MIN", {})
    team_clutch = fetch_clutch(season, season_type_api, "Team").get("MIN", {})
    team_lineups = fetch_lineups(season, season_type_api)
    team_defense = merge_maps(
        fetch_hustle(season, season_type_api, "Team"),
        fetch_defense_box(season, season_type_api, "Team"),
        fetch_opp_shot_locations(season, season_type_api),
    ).get("MIN", {})

    # Step 4: 抓全聯盟球員數據（皆 PlayerID 為 key，待過濾）
    print(f"\n--- 抓取全聯盟球員數據（將以歷史名單過濾） ---")
    all_player_synergy = fetch_synergy_data(season, season_type_api, "P")
    p_base = fetch_base_box(season, season_type_api, "Player", with_team_abbr=True)
    p_tracking = fetch_tracking_data(season, season_type_api, "Player")
    p_shooting = merge_maps(
        fetch_shot_locations(season, season_type_api, "Player"),
        fetch_pt_shots(season, season_type_api, "Player"),
    )
    p_clutch = fetch_clutch(season, season_type_api, "Player")
    p_defense = merge_maps(
        fetch_matchup_defense(season, season_type_api),
        fetch_hustle(season, season_type_api, "Player"),
        fetch_defense_box(season, season_type_api, "Player"),
    )
    p_onoff = fetch_onoff(season, season_type_api)

    # Step 5: 過濾與組裝（PlayerID 為主鍵，內層比照每日快照的 per-player 結構）
    #
    # 過濾集合 = 該季灰狼名單 ∪ 現役（CURRENT_SEASON）名單。
    # 聯集的用意：讓「本季才加入灰狼、該季還在別隊」的新援也被保留，
    # 面板才追得到他在舊東家的表現。全聯盟資料本來就已抓下來（Step 4），
    # 這裡只是不再把他們丟掉。
    include_ids = historical_ids | current_ids
    player_stats = {}

    def ensure(pid_int, fallback_name=""):
        pid_str = str(pid_int)
        if pid_str not in player_stats:
            player_stats[pid_str] = {
                "playerName": historical_id_to_name.get(pid_int, fallback_name),
                "isCurrentRoster": pid_int in current_ids,
                # 該季不在灰狼、但現在是灰狼 → 新援。前端據此判定
                # 對位防守 / On-Off 為「跨隊不適用」而非 0
                "isNewcomer": pid_int in current_ids and pid_int not in historical_ids,
                "teamAbbr": None,
                "stats": [],
                **{k: {} for k in PLAYER_CATEGORY_KEYS},
            }
        return player_stats[pid_str]

    for item in all_player_synergy:
        pid_int = item.pop("playerId")
        pname = item.pop("playerName")
        if pid_int not in include_ids:
            continue
        ensure(pid_int, pname)["stats"].append(item)

    for field, src in [("base", p_base), ("tracking", p_tracking), ("shooting", p_shooting),
                       ("clutch", p_clutch), ("defense", p_defense), ("onoff", p_onoff)]:
        for pid_str, data in src.items():
            pid_int = int(pid_str)
            if pid_int not in include_ids:
                continue
            rec = ensure(pid_int, data.get("playerName", ""))
            data = dict(data)
            data.pop("playerName", None)
            # teamAbbr 只有 base 帶，提到 per-player 頂層當 metadata
            abbr = data.pop("teamAbbr", None)
            if abbr:
                rec["teamAbbr"] = abbr
            rec[field] = data

    # Step 5b: 修正新援的 teamAbbr
    # leaguedashplayerstats 對季中換隊球員回的是整季合併值，但 TEAM_ABBREVIATION
    # 只標最後一隊（Kuminga 2025-26 標成 ATL，實際是 GSW 20 場 + ATL 16 場），
    # 直接顯示會誤導。只對新援逐人查生涯分隊（人數少，request 量可忽略）。
    newcomers = [(pid, rec) for pid, rec in player_stats.items() if rec["isNewcomer"]]
    if newcomers:
        print(f"\n--- 修正 {len(newcomers)} 位新援的所屬球隊標記 ---")
        for pid_str, rec in newcomers:
            teams = fetch_player_season_teams(int(pid_str), type_key)
            accurate = teams.get(season)
            if accurate and accurate != rec["teamAbbr"]:
                print(f"   {rec['playerName']}: {rec['teamAbbr']} → {accurate}")
                rec["teamAbbr"] = accurate

    n_newcomer = sum(1 for p in player_stats.values() if p["isNewcomer"])
    print(f"\n✅ 共組裝 {len(player_stats)} 位球員資料")
    print(f"   該季灰狼現役：{sum(1 for p in player_stats.values() if p['isCurrentRoster'] and not p['isNewcomer'])} 位")
    print(f"   已離隊：{sum(1 for p in player_stats.values() if not p['isCurrentRoster'])} 位")
    print(f"   新援（該季在別隊）：{n_newcomer} 位")

    # Step 6: 寫入 Firebase
    final_team_data = {
        "season": season,
        "seasonType": season_type_label,
        "type": "歷史快照",
        "timestamp": int(datetime.now().timestamp() * 1000),
        "stats": team_synergy,
        "tracking": team_tracking,
        "base": team_base,
        "shooting": team_shooting,
        "clutch": team_clutch,
        "lineups": team_lineups,
        "defense": team_defense,
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

    db = None if args.dry_run else init_firebase()
    if args.dry_run:
        print("🔍 dry-run：略過 Firestore 寫入")
    if db:
        db.collection("wolves_team_history").document(doc_id).set(final_team_data)
        print(f"✅ 球隊歷史數據已寫入 wolves_team_history/{doc_id}")
        db.collection("wolves_player_history").document(doc_id).set(final_player_data)
        print(f"✅ 球員歷史數據已寫入 wolves_player_history/{doc_id}")

    # 本地驗證輸出
    # dry-run 另存檔名，避免覆寫既有的基準驗證檔（比對前後差異時要用）
    out_path = f"backfill_{doc_id}.dryrun.json" if args.dry_run else f"backfill_{doc_id}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({"team": final_team_data, "player": final_player_data}, f, ensure_ascii=False, indent=2)
    print(f"📁 已寫出本地驗證檔：{out_path}")


if __name__ == "__main__":
    main()
