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
    merge_maps,
    pid_to_name_keyed,
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
    fetch_single_game,
    game_docs,
    get_current_season,
)
from build_bundles import upsert_game

SEASON = get_current_season()  # 10/20 起切換為新賽季；前端 constants.js 同規則

# 每日快照文件中參與去重比對的資料欄位
DATA_KEYS = ["stats", "base", "tracking", "shooting", "clutch", "lineups", "defense", "onoff"]


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
# 單場擷取（G2）：每日補抓「已完賽但尚未擷取」的場次 → wolves_*_games + bundle 增量更新
# ==========================================
# 往回檢查最近幾場：排程漏跑（電腦關機）或某場被標 partial 時，下次執行自動補上
CAPTURE_LOOKBACK_GAMES = 5
# partial 場次最多擷取幾次就放棄（避免某來源永久沒資料時每天白打 ~20 個 request）；只計「定稿」後的擷取
CAPTURE_MAX_TRIES = 3
# 定稿門檻：比賽隔天美東（UTC-5 計）13:00。NBA 賽後最多約 12 小時才把數據補齊，
# 最晚的西岸場約美東 01:00 結束 → +12h ≈ 13:00。早於此時擷取的單場標 final=False，下次一定重抓，
# 避免把「各來源都有值但還沒更新完」的半成品鎖死（partial 只抓得到「某來源整個空」的情況）。
# 正式排程在台北 03:00（≈ UTC-5 14:00），一次即可定稿。
FINAL_AFTER_HOURS = 24 + 13


def is_final_capture(game_date, now_east=None):
    """game_date 'YYYY-MM-DD'；now_east 預設為現在的 UTC-5 時間"""
    now_east = now_east or (datetime.utcnow() - timedelta(hours=5))
    return now_east >= datetime.strptime(game_date, "%Y-%m-%d") + timedelta(hours=FINAL_AFTER_HOURS)


