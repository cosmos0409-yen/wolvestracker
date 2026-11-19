# -*- coding: utf-8 -*-
"""測試共用：把 scripts/ 加進 import 路徑、提供專案根目錄與在 Node 裡執行前端打包檔的小工具"""
import json
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCRIPTS = os.path.join(ROOT, "scripts")
if SCRIPTS not in sys.path:
    sys.path.insert(0, SCRIPTS)

NODE = shutil.which("node")
_EVAL_JS = os.path.join(ROOT, "tests", "js", "eval_bundle.js")


def eval_js(expr_body):
    """在 Node 沙盒載入 dist/components-bundle.js，執行 `(w) => { …expr_body… }` 並回傳 JSON 結果。
    expr_body 例：'return w.seasonForDate(new Date("2026-10-20T04:30:00Z"))'"""
    if not NODE:
        raise RuntimeError("找不到 Node.js")
    r = subprocess.run([NODE, _EVAL_JS], input=expr_body, capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
    if r.returncode != 0:
        raise RuntimeError(f"Node 執行失敗：{r.stderr[-2000:]}")
    return json.loads(r.stdout)
