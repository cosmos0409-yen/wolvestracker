# -*- coding: utf-8 -*-
"""
Wolves Tracker - 單場題材（本場題材 Story Leads）

每場挑出最多 5 個「值得寫的點」＋勝負關鍵，寫進 wolves_team_games/{date}.insights，前端單場頁「概要」直接讀：
    個人：本季新高、灰狼生涯（本站資料內）前 N 高
    全隊：本站資料內前 N 高／低、本季最佳／最低
    勝負關鍵：Four Factors 加權貢獻最大的一項（需要 box，2025-26 起）
    歷史定位標籤 marks：灰狼球員本場在「本場 vs 季平均」12 項中，排進他灰狼場次前 3 名的（現在排名，2026-11-04 起）

只讀逐場 bundle（wolves_games_bundle／wolves_pgames_bundle）與單場 box，0 個 NBA request。
名次一律「截至當場」：只和這場之前的比賽比，寫入後不隨之後的比賽改變；
之後若被超越，記在 tag.after（之後第一場超越它的比賽），每次執行都重算——所以每日要跑「全部場次」，
舊賽季的生涯紀錄也可能被本季打破。只有內容變動的場次才會寫入。

門檻與指標清單在 nba_common.INSIGHT_RULES／INSIGHT_TEAM_METRICS／INSIGHT_PLAYER_METRICS；
文案在前端組（這裡只存結構化資料），改文案不必重算。

Usage:
    python build_insights.py                     # 全部場次（每日由 fetch_data.py 擷取單場後呼叫）
    python build_insights.py --date 2026-11-02   # 只算／寫一場
    python build_insights.py --season 2024-25    # 只寫某季（計算仍用全部歷史）
    python build_insights.py --dry-run [--date …] # 只印結果不寫入
"""

import sys
import os
import argparse
import statistics
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nba_common as nc

R = nc.INSIGHT_RULES
VERSION = 2   # v2（2026-11-04）：加 marks（歷史定位標籤）
TYPES = ("regular", "playoffs")


def seasons_since(first):
    start, end = int(first[:4]), int(nc.get_current_season()[:4])
    return [nc._season_str(y) for y in range(start, end + 1)]


# ==========================================
# 讀資料
# ==========================================
def load_data(db):
    """全隊逐場（含賽季／賽別）、各球員灰狼逐場。回傳 (team_games, players)
    team_games：依日期排序的 [{date, season, type, matchup, wl, stats}]
    players：{pid: {"name", "games": [{date, season, stats}]}}（只含灰狼場次，依日期排序）"""
    seasons = seasons_since(R["first_season"])
    team = []
    for s in seasons:
        for t in TYPES:
            d = db.collection("wolves_games_bundle").document(f"{s}_{t}").get()
            for g in (d.to_dict() or {}).get("games", []) if d.exists else []:
                team.append({"date": g["date"], "season": s, "type": t, "matchup": g.get("matchup", ""),
                             "wl": g.get("wl"), "stats": g.get("stats") or {}})
    team.sort(key=lambda g: g["date"])

    players = {}
    # 正確格式 {season}_{type}_{pid}；集合裡有一份格式不符的舊文件（2024-25_playoffs），略過
    ok_id = lambda p: len(p) == 3 and p[0] in seasons and p[1] in TYPES and p[2].isdigit()
    refs = [r for r in db.collection("wolves_pgames_bundle").list_documents() if ok_id(r.id.split("_"))]
    for snap in db.get_all(refs):   # 批次讀取（逐份 get 約 170 份要 1 分多鐘）
        parts = snap.id.split("_")
        d = snap.to_dict() or {}
        p = players.setdefault(parts[2], {"name": d.get("playerName") or parts[2], "games": []})
        p["games"] += [{"date": g["date"], "season": parts[0], "stats": g.get("stats") or {}}
                       for g in d.get("games", []) if (g.get("stats") or {}).get("MIN")]
    for p in players.values():
        p["games"].sort(key=lambda g: g["date"])
    return team, players


# ==========================================
# 計算
# ==========================================
def team_value(stats, key):
    """全隊欄位取值：OPP_PTS 為衍生欄；Tracking 沒釋出（缺 TOUCHES）時切入／傳球是補 0，不算數"""
    if key == "OPP_PTS":
        pts, pm = stats.get("PTS"), stats.get("PLUS_MINUS")
        return pts - pm if isinstance(pts, (int, float)) and isinstance(pm, (int, float)) else None
    if key in ("DRIVES", "PASSES_MADE") and stats.get("TOUCHES") is None:
        return None
    v = stats.get(key)
    return v if isinstance(v, (int, float)) else None


