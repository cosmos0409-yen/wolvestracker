# -*- coding: utf-8 -*-
"""假資料跑抓取流程（0 個 NBA／Firestore request）。test_fetch_flow.py 以子程序呼叫：

    python tests/py/fake_nba.py <情境> <輸出 JSON>

把 nba_common 的 fetch_* 換成「依（函式名、參數）產生固定資料」的假函式、Firestore 換成記錄器，
跑 fetch_data.py／backfill_history.py 的 main()，輸出 {exit, calls（抓取呼叫）, writes（Firestore 寫入）, side（旁路呼叫）}。
參數只要被改到，假資料就跟著不同——重構時寫入內容不變＝行為不變。
所有本地輸出（local_test_data.json、backfill 驗證檔）一律寫在暫存資料夾，不碰專案目錄（2026-11-19 曾覆蓋掉真的驗證檔）。
情境：daily｜games_only｜force｜playin_main｜pending｜hist_regular｜hist_playoffs"""
import contextlib
import hashlib
import inspect
import io
import json
import os
import sys
import tempfile

scenario, out_path = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
work = tempfile.mkdtemp(prefix="wolves_fake_")
os.environ["WOLVES_LOCAL_DIR"] = work
os.chdir(work)
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import nba_common as nc  # noqa: E402

CALLS, WRITES, SIDE = [], [], []
TEAMS = ["MIN", "1610612737", "1610612738"]
PLAYERS = {"101": "Alpha One", "102": "Beta Two Jr", "103": "Gamma Three", "201": "Other Guy", "202": "Another Guy"}
WOLVES = {"101", "102", "103"}


def h(*parts):
    return int(hashlib.md5(repr(parts).encode()).hexdigest()[:6], 16) % 1000 / 10


def bound(real, args, kw):
    b = inspect.signature(real).bind(*args, **kw)
    b.apply_defaults()
    return {k: v for k, v in b.arguments.items() if k not in ("team_of", "failed")}


def make_fake(name):
    real = getattr(nc, name)

    def fake(*args, **kw):
        a = bound(real, args, kw)
        CALLS.append([name, repr(sorted(a.items()))])
        pot = a.get("player_or_team")
        team_only = name in ("fetch_team_advanced", "fetch_opp_shot_locations", "fetch_team_matchup_defense")
        if name == "fetch_synergy_data":
            if pot == "P":
                return [{"playerId": int(p), "playerName": n, "PLAY_TYPE": "Iso", "PPP": h(name, p, repr(a))} for p, n in PLAYERS.items()]
            return [{"PLAY_TYPE": "Iso", "PPP": h(name, repr(a))}]
        if team_only or pot in ("Team", "T"):
            teams = TEAMS if a.get("team_id") == 0 else ["MIN"]
            return {t: {f"{name}_v": h(name, t, repr(a)), "GP": 10} for t in teams}
        ids = list(PLAYERS)
        if name == "fetch_matchup_defense" and a.get("team_id") not in (0, None):
            ids = [p for p in ids if p in WOLVES]
        out = {}
        for p in ids:
            out[p] = {"playerName": PLAYERS[p], f"{name}_v": h(name, p, repr(a)), "GP": 10, "MIN": 20}
            if name == "fetch_base_box" and a.get("with_team_abbr"):
                out[p]["teamAbbr"] = "MIN" if p in WOLVES else "ATL"
        if name == "fetch_base_box" and kw.get("team_of") is not None:
            for p in ids:
                kw["team_of"][p] = nc.TEAM_ID if p in WOLVES else 1610612737
        return out
    return fake


for n in ["fetch_synergy_data", "fetch_tracking_data", "fetch_shot_locations", "fetch_clutch", "fetch_matchup_defense",
          "fetch_team_matchup_defense", "fetch_hustle", "fetch_defense_box", "fetch_opp_shot_locations", "fetch_team_advanced",
          "fetch_player_advanced", "fetch_scoring", "fetch_base_box", "fetch_onoff"]:
    setattr(nc, n, make_fake(n))


def fake_lineup_rows(season, season_type_api, group_quantity=5):
    CALLS.append(["fetch_lineup_rows", repr((season, season_type_api, group_quantity))])
    return [{"players": f"G{group_quantity}-{i}", **{f[0]: h("lu", group_quantity, i, f[0]) for f in nc.LINEUP_FIELDS}} for i in range(12)]


def fake_roster(season):
    CALLS.append(["fetch_roster_with_ids", repr(season)])
    ids = ["101", "102", "103"] if season != "2026-27" else ["101", "103", "201"]
    return [{"id": int(p), "name": PLAYERS[p]} for p in ids]


def fake_season_teams(pid, type_key="regular"):
    CALLS.append(["fetch_player_season_teams", repr((pid, type_key))])
    return {"2024-25": "ATL", "2025-26": "ATL"}


class Doc:
    def __init__(self, c, d): self.c, self.d = c, d
    def set(self, data, merge=False): WRITES.append([self.c, self.d, data])
    def get(self, *a, **k):
        class S:
            exists = False
            def to_dict(self): return None
        return S()


class DB:
    def collection(self, c):
        class C:
            def document(self, d): return Doc(c, d)
        return C()


def rec(label):
    def f(*args, **kw):
        SIDE.append([label, [x for x in args if not isinstance(x, DB)], sorted(kw)])
        return True
    return f


nc.fetch_lineup_rows = fake_lineup_rows
nc.fetch_roster_with_ids = fake_roster
nc.fetch_player_season_teams = fake_season_teams
nc.init_firebase = lambda: DB()
nc.write_lineups = rec("write_lineups")
nc.get_current_season = lambda: "2026-27"
nc.get_roster_season = lambda: "2026-27"
nc.get_today_str = lambda: "2026-11-19"
_ST = {"playin_main": ("PlayIn", "附加賽"), "pending": ("Playoffs", "季後賽")}.get(scenario, ("Regular+Season", "例行賽"))
nc.get_season_type = lambda *a, **k: _ST
nc.pending_playin = lambda *a, **k: scenario == "pending"
nc.fetch_league_schedule = lambda *a, **k: None
nc.enable_block_guard = lambda: None
nc.fingerprint_info = lambda: {}

code = None
with contextlib.redirect_stdout(io.StringIO()):
    try:
        if scenario.startswith("hist"):
            import backfill_history as m
            m.write_lineups = nc.write_lineups
            sys.argv = ["x", "--season", "2024-25", "--type", "regular" if scenario == "hist_regular" else "playoffs"]
            m.main()
        else:
            import build_preview
            build_preview.build = rec("build_preview.build")
            import fetch_data as m
            m.should_skip_write = lambda db, c, t, d: (False, None)
            m.capture_recent_games = rec("capture_recent_games")
            m.write_status = rec("write_status")
            sys.argv = {"daily": ["x"], "games_only": ["x", "--games-only"], "playin_main": ["x"], "pending": ["x"],
                        "force": ["x", "--force-type", "playoffs", "--date", "2026-06-01"]}[scenario]
            m.main()
    except SystemExit as e:
        code = e.code


def scrub(o):
    if isinstance(o, dict):
        return {k: (0 if k in ("timestamp", "updatedAt") else scrub(v)) for k, v in o.items()}
    if isinstance(o, list):
        return [scrub(x) for x in o]
    return o


local_files = sorted(os.path.relpath(os.path.join(dp, f), work) for dp, _, fs in os.walk(work) for f in fs)
json.dump(scrub({"exit": code, "calls": CALLS, "writes": WRITES, "side": SIDE, "local_files": local_files}),
          open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True, default=repr)
