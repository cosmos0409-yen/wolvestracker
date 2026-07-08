# -*- coding: utf-8 -*-
"""
Wolves Tracker - 單場比賽數據回補（非 Synergy）

用 leaguedash* 的 DateFrom=DateTo 逐場抓灰狼單場數據，寫入：
    wolves_player_games/{YYYY-MM-DD}   球員單場（僅輪換球員）
    wolves_team_games/{YYYY-MM-DD}     球隊單場

只含可靠的單場數據：Base(傳統基本) + Tracking(6) + 對位防守 + Hustle + 分區投籃。
不含 Clutch（單場多為 0、端點單日不穩）與 Synergy（不支援日期，僅能相減還原）。

Usage:
    python backfill_games.py --season 2025-26 --type regular --limit 2   # 小樣本測試(前2場)
    python backfill_games.py --season 2025-26 --type regular             # 全季
    python backfill_games.py --season 2025-26 --type regular --start 40 --limit 20  # 分批(第40場起20場)
"""

import sys
import os
import time
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nba_common as nc

DEFAULT_MIN_GP = 0  # 門檻：整季出賽 >= 此值才回補（0 = 全名單球員都存）


def merge_maps(*maps):
    """合併多個同 key 結構的 dict（後者欄位補進前者）"""
    merged = {}
    for m in maps:
        for ident, data in m.items():
            merged.setdefault(ident, {}).update(data)
    return merged


def pid_to_name(pid_map, keep_names):
    """PlayerID-keyed → playerName-keyed，只保留 keep_names 內的球員（輪換過濾）"""
    out = {}
    for pid_str, data in pid_map.items():
        data = dict(data)
        name = (data.pop("playerName", "") or "").strip()
        if not name or (keep_names and name not in keep_names):
            continue
        out[name] = {"playerId": int(pid_str), **data}
    return out


def fetch_rotation_names(season, season_type_api, min_gp):
    """整季出賽 >= min_gp 的灰狼球員名單（輪換界定）"""
    url = (f"https://stats.nba.com/stats/leaguedashplayerstats?{nc.LEAGUE_DASH_COMMON}"
           f"&MeasureType=Base&PaceAdjust=N&PlusMinus=N&Rank=N&Period=0"
           f"&ShotClockRange=&GameSegment=&PlayerOrTeam=Player"
           f"&Season={season}&SeasonType={season_type_api}&TeamID={nc.TEAM_ID}")
    data = nc.fetch_with_retry(url, "RotationNames")
    if data is None:
        return set()
    h = data['resultSets'][0]['headers']
    gp_i, name_i = h.index("GP"), h.index("PLAYER_NAME")
    return {r[name_i].strip() for r in data['resultSets'][0]['rowSet'] if r[gp_i] >= min_gp}


def main():
    parser = argparse.ArgumentParser(description="Wolves Tracker 單場數據回補")
    parser.add_argument("--season", default="2025-26")
    parser.add_argument("--type", required=True, choices=["regular", "playoffs"])
    parser.add_argument("--limit", type=int, default=0, help="只跑前 N 場（0=全部）")
    parser.add_argument("--start", type=int, default=0, help="從第幾場開始（分批用）")
    parser.add_argument("--min-gp", type=int, default=DEFAULT_MIN_GP, help="輪換門檻出賽數")
    parser.add_argument("--index-only", action="store_true", help="只寫比賽索引(前端日期選單用)後結束")
    parser.add_argument("--dates", default="", help="只回補指定日期(逗號分隔 YYYY-MM-DD)，補失敗場用")
    args = parser.parse_args()

    season = args.season
    season_type_api = "Regular+Season" if args.type == "regular" else "Playoffs"
    season_type_label = "例行賽" if args.type == "regular" else "季後賽"

    print(f"=== 單場回補 {season} {season_type_label} ===")
    rotation = fetch_rotation_names(season, season_type_api, args.min_gp)
    print(f"輪換球員（GP>={args.min_gp}）：{len(rotation)} 人 — {', '.join(sorted(rotation))}")

    games = nc.fetch_team_game_log(season, season_type_api)
    if not games:
        print("❌ 無法取得比賽日期，終止")
        sys.exit(1)
    total = len(games)

    db = nc.init_firebase()
    # 寫比賽索引（前端單場日期選單用，避免讀 82 份文件）
    if db:
        index_id = f"{season}_{args.type}"
        db.collection("wolves_games_index").document(index_id).set({
            "season": season, "seasonType": season_type_label,
            "games": [{"date": d, "matchup": m, "wl": w} for d, _, m, w in games],
        })
        print(f"✅ 已寫入比賽索引 wolves_games_index/{index_id}（{total} 場）")
    if args.index_only:
        print("（--index-only：只寫索引，結束）")
        return

    if args.dates:
        want = {d.strip() for d in args.dates.split(",") if d.strip()}
        games = [g for g in games if g[0] in want]
        print(f"（--dates 指定回補 {len(games)} 場：{', '.join(g[0] for g in games)}）")
    else:
        games = games[args.start:]
        if args.limit:
            games = games[:args.limit]
    print(f"共 {total} 場，本次處理 {len(games)} 場（start={args.start}, limit={args.limit or '全部'}）")

    done = 0
    for doc_date, api_date, matchup, wl in games:
        print(f"\n--- {doc_date} {matchup} {wl} ---")
        player = pid_to_name(merge_maps(
            nc.fetch_base_box(season, season_type_api, "Player", game_date=api_date),
            nc.fetch_tracking_data(season, season_type_api, "Player", game_date=api_date),
            nc.fetch_matchup_defense(season, season_type_api, game_date=api_date),
            nc.fetch_hustle(season, season_type_api, "Player", game_date=api_date),
            nc.fetch_shot_locations(season, season_type_api, "Player", game_date=api_date),
        ), rotation)
        team = merge_maps(
            nc.fetch_base_box(season, season_type_api, "Team", game_date=api_date),
            nc.fetch_tracking_data(season, season_type_api, "Team", game_date=api_date),
            nc.fetch_hustle(season, season_type_api, "Team", game_date=api_date),
            nc.fetch_shot_locations(season, season_type_api, "Team", game_date=api_date),
        ).get("MIN", {})

        if not player and not team:
            print(f"[FAILED] {doc_date} 無資料，跳過")
            continue

        ts = int(datetime.now().timestamp() * 1000)
        player_doc = {"date": doc_date, "seasonType": season_type_label, "type": "單場",
                      "matchup": matchup, "wl": wl, "timestamp": ts, "players": player}
        team_doc = {"date": doc_date, "seasonType": season_type_label, "type": "單場",
                    "matchup": matchup, "wl": wl, "timestamp": ts, "stats": team}
        if db:
            db.collection("wolves_player_games").document(doc_date).set(player_doc)
            db.collection("wolves_team_games").document(doc_date).set(team_doc)
            print(f"✅ 已寫入 {doc_date}（球員 {len(player)} 人）")
        else:
            print(f"（無 DB）{doc_date} 球員 {len(player)} 人、球隊 {len(team)} 欄")
        done += 1

    print(f"\n=== 完成 {done}/{len(games)} 場 ===")


if __name__ == "__main__":
    main()
