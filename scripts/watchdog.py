# -*- coding: utf-8 -*-
"""
Wolves Tracker - 每日抓取看門狗（排程 WolvesWatchdog，台北 15:00 ≈ 美東 02:00）

03:00 主排程在比賽開打前執行，昨晚的比賽要隔天凌晨才上站；主排程也可能崩潰、被擋或因電池／關機跳過。
看門狗分兩級補抓，每次最多補抓一次：
  1. 今天主排程沒完成（fetch_status.json 的 full 不是今天且成功）→ 完整抓取（約 95 requests）
  2. 主排程有完成，但賽程上最新一場不在 wolves_player_games → 只抓單場（--games-only，約 24 requests）
補抓的單場未過定稿門檻（final=False），隔天 03:00 主排程照定稿規則重抓。
一切正常只花 1 個 request（讀賽程）、不通知；有補抓或失敗才跳 Windows 桌面通知。結論逐日記在 watchdog_log.txt。

用法：
  python scripts/watchdog.py               # 正式執行
  python scripts/watchdog.py --dry-run     # 只檢查並印出判斷，不補抓、不通知
  python scripts/watchdog.py --test-notify # 只跳一則測試通知
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from nba_common import get_season_type, get_current_season, fetch_team_game_log, init_firebase

STATUS_PATH = os.path.join(ROOT, "fetch_status.json")  # fetch_data.py 寫入
LOG_PATH = os.path.join(ROOT, "watchdog_log.txt")
FETCH_LOG_PATH = os.path.join(ROOT, "fetch_log.txt")
MAIN_TASK = "WolvesTracker"
FETCH_PROC_PATTERN = "*fetch_data.py*"  # 偵測執行中的抓取（含手動執行）
WAIT_MAIN_START_MINUTES = 10  # 主排程錯過時，等它開機補跑啟動最多這麼久
WAIT_MAIN_MINUTES = 60        # 主排程（或手動的 fetch_data.py）執行中，等它跑完最多這麼久
FETCH_TIMEOUT_MINUTES = 45

# Windows PowerShell 5.1 內建的 AppUserModelID，免註冊即可發 toast（pwsh 7 沒有 WinRT，不能用）
TOAST_SCRIPT = r"""
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$t = [Security.SecurityElement]::Escape($env:WT_TITLE)
$b = [Security.SecurityElement]::Escape($env:WT_BODY)
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$t</text><text>$b</text></binding></visual></toast>")
$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
"""


def notify(title, body):
    env = dict(os.environ, WT_TITLE=title, WT_BODY=body)
    r = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", TOAST_SCRIPT],
                       env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        log(f"通知失敗：{(r.stderr or '').strip()[:200]}")


def log(msg):
    line = f"{datetime.now():%Y-%m-%d %H:%M} | {msg}"
    print(line)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def powershell(cmd):
    r = subprocess.run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", cmd],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.stdout.strip()


def main_state(now=None):
    """主排程現況：running（排程執行中或有 fetch_data.py 程序，含手動執行）、
    missed（上次執行早於最近一次應觸發時間 → 錯過、開機後即將補跑）"""
    out = powershell(
        f"$t = Get-ScheduledTask -TaskName {MAIN_TASK} -ErrorAction SilentlyContinue; "
        f"if ($t) {{ $i = Get-ScheduledTaskInfo -TaskName {MAIN_TASK}; "
        f"'{{0}}|{{1:yyyy-MM-dd HH:mm:ss}}|{{2}}' -f $t.State, $i.LastRunTime, $t.Triggers[0].StartBoundary }}; "
        # Win32_Process 也會列出已結束、但還有人握著 handle 的殘影程序（HasExited=True），要用 Get-Process 確認還活著
        "'|' + @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'python.exe' -and "
        f"$_.CommandLine -like '{FETCH_PROC_PATTERN}' -and "
        "(Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue | Where-Object { -not $_.HasExited }) }).Count")
    lines = out.splitlines()
    fetch_procs = int(lines[-1].lstrip("|") or 0) if lines else 0
    state, missed = "", False
    if len(lines) >= 2:
        state, last_run, boundary = lines[0].split("|")
        now = now or datetime.now()
        # 觸發時間從排程讀（StartBoundary 'YYYY-MM-DDTHH:MM:SS'），不寫死 03:00
        due = now.replace(hour=int(boundary[11:13]), minute=int(boundary[14:16]), second=0, microsecond=0)
        if now < due:
            due -= timedelta(days=1)
        missed = datetime.strptime(last_run, "%Y-%m-%d %H:%M:%S") < due
    return {"running": state == "Running" or fetch_procs > 0, "missed": missed}


def wait_for_main(dry_run):
    """開機補跑時主排程與看門狗會同時啟動，啟動順序不保證：主排程錯過時先等它啟動（最多 WAIT_MAIN_START_MINUTES），
    再等它跑完（最多 WAIT_MAIN_MINUTES），避免兩邊同時完整抓取。回傳 dry-run 要附註的說明"""
    s = main_state()
    if dry_run:
        return ("主排程錯過、尚未補跑，正式執行時會先等它；" if s["missed"] else
                "主排程或 fetch_data.py 執行中，正式執行時會等它跑完；" if s["running"] else "")
    if s["missed"] and not s["running"]:
        print(f"主排程 {MAIN_TASK} 錯過、尚未補跑，等它啟動…")
        for _ in range(WAIT_MAIN_START_MINUTES * 2):
            time.sleep(30)
            s = main_state()
            if s["running"] or not s["missed"]:
                break
        else:
            log(f"⚠️ 主排程錯過且 {WAIT_MAIN_START_MINUTES} 分鐘內沒補跑，改由看門狗自行判斷")
    waited = 0
    while s["running"] and waited < WAIT_MAIN_MINUTES:
        if waited == 0:
            print("主排程或 fetch_data.py 執行中，等它跑完…")
        time.sleep(60)
        waited += 1
        s = main_state()
    return ""


def read_status(mode):
    try:
        with open(STATUS_PATH, encoding="utf-8") as f:
            return json.load(f).get(mode) or {}
    except (OSError, ValueError):
        return {}


def ran_today(mode, since):
    """mode 在 since（本次看門狗啟動當天 00:00）之後成功完成過"""
    s = read_status(mode)
    return bool(s.get("ok")) and s.get("finishedAt", "") >= since.isoformat(timespec="seconds")


def latest_game(season, season_type_api):
    """賽程上最新一場 (doc_date, matchup, wl)；賽程抓不到回 None"""
    log_ = fetch_team_game_log(season, season_type_api)
    if not log_:
        return None
    d, _api, m, w, _gid = log_[-1]
    return d, m, w


def game_captured(db, d):
    return db.collection("wolves_player_games").document(d).get(field_paths=["date"]).exists


def run_fetch(extra_args):
    """跑 fetch_data.py，輸出併入 fetch_log.txt；回傳 (結束碼, 輸出中最後一條錯誤訊息)"""
    cmd = [sys.executable, os.path.join(ROOT, "scripts", "fetch_data.py")] + extra_args
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    try:
        r = subprocess.run(cmd, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=FETCH_TIMEOUT_MINUTES * 60)
        out, rc = (r.stdout or "") + (r.stderr or ""), r.returncode
    except subprocess.TimeoutExpired as e:
        out, rc = str(e.stdout or ""), -1
    with open(FETCH_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(f"=== [watchdog] fetch_data.py {' '.join(extra_args)} {datetime.now():%Y-%m-%d %H:%M} ===\n{out}")
    if rc == -1:
        return rc, f"執行超過 {FETCH_TIMEOUT_MINUTES} 分鐘被中止"
    lines = [l.strip() for l in out.splitlines() if l.strip()]
    errs = [l for l in lines if l.startswith(("❌", "[FAILED]"))]
    if not errs and rc != 0 and lines:
        errs = lines[-1:]  # 未捕捉例外：Traceback 最後一行就是錯誤本身
    return rc, (errs[-1] if errs else "")


def label(game):
    d, m, w = game
    return f"{d[5:].replace('-', '/')} {m.replace('MIN ', '').replace('.', '')}（{w}）"


def main():
    parser = argparse.ArgumentParser(description="Wolves Tracker 每日抓取看門狗")
    parser.add_argument("--dry-run", action="store_true", help="只檢查並印出判斷，不補抓、不通知")
    parser.add_argument("--test-notify", action="store_true", help="只跳一則測試通知")
    args = parser.parse_args()
    os.chdir(ROOT)  # init_firebase 以相對路徑找 firebase-key.json

    if args.test_notify:
        notify("Wolves Tracker 看門狗", "測試通知：看得到這則就代表通知正常。")
        log("測試通知已送出")
        return

    season_type_api, season_type_label = get_season_type()
    if season_type_api is None:
        log("休賽期，不檢查")
        return

    start = datetime.now()
    since = start.replace(hour=0, minute=0, second=0, microsecond=0)
    wait_note = wait_for_main(args.dry_run)

    season = get_current_season()
    db = init_firebase()
    if not db:
        log("❌ Firebase 初始化失敗，無法檢查")
        if not args.dry_run:
            notify("Wolves Tracker 看門狗：無法檢查", "Firebase 初始化失敗，請看 watchdog_log.txt")
        sys.exit(1)

    # 判斷要補抓哪一級
    if not ran_today("full", since):
        s = read_status("full")
        why = f"上次完整抓取 {s.get('finishedAt', '無紀錄')[:16].replace('T', ' ')}{'（失敗：' + s['note'] + '）' if s.get('note') and not s.get('ok') else ''}"
        mode, fetch_args = "full", []
        reason = f"今天主排程沒完成（{why}）"
    else:
        game = latest_game(season, season_type_api)
        if game is None:
            log("⚠️ 主排程已完成，但賽程抓不到，無法確認昨晚比賽（不補抓）")
            return
        if game_captured(db, game[0]):
            log(f"正常（主排程已完成；最新一場 {label(game)} 已在）")
            return
        mode, fetch_args = "games", ["--games-only"]
        reason = f"最新一場 {label(game)} 還沒進資料庫"

    if args.dry_run:
        log(f"[dry-run] {wait_note}{reason} → 會執行 fetch_data.py {' '.join(fetch_args) or '（完整抓取）'}")
        return

    print(f"{reason}，開始補抓…")
    rc, err = run_fetch(fetch_args)

    # 補抓後再檢查一次：狀態檔要是這次成功，且最新一場要在
    game = latest_game(season, season_type_api)
    ok = rc == 0 and ran_today(mode, start) and game is not None and game_captured(db, game[0])
    kind = "完整抓取" if mode == "full" else "單場"
    if ok:
        log(f"✅ 已補抓（{kind}）：{reason} → 已補上")
        body = (f"{label(game)} 已上站（暫定版，明天 03:00 定稿）。" if mode == "games" else
                f"今天的累積快照已補上，最新一場 {label(game)} 已在。")
        notify("Wolves Tracker：已補抓", f"{body}原因：{reason}")
    else:
        detail = err or (f"結束碼 {rc}" if rc != 0 else "最新一場仍不在資料庫")
        log(f"❌ 補抓失敗（{kind}）：{reason}；{detail}")
        notify("Wolves Tracker：補抓失敗", f"{reason}。{detail.rstrip('。')}。詳見 fetch_log.txt")
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # 看門狗自己壞掉也要讓人知道
        log(f"❌ 看門狗例外：{type(e).__name__}: {e}")
        notify("Wolves Tracker 看門狗出錯", f"{type(e).__name__}: {e}")
        raise