def capture_recent_games(db, season, season_type_api, season_type_label, normalized_active):
    """以賽程（teamgamelog，只列已完賽場次）找出缺漏、未定稿或不完整的單場，逐場擷取。
    場次日期取自賽程本身，不用執行當天日期——排程在台北 14:00（美東凌晨）執行，
    當天日期永遠是比賽隔天，用它查單場會落空。
    同時以最新賽程重建比賽索引 wolves_games_index（前端日期選單用），並增量更新 bundle（前端 Splits/總覽用）。"""
    if not normalized_active:
        # 名單抓失敗時 pid_to_name_keyed 不過濾 → 會把全聯盟球員寫進單場與 bundle
        print("（現役名單為空，本次不擷取單場）")
        return
    game_log = fetch_team_game_log(season, season_type_api)
    if not game_log:
        print("（賽程為空或抓取失敗，本次不擷取單場）")
        return
    type_key = "regular" if season_type_api == "Regular+Season" else "playoffs"
    index_id = f"{season}_{type_key}"
    db.collection("wolves_games_index").document(index_id).set({
        "season": season, "seasonType": season_type_label,
        "games": [{"date": d, "matchup": m, "wl": w, "gameId": gid} for d, _api, m, w, gid in game_log],
    })

    todo = []
    for d, api_date, m, w, gid in game_log[-CAPTURE_LOOKBACK_GAMES:]:
        snap = db.collection("wolves_player_games").document(d).get(
            field_paths=["partial", "final", "captureTries"])
        if not snap.exists:
            todo.append((d, api_date, m, w, gid, 0, "缺漏"))
            continue
        prev = snap.to_dict() or {}
        # 舊文件（回補產生、無 final 欄）一律視為已定稿
        if not prev.get("final", True):
            todo.append((d, api_date, m, w, gid, 0, "上次未定稿"))
            continue
        tries = prev.get("captureTries", 1)
        if prev.get("partial") and tries < CAPTURE_MAX_TRIES:
            todo.append((d, api_date, m, w, gid, tries, f"上次不完整，第 {tries + 1} 次"))
    if not todo:
        print(f"（最近 {min(len(game_log), CAPTURE_LOOKBACK_GAMES)} 場皆已擷取，比賽索引已更新）")
        return

    for d, api_date, m, w, gid, tries, why in todo:
        print(f"--- 擷取單場 {d} {m} {w} [{gid}]（{why}）---")
        g = fetch_single_game(season, season_type_api, api_date, gid, normalized_active, casefold=True)
        player, team, partial = g["player"], g["team"], g["partial"]
        if not player and not team:
            print(f"[FAILED] {d} 單場無資料，下次再試")
            continue
        final = is_final_capture(d)
        player_doc, team_doc = game_docs(d, season_type_label, m, w, g, extra={
            "partial": partial, "final": final, "captureTries": tries + 1 if final else 0})
        db.collection("wolves_player_games").document(d).set(player_doc)
        db.collection("wolves_team_games").document(d).set(team_doc)
        upsert_game(db, index_id, season, season_type_label, d, m, w, team, player,
                    opp_stats=g["opp_team"], opp_abbr=g["opp_abbr"])
        flag = ("未定稿（距比賽未滿 12 小時），下次重抓" if not final else "完整" if not partial else
                "⚠️ 部分來源缺漏，下次重抓" if tries + 1 < CAPTURE_MAX_TRIES else "⚠️ 部分來源缺漏，已達重試上限")
        print(f"✅ 單場已寫入 wolves_*_games/{d}（灰狼 {len(player)} 人、對手 {g['opp_abbr']} {len(g['opp_players'])} 人，{flag}）")


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
    team_base = fetch_base_box(SEASON, season_type_api, "Team").get("MIN", {})
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
        "base": team_base,          # Dict（整季 base，PerMode=PerGame 每場平均）
        "tracking": team_tracking,  # Dict
        "shooting": team_shooting,  # Dict
        "clutch": team_clutch,      # Dict
        "lineups": team_lineups,    # Array
        "defense": team_defense,    # Dict（Hustle + 防守 box + 對手分區）
    }

    # 2. 先抓取目前的現役球員名單，用來過濾已經離隊的球員
    roster_full = fetch_roster_with_ids(SEASON)
    # 以 PlayerID 過濾，不比名字：名冊 API 與數據 API 的名字寫法可能不同
    # （2025-26 名冊 "Terrence Shannon Jr." vs 數據 "Terrence Shannon Jr"，比名字會整個人消失）。
    # 輸出 key 一律用數據 API 的寫法（pid_to_name_keyed 取 playerName）
    roster_ids = {str(p["id"]) for p in roster_full}
    # 小寫名字清單只留給單場擷取當後備（box score 抓不到時）
    normalized_active = [p["name"].strip().lower() for p in roster_full]

    # 3. 抓取球員資料（全聯盟後以現役名單 PlayerID 過濾）
    player_synergy = fetch_synergy_data(SEASON, season_type_api, "P")
    player_tracking = pid_to_name_keyed(
        fetch_tracking_data(SEASON, season_type_api, "Player"), keep_ids=roster_ids)
    player_shooting = pid_to_name_keyed(merge_maps(
        fetch_shot_locations(SEASON, season_type_api, "Player"),
        fetch_pt_shots(SEASON, season_type_api, "Player"),
    ), keep_ids=roster_ids)
    player_clutch = pid_to_name_keyed(
        fetch_clutch(SEASON, season_type_api, "Player"), keep_ids=roster_ids)
    player_defense = pid_to_name_keyed(merge_maps(
        fetch_matchup_defense(SEASON, season_type_api),
        fetch_hustle(SEASON, season_type_api, "Player"),
        fetch_defense_box(SEASON, season_type_api, "Player"),
    ), keep_ids=roster_ids)
    base_raw = fetch_base_box(SEASON, season_type_api, "Player")
    player_base = pid_to_name_keyed(base_raw, keep_ids=roster_ids)
    # On/Off（在場/不在場效率）：endpoint 的球員名為 'Last, First'，改以 PlayerID 取名。
    # 優先用 base 的寫法（與其他類別 key 一致，前端 current.onoff[球員名] 直接查），沒有才退回名冊
    id2name = {str(p["id"]): p["name"] for p in roster_full}
    id2name.update({pid: v["playerName"].strip() for pid, v in base_raw.items()
                    if pid in id2name and (v.get("playerName") or "").strip()})
    onoff_raw = fetch_onoff(SEASON, season_type_api)
    player_onoff = {id2name[pid]: v for pid, v in onoff_raw.items() if pid in id2name}

    # 將 Synergy 資料轉換以球員名稱為 key 的 dict（同樣以 PlayerID 過濾）
    player_stats_map = {}
    for item in player_synergy:
        pid = str(item.pop("playerId", ""))
        ident = item.pop("playerName").strip()
        if roster_ids and pid not in roster_ids:
            continue
        player_stats_map.setdefault(ident, []).append(item)

    final_player_data = {
        "date": today,
        "type": "官方數據",
        "seasonType": season_type_label,
        "timestamp": int(datetime.now().timestamp() * 1000),
        "stats": player_stats_map,    # Dict of Arrays
        "base": player_base,          # Dict of Dicts（整季 base，PerMode=PerGame 每場平均）
        "tracking": player_tracking,  # Dict of Dicts
        "shooting": player_shooting,  # Dict of Dicts
        "clutch": player_clutch,      # Dict of Dicts
        "defense": player_defense,    # Dict of Dicts（對位防守 + Hustle + 防守 box）
        "onoff": player_onoff,        # Dict of Dicts（在場/不在場效率，球員專屬）
    }

    print("=== 資料整理完成，準備寫入 Firebase ===")

    # 防止 API 抓取失敗導致洗掉資料庫：Synergy 與 base 都空才視為被擋。
    # 開季初 NBA 尚未釋出 Synergy（回傳 0 筆、非錯誤），此時其他類別與單場照常寫入
    if not team_synergy and not player_synergy:
        if not team_base and not player_base:
            print("❌ 警告：Synergy 與 base 皆無資料，可能遭到 NBA API 阻擋，本次終止寫入。")
            return
        print("⚠️ Synergy 無資料（開季初 NBA 尚未釋出？），其他類別與單場照常寫入。")

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

        # G2：每次都對賽程補抓缺漏單場（無缺漏時只花 1 個 request 讀賽程）
        # 強制模式為補期末整季快照，不擷取單場（該場已由 backfill_games 回補）
        if not force:
            capture_recent_games(db, SEASON, season_type_api, season_type_label, normalized_active)

    # 本地測試模式：寫出為 json (一律寫出以供驗證)
    with open("local_test_data.json", "w", encoding="utf-8") as f:
        json.dump({
            "team": final_team_data,
            "player": final_player_data
        }, f, ensure_ascii=False, indent=2)
    print("📁 已更新 local_test_data.json")


if __name__ == "__main__":
    main()
