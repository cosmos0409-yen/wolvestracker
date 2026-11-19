# -*- coding: utf-8 -*-
"""聯盟名次：全隊 league_ranks／split_league、球員 player_league_ranks（合格門檻、出手門檻、方向、並列）"""
import unittest

import _common  # noqa: F401
import nba_common as nc


class LeagueRanks(unittest.TestCase):
    def test_direction_ties_skip_and_n(self):
        lower = next(f for f in sorted(nc.RANK_LOWER_BETTER) if not f.startswith("*"))
        skip = next(f for f in sorted(nc.RANK_SKIP) if not f.startswith("*"))
        teams = {
            "MIN": {"PTS": 110, lower: 10, skip: 5, "NAME": "x"},
            "1": {"PTS": 120, lower: 12, skip: 1},
            "2": {"PTS": 110, lower: 8, skip: 9},
            "3": {"PTS": 100, lower: 10},
        }
        mine, r = nc.split_league(teams)
        self.assertIs(mine, teams["MIN"])
        self.assertEqual(r["_n"], 4)
        self.assertEqual(r["PTS"], 2)          # 120 比較高 → 第 2；與另一隊 110 並列取最小名次
        self.assertEqual(r[lower], 2)          # 越低越好：8 比較低 → 第 2（與 10 並列）
        self.assertNotIn(skip, r)              # RANK_SKIP 不排
        self.assertNotIn("NAME", r)            # 非數值不排

    def test_no_wolves_data(self):
        self.assertEqual(nc.league_ranks({"1": {"PTS": 1}}), {})


class PlayerLeagueRanks(unittest.TestCase):
    def setUp(self):
        # 球隊各打 10 場；灰狼 101 合格、102 出賽不足（6 場 < 70%）、103 上場不足（12 分 < 15）
        self.base = {
            "101": {"playerName": "Alpha One", "GP": 10, "MIN": 30, "PTS": 20, "FG_PCT": 50.0, "FGA": 10, "TOV": 2},
            "102": {"playerName": "Beta Two", "GP": 6, "MIN": 30, "PTS": 25, "FG_PCT": 60.0, "FGA": 12, "TOV": 1},
            "103": {"playerName": "Gamma Three", "GP": 10, "MIN": 12, "PTS": 5, "FG_PCT": 70.0, "FGA": 3, "TOV": 3},
            "201": {"playerName": "Other A", "GP": 10, "MIN": 35, "PTS": 30, "FG_PCT": 45.0, "FGA": 20, "TOV": 4},
            "202": {"playerName": "Other B", "GP": 9, "MIN": 25, "PTS": 20, "FG_PCT": 55.0, "FGA": 4, "TOV": 2},
        }
        self.team_of = {"101": nc.TEAM_ID, "102": nc.TEAM_ID, "103": nc.TEAM_ID, "201": 1, "202": 2}
        self.team_gp = {str(nc.TEAM_ID): 10, "1": 10, "2": 10}
        self.out = nc.player_league_ranks({}, self.base, self.team_of, self.team_gp, {"101", "102", "103"})

    def test_qualification(self):
        meta = self.out["_meta"]
        self.assertTrue(meta["Alpha One"]["qualified"])
        self.assertFalse(meta["Beta Two"]["qualified"])      # 出賽 < 70%
        self.assertFalse(meta["Gamma Three"]["qualified"])   # 每場 < 15 分鐘
        self.assertEqual(self.out["_rules"]["n_qualified"], 3)   # 101、201、202

    def test_ranks_among_qualified(self):
        r = self.out["base"]["Alpha One"]
        self.assertEqual(r["PTS"], 2)        # 30、20、20 → 並列第 2
        self.assertEqual(r["TOV"], 1)        # 失誤越少越好：2、4、2 → 並列第 1
        # 命中率出手門檻 FGA ≥ 5：202 只有 4 次不列入母體 → 50.0 vs 45.0 → 第 1
        self.assertEqual(r["FG_PCT"], 1)
        self.assertEqual(self.out["_n"]["base"]["FG_PCT"], 2)

    def test_unqualified_get_reference_rank_only(self):
        self.assertNotIn("Beta Two", self.out.get("base", {}))
        self.assertEqual(self.out["_ref"]["base"]["Beta Two"]["PTS"], 2)   # 若列入：25 → 第 2（30 之後）
        # 103 出手 3 次沒過命中率門檻 → 連參考名次都沒有
        self.assertNotIn("FG_PCT", self.out["_ref"]["base"].get("Gamma Three", {}))


if __name__ == "__main__":
    unittest.main()
