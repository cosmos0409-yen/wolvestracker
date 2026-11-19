# -*- coding: utf-8 -*-
"""前後端成對規則（CLAUDE.md 寫「兩邊一起改」的地方）：同一份輸入，Python 與前端打包檔（Node 沙盒）要給出一致結果。
任一邊改了界線或門檻、另一邊忘了改，這裡會失敗。需要 Node 與 dist/components-bundle.js（先 python scripts/bundle.py）"""
import json
import unittest
from datetime import datetime, timezone

from _common import NODE, eval_js
import nba_common as nc

INSTANTS = ["2026-10-20T03:30:00Z", "2026-10-20T04:30:00Z", "2026-10-20T05:30:00Z",   # 資料賽季界線（EDT 前後一小時）
            "2026-07-01T03:30:00Z", "2026-07-01T04:30:00Z",                           # 名冊賽季界線
            "2027-03-14T06:30:00Z", "2027-03-14T07:30:00Z",                           # 夏令開始
            "2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z",                           # 夏令結束
            "2027-01-01T04:59:00Z", "2027-01-01T05:00:00Z"]                           # 冬令跨年


@unittest.skipIf(not NODE, "沒有 Node.js")
class FrontBackContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.js = eval_js("""
            const pad = (n) => String(n).padStart(2, '0');
            const inst = %s;
            const zero = %s;
            return {
              dates: inst.map(s => { const d = new Date(s), p = w.etParts(d);
                return { season: w.seasonForDate(d), roster: w.capSeasonForDate(d), today: `${p.y}-${pad(p.m)}-${pad(p.d)}` }; }),
              typeLabels: w.SEASON_TYPE_LABEL,
              typeOfPrefix: { '002': w.gameTypeOfId('0022600001'), '004': w.gameTypeOfId('0042600101'), '005': w.gameTypeOfId('0052600111') },
              historyRules: w.HISTORY_RULES,
              zeroBlanked: zero.map(s => { const c = w.cleanGameStats(s);
                return Object.keys(s).filter(k => /^(CATCH_SHOOT_|PULL_UP_)/.test(k)).some(k => c[k] === null); }),
            };
        """ % (json.dumps(INSTANTS), json.dumps(ZERO_CASES)))

    def test_season_boundaries_and_east_date(self):
        orig = nc.now_east
        try:
            for iso, js in zip(INSTANTS, self.js["dates"]):
                utc = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)
                nc.now_east = lambda utc_=None, _u=utc: orig(_u)
                py = {"season": nc.get_current_season(), "roster": nc.get_roster_season(), "today": nc.get_today_str()}
                self.assertEqual(py, js, f"{iso}：Python {py} vs 前端 {js}")
        finally:
            nc.now_east = orig

    def test_season_type_labels_and_game_id_prefixes(self):
        self.assertEqual({k: lab for k, (_api, lab) in nc.SEASON_TYPES.items()}, self.js["typeLabels"])
        self.assertEqual(self.js["typeOfPrefix"], {"002": "regular", "004": "playoffs", "005": "playin"})

    def test_history_mark_thresholds_same(self):
        """單場頁「灰狼第 N 高」：後端 INSIGHT_MARK_RULES 與前端 HISTORY_RULES 的門檻必須同值"""
        h = self.js["historyRules"]
        self.assertEqual(nc.INSIGHT_MARK_RULES["min_att"], h["minAtt"])
        self.assertEqual(nc.INSIGHT_MARK_RULES["min_n"], h["minN"])

    def test_tracking_zero_fill_same_rule(self):
        """NBA 未釋出的 Tracking「整組 0」：後端標 partial（tracking_zero_filled）⇔ 前端清成「—」（cleanGameStats）"""
        for s, js_blank in zip(ZERO_CASES, self.js["zeroBlanked"]):
            self.assertEqual(nc.tracking_zero_filled(s), js_blank, s)


ZERO_CASES = [
    {"CATCH_SHOOT_FGA": 0, "CATCH_SHOOT_FGM": 0, "PULL_UP_FGA": 5, "PULL_UP_FGM": 2},                    # 缺 TOUCHES＋C&S 全 0 → 是
    {"TOUCHES": 400, "CATCH_SHOOT_FGA": 0, "CATCH_SHOOT_FGM": 0},                                     # 有 TOUCHES → 不是
    {"CATCH_SHOOT_FGA": 3, "CATCH_SHOOT_FGM": 0, "PULL_UP_FGA": 0, "PULL_UP_FGM": 0},                 # Pull Up 全 0 → 是
    {"CATCH_SHOOT_FGA": 3, "CATCH_SHOOT_FGM": 1, "PULL_UP_FGA": 4, "PULL_UP_FGM": 2},                 # 都有值 → 不是
    {"PTS": 0},                                                                                       # 沒有這兩組欄位 → 不是
]

if __name__ == "__main__":
    unittest.main()
