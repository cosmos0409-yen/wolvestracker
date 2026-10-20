# -*- coding: utf-8 -*-
"""
Wolves Tracker - 薪資資料同步（Google Sheet → Firestore）

Sheet「Wolves Tracker 薪資資料」是唯一資料來源（人工維護），8 個分頁各自發佈成 CSV：
    contracts / dead / thresholds / tax_rates / tax_history / rules / picks / settings
累犯（repeater）不手填：前端依 tax_history（逐季是否繳稅）自動判定。
本腳本只負責「讀取 → 檢查格式 → 對帳 → 寫入」，不做任何薪資計算（總額、奢侈稅、
距門檻差距一律在前端算，計算邏輯只放一處）。寫入：
    wolves_salary/main   單一 doc，欄位名沿用 Sheet 欄名（Sheet 即 schema）

檢查有錯誤（error）就不寫入並以 exit code 1 結束；對帳不符只警告（warning）不擋。
內容與 Firestore 現有版本相同（contentHash 一致）就略過寫入。

Usage:
    python sync_salary.py              # 讀發佈的 CSV，檢查後寫入
    python sync_salary.py --dry-run    # 只印摘要，不寫入
    python sync_salary.py --local DIR  # 改讀本地 DIR/<分頁>.csv（測試用）
"""

import sys
import os
import io
import csv
import json
import time
import hashlib
import argparse
import re
import urllib.request
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nba_common as nc

TABS = ["contracts", "dead", "thresholds", "tax_rates", "tax_history", "rules", "picks", "settings"]

REQUIRED = {
    "contracts": ["season", "player", "playerId", "salary", "unlikely", "guarantee", "guaranteed_amt", "option", "type", "note"],
    "dead": ["season", "player", "amount", "reason"],
    "thresholds": ["season", "cap", "tax", "apron1", "apron2", "min_team", "tax_bracket", "ntmle", "tmle", "bae",
                   "apron_final", "hard_cap", "hard_cap_reason", "ref_tax_total", "ref_apron_total"],
    "tax_rates": ["season", "bracket", "rate", "repeater_rate"],
    "tax_history": ["season", "paid", "tax_payroll", "note", "source_url"],
    "rules": ["tier", "order", "text_zh", "detail", "source_url"],
    "picks": ["year", "round", "status", "counterparty", "summary_zh", "terms", "source_url", "as_of"],
    "settings": ["key", "value"],
}

GUARANTEE = {"full", "partial", "none"}
OPTION = {"", "PO", "TO", "ETO"}
KNOWN_TYPES = {"", "VET-EXT", "DRK-EXT", "RK-EXT", "FA", "RK", "RK-1ST", "RK-2ND", "ROS", "MIN",
               "MLE-TP", "MLE-NT", "MLE-ROOM", "BAE", "TWO-WAY", "10-DAY"}
TIERS = {"cap", "tax", "apron1", "apron2", "hardcap"}
PICK_STATUS = {"own", "out", "swap", "frozen", "conditional", "in"}
APRON_FINAL = {"", "below_cap", "cap", "tax", "apron1", "apron2"}
HARD_CAP = {"", "none", "apron1", "apron2"}
THRESHOLD_INTS = ["cap", "tax", "apron1", "apron2", "min_team", "tax_bracket", "ntmle", "tmle", "bae"]
SEASON_RE = re.compile(r"^(\d{4})-(\d{2})$")


# ==========================================
# 讀取
# ==========================================
def fetch_tab(name, local_dir=None):
    """回傳該分頁的列（list of dict）。發佈的 CSV 偶爾會 5xx，重試 3 次。"""
    if local_dir:
        with open(os.path.join(local_dir, f"{name}.csv"), encoding="utf-8", newline="") as f:
            return list(csv.DictReader(f))
    url = f"{nc.SALARY_SHEET_PUB}?gid={nc.SALARY_SHEET_GIDS[name]}&single=true&output=csv"
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=20) as res:
                text = res.read().decode("utf-8")
            return list(csv.DictReader(io.StringIO(text)))
        except Exception as e:
            print(f"   ⚠️ 讀取 {name} 失敗（{attempt + 1}/3）：{e}")
            time.sleep(3)
    raise RuntimeError(f"讀取分頁 {name} 失敗（3 次重試皆失敗）")


# ==========================================
# 檢查與轉型
# ==========================================
class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, tab, row, msg):
        self.errors.append(f"[{tab} 第 {row} 列] {msg}")

    def warn(self, msg):
        self.warnings.append(msg)


