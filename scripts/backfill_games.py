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
    python backfill_games.py --season 2025-26 --type regular --box-only  # 只替既有單場補 box score（每場約 2 requests）
"""

import sys
import os
import time
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nba_common as nc

DEFAULT_MIN_GP = 0  # 門檻：整季出賽 >= 此值才回補（0 = 全名單球員都存）


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


def backfill_box_only(db, games):
    """只替既有單場文件補 box score（2026-10 前的場次沒抓過 box）。
    用 update 合併寫入 box/gameId，不覆寫 stats/opp 等既有欄位；文件不存在的場次跳過（不建空文件）。
    summary 沒抓到（complete=False）的場次標 [PARTIAL]，之後用 --dates 重補。"""
    if not db:
        print("❌ --box-only 需要 Firebase（找不到憑證），終止")
        sys.exit(1)
    done, partial, skipped, failed = 0, [], [], []
    for doc_date, _api_date, matchup, wl, gid in games:
        ref = db.collection("wolves_team_games").document(doc_date)
        if not ref.get().exists:
            print(f"[SKIP] {doc_date} {matchup}：wolves_team_games 無此文件")
            skipped.append(doc_date)
            continue
        box, complete = nc.fetch_boxscore(gid)
        if not box:
            print(f"[FAILED] {doc_date} {matchup} [{gid}]：box score 抓不到")
            failed.append(doc_date)
            continue
        ref.update({"box": box, "gameId": gid})
        score = " - ".join(f"{t['tricode']} {t['score']}" for t in box["teams"])
        print(f"✅ {doc_date} {matchup} {wl}｜{score}｜球員 {len(box['players'])} 人"
              f"{'' if complete else '｜[PARTIAL] 缺每節比分／傷停／背號'}")
        if not complete:
            partial.append(doc_date)
        done += 1
    print(f"\n=== box score 完成 {done}/{len(games)} 場 ===")
    if partial:
        print(f"[PARTIAL] {len(partial)} 場：--dates {','.join(partial)}")
    if failed:
        print(f"[FAILED] {len(failed)} 場：--dates {','.join(failed)}")
    if skipped:
        print(f"[SKIP] {len(skipped)} 場無單場文件：{', '.join(skipped)}")


def main():
    parser = argparse.ArgumentParser(description="Wolves Tracker 單場數據回補")
    parser.add_argument("--season", default=nc.get_current_season())
    parser.add_argument("--type", required=True, choices=["regular", "playoffs"])
    parser.add_argument("--limit", type=int, default=0, help="只跑前 N 場（0=全部）")
    parser.add_argument("--start", type=int, default=0, help="從第幾場開始（分批用）")
    parser.add_argument("--min-gp", type=int, default=DEFAULT_MIN_GP, help="輪換門檻出賽數")
    parser.add_argument("--index-only", action="store_true", help="只寫比賽索引(前端日期選單用)後結束")
    parser.add_argument("--dates", default="", help="只回補指定日期(逗號分隔 YYYY-MM-DD)，補失敗場用")
    parser.add_argument("--box-only", action="store_true",
                        help="只補 box score（每場約 2 requests），合併寫入既有 wolves_team_games，不動其他欄位")
    args = parser.parse_args()

    season = args.season
    season_type_api = "Regular+Season" if args.type == "regular" else "Playoffs"
    season_type_label = "例行賽" if args.type == "regular" else "季後賽"

    print(f"=== 單場回補 {season} {season_type_label} ===")
    if not args.box_only:   # --box-only 不需要球員名單，省一次 request
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
            "games": [{"date": d, "matchup": m, "wl": w, "gameId": gid} for d, _, m, w, gid in games],
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

    if args.box_only:
        backfill_box_only(db, games)
        return

    done = 0
    for doc_date, api_date, matchup, wl, gid in games:
        print(f"\n--- {doc_date} {matchup} {wl} [{gid}] ---")
        # 球員以 box score 上場名單（ID）過濾；--min-gp > 0 時再加套輪換門檻
        g = nc.fetch_single_game(season, season_type_api, api_date, gid, rotation,
                                 keep_is_fallback=(args.min_gp == 0))
        player, team = g["player"], g["team"]

        if not player and not team:
            print(f"[FAILED] {doc_date} 無資料，跳過")
            continue

        # 回補為事後抓取，數據已定稿；partial 照實標記，之後可用 --dates 重補
        player_doc, team_doc = nc.game_docs(doc_date, season_type_label, matchup, wl, g,
                                            extra={"partial": g["partial"], "final": True, "captureTries": 1})
        if db:
            db.collection("wolves_player_games").document(doc_date).set(player_doc)
            db.collection("wolves_team_games").document(doc_date).set(team_doc)
            print(f"✅ 已寫入 {doc_date}（灰狼 {len(player)} 人、對手 {g['opp_abbr']} {len(g['opp_players'])} 人"
                  f"{'，⚠️ 部分來源缺漏' if g['partial'] else ''}）")
        else:
            print(f"（無 DB）{doc_date} 球員 {len(player)} 人、球隊 {len(team)} 欄")
        done += 1

    print(f"\n=== 完成 {done}/{len(games)} 場 ===")


if __name__ == "__main__":
    main()
