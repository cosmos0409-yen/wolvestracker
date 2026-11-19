# -*- coding: utf-8 -*-
"""抓取流程（fetch_data.py／backfill_history.py）用假資料跑（tests/py/fake_nba.py，0 request）：
寫入哪些文件、文件結構、request 清單、旁路呼叫（組合、單場擷取、賽前預覽、狀態檔）"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from collections import Counter

from _common import ROOT
import nba_common as nc

FAKE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fake_nba.py")
_cache = {}


def run(scenario):
    if scenario not in _cache:
        out = os.path.join(tempfile.mkdtemp(prefix="wolves_test_"), "out.json")
        r = subprocess.run([sys.executable, FAKE, scenario, out], capture_output=True, text=True, encoding="utf-8",
                           env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONWARNINGS": "ignore"})
        if r.returncode != 0 or not os.path.exists(out):
            raise AssertionError(f"{scenario} 執行失敗：{r.stderr[-2000:]}")
        with open(out, encoding="utf-8") as f:
            _cache[scenario] = json.load(f)
    return _cache[scenario]


def side(d, label):
    return [s for s in d["side"] if s[0] == label]


TEAM_CATS = [c for c, _ in nc.TEAM_SNAPSHOT_CATEGORIES]
PLAYER_CATS = [c for c, _ in nc.PLAYER_SNAPSHOT_CATEGORIES]


class DailyFlow(unittest.TestCase):
    def test_writes_team_and_player_snapshots(self):
        d = run("daily")
        self.assertIsNone(d["exit"])
        self.assertEqual([(c, i) for c, i, _ in d["writes"]], [("wolves_team_stats", "2026-11-19"), ("wolves_player_stats", "2026-11-19")])
        team, player = d["writes"][0][2], d["writes"][1][2]
        for cat in TEAM_CATS:
            self.assertIn(cat, team)
            self.assertIn(cat, team["ranks"], f"全隊 {cat} 沒有聯盟名次")
        self.assertIn("lineups", team)
        for cat in PLAYER_CATS:
            self.assertIn(cat, player)
        # 名冊（2026-27）＝101、103、201 → 只留這三人，以數據 API 的名字為 key
        self.assertEqual(sorted(player["base"]), ["Alpha One", "Gamma Three", "Other Guy"])
        self.assertEqual(sorted(player["onoff"]), ["Alpha One", "Gamma Three", "Other Guy"])
        self.assertIn("_meta", player["ranks"])

    def test_every_snapshot_field_is_deduped(self):
        """新增快照類別一定要加進 DATA_KEYS，否則去重不會比它（CLAUDE.md 硬性約束）"""
        import fetch_data
        d = run("daily")
        keys = set(d["writes"][0][2]) | set(d["writes"][1][2])
        missing = keys - set(fetch_data.DATA_KEYS) - {"date", "type", "seasonType", "timestamp"}
        self.assertEqual(missing, set())

    def test_requests_and_league_wide_team_calls(self):
        d = run("daily")
        names = Counter(c[0] for c in d["calls"])
        self.assertEqual(len(d["calls"]), 26)
        self.assertEqual(names["fetch_lineup_rows"], len(nc.LINEUP_GROUPS))
        team_calls = [c for c in d["calls"] if "'Team'" in c[1] or c[0] in ("fetch_team_advanced", "fetch_opp_shot_locations", "fetch_team_matchup_defense")]
        self.assertTrue(team_calls)
        for c in team_calls:   # 全隊一律 team_id=0 拿 30 隊（算名次，請求數不變）
            self.assertIn("('team_id', 0)", c[1], c)

    def test_side_effects(self):
        d = run("daily")
        self.assertEqual([s[0] for s in d["side"]], ["write_lineups", "capture_recent_games", "build_preview.build", "write_status"])
        self.assertEqual(side(d, "capture_recent_games")[0][1][1], "Regular+Season")
        self.assertEqual(side(d, "write_status")[0][1][:2], ["full", True])


class OtherModes(unittest.TestCase):
    def test_games_only(self):
        d = run("games_only")
        self.assertEqual(d["writes"], [])
        self.assertEqual([c[0] for c in d["calls"]], ["fetch_roster_with_ids"])
        self.assertEqual(side(d, "write_status")[0][1][:2], ["games", True])

    def test_force_snapshot(self):
        d = run("force")
        self.assertEqual([i for _, i, _ in d["writes"]], ["2026-06-01", "2026-06-01"])
        self.assertEqual(d["writes"][0][2]["seasonType"], "季後賽")
        self.assertEqual(side(d, "capture_recent_games"), [])   # 補期末快照不擷取單場
        self.assertEqual(side(d, "write_status"), [])

    def test_playin_main_run(self):
        d = run("playin_main")
        self.assertEqual(d["writes"], [], "附加賽期間不可寫累積快照")
        self.assertEqual(side(d, "capture_recent_games")[0][1][1], "PlayIn")
        self.assertEqual(len(side(d, "build_preview.build")), 1)
        base_calls = [c for c in d["calls"] if c[0] == "fetch_base_box"]
        self.assertTrue(base_calls and all("Regular+Season" in c[1] for c in base_calls), "預覽要用例行賽數據")
        self.assertEqual(side(d, "write_status")[0][1][:2], ["full", True])

    def test_pending_playin_captured_after_playoffs_start(self):
        d = run("pending")
        self.assertEqual([s[1][1] for s in side(d, "capture_recent_games")], ["Playoffs", "PlayIn"])


class HistoryFlow(unittest.TestCase):
    def test_history_snapshot(self):
        d = run("hist_regular")
        self.assertEqual([(c, i) for c, i, _ in d["writes"]],
                         [("wolves_team_history", "2024-25_regular"), ("wolves_player_history", "2024-25_regular")])
        team, player = d["writes"][0][2], d["writes"][1][2]
        for cat in TEAM_CATS:
            self.assertIn(cat, team)
        self.assertNotIn("ranks", team)
        stats = player["stats"]
        self.assertEqual(sorted(stats), ["101", "102", "103", "201"])    # 該季名冊 ∪ 現役（含新援 201），PlayerID 為 key
        self.assertTrue(stats["201"]["isNewcomer"])
        self.assertEqual(stats["201"]["teamAbbr"], "ATL")                # 新援以生涯分隊修正
        self.assertFalse(stats["102"]["isCurrentRoster"])
        for cat in PLAYER_CATS:
            self.assertIn(cat, stats["101"])

    def test_local_output_goes_to_temp_not_project(self):
        real = os.path.join(ROOT, "_local", "backfill", "backfill_2024-25_playoffs.json")
        before = os.path.getmtime(real) if os.path.exists(real) else None
        d = run("hist_playoffs")
        self.assertIn(os.path.join("backfill", "backfill_2024-25_playoffs.json"), d["local_files"])
        after = os.path.getmtime(real) if os.path.exists(real) else None
        self.assertEqual(before, after, "測試寫到專案的 _local/ 了")


if __name__ == "__main__":
    unittest.main()