def _int(v, rep, tab, row, col, allow_blank=False):
    """Sheet 數字若被設成貨幣格式會帶 $ 與千分位，先去掉再轉。"""
    s = str(v or "").replace(",", "").replace("$", "").strip()
    if s == "":
        if not allow_blank:
            rep.err(tab, row, f"{col} 不可空白")
        return None
    try:
        f = float(s)
        if not f.is_integer():
            raise ValueError
        return int(f)
    except ValueError:
        rep.err(tab, row, f"{col} 不是整數：{v!r}")
        return None


def _float(v, rep, tab, row, col):
    try:
        return float(str(v).strip())
    except ValueError:
        rep.err(tab, row, f"{col} 不是數字：{v!r}")
        return None


def _bool(v, rep, tab, row, col):
    s = str(v or "").strip().upper()
    if s not in ("TRUE", "FALSE"):
        rep.err(tab, row, f"{col} 必須是 TRUE 或 FALSE：{v!r}")
        return None
    return s == "TRUE"


def _season(v, rep, tab, row):
    s = str(v or "").strip().lstrip("'")
    m = SEASON_RE.match(s)
    if not m or (int(m.group(1)) + 1) % 100 != int(m.group(2)):
        rep.err(tab, row, f"season 格式應為 2026-27：{v!r}")
        return None
    return s


def _str(v):
    return str(v or "").strip()


def check_headers(raw, rep):
    for tab in TABS:
        cols = set(raw[tab][0].keys()) if raw[tab] else set()
        missing = [c for c in REQUIRED[tab] if c not in cols]
        if not raw[tab]:
            rep.err(tab, 1, "分頁沒有任何資料列")
        elif missing:
            rep.err(tab, 1, f"缺少欄位：{', '.join(missing)}")


