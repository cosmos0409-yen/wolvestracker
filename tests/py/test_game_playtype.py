# -*- coding: utf-8 -*-
"""單場 Playtype：每日快照相減還原（split_game_playtypes）與寫入單場文件（write_game_playtypes，假 Firestore，0 request）"""
import unittest

import _common  # noqa: F401
import nba_common as nc


def snap(gp, rows):
    """rows：{(side, type): (poss, pts, fgm, fga)}"""
    return [{"side": side, "playType": t, "gp": gp, "possTotal": p, "ptsTotal": pts, "fgmTotal": m, "fgaTotal": a}
            for (side, t), (p, pts, m, a) in rows.items()]


ISO, SPOT, D_ISO = ("offensive", "Isolation"), ("offensive", "Spotup"), ("defensive", "Isolation")
DATES = ["2026-10-21", "2026-10-23", "2026-10-25", "2026-10-26", "2026-10-28"]
SNAPS = [
    ("2026-10-22", snap(1, {ISO: (10, 12, 5, 9), SPOT: (20, 22, 8, 19), D_ISO: (8, 6, 3, 7)})),     # 第 1 場（0 基底）
    ("2026-10-24", snap(2, {ISO: (18, 20, 8, 16), SPOT: (41, 50, 18, 38), D_ISO: (15, 14, 6, 13)})),  # 第 2 場
    ("2026-10-25", snap(2, {ISO: (19, 22, 9, 17), SPOT: (41, 50, 18, 38), D_ISO: (15, 14, 6, 13)})),  # 同 GP，NBA 修正
    ("2026-10-27", snap(4, {ISO: (30, 33, 13, 26), SPOT: (80, 90, 33, 75), D_ISO: (30, 29, 12, 27)})), # 一次多兩場 → 3、4 拆不開
]


class SplitGamePlaytypes(unittest.TestCase):
    def setUp(self):
        self.r = nc.split_game_playtypes(SNAPS, DATES)

    def test_first_game_uses_zero_base(self):
        g1 = self.r["2026-10-21"]
        self.assertTrue(g1["ok"])
        self.assertEqual((g1["n"], g1["preGP"], g1["snaps"]), (1, 0, [None, "2026-10-22"]))
        self.assertEqual(g1["off"][0], {"t": "Spotup", "poss": 20, "pts": 22, "fgm": 8, "fga": 19, "prePoss": 0, "prePts": 0})

    def test_normal_game_and_sort_by_poss(self):
        g2 = self.r["2026-10-23"]
        self.assertEqual(g2["snaps"], ["2026-10-22", "2026-10-24"])
        self.assertEqual([x["t"] for x in g2["off"]], ["Spotup", "Isolation"])   # 依本場回合數排序
        self.assertEqual(g2["off"][0], {"t": "Spotup", "poss": 21, "pts": 28, "fgm": 10, "fga": 19, "prePoss": 20, "prePts": 22})
        self.assertEqual(g2["def"], [{"t": "Isolation", "poss": 7, "pts": 8, "fgm": 3, "fga": 6, "prePoss": 8, "prePts": 6}])

    def test_merged_games_not_split(self):
        self.assertEqual(self.r["2026-10-25"], {"ok": False})
        self.assertEqual(self.r["2026-10-26"], {"ok": False})

    def test_pending_game_not_output(self):
        self.assertNotIn("2026-10-28", self.r)

    def test_before_is_latest_same_gp_snapshot(self):
        # 第 3 場若可拆，賽前要用同 GP 的最後一份（含修正）；這裡改成 gp 3 的賽後快照驗證
        snaps = SNAPS[:3] + [("2026-10-26", snap(3, {ISO: (25, 25, 10, 20), SPOT: (50, 60, 22, 47), D_ISO: (20, 18, 8, 17)}))]
        g3 = nc.split_game_playtypes(snaps, DATES)["2026-10-25"]
        self.assertEqual(g3["snaps"], ["2026-10-25", "2026-10-26"])
        iso = next(x for x in g3["off"] if x["t"] == "Isolation")
        self.assertEqual((iso["poss"], iso["pts"], iso["prePoss"]), (6, 3, 19))

    def test_negative_revision_kept(self):
        snaps = SNAPS[:2] + [("2026-10-26", snap(3, {ISO: (17, 19, 8, 16), SPOT: (50, 60, 22, 47), D_ISO: (20, 18, 8, 17)}))]
        iso = next(x for x in nc.split_game_playtypes(snaps, DATES)["2026-10-25"]["off"] if x["t"] == "Isolation")
        self.assertEqual((iso["poss"], iso["pts"]), (-1, -1))

    def test_old_snapshots_without_totals_ignored(self):
        old = [("2026-10-22", [{"side": "offensive", "playType": "Isolation", "gp": 1, "poss": 10.0, "ppp": 1.2}])]
        self.assertEqual(nc.split_game_playtypes(old, DATES), {})
        self.assertEqual(nc.split_game_playtypes([], DATES), {})