def better(a, b, side):
    """side='high'：a 比 b 高；'low'：a 比 b 低"""
    return a > b if side == "high" else a < b


def rank_in(pool, x, side):
    """pool：之前場次的值。回傳 (名次, 並列數, 樣本數含本場)"""
    return sum(1 for v in pool if better(v, x, side)) + 1, sum(1 for v in pool if v == x), len(pool) + 1


def ref_of(game):
    return {"date": game["date"], "value": game["v"], "matchup": game["matchup"],
            **({"playoffs": True} if game.get("type") == "playoffs" else {})}


def best_prior(prior, side):
    if not prior:
        return None
    return ref_of((max if side == "high" else min)(prior, key=lambda g: g["v"]))


def first_after(later, x, side):
    for g in later:
        if better(g["v"], x, side):
            return ref_of(g)
    return None


def make_tags(x, side, scopes, top, min_n, season_min, strict_season):
    """scopes：[(scope, prior, later)]，scope 為 'all'（本站資料內）或 'season'。
    寬範圍（all）前 top 名且樣本 ≥ min_n 才列；本季只列第 1（新高／最低），需賽前 ≥ season_min 場、不可並列"""
    tags = []
    for scope, prior, later in scopes:
        pool = [g["v"] for g in prior]
        r, ties, n = rank_in(pool, x, side)
        if scope == "season":
            if r != 1 or len(pool) < season_min or (strict_season and ties):
                continue
        elif r > top or n < min_n:
            continue
        tags.append({"scope": scope, "side": side, "rank": r, "ties": ties, "n": n,
                     "after": first_after(later, x, side)})
    return tags


def zscore(pool, x):
    if len(pool) < 5:
        return 0.0
    sd = statistics.pstdev(pool)
    return 0.0 if sd == 0 else (x - statistics.mean(pool)) / sd


def card_score(tags, top, z, is_player):
    """排序分數：寬範圍名次（第 1＝top 分）為主、本季新高次之，多個標籤與偏離程度微調"""
    pts = [(top + 1 - t["rank"]) if t["scope"] == "all" else (1.5 if is_player else 1.0) for t in tags]
    return round(max(pts) + 0.5 * (len(tags) - 1) + 0.1 * min(abs(z), 5), 3)


def team_cards(game, team):
    s = game["stats"]
    prior_all = [g for g in team if g["date"] < game["date"]]
    later_all = [g for g in team if g["date"] > game["date"]]
    cards = []
    for key, label, direction, min_att in nc.INSIGHT_TEAM_METRICS:
        x = team_value(s, key)
        if x is None or (min_att and (s.get(min_att[0]) or 0) < min_att[1]):
            continue

        def series(games):
            out = []
            for g in games:
                v = team_value(g["stats"], key)
                if v is not None and (not min_att or (g["stats"].get(min_att[0]) or 0) >= min_att[1]):
                    out.append({**g, "v": v})
            return out
        pa, la = series(prior_all), series(later_all)
        ps = [g for g in pa if g["season"] == game["season"]]
        ls = [g for g in la if g["season"] == game["season"]]
        # 正向：high/neutral 看「高」、low 看「低」；反向（只有 high）：看「低」，0 值不算（多半是資料缺漏）
        sides = [("low" if direction == "low" else "high", "neu" if direction == "neutral" else "pos")]
        if direction == "high" and x != 0:
            sides.append(("low", "neg"))
        if direction == "low":
            sides.append(("high", "neg"))
        for side, tone in sides:
            tags = make_tags(x, side, [("all", pa, la), ("season", ps, ls)],
                             R["team_top"], R["team_min_n"], R["season_min_prior"], True)
            if not tags:
                continue
            first = tags[0]
            prev = best_prior(pa if first["scope"] == "all" else ps, side)
            cards.append({"kind": "team", "key": key, "label": label, "value": x, "tone": tone,
                          "tags": tags, "prev": prev,
                          "score": card_score(tags, R["team_top"], zscore([g["v"] for g in pa], x), False)})
    return cards


