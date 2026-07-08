# -*- coding: utf-8 -*-
"""
Wolves Tracker - 每日當季數據抓取

抓取灰狼隊當季 Synergy 戰術 / Tracking / 投籃 / Clutch / 陣容數據，
寫入 Firestore（wolves_team_stats / wolves_player_stats，doc id 為日期）。
共用抓取邏輯與欄位設定表見 nba_common.py。
"""

import json
import sys
import os
import argparse
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nba_common import (
    TEAM_ID,
    get_today_str,
    get_season_type,
    init_firebase,
    fetch_roster_with_ids,
    fetch_team_game_log,
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
)

SEASON = "2025-26"

# 每日快照文件中參與去重比對的資料欄位
DATA_KEYS = ["stats", "tracking", "shooting", "clutch", "lineups", "defense", "onoff"]


# ==========================================
# Dedup 比對工具：避免連續兩天寫入完全相同的資料
# ==========================================
def _normalize(value):
    """遞迴標準化供比對使用；list 內若全為 dict，依 JSON 字串排序，避免順序差異造成誤判"""
    if isinstance(value, dict):
        return {k: _normalize(v) for k, v in value.items()}
    if isinstance(value, list):
        norm = [_normalize(x) for x in value]
        if norm and all(isinstance(x, dict) for x in norm):
            try:
                norm.sort(key=lambda x: json.dumps(x, sort_keys=True, ensure_ascii=False))
            except TypeError:
                pass
        return norm
    if isinstance(value, float):
        return round(value, 4)
    return value


def _data_equal(a, b):
    return _normalize(a) == _normalize(b)


def find_latest_existing(db, collection, today_str, lookback_days=14):
    """從今天往回找最多 lookback_days 天，回傳第一個存在的 doc dict，找不到回 None"""
    today_dt = datetime.strptime(today_str, "%Y-%m-%d")
    for delta in range(1, lookback_days + 1):
        check_date = (today_dt - timedelta(days=delta)).strftime("%Y-%m-%d")
        doc = db.collection(collection).document(check_date).get()
        if doc.exists:
            data = doc.to_dict()
            data["_doc_id"] = check_date
            return data
    return None


def should_skip_write(db, collection, today_str, new_data):
    """與最近一筆既存文件比對 DATA_KEYS 各欄位，全部相同回傳 (True, prev_doc_id)"""
    prev = find_latest_existing(db, collection, today_str)
    if prev is None:
        return False, None
    if all(_data_equal(prev.get(k), new_data.get(k)) for k in DATA_KEYS):
        return True, prev["_doc_id"]
    return False, prev["_doc_id"]


# ==========================================
# 資料整形
# ==========================================
def to_name_keyed(pid_map, normalized_active):
    """
    將 PlayerID 為 key 的 dict 轉為球員名稱為 key（每日快照的既有格式），
    並以現役名單過濾；名單為空時不過濾。
    """
    out = {}
    for pid_str, data in pid_map.items():
        data = dict(data)
        name = (data.pop("playerName", "") or "").strip()
        if not name:
            continue
        if normalized_active and name.lower() not in normalized_active:
            continue
        out[name] = {"playerId": int(pid_str), **data}
    return out


def merge_maps(*maps):
    """合併多個同 key 結構的 dict（後者欄位補進前者）"""
    merged = {}
    for m in maps:
        for ident, data in m.items():
            merged.setdefault(ident, {}).update(data)
    return merged


