# -*- coding: utf-8 -*-
"""
Wolves Tracker - 逐場資料打包

把某季某賽別的所有單場濃縮成 bundle doc（每場統一為 {date,matchup,wl,stats} 形狀）：
    wolves_games_bundle/{season}_{type}              球隊逐場（stats=球隊當場數據）
    wolves_pgames_bundle/{season}_{type}_{playerId}  逐球員逐場（stats=該員當場數據）

球員拆成「每人一份」是因為整季 15 人一份會超過 Firestore 單 doc 1 MiB 上限。
前端 Splits 分頁只需讀 1 份 bundle（球隊）或該球員 1 份，即可用 GameAgg 在瀏覽器算
任意期間（每月/勝敗/自訂區間/趨勢），避免一次讀 90+ 份文件（long-polling 會卡死）。

Usage:
    python build_bundles.py --season 2025-26 --type regular
    python build_bundles.py --all        # 依索引現有的所有 season_type 全部打包
"""

import sys
import os
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nba_common as nc

MiB = 1024 * 1024


def build_one(db, index_id):
    """依 wolves_games_index/{index_id} 的日期，打包 team 與 player 兩份 bundle。"""
    idx = db.collection("wolves_games_index").document(index_id).get()
    if not idx.exists:
        print(f"❌ 無索引 {index_id}，略過")
        return
    idata = idx.to_dict()
    season = idata.get("season")
    season_type_label = idata.get("seasonType")
    dates = [g["date"] for g in idata.get("games", [])]
    print(f"\n=== 打包 {index_id}（{len(dates)} 場）===")

    import json
    ts = int(datetime.now().timestamp() * 1000)

    # 球隊 bundle（單一 doc）
    team_games = []
    # 逐球員彙整：{playerId: {playerName, games: [...]}}
    per_player = {}
    for d in dates:
        tg = db.collection("wolves_team_games").document(d).get()
        m = w = ""
        if tg.exists:
            t = tg.to_dict()
            m, w = t.get("matchup", ""), t.get("wl", "")
            team_games.append({"date": d, "matchup": m, "wl": w, "stats": t.get("stats", {})})
        pg = db.collection("wolves_player_games").document(d).get()
        if pg.exists:
            p = pg.to_dict()
            m, w = p.get("matchup", m), p.get("wl", w)
            for name, pdata in (p.get("players") or {}).items():
                pid = str(pdata.get("playerId", ""))
                if not pid:
                    continue
                rec = per_player.setdefault(pid, {"playerName": name, "games": []})
                rec["playerName"] = name
                rec["games"].append({"date": d, "matchup": m, "wl": w, "stats": pdata})

    team_doc = {"season": season, "seasonType": season_type_label, "type": "逐場打包",
                "count": len(team_games), "timestamp": ts, "games": team_games}
    t_size = len(json.dumps(team_doc, ensure_ascii=False).encode("utf-8"))
    db.collection("wolves_games_bundle").document(index_id).set(team_doc)
    print(f"   ✅ team bundle ~{t_size/1024:.0f} KB → wolves_games_bundle/{index_id}")

    max_p = 0
    for pid, rec in per_player.items():
        pdoc = {"season": season, "seasonType": season_type_label, "type": "逐場打包",
                "playerId": int(pid), "playerName": rec["playerName"],
                "count": len(rec["games"]), "timestamp": ts, "games": rec["games"]}
        size = len(json.dumps(pdoc, ensure_ascii=False).encode("utf-8"))
        max_p = max(max_p, size)
        if size > 0.95 * MiB:
            print(f"   ⚠️ {rec['playerName']} bundle 逼近 1 MiB（{size/MiB:.2f}）")
        db.collection("wolves_pgames_bundle").document(f"{index_id}_{pid}").set(pdoc)
    print(f"   ✅ 逐球員 {len(per_player)} 份（最大 ~{max_p/1024:.0f} KB）→ wolves_pgames_bundle/{index_id}_*")


def main():
    parser = argparse.ArgumentParser(description="Wolves Tracker 逐場打包")
    parser.add_argument("--season", help="例：2025-26")
    parser.add_argument("--type", choices=["regular", "playoffs"])
    parser.add_argument("--all", action="store_true", help="依索引現有的所有 season_type 全部打包")
    args = parser.parse_args()

    db = nc.init_firebase()
    if not db:
        print("❌ 無法連線 Firebase")
        sys.exit(1)

    if args.all:
        for doc in db.collection("wolves_games_index").stream():
            build_one(db, doc.id)
    elif args.season and args.type:
        build_one(db, f"{args.season}_{args.type}")
    else:
        parser.error("需指定 --season 與 --type，或用 --all")


if __name__ == "__main__":
    main()