def parse_all(raw, rep):
    """逐分頁轉型；資料列號以 Sheet 為準（標題是第 1 列）。"""
    out = {}

    contracts, seen = [], set()
    for i, r in enumerate(raw["contracts"], start=2):
        season = _season(r.get("season"), rep, "contracts", i)
        g = _str(r.get("guarantee"))
        opt = _str(r.get("option"))
        typ = _str(r.get("type"))
        item = {
            "season": season, "player": _str(r.get("player")),
            "playerId": _int(r.get("playerId"), rep, "contracts", i, "playerId"),
            "salary": _int(r.get("salary"), rep, "contracts", i, "salary"),
            "unlikely": _int(r.get("unlikely"), rep, "contracts", i, "unlikely", allow_blank=True) or 0,
            "guarantee": g,
            "guaranteed_amt": _int(r.get("guaranteed_amt"), rep, "contracts", i, "guaranteed_amt", allow_blank=True),
            "option": opt, "type": typ, "note": _str(r.get("note")),
        }
        if not item["player"]:
            rep.err("contracts", i, "player 不可空白")
        if g not in GUARANTEE:
            rep.err("contracts", i, f"guarantee 只能是 {sorted(GUARANTEE)}：{g!r}")
        if g == "partial" and item["guaranteed_amt"] is None:
            rep.err("contracts", i, "guarantee=partial 時要填 guaranteed_amt")
        if opt not in OPTION:
            rep.err("contracts", i, f"option 只能是 PO/TO/ETO 或空白：{opt!r}")
        if typ not in KNOWN_TYPES:
            rep.warn(f"[contracts 第 {i} 列] 未知的 type {typ!r}（若是新類別請加進 KNOWN_TYPES）")
        key = (season, item["playerId"])
        if season and item["playerId"] and key in seen:
            rep.err("contracts", i, f"{season} {item['player']} 重複")
        seen.add(key)
        contracts.append(item)
    out["contracts"] = contracts

    dead = []
    for i, r in enumerate(raw["dead"], start=2):
        item = {"season": _season(r.get("season"), rep, "dead", i), "player": _str(r.get("player")),
                "amount": _int(r.get("amount"), rep, "dead", i, "amount"), "reason": _str(r.get("reason"))}
        if not item["player"] or not item["reason"]:
            rep.err("dead", i, "player、reason 不可空白")
        dead.append(item)
    out["dead"] = dead

    thresholds = {}
    for i, r in enumerate(raw["thresholds"], start=2):
        season = _season(r.get("season"), rep, "thresholds", i)
        t = {c: _int(r.get(c), rep, "thresholds", i, c) for c in THRESHOLD_INTS}
        t["apron_final"] = _str(r.get("apron_final"))
        t["hard_cap"] = _str(r.get("hard_cap"))
        t["hard_cap_reason"] = _str(r.get("hard_cap_reason"))
        t["ref_tax_total"] = _int(r.get("ref_tax_total"), rep, "thresholds", i, "ref_tax_total", allow_blank=True)
        t["ref_apron_total"] = _int(r.get("ref_apron_total"), rep, "thresholds", i, "ref_apron_total", allow_blank=True)
        t["verify"] = _str(r.get("verify"))
        if t["apron_final"] not in APRON_FINAL:
            rep.err("thresholds", i, f"apron_final 只能是 {sorted(APRON_FINAL - {''})} 或空白")
        if t["hard_cap"] not in HARD_CAP:
            rep.err("thresholds", i, "hard_cap 只能是 none/apron1/apron2 或空白")
        lines = [t["cap"], t["tax"], t["apron1"], t["apron2"]]
        if None not in lines and not (lines[0] < lines[1] < lines[2] < lines[3]):
            rep.err("thresholds", i, "門檻順序應為 cap < tax < apron1 < apron2")
        if season in thresholds:
            rep.err("thresholds", i, f"{season} 重複")
        if season:
            thresholds[season] = t
    out["thresholds"] = thresholds

    tax_rates = {}
    for i, r in enumerate(raw["tax_rates"], start=2):
        season = _season(r.get("season"), rep, "tax_rates", i)
        item = {"bracket": _int(r.get("bracket"), rep, "tax_rates", i, "bracket"),
                "rate": _float(r.get("rate"), rep, "tax_rates", i, "rate"),
                "repeater_rate": _float(r.get("repeater_rate"), rep, "tax_rates", i, "repeater_rate")}
        if season:
            tax_rates.setdefault(season, []).append(item)
    for season, rows in tax_rates.items():
        rows.sort(key=lambda x: x["bracket"] or 0)
        if [x["bracket"] for x in rows] != list(range(1, len(rows) + 1)):
            rep.err("tax_rates", "-", f"{season} 的 bracket 應從 1 連續編號")
    out["tax_rates"] = tax_rates

    tax_history, seen_h = [], set()
    for i, r in enumerate(raw["tax_history"], start=2):
        season = _season(r.get("season"), rep, "tax_history", i)
        if season in seen_h:
            rep.err("tax_history", i, f"{season} 重複")
        seen_h.add(season)
        tax_history.append({"season": season, "paid": _bool(r.get("paid"), rep, "tax_history", i, "paid"),
                            "tax_payroll": _int(r.get("tax_payroll"), rep, "tax_history", i, "tax_payroll", allow_blank=True),
                            "note": _str(r.get("note")), "source_url": _str(r.get("source_url"))})
    out["tax_history"] = sorted(tax_history, key=lambda x: x["season"] or "")

    rules = []
    for i, r in enumerate(raw["rules"], start=2):
        tier = _str(r.get("tier"))
        if tier not in TIERS:
            rep.err("rules", i, f"tier 只能是 {sorted(TIERS)}：{tier!r}")
        if not _str(r.get("text_zh")):
            rep.err("rules", i, "text_zh 不可空白")
        rules.append({"tier": tier, "order": _int(r.get("order"), rep, "rules", i, "order"),
                      "text_zh": _str(r.get("text_zh")), "detail": _str(r.get("detail")),
                      "source_url": _str(r.get("source_url"))})
    out["rules"] = sorted(rules, key=lambda x: (x["tier"], x["order"] or 0))

    picks = []
    for i, r in enumerate(raw["picks"], start=2):
        status = _str(r.get("status"))
        rnd = _int(r.get("round"), rep, "picks", i, "round")
        if status not in PICK_STATUS:
            rep.err("picks", i, f"status 只能是 {sorted(PICK_STATUS)}：{status!r}")
        if rnd not in (1, 2, None):
            rep.err("picks", i, "round 只能是 1 或 2")
        picks.append({"year": _int(r.get("year"), rep, "picks", i, "year"), "round": rnd, "status": status,
                      "counterparty": _str(r.get("counterparty")), "summary_zh": _str(r.get("summary_zh")),
                      "terms": _str(r.get("terms")), "source_url": _str(r.get("source_url")),
                      "as_of": _str(r.get("as_of")), "verify": _str(r.get("verify"))})
    out["picks"] = sorted(picks, key=lambda x: (x["year"] or 0, x["round"] or 0))

    settings = {_str(r.get("key")): _str(r.get("value")) for r in raw["settings"] if _str(r.get("key"))}
    out["settings"] = {"show_value": _bool(settings.get("show_value", "TRUE"), rep, "settings", "-", "show_value")}
    return out