def player_cards(game, players):
    cards = []
    for pid, p in players.items():
        me = next((g for g in p["games"] if g["date"] == game["date"]), None)
        if not me or (me["stats"].get("MIN") or 0) < R["min_minutes"]:
            continue
        mine = []
        for key, label, floor in nc.INSIGHT_PLAYER_METRICS:
            x = me["stats"].get(key)
            if not isinstance(x, (int, float)) or x < floor:
                continue
            series = lambda gs: [{**g, "matchup": game_matchup.get(g["date"], ""), "type": game_type.get(g["date"]),
                                  "v": g["stats"][key]} for g in gs if isinstance(g["stats"].get(key), (int, float))]
            pa = series([g for g in p["games"] if g["date"] < game["date"]])
            la = series([g for g in p["games"] if g["date"] > game["date"]])
            ps = [g for g in pa if g["season"] == game["season"]]
            ls = [g for g in la if g["season"] == game["season"]]
            tags = make_tags(x, "high", [("all", pa, la), ("season", ps, ls)],
                             R["player_top"], R["player_min_n"], R["season_min_prior"], True)
            if not tags:
                continue
            prev = best_prior(pa if tags[0]["scope"] == "all" else ps, "high")
            mine.append({"kind": "player", "pid": int(pid), "name": p["name"], "key": key, "label": label,
                         "value": x, "tone": "pos", "tags": tags, "prev": prev,
                         "score": card_score(tags, R["player_top"], zscore([g["v"] for g in pa], x), True)})
        mine.sort(key=lambda c: -c["score"])
        cards += mine[:R["max_per_player"]]
    return cards


def four_factors(box):
    """勝負關鍵：box 兩隊合計算 Four Factors，依權重取對勝負貢獻最大的一項；沒有 box（2024-25 以前）回 None"""
    teams = (box or {}).get("teams") or []
    mt = next((t for t in teams if t.get("tricode") == "MIN"), None)
    ot = next((t for t in teams if t.get("tricode") != "MIN"), None)
    if not mt or not ot:
        return None
    a, b = mt.get("totals") or {}, ot.get("totals") or {}

    def ff(t, o):
        try:
            return {"efg": (t["FGM"] + 0.5 * t["FG3M"]) / t["FGA"] * 100,
                    "tov": t["TOV"] / (t["FGA"] + 0.44 * t["FTA"] + t["TOV"]) * 100,
                    "orb": t["OREB"] / (t["OREB"] + o["DREB"]) * 100,
                    "ftr": t["FTM"] / t["FGA"] * 100}
        except (KeyError, TypeError, ZeroDivisionError):
            return None
    fa, fb = ff(a, b), ff(b, a)
    if not fa or not fb:
        return None
    w = R["ff_weights"]
    sign = {"efg": 1, "tov": -1, "orb": 1, "ftr": 1}   # 失誤率越低越好
    contrib = {k: (fa[k] - fb[k]) * sign[k] * w[k] for k in w}
    win = mt.get("score", 0) > ot.get("score", 0)
    key = max(contrib, key=lambda k: contrib[k] if win else -contrib[k])
    return {"factor": key, "win": win, "oppAbbr": ot.get("tricode"),
            "factors": {k: {"min": round(fa[k], 1), "opp": round(fb[k], 1), "contrib": round(contrib[k], 2)} for k in w}}


def player_marks(game, players):
    """歷史定位標籤：{pid: {欄名: {rank, ties, side}}}，只存前 N 名（INSIGHT_MARK_RULES）。
    名次是「現在」排名（含之後的比賽），不存樣本數——多打一場樣本數就變，存了會讓每場文件每天都改寫"""
    M = nc.INSIGHT_MARK_RULES
    out = {}
    for pid, p in players.items():
        me = next((g for g in p["games"] if g["date"] == game["date"]), None)
        if not me or (me["stats"].get("MIN") or 0) < R["min_minutes"]:
            continue
        marks = {}
        for key, den in nc.INSIGHT_MARK_METRICS:
            ok = lambda s: isinstance(s.get(key), (int, float)) and (not den or (s.get(den) or 0) >= M["min_att"])
            if not ok(me["stats"]):
                continue
            pool = [g["stats"][key] for g in p["games"] if ok(g["stats"])]
            if len(pool) < M["min_n"]:
                continue
            x = me["stats"][key]
            for side in (("high", "low") if den else ("high",)):
                rank = sum(1 for v in pool if better(v, x, side)) + 1
                ties = sum(1 for v in pool if v == x) - 1   # pool 含本場
                if rank <= M["top"] and ties <= M["max_ties"]:
                    marks[key] = {"rank": rank, "ties": ties, "side": side}
                    break
        if marks:
            out[pid] = marks
    return out