# ── 假 Firestore（只支援 write_game_playtypes 用到的操作）──
class _Snap:
    def __init__(self, doc_id, data): self.id, self._d = doc_id, data
    @property
    def exists(self): return self._d is not None
    def to_dict(self): return None if self._d is None else dict(self._d)


class _Ref:
    def __init__(self, store, c, d): self.store, self.c, self.d = store, c, d
    def get(self, field_paths=None): return _Snap(self.d, self.store.get(self.c, {}).get(self.d))
    def update(self, data):
        self.store[self.c][self.d].update(data)
        self.store.setdefault("_updates", []).append(self.d)


class _Query:
    def __init__(self, store, c): self.store, self.c = store, c
    def where(self, filter=None): return self
    def select(self, fields): return self
    def stream(self): return [_Snap(k, v) for k, v in sorted(self.store.get(self.c, {}).items())]


class _Coll(_Query):
    def document(self, d): return _Ref(self.store, self.c, d)


class _DB:
    def __init__(self, store): self.store = store
    def collection(self, c): return _Coll(self.store, c)


class WriteGamePlaytypes(unittest.TestCase):
    def make(self):
        return {
            "wolves_games_index": {"2026-27_regular": {"games": [{"date": d} for d in DATES]}},
            "wolves_team_stats": {d: {"stats": st, "seasonType": "例行賽"} for d, st in SNAPS}
                                 | {"2026-10-20": {"stats": snap(9, {ISO: (1, 1, 1, 1)}), "seasonType": "季後賽"}},   # 別的賽別不算
            "wolves_team_games": {d: {"date": d} for d in DATES if d != "2026-10-26"},   # 10-26 沒有單場文件
        }

    def test_writes_once_then_idempotent(self):
        store = self.make()
        db = _DB(store)
        s1 = nc.write_game_playtypes(db, "2026-27", "regular")
        self.assertEqual((s1["ok"], s1["na"], s1["written"], s1["noDoc"]), (2, 2, 3, 1))
        self.assertTrue(store["wolves_team_games"]["2026-10-23"]["playtype"]["ok"])
        self.assertEqual(store["wolves_team_games"]["2026-10-25"]["playtype"], {"ok": False})
        self.assertNotIn("playtype", store["wolves_team_games"]["2026-10-28"])   # 還沒有賽後快照
        n = len(store["_updates"])
        s2 = nc.write_game_playtypes(db, "2026-27", "regular")
        self.assertEqual((s2["written"], s2["same"]), (0, 3))
        self.assertEqual(len(store["_updates"]), n)                                # 第二次不寫

    def test_dry_run_and_playin_do_not_write(self):
        store = self.make()
        s = nc.write_game_playtypes(_DB(store), "2026-27", "regular", dry_run=True)
        self.assertEqual(s["written"], 3)
        self.assertNotIn("_updates", store)
        self.assertEqual(nc.write_game_playtypes(_DB(store), "2026-27", "playin")["written"], 0)


if __name__ == "__main__":
    unittest.main()
