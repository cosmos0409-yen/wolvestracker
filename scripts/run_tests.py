# -*- coding: utf-8 -*-
"""
Wolves Tracker 自動化測試（零新依賴：Python 標準庫 unittest＋Node 內建 node:test）

    python scripts/run_tests.py          # 全部（後端＋前端＋前後端契約）
    python scripts/run_tests.py --py     # 只跑 tests/py（後端、契約）
    python scripts/run_tests.py --js     # 只跑 tests/js（前端；測打包好的 dist/components-bundle.js）

全部 0 個 NBA／Firestore request：抓取流程用假資料（tests/py/fake_nba.py）、前端在 Node 沙盒裡載入打包檔。
前端測試測的是 dist/ 的打包檔：改了 components/*.js 要先 python scripts/bundle.py（bundle.py 打包完也會自動跑前端測試）。
排程用的 Python312 才有 curl_cffi／firebase_admin／tzdata：請用它跑（裸 python 可能缺套件）。
"""
import argparse
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run_py():
    print("=== 後端／契約測試（tests/py，unittest）===", flush=True)
    return subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", os.path.join("tests", "py"), "-p", "test_*.py"],
                          cwd=ROOT, env={**os.environ, "PYTHONIOENCODING": "utf-8"}).returncode


def run_js():
    node = shutil.which("node")
    if not node:
        print("找不到 Node.js，略過前端測試")
        return 1
    print("=== 前端測試（tests/js，node:test）===", flush=True)
    files = sorted(os.path.join("tests", "js", f) for f in os.listdir(os.path.join(ROOT, "tests", "js")) if f.endswith(".test.js"))
    return subprocess.run([node, "--test", *files], cwd=ROOT).returncode


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")   # Windows 主控台 cp950 印不出 ✅
    except Exception:
        pass
    ap = argparse.ArgumentParser(description="Wolves Tracker 自動化測試")
    ap.add_argument("--py", action="store_true", help="只跑後端／契約測試")
    ap.add_argument("--js", action="store_true", help="只跑前端測試")
    args = ap.parse_args()
    both = not args.py and not args.js
    rc = 0
    if args.py or both:
        rc |= run_py()
    if args.js or both:
        rc |= run_js()
    print("\n✅ 全部通過" if rc == 0 else "\n❌ 有測試失敗（見上方）")
    sys.exit(1 if rc else 0)


if __name__ == "__main__":
    main()