def build_for(game, team, players, box):
    cards = team_cards(game, team) + player_cards(game, players)
    cards.sort(key=lambda c: (-c["score"], c["kind"] != "player"))
    out, per = [], {}
    for c in cards:
        if c["kind"] == "player":
            if per.get(c["pid"], 0) >= R["max_per_player"]:
                continue
            per[c["pid"]] = per.get(c["pid"], 0) + 1
        out.append(c)
        if len(out) >= R["max_cards"]:
            break
    return {"v": VERSION, "since": R["first_season"], "cards": out, "key": four_factors(box),
            "marks": player_marks(game, players)}


# ==========================================
# 輸出
# ==========================================
def describe(ins):
    """dry-run 用的純文字摘要（正式文案在前端）"""
    lines = []
    for c in ins["cards"]:
        who = c.get("name") or "灰狼"
        tags = "、".join(
            (f"{'本站' if t['scope'] == 'all' else '本季'}{'並列' if t['ties'] else ''}第 {t['rank']} "
             f"{'高' if t['side'] == 'high' else '低'}（{t['n']} 場）")
            + (f"→ 之後被 {t['after']['date']} {t['after']['value']:g} 超越" if t["after"] else "")
            for t in c["tags"])
        prev = f"｜前紀錄 {c['prev']['value']:g}（{c['prev']['date']} {c['prev']['matchup']}）" if c["prev"] else ""
        lines.append(f"  [{c['tone']}] {who}・{c['label']} {c['value']:g}　{tags}{prev}　score={c['score']}")
    k = ins.get("key")
    if k:
        f = k["factors"][k["factor"]]
        lines.append(f"  勝負關鍵：{k['factor']} {f['min']} vs {k['oppAbbr']} {f['opp']}")
    for pid, ms in (ins.get("marks") or {}).items():
        lines.append(f"  標籤 {pid}：" + "、".join(
            f"{key} 第 {m['rank']} {'高' if m['side'] == 'high' else '低'}{'（並列）' if m['ties'] else ''}" for key, m in ms.items()))
    return "\n".join(lines) or "  （無）"


def comparable(ins):
    return {k: v for k, v in (ins or {}).items() if k != "computedAt"}


def run(db, dates=None, seasons=None, dry_run=False, quiet=False):
    """計算並寫入。dates／seasons 只限制「寫哪些場」，計算一律用全部歷史。回傳 (寫入數, 未變數, 失敗數)"""
    team, players = load_data(db)
    global game_matchup, game_type
    game_matchup = {g["date"]: g["matchup"] for g in team}
    game_type = {g["date"]: g["type"] for g in team}
    targets = [g for g in team if (not dates or g["date"] in dates) and (not seasons or g["season"] in seasons)]
    if not quiet:
        print(f"=== 單場題材：{len(team)} 場歷史、{len(players)} 位球員，處理 {len(targets)} 場{'（dry-run）' if dry_run else ''} ===")
    written = same = failed = 0
    ts = int(datetime.now().timestamp() * 1000)
    refs = [db.collection("wolves_team_games").document(g["date"]) for g in targets]
    snaps = {s.id: s for s in db.get_all(refs, field_paths=["insights", "box.teams"])} if refs else {}
    for g in targets:
        ref = db.collection("wolves_team_games").document(g["date"])
        snap = snaps.get(g["date"])
        if not snap or not snap.exists:
            print(f"⚠️ {g['date']} 沒有單場文件，略過")
            failed += 1
            continue
        doc = snap.to_dict() or {}
        ins = build_for(g, team, players, doc.get("box"))
        if dry_run:
            print(f"--- {g['date']} {g['matchup']} {g['wl']}\n{describe(ins)}")
            continue
        if comparable(doc.get("insights")) == ins:
            same += 1
            continue
        ref.update({"insights": {**ins, "computedAt": ts}})
        written += 1
    if not quiet and not dry_run:
        print(f"✅ 單場題材：寫入 {written} 場、未變 {same} 場" + (f"、略過 {failed} 場" if failed else ""))
    return written, same, failed


game_matchup, game_type = {}, {}


def main():
    ap = argparse.ArgumentParser(description="單場題材（wolves_team_games/{date}.insights）")
    ap.add_argument("--date", help="只處理這幾場，逗號分隔 YYYY-MM-DD")
    ap.add_argument("--season", help="只處理這幾季，逗號分隔（如 2024-25）")
    ap.add_argument("--all", action="store_true", help="全部場次（預設即全部；保留給指令可讀性）")
    ap.add_argument("--dry-run", action="store_true", help="只印結果，不寫入")
    args = ap.parse_args()
    db = nc.init_firebase()
    if db is None:
        sys.exit(1)
    run(db, dates=set(args.date.split(",")) if args.date else None,
        seasons=set(args.season.split(",")) if args.season else None, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
