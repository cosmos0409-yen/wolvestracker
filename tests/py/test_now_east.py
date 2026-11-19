# -*- coding: utf-8 -*-
"""美東時間 nba_common.now_east()：zoneinfo 與手寫夏令後備規則一致、夏令切換時刻正確、賽季界線"""
import unittest
from datetime import datetime, timedelta, timezone

import _common  # noqa: F401
import nba_common as nc

U = lambda *a: datetime(*a, tzinfo=timezone.utc)  # noqa: E731


class NowEast(unittest.TestCase):
    def test_zoneinfo_available(self):
        self.assertIsNotNone(nc._ET_ZONE, "tzdata 沒裝：requirements.txt 有列，排程用的 Python312 要裝")

    def test_fallback_matches_zoneinfo_2024_2030(self):
        t, bad = U(2024, 1, 1), []
        while t < U(2031, 1, 1):
            u = t.replace(tzinfo=None)
            if nc.now_east(t) != u + timedelta(hours=nc._us_eastern_offset_hours(u)):
                bad.append(t.isoformat())
            t += timedelta(hours=1)
        self.assertEqual(bad, [])

    def test_dst_transitions(self):
        cases = [(U(2026, 3, 8, 6, 59), "2026-03-08 01:59"), (U(2026, 3, 8, 7, 0), "2026-03-08 03:00"),
                 (U(2026, 11, 1, 5, 59), "2026-11-01 01:59"), (U(2026, 11, 1, 6, 0), "2026-11-01 01:00"),
                 (U(2026, 7, 1, 3, 30), "2026-06-30 23:30")]
        for utc, want in cases:
            self.assertEqual(nc.now_east(utc).strftime("%Y-%m-%d %H:%M"), want, utc)

    def test_season_boundaries_follow_east_date(self):
        orig = nc.now_east
        try:
            for utc, season, roster, today in [
                (U(2026, 10, 20, 3, 30), "2025-26", "2026-27", "2026-10-19"),   # 美東 10/19 23:30（EDT）
                (U(2026, 10, 20, 4, 30), "2026-27", "2026-27", "2026-10-20"),   # 美東 10/20 00:30
                (U(2026, 7, 1, 3, 30), "2025-26", "2025-26", "2026-06-30"),     # 名冊賽季 7/1 才切
                (U(2026, 7, 1, 4, 30), "2025-26", "2026-27", "2026-07-01"),
            ]:
                nc.now_east = lambda utc=None, _u=utc: orig(_u)
                self.assertEqual((nc.get_current_season(), nc.get_roster_season(), nc.get_today_str()), (season, roster, today), utc)
        finally:
            nc.now_east = orig


if __name__ == "__main__":
    unittest.main()
