# -*- coding: utf-8 -*-
"""
Wolves Tracker - 每日抓取看門狗（排程 WolvesWatchdog，台北 15:00 ≈ 美東 02:00）

03:00 主排程在比賽開打前執行，昨晚的比賽要隔天凌晨才上站；主排程也可能崩潰、被擋或因電池／關機跳過。
看門狗分兩級補抓，每次最多補抓一次：
  1. 今天主排程沒完成（fetch_status.json 的 full 不是今天且成功）→ 完整抓取（約 95 requests）
  2. 主排程有完成，但賽程上最新一場不在 wolves_player_games → 只抓單場（--games-only，約 24 requests）
補抓的單場未過定稿門檻（final=False），隔天 03:00 主排程照定稿規則重抓。
一切正常只花 1 個 request（讀賽程）、不通知；有補抓或失敗才跳 Windows 桌面通知。結論逐日記在 watchdog_log.txt。

早上模式 --morning（排程 WolvesWatchdogMorning：每日 09:00＋登入＋解鎖螢幕）：筆電用電池待命時 03:00 不會被喚醒，
主排程常要拖到 15:00 才由上面的看門狗補上。早上模式只做第 1 級：主排程今天的觸發時間已過、卻沒完成 → 完整補抓
（此時前一晚的比賽已定稿，補到的就是最終版）。今天已完成、今天已失敗過（多半被擋，留給 15:00）或還沒到觸發時間
就直接結束：不發 request、不寫 log，
所以一天被解鎖觸發很多次也沒關係。第 2 級（昨晚那場）仍留給 15:00。

用法：
  python scripts/watchdog.py               # 正式執行
  python scripts/watchdog.py --morning     # 早上模式（只補主排程）
  python scripts/watchdog.py --dry-run     # 只檢查並印出判斷，不補抓、不通知（可與 --morning 併用）
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
from nba_common import get_season_type, get_current_season, fetch_team_game_log, init_firebase, fingerprint_info

STATUS_PATH = os.path.join(ROOT, "fetch_status.json")  # fetch_data.py 寫入
LOG_PATH = os.path.join(ROOT, "watchdog_log.txt")
FETCH_LOG_PATH = os.path.join(ROOT, "fetch_log.txt")
FETCH_LOG_FALLBACK = os.path.join(ROOT, "fetch_log_watchdog.txt")  # fetch_log.txt 被主排程鎖住時改寫這裡
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
    state, missed, due_passed_today = "", False, True
    if len(lines) >= 2:
        state, last_run, boundary = lines[0].split("|")
        now = now or datetime.now()
        # 觸發時間從排程讀（StartBoundary 'YYYY-MM-DDTHH:MM:SS'），不寫死 03:00
        due = now.replace(hour=int(boundary[11:13]), minute=int(boundary[14:16]), second=0, microsecond=0)
        due_passed_today = now >= due
        if now < due:
            due -= timedelta(days=1)
        missed = datetime.strptime(last_run, "%Y-%m-%d %H:%M:%S") < due
    return {"running": state == "Running" or fetch_procs > 0, "missed": missed, "due_passed_today": due_passed_today}


def wait_for_main(dry_run):
    """開機補跑時主排程與看門狗會同時啟動，啟動順序不保證：主排程錯過時先等它啟動（最多 WAIT_MAIN_START_MINUTES），
    再等它跑完（最多 WAIT_MAIN_MINUTES），避免兩邊同時完整抓取。
    回傳 (dry-run 要附註的說明, 等滿仍在跑)；仍在跑時呼叫端不補抓——跑這麼久多半是 NBA 逾時／被擋，
    再開一個抓取只會加重（2026-10-29 兩個抓取並行、看門狗那個 45 分鐘逾時）"""
    s = main_state()
    if dry_run:
        return ("主排程錯過、尚未補跑，正式執行時會先等它；" if s["missed"] else
                f"主排程或 fetch_data.py 執行中，正式執行時會等它跑完（超過 {WAIT_MAIN_MINUTES} 分鐘就不補抓）；"
                if s["running"] else ""), False
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
    return "", s["running"]


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


def failed_today(mode, since):
    """mode 在 since 之後執行完、但失敗（主排程或看門狗補抓都算；被逾時中止的不會寫狀態檔）"""
    s = read_status(mode)
    return s.get("ok") is False and s.get("finishedAt", "") >= since.isoformat(timespec="seconds")


def latest_game(season, season_type_api):
    """賽程上最新一場 (doc_date, matchup, wl)；賽程抓不到回 None"""
    log_ = fetch_team_game_log(season, season_type_api)
    if not log_:
        return None
    d, _api, m, w, _gid = log_[-1]
    return d, m, w


def game_captured(db, d):
    return db.collection("wolves_player_games").document(d).get(field_paths=["date"]).exists


def write_fetch_log(text):
    """補抓輸出併入 fetch_log.txt；主排程 run_fetch.bat 的 >> 轉向會鎖住它（Windows 檔案鎖），
    寫不進去改寫 FETCH_LOG_FALLBACK，回傳實際寫入的檔名（給通知用）"""
    for path in (FETCH_LOG_PATH, FETCH_LOG_FALLBACK):
        try:
            with open(path, "a", encoding="utf-8") as f:
                f.write(text)
            return os.path.basename(path)
        except OSError:
            continue
    return "（log 寫入失敗）"


def run_fetch(extra_args):
    """跑 fetch_data.py，輸出併入 fetch_log.txt；回傳 (結束碼, 輸出中最後一條錯誤訊息, 輸出寫進的 log 檔名)"""
    cmd = [sys.executable, os.path.join(ROOT, "scripts", "fetch_data.py")] + extra_args
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    try:
        r = subprocess.run(cmd, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=FETCH_TIMEOUT_MINUTES * 60)
        out, rc = (r.stdout or "") + (r.stderr or ""), r.returncode
    except subprocess.TimeoutExpired as e:
        out, rc = str(e.stdout or ""), -1
    if out and not out.endswith("\n"):
        out += "\n"  # 被中止的輸出停在行中間，不補換行下一段標頭會黏上來
    log_name = write_fetch_log(
        f"=== [watchdog] fetch_data.py {' '.join(extra_args)} {datetime.now():%Y-%m-%d %H:%M} ===\n{out}")
    if rc == -1:
        return rc, f"執行超過 {FETCH_TIMEOUT_MINUTES} 分鐘被中止", log_name
    lines = [l.strip() for l in out.splitlines() if l.strip()]
    errs = [l for l in lines if l.startswith(("❌", "[FAILED]"))]
    if not errs and rc != 0 and lines:
        errs = lines[-1:]  # 未捕捉例外：Traceback 最後一行就是錯誤本身
    return rc, (errs[-1] if errs else ""), log_name


def fp_text(s):
    """一次抓取用的瀏覽器指紋（fetch_status.json 的一筆或 fingerprint_info()）：
    換過 → '🔁 指紋 chrome110 沒回應，已自動換成 safari15_5'；全換過都不行 → 提示多半不是指紋；沒換 → '指紋 safari15_5'"""
    if s.get("switchedFrom"):
        return f"🔁 指紋 {s['switchedFrom']} 沒回應，已自動換成 {s['fingerprint']}"
    if s.get("triedAll"):
        return f"🔁 指紋 {s['fingerprint']} 沒回應，換過所有指紋也不行（多半是 IP 被擋或伺服器問題）"
    return f"指紋 {s['fingerprint']}" if s.get("fingerprint") else ""


def with_fp(text, s):
    note = fp_text(s)
    return f"{text}；{note}" if note else text


def label(game):
    d, m, w = game
    return f"{d[5:].replace('-', '/')} {m.replace('MIN ', '').replace('.', '')}（{w}）"


def main():
    parser = argparse.ArgumentParser(description="Wolves Tracker 每日抓取看門狗")
    parser.add_argument("--dry-run", action="store_true", help="只檢查並印出判斷，不補抓、不通知")
    parser.add_argument("--morning", action="store_true", help="早上模式：只在主排程今天該跑卻沒完成時完整補抓")
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
    if args.morning:
        # 解鎖螢幕一天會觸發很多次：已完成／還沒到觸發時間就安靜結束（只讀狀態檔與排程，不發 request）
        if ran_today("full", since):
            if args.dry_run:
                print("[dry-run][早上] 今天主排程已完成，不用補")
            return
        if failed_today("full", since):
            # 被擋時解鎖一次就重抓一次只會越擋越久（2026-10-29），今天已失敗過就留給 15:00 那次
            if args.dry_run:
                print("[dry-run][早上] 今天完整抓取已失敗過，不再重試，留給 15:00 看門狗")
            return
        if not main_state()["due_passed_today"]:
            if args.dry_run:
                print("[dry-run][早上] 今天主排程還沒到觸發時間，不用補")
            return
    wait_note, still_running = wait_for_main(args.dry_run)
    if args.morning and (ran_today("full", since) or failed_today("full", since)):
        return   # 等到主排程自己補跑完成；它失敗了也不接著重試（同上，留給 15:00）
    if still_running:
        log(f"⚠️ 主排程或 fetch_data.py 等了 {WAIT_MAIN_MINUTES} 分鐘仍在執行（多半是 NBA 逾時／被擋），本次不補抓，交給下一次看門狗")
        return

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
        reason = f"{'[早上] ' if args.morning else ''}今天主排程沒完成（{why}）"
    else:
        game = latest_game(season, season_type_api)
        if game is None:
            log("⚠️ 主排程已完成，但賽程抓不到，無法確認昨晚比賽（不補抓）")
            return
        if game_captured(db, game[0]):
            # 報主排程用的指紋；看門狗自己讀賽程時換過也要報
            main_fp, own_fp = read_status("full"), fingerprint_info()
            note = fp_text(main_fp) + (f"；看門狗讀賽程時 {fp_text(own_fp)}" if own_fp["switchedFrom"] else "")
            log(f"正常（主排程已完成；最新一場 {label(game)} 已在{'；' + note if note else ''}）")
            if main_fp.get("switchedFrom") or own_fp["switchedFrom"]:
                notify("Wolves Tracker：已自動換指紋", f"{note}。資料正常，不用處理。")
            return
        mode, fetch_args = "games", ["--games-only"]
        reason = f"最新一場 {label(game)} 還沒進資料庫"

    if args.dry_run:
        log(f"[dry-run] {wait_note}{reason} → 會執行 fetch_data.py {' '.join(fetch_args) or '（完整抓取）'}"
            f"（目前指紋 {fingerprint_info()['fingerprint']}）")
        return

    print(f"{reason}，開始補抓…")
    rc, err, log_name = run_fetch(fetch_args)

    # 補抓後再檢查一次：狀態檔要是這次成功，且最新一場要在
    game = latest_game(season, season_type_api)
    ok = rc == 0 and ran_today(mode, start) and game is not None and game_captured(db, game[0])
    kind = "完整抓取" if mode == "full" else "單場"
    # 這次補抓的指紋：子程序寫進狀態檔才算數（被逾時中止的沒寫，就不報）
    fp = read_status(mode) if ran_today(mode, start) or failed_today(mode, start) else {}
    if ok:
        log(with_fp(f"✅ 已補抓（{kind}）：{reason} → 已補上", fp))
        body = (f"{label(game)} 已上站（暫定版，明天 03:00 定稿）。" if mode == "games" else
                f"今天的累積快照已補上，最新一場 {label(game)} 已在。")
        notify("Wolves Tracker：已補抓", with_fp(f"{body}原因：{reason}", fp))
    else:
        detail = err or (f"結束碼 {rc}" if rc != 0 else "最新一場仍不在資料庫")
        log(with_fp(f"❌ 補抓失敗（{kind}）：{reason}；{detail}", fp))
        notify("Wolves Tracker：補抓失敗", with_fp(f"{reason}。{detail.rstrip('。')}。詳見 {log_name}", fp))
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # 看門狗自己壞掉也要讓人知道
        log(f"❌ 看門狗例外：{type(e).__name__}: {e}")
        notify("Wolves Tracker 看門狗出錯", f"{type(e).__name__}: {e}")
        raise
