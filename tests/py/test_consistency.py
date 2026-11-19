# -*- coding: utf-8 -*-
"""逐場對帳 consistency_issues：只把「逐場比快照少」當異常、逐場多的只記 info.over、樣本不足不比"""
import unittest

import _common  # noqa: F401
import nba_common as nc

KEY = "PTS"   # base 欄位、非百分比、不在 CONSISTENCY_SKIP
assert ("base", KEY) in nc.consistency_fields()


def games(vals, extra_dates=0):
    gs = [{"date": f"2026-11-{i + 1:02d}", "stats": {KEY: v}} for i, v in enumerate(vals)]
    gs += [{"date": f"2026-12-{i + 1:02d}", "stats": {KEY: 999}} for i in range(extra_dates)]   # 快照還沒算進去的新場次
    return gs


def snap(per_game, n):
    return {"base": {"GP": n, KEY: per_game}}


class Consistency(unittest.TestCase):
    def test_match_no_issue(self):
        issues, info = nc.consistency_issues(snap(110, 6), games([110] * 6))
        self.assertEqual(issues, [])
        self.assertEqual(info["reason"], "")

    def test_undercount_is_issue_with_suspect(self):
        issues, _ = nc.consistency_issues(snap(110, 6), games([110, 110, 110, 40, 110, 110]))
        it = next(i for i in issues if i["key"] == KEY)
        self.assertLess(it["pct"], 0)
        self.assertEqual([d for d, _ in it["suspects"]], ["2026-11-04"])

    def test_overcount_only_info(self):
        issues, info = nc.consistency_issues(snap(110, 6), games([110] * 5 + [150]))
        self.assertEqual([i for i in issues if i["key"] == KEY], [])
        self.assertTrue(any(o["key"] == KEY for o in info["over"]))

    def test_only_games_covered_by_snapshot(self):
        issues, _ = nc.consistency_issues(snap(110, 6), games([110] * 6, extra_dates=2))
        self.assertEqual(issues, [])

    def test_too_few_or_missing_games(self):
        _, info = nc.consistency_issues(snap(110, nc.CONSISTENCY_RULES["min_games"] - 1), games([110] * 3))
        self.assertIn("少於", info["reason"])
        _, info = nc.consistency_issues(snap(110, 8), games([110] * 6))
        self.assertIn("bundle", info["reason"])


if __name__ == "__main__":
    unittest.main()