def cross_check(data, rep):
    """跨分頁檢查：當季（含）以前有合約的賽季必須有門檻與稅率；有參考總額就對帳（只警告）。"""
    cap_season = nc.get_roster_season()   # 聯盟年度 7/1 切換，與前端 capSeasonForDate 同規則
    seasons = sorted({c["season"] for c in data["contracts"] if c["season"]})
    for s in seasons:
        if s <= cap_season:
            if s not in data["thresholds"]:
                rep.err("thresholds", "-", f"{s} 有合約但沒有門檻資料")
            if s not in data["tax_rates"]:
                rep.err("tax_rates", "-", f"{s} 有合約但沒有稅率資料")
    for s, t in data["thresholds"].items():
        rows = [c for c in data["contracts"] if c["season"] == s and c["type"] != "TWO-WAY"]
        dead = sum(d["amount"] or 0 for d in data["dead"] if d["season"] == s)
        tax_total = sum(c["salary"] or 0 for c in rows) + dead
        apron_total = tax_total + sum(c["unlikely"] or 0 for c in rows)
        for label, got, ref in (("奢侈稅薪資", tax_total, t["ref_tax_total"]), ("apron 薪資", apron_total, t["ref_apron_total"])):
            if ref is not None and abs(got - ref) > 1:
                rep.warn(f"{s} {label}對帳不符：加總 {got:,}、參考 {ref:,}（差 {ref - got:+,}）")


def summarize(data):
    print("\n── 摘要 ──")
    for s in sorted(data["thresholds"]) + sorted({c["season"] for c in data["contracts"]} - set(data["thresholds"])):
        rows = [c for c in data["contracts"] if c["season"] == s]
        tw = sum(1 for c in rows if c["type"] == "TWO-WAY")
        dead = sum(d["amount"] or 0 for d in data["dead"] if d["season"] == s)
        total = sum(c["salary"] or 0 for c in rows if c["type"] != "TWO-WAY") + dead
        t = data["thresholds"].get(s)
        mark = ""
        if t and t["ref_tax_total"] is not None:
            mark = "✅" if abs(total - t["ref_tax_total"]) <= 1 else "❌"
        print(f"   {s}：{len(rows) - tw} 人（雙向 {tw}）、死錢 {dead:,}、奢侈稅薪資 {total:,} {mark}")
    print(f"   rules {len(data['rules'])} 條、picks {len(data['picks'])} 筆、繳稅紀錄 {len(data['tax_history'])} 季、show_value={data['settings']['show_value']}")


# ==========================================
# 主流程
# ==========================================
def main():
    parser = argparse.ArgumentParser(description="薪資資料同步（Google Sheet → Firestore）")
    parser.add_argument("--dry-run", action="store_true", help="只檢查並印摘要，不寫入")
    parser.add_argument("--local", help="改讀本地資料夾內的 <分頁>.csv（測試用）")
    args = parser.parse_args()

    print(f"=== 薪資同步 {datetime.now():%Y-%m-%d %H:%M} ===")
    raw = {tab: fetch_tab(tab, args.local) for tab in TABS}
    rep = Report()
    check_headers(raw, rep)
    if rep.errors:
        data = None
    else:
        data = parse_all(raw, rep)
        cross_check(data, rep)

    for w in rep.warnings:
        print(f"⚠️ {w}")
    if rep.errors:
        print(f"\n❌ 檢查發現 {len(rep.errors)} 個錯誤，不寫入：")
        for e in rep.errors:
            print(f"   {e}")
        sys.exit(1)

    summarize(data)
    content_hash = hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
    if args.dry_run:
        print(f"\n(dry-run) 檢查通過，不寫入。contentHash={content_hash[:12]}")
        return

    db = nc.init_firebase()
    if db is None:
        sys.exit(1)
    ref = db.collection("wolves_salary").document("main")
    snap = ref.get()
    if snap.exists and (snap.to_dict() or {}).get("contentHash") == content_hash:
        print("\n⏭️ 內容與 Firestore 相同，略過寫入")
        return
    ref.set({**data, "contentHash": content_hash, "source": "Google Sheet",
             "updatedAt": int(datetime.now().timestamp() * 1000)})
    print(f"\n✅ 已寫入 wolves_salary/main（contentHash={content_hash[:12]}）")


if __name__ == "__main__":
    main()
