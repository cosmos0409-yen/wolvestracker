# -*- coding: utf-8 -*-
"""逐場 bundle 的 adv 欄位（nba_common.box_team_adv／box_player_adv、build_bundles 的組裝）：0 request，用假 box"""
import unittest

import _common  # noqa: F401  （把 scripts/ 加進 import 路徑）
import nba_common as nc
import build_bundles as bb


def make_box(adv=True, onoff=True, oreb_pct=40.0, off_pace=None):
    mine = {"PTS": 120, "FGM": 44, "FTM": 20, "FGA": 90, "FTA": 25, "OREB": 12, "DREB": 33, "AST": 28,
            "STL": 8, "BLK": 5, "PF": 18, "TOV": 13, "MIN": "240:00"}
    opp = {"PTS": 110, "FGM": 40, "FTM": 15, "FGA": 88, "FTA": 20, "OREB": 10, "DREB": 30, "AST": 24,
           "STL": 7, "BLK": 4, "PF": 20, "TOV": 15, "MIN": "240:00"}
    if adv:
        mine.update({"POSS": 100.0, "PACE": 100.5, "OREB_PCT": oreb_pct, "DREB_PCT": 75.0})
        opp.update({"POSS": 101.0, "PACE": 100.5})
    p1 = {"PTS": 30, "FGM": 11, "FGA": 20, "MIN": "36:00"}
    if adv:
        p1.update({"POSS": 75.0, "USG_PCT": 30.0, "AST_PCT": 25.0, "OREB_PCT": 2.0, "DREB_PCT": 12.0, "REB_PCT": 7.0, "PIE": 18.0, "PACE": 101.5})
        if onoff:
            p1.update({"OFF_OFF_RATING": 105.0, "OFF_DEF_RATING": 110.0, "OFF_MIN": 12.0})
            if off_pace is not None:
                p1["OFF_PACE"] = off_pace
    return {"teams": [{"tricode": "MIN", "totals": mine}, {"tricode": "DEN", "totals": opp}],
            "players": [{"personId": 1, "tricode": "MIN", "stats": p1},
                        {"personId": 2, "tricode": "MIN", "stats": {}},                       # DNP
                        {"personId": 9, "tricode": "DEN", "stats": dict(p1)}]}               # 對手不算


class TeamAdv(unittest.TestCase):
    def test_full(self):
        a = nc.box_team_adv(make_box())
        self.assertEqual(a["POSS"], 100.0)
        self.assertEqual(a["OPP_POSS"], 101.0)
        self.assertEqual(a["PACE"], 100.5)
        self.assertEqual(a["GMIN"], 240.0)
        self.assertAlmostEqual(a["OREB_CH"], 12 * 100 / 40.0)    # 由官方比率反推
        self.assertAlmostEqual(a["DREB_CH"], 33 * 100 / 75.0)
        self.assertTrue(set(a) <= set(nc.BUNDLE_TEAM_ADV_KEYS))

    def test_no_advanced_box(self):
        self.assertEqual(nc.box_team_adv(make_box(adv=False)), {})
        self.assertEqual(nc.box_team_adv(None), {})
        self.assertEqual(nc.box_team_adv({"teams": []}), {})

    def test_zero_pct_falls_back_to_plain_sum(self):
        a = nc.box_team_adv(make_box(oreb_pct=0))
        self.assertEqual(a["OREB_CH"], 12 + 30)                 # 己方進攻籃板＋對手防守籃板


class PlayerAdv(unittest.TestCase):
    def test_full(self):
        a = nc.box_player_adv(make_box())
        self.assertEqual(set(a), {"1"})                         # 只有灰狼有上場的人
        r = a["1"]
        self.assertEqual(r["USG_PCT"], 30.0)
        self.assertEqual(r["POSS"], 75.0)
        pie_w = nc._pie_part(make_box()["teams"][0]["totals"]) + nc._pie_part(make_box()["teams"][1]["totals"])
        self.assertAlmostEqual(r["PIE_W"], pie_w)
        self.assertAlmostEqual(r["OFF_W"], 100.0 * 12.0 / 48.0)  # 舊資料（沒有不在場節奏）：全隊回合 × 不在場分鐘 ÷ (240/5)
        self.assertEqual(r["PACE"], 101.5)
        self.assertEqual(r["OFF_MIN"], 12.0)
        self.assertNotIn("OFF_PACE", r)
        self.assertTrue(set(r) <= set(nc.BUNDLE_PLAYER_ADV_KEYS))

    def test_off_pace_used_for_off_possessions(self):
        r = nc.box_player_adv(make_box(off_pace=96.0))["1"]
        self.assertEqual(r["OFF_PACE"], 96.0)
        self.assertAlmostEqual(r["OFF_W"], 96.0 * 12.0 / 48.0)  # 有不在場節奏：節奏 × 不在場分鐘 ÷ 48
        self.assertTrue(set(r) <= set(nc.BUNDLE_PLAYER_ADV_KEYS))

    def test_without_single_game_onoff(self):
        r = nc.box_player_adv(make_box(onoff=False))["1"]
        self.assertNotIn("OFF_W", r)
        self.assertNotIn("OFF_OFF_RATING", r)

    def test_no_advanced_box(self):
        self.assertEqual(nc.box_player_adv(make_box(adv=False)), {})

    def test_box_minutes(self):
        self.assertEqual(nc._box_minutes("265:00"), 265.0)
        self.assertEqual(nc._box_minutes("38:30"), 38.5)
        self.assertEqual(nc._box_minutes(""), 0.0)
        self.assertEqual(nc._box_minutes(None), 0.0)


class Entries(unittest.TestCase):
    def test_entries_only_carry_adv_when_present(self):
        self.assertNotIn("adv", bb._team_entry("2026-11-01", "MIN vs. DEN", "W", {"PTS": 1}, adv={}))
        self.assertEqual(bb._team_entry("2026-11-01", "m", "W", {}, adv={"POSS": 1})["adv"], {"POSS": 1})
        e = bb._player_entry("2026-11-01", "m", "W", {"PTS": 30}, {"ON_POSS": 70}, {"USG_PCT": 30})
        self.assertEqual(e["stats"], {"PTS": 30, "ON_POSS": 70})   # adv 不混進 stats
        self.assertEqual(e["adv"], {"USG_PCT": 30})
        self.assertNotIn("adv", bb._player_entry("d", "m", "W", {}, None, None))


if __name__ == "__main__":
    unittest.main()