# ==========================================
# 單場擷取（G2）：每日順抓當天單場 → wolves_*_games（未來賽季免回補）
# ==========================================
def capture_single_game(db, season, season_type_api, season_type_label, today, normalized_active):
    """抓當天單場(DateFrom=DateTo=today)寫入 games collection；當天無比賽則 sg 為空、不寫。
    同時以最新賽程重建比賽索引 wolves_games_index（前端日期選單用，未來賽季免另跑回補）。"""
    api_date = datetime.strptime(today, "%Y-%m-%d").strftime("%m/%d/%Y")
    player = to_name_keyed(merge_maps(
        fetch_base_box(season, season_type_api, "Player", game_date=api_date),
        fetch_tracking_data(season, season_type_api, "Player", game_date=api_date),
        fetch_matchup_defense(season, season_type_api, game_date=api_date),
        fetch_hustle(season, season_type_api, "Player", game_date=api_date),
        fetch_shot_locations(season, season_type_api, "Player", game_date=api_date),
    ), normalized_active)
    team = merge_maps(
        fetch_base_box(season, season_type_api, "Team", game_date=api_date),
        fetch_tracking_data(season, season_type_api, "Team", game_date=api_date),
        fetch_hustle(season, season_type_api, "Team", game_date=api_date),
        fetch_shot_locations(season, season_type_api, "Team", game_date=api_date),
    ).get("MIN", {})
    if not player and not team:
        print(f"（{today} 當天無單場資料，不寫 games）")
        return
    # 取賽程：找當天 matchup/wl，並重建整季索引（idempotent，永遠反映最新已打場次）
    game_log = fetch_team_game_log(season, season_type_api)
    matchup, wl = "", ""
    for d, _api, m, w in game_log:
        if d == today:
            matchup, wl = m, w
            break
    ts = int(datetime.now().timestamp() * 1000)
    db.collection("wolves_player_games").document(today).set(
        {"date": today, "seasonType": season_type_label, "type": "單場",
         "matchup": matchup, "wl": wl, "timestamp": ts, "players": player})
    db.collection("wolves_team_games").document(today).set(
        {"date": today, "seasonType": season_type_label, "type": "單場",
         "matchup": matchup, "wl": wl, "timestamp": ts, "stats": team})
    if game_log:
        type_key = "regular" if season_type_api == "Regular+Season" else "playoffs"
        db.collection("wolves_games_index").document(f"{season}_{type_key}").set({
            "season": season, "seasonType": season_type_label,
            "games": [{"date": d, "matchup": m, "wl": w} for d, _api, m, w in game_log],
        })
    print(f"✅ 單場已寫入 wolves_*_games/{today}（球員 {len(player)} 人）+ 更新比賽索引")


