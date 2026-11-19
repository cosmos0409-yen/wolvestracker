# -*- coding: utf-8 -*-
"""賽別判斷（nba_common.season_type_from_schedule／pending_playin／get_season_type 後備規則），用合成的 2026-27 賽程"""
import contextlib
import io
import unittest
from datetime import date, timedelta

import _common  # noqa: F401
import nba_common as nc


def g(gid, d, status=1, hs=None, vs=None, home=1, away=2):
    return {"id": gid, "date": d, "status": status, "home": {"id": home, "score": hs}, "away": {"id": away, "score": vs}}


def days(a, b):
    x = date.fromisoformat(a)
    while x <= date.fromisoformat(b):
        yield x.isoformat()
        x += timedelta(days=1)


W = nc.TEAM_ID
REG = [g(f"00226{i:05d}", d, 3, 100, 90) for i, d in enumerate(days("2026-10-21", "2027-04-11"))]
CUP = [g("0062600001", "2026-12-15", 3, 110, 100)]
PLAYIN_OTHERS = [g("0052600121", "2027-04-15", 3, 100, 90, home=1, away=2)]
R1 = [g(f"004260010{i}", d, 3, 100, 90) for i, d in enumerate(days("2027-04-18", "2027-05-01"), 1)]
FINALS_DONE = [g("0042600401", "2027-06-03", 3, 100, 90), g("0042600402", "2027-06-05", 3, 90, 100),
               g("0042600403", "2027-06-08", 3, 100, 95), g("0042600404", "2027-06-10", 3, 100, 95),
               g("0042600405", "2027-06-12", 3, 101, 99), g("0042600406", "2027-06-15", 1)]
PI_1 = [g("0052600111", "2027-04-15", 3, 100, 110, home=W, away=1610612744)]
PI_2 = PI_1 + [g("0052600201", "2027-04-17", 3, 105, 99, home=1610612742, away=W)]


def label(sched, today, season="2026-27"):
    r = nc.season_type_from_schedule(sched, today, season)
    return None if r is None else r[0][1]


class SeasonTypeFromSchedule(unittest.TestCase):
    def test_regular_window_and_grace(self):
        s = REG + CUP
        self.assertIsNone(label(s, "2026-10-20"))            # 開季前一天
        self.assertEqual(label(s, "2026-10-21"), "例行賽")
        self.assertEqual(label(s, "2026-12-15"), "例行賽")   # 盃賽冠軍戰（006）不影響
        self.assertEqual(label(s, "2027-04-12"), "例行賽")   # 最後一場隔天（寬限，抓定稿快照）
        self.assertIsNone(label(s, "2027-04-13"))

    def test_playoffs_until_finals_clinched(self):
        s = REG + CUP + R1 + FINALS_DONE
        self.assertEqual(label(s, "2027-04-18"), "季後賽")
        self.assertEqual(label(s, "2027-05-04"), "季後賽")   # 輪與輪之間、下一輪還沒排
        self.assertEqual(label(s, "2027-06-13"), "季後賽")   # 封王隔天（寬限）
        self.assertIsNone(label(s, "2027-06-14"))

    def test_finals_not_clinched_is_still_playoffs(self):
        s = REG + R1 + FINALS_DONE[:3] + [g("0042600404", "2027-06-10", 1)]
        self.assertEqual(label(s, "2027-06-20"), "季後賽")

    def test_playin_only_when_wolves_in_it(self):
        self.assertIsNone(label(REG + PLAYIN_OTHERS, "2027-04-15"))                            # 灰狼沒打
        self.assertIsNone(label(REG + [g("0052600111", "2027-04-15", 1, home=0, away=0)], "2027-04-15"))   # 對手未定
        s1 = REG + PI_1 + PLAYIN_OTHERS
        self.assertIsNone(label(s1, "2027-04-14"))
        self.assertEqual(label(s1, "2027-04-15"), "附加賽")
        self.assertEqual(label(s1, "2027-04-16"), "附加賽")   # 隔天寬限（定稿）
        self.assertIsNone(label(s1, "2027-04-17"))            # 第二場還沒排出
        s2 = REG + PI_2 + R1
        self.assertEqual(label(s2, "2027-04-17"), "附加賽")
        self.assertEqual(label(s2, "2027-04-18"), "季後賽")   # 季後賽首日優先

    def test_pending_playin(self):
        s2 = REG + PI_2 + R1
        self.assertTrue(nc.pending_playin(s2, "2027-04-18"))   # 季後賽首日仍要補定稿 4/17 附加賽
        self.assertFalse(nc.pending_playin(s2, "2027-04-19"))
        self.assertFalse(nc.pending_playin(REG + PLAYIN_OTHERS, "2027-04-16"))
        self.assertFalse(nc.pending_playin([], "2027-04-16"))

    def test_schedule_of_other_season_or_empty(self):
        nxt = [g(f"00227{i:05d}", d) for i, d in enumerate(days("2027-10-20", "2027-10-30"))]
        self.assertIsNone(label(nxt, "2027-09-01"))   # 賽程檔已換成下一季 → 休賽期
        self.assertIsNone(nc.season_type_from_schedule([], "2026-11-19", "2026-27"))   # 判斷不了 → None（退回日期規則）

    def test_date_fallback_when_schedule_missing(self):
        orig = nc.fetch_league_schedule
        nc.fetch_league_schedule = lambda retries=3: None
        try:
            with contextlib.redirect_stdout(io.StringIO()):   # get_season_type 會印判斷結果
                got = [nc.get_season_type(today=d) for d in ("2026-11-19", "2027-04-17", "2027-07-01")]
            self.assertEqual(got, [("Regular+Season", "例行賽"), ("Playoffs", "季後賽"), (None, None)])
        finally:
            nc.fetch_league_schedule = orig


class SeasonTypeKeys(unittest.TestCase):
    def test_round_trip(self):
        for key, (api, _label) in nc.SEASON_TYPES.items():
            self.assertEqual(nc.type_key_of(api), key)
        self.assertEqual(set(nc.SNAPSHOT_TYPE_KEYS), {"regular", "playoffs"})


if __name__ == "__main__":
    unittest.main()