# ==========================================
# 主程式
# ==========================================
def main():
    parser = argparse.ArgumentParser(description="Wolves Tracker 每日數據抓取")
    parser.add_argument("--force-type", choices=["regular", "playoffs"],
                        help="繞過休賽期，強制指定賽別（一次性補期末完整快照用）")
    parser.add_argument("--date", help="強制快照 doc id 日期 YYYY-MM-DD（配合 --force-type）")
    args = parser.parse_args()

    force = bool(args.force_type)
    if force:
        season_type_api = "Regular+Season" if args.force_type == "regular" else "Playoffs"
        season_type_label = "例行賽" if args.force_type == "regular" else "季後賽"
        today = args.date or get_today_str()
        print(f"=== 強制模式：補寫 {season_type_label} 期末完整快照 doc={today} ===")
    else:
        season_type_api, season_type_label = get_season_type()
        if season_type_api is None:
            print("目前為休賽期，不需要抓取數據，結束執行。")
            return
        today = get_today_str()
        print(f"=== 開始抓取灰狼隊數據（{season_type_label}）===")

    # 1. 抓取球隊資料
    team_synergy = fetch_synergy_data(SEASON, season_type_api, "T")
    team_tracking = fetch_tracking_data(SEASON, season_type_api, "Team").get("MIN", {})
    team_shooting = merge_maps(
        fetch_shot_locations(SEASON, season_type_api, "Team"),
        fetch_pt_shots(SEASON, season_type_api, "Team"),
    ).get("MIN", {})
    team_clutch = fetch_clutch(SEASON, season_type_api, "Team").get("MIN", {})
    team_lineups = fetch_lineups(SEASON, season_type_api)
    team_defense = merge_maps(
        fetch_hustle(SEASON, season_type_api, "Team"),
        fetch_defense_box(SEASON, season_type_api, "Team"),
        fetch_opp_shot_locations(SEASON, season_type_api),
    ).get("MIN", {})

    final_team_data = {
        "date": today,
        "type": "官方數據",
        "seasonType": season_type_label,
        "timestamp": int(datetime.now().timestamp() * 1000),
        "stats": team_synergy,      # Array
        "tracking": team_tracking,  # Dict
        "shooting": team_shooting,  # Dict
        "clutch": team_clutch,      # Dict
        "lineups": team_lineups,    # Array
        "defense": team_defense,    # Dict（Hustle + 防守 box + 對手分區）
    }

    # 2. 先抓取目前的現役球員名單，用來過濾已經離隊的球員
    roster_full = fetch_roster_with_ids(SEASON)
    active_roster = [p["name"] for p in roster_full]
    normalized_active = [p.strip().lower() for p in active_roster]
    # On/Off endpoint 的球員名為 'Last, First'，改以 PlayerID 對照名單取正規名稱
    id2name = {str(p["id"]): p["name"] for p in roster_full}

    # 3. 抓取球員資料（全聯盟後以現役名單過濾）
    player_synergy = fetch_synergy_data(SEASON, season_type_api, "P")
    player_tracking = to_name_keyed(
        fetch_tracking_data(SEASON, season_type_api, "Player"), normalized_active)
    player_shooting = to_name_keyed(merge_maps(
        fetch_shot_locations(SEASON, season_type_api, "Player"),
        fetch_pt_shots(SEASON, season_type_api, "Player"),
    ), normalized_active)
    player_clutch = to_name_keyed(
        fetch_clutch(SEASON, season_type_api, "Player"), normalized_active)
    player_defense = to_name_keyed(merge_maps(
        fetch_matchup_defense(SEASON, season_type_api),
        fetch_hustle(SEASON, season_type_api, "Player"),
        fetch_defense_box(SEASON, season_type_api, "Player"),
    ), normalized_active)
    # On/Off（在場/不在場效率）：以 PlayerID 對照名單轉為球員名 key
    onoff_raw = fetch_onoff(SEASON, season_type_api)
    player_onoff = {id2name[pid]: v for pid, v in onoff_raw.items() if pid in id2name}

    # 將 Synergy 資料轉換以球員名稱為 key 的 dict
    player_stats_map = {}
    for item in player_synergy:
        item.pop("playerId", None)
        ident = item.pop("playerName").strip()
        if normalized_active and ident.lower() not in normalized_active:
            continue
        player_stats_map.setdefault(ident, []).append(item)

    final_player_data = {
        "date": today,
        "type": "官方數據",
        "seasonType": season_type_label,
        "timestamp": int(datetime.now().timestamp() * 1000),
        "stats": player_stats_map,    # Dict of Arrays
        "tracking": player_tracking,  # Dict of Dicts
        "shooting": player_shooting,  # Dict of Dicts
        "clutch": player_clutch,      # Dict of Dicts
        "defense": player_defense,    # Dict of Dicts（對位防守 + Hustle + 防守 box）
        "onoff": player_onoff,        # Dict of Dicts（在場/不在場效率，球員專屬）
    }

    print("=== 資料整理完成，準備寫入 Firebase ===")

    # 防止 API 抓取失敗導致洗掉資料庫
    if not team_synergy and not player_synergy:
        print("❌ 警告：未成功抓取任何 Synergy 數據，可能遭到 NBA API 阻擋，本次終止寫入。")
        return

    db = init_firebase()
    if db:
        # 強制模式（補期末快照）一律寫入，不做 dedup、不擷取單場
        # Dedup：若與最近一筆既存資料完全相同，跳過寫入（節省 Firestore 用量 & 避免 UI 出現多日相同點）
        skip_team, prev_team = (False, None) if force else should_skip_write(db, 'wolves_team_stats', today, final_team_data)
        if skip_team:
            print(f"⏭️  球隊數據與 {prev_team} 完全相同，跳過寫入 {today}")
        else:
            db.collection('wolves_team_stats').document(today).set(final_team_data)
            print(f"✅ 球隊數據已寫入 Document: {today}（前一筆：{prev_team or '無'}）")

        skip_player, prev_player = (False, None) if force else should_skip_write(db, 'wolves_player_stats', today, final_player_data)
        if skip_player:
            print(f"⏭️  球員數據與 {prev_player} 完全相同，跳過寫入 {today}")
        else:
            db.collection('wolves_player_stats').document(today).set(final_player_data)
            print(f"✅ 球員數據已寫入 Document: {today}（前一筆：{prev_player or '無'}）")

        # G2：僅在累積數據有變動（= 今天有比賽）時擷取當天單場，避免非比賽日浪費請求
        # 強制模式為補期末整季快照，不擷取單場（該場已由 backfill_games 回補）
        if not skip_player and not force:
            capture_single_game(db, SEASON, season_type_api, season_type_label, today, normalized_active)

    # 本地測試模式：寫出為 json (一律寫出以供驗證)
    with open("local_test_data.json", "w", encoding="utf-8") as f:
        json.dump({
            "team": final_team_data,
            "player": final_player_data
        }, f, ensure_ascii=False, indent=2)
    print("📁 已更新 local_test_data.json")


if __name__ == "__main__":
    main()
