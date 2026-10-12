"""
前端打包：把 components/ 依依賴順序合併 → esbuild 預先編譯 JSX → Tailwind 產生 CSS。
產物：
    dist/components-bundle.js（＋ .map）  瀏覽器直接執行的一般 JS（不再於瀏覽器內跑 Babel）
    dist/app.css                           只含實際用到的 Tailwind class（取代 Tailwind CDN）

用法：
    npm ci                      # 新電腦第一次（依 package-lock.json 安裝鎖定版本的 esbuild / tailwindcss）
    python scripts/bundle.py

為何合併成單一檔：元件以 window.* 互相引用、共用同一個 script scope，順序即依賴順序（見 ORDER）。

快取版本號：GitHub Pages 對所有檔案回 Cache-Control: max-age=600，
使用者可能拿到「新 index.html + 快取裡的舊 bundle / css」。因此每次打包都把產物內容雜湊
寫進 index.html 的網址（components-bundle.js?v=xxxxxxxx、app.css?v=xxxxxxxx），內容一變網址就變，瀏覽器必抓新檔。
"""

import hashlib
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMPONENTS_DIR = ROOT / "components"
DIST_DIR = ROOT / "dist"
OUT_JS = DIST_DIR / "components-bundle.js"
OUT_CSS = DIST_DIR / "app.css"
CSS_SRC = ROOT / "styles" / "app.css"
TW_CONFIG = ROOT / "tailwind.config.js"
INDEX_HTML = ROOT / "index.html"
ESBUILD = ROOT / "node_modules" / "esbuild" / "bin" / "esbuild"
BUILD_DIR = ROOT / ".build"   # 合併後、編譯前的 JSX 暫存（不進版控）
CONCAT_SRC = BUILD_DIR / "components-bundle.jsx"
TAILWIND = ROOT / "node_modules" / "tailwindcss" / "lib" / "cli.js"

# 依依賴順序排列（上層被下層引用）
ORDER = [
    "Icons.js",
    "ui.js",
    "constants.js",
    "MetricComponents.js",
    "PlayTypeCard.js",
    "TrackingCardRow.js",
    "ShotChart.js",
    "DefenseHeatmap.js",
    "gameAggregates.js",
    "gamesData.js",
    "SingleGamePanel.js",
    "OverviewTab.js",
    "SplitsTab.js",
    "ShootingTab.js",
    "ComparisonTab.js",
    "RadarPanel.js",
    "HistoryModal.js",
    "App.js",
]


def fail(msg):
    print(f"[錯誤] {msg}")
    sys.exit(1)


def check_tools():
    node = shutil.which("node")
    if not node:
        fail("找不到 Node.js。請先安裝 Node（https://nodejs.org），再於專案根目錄執行 npm ci")
    if not ESBUILD.exists() or not TAILWIND.exists():
        fail("找不到 esbuild / tailwindcss。請先在專案根目錄執行 npm ci")
    return node


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", cwd=ROOT)
    if r.returncode != 0:
        fail(f"{Path(cmd[1]).name} 執行失敗：\n{r.stderr or r.stdout}")
    return r


def build_js(node):
    parts = []
    for name in ORDER:
        src = COMPONENTS_DIR / name
        if not src.exists():
            fail(f"找不到元件：{src}")
        parts.append(f"\n// ---------- {name} ----------\n")
        parts.append(src.read_text(encoding="utf-8"))
        parts.append("\n")
    BUILD_DIR.mkdir(exist_ok=True)
    CONCAT_SRC.write_text("".join(parts), encoding="utf-8")
    # 非 module、不 bundle：輸出仍是一般 <script>，頂層宣告與 window.* 指派行為與原本 Babel 相同。
    # 不壓縮識別字（--minify-identifiers），避免改到跨檔共用的頂層名稱。
    # target=es2018：把 ?. / ?? 等語法降級，讓較舊的手機瀏覽器也能開。
    run([node, str(ESBUILD), str(CONCAT_SRC),
         "--loader:.jsx=jsx", "--jsx=transform",
         "--jsx-factory=React.createElement", "--jsx-fragment=React.Fragment",
         "--target=es2018", "--charset=utf8",
         "--minify-whitespace", "--minify-syntax", "--legal-comments=none",
         "--sourcemap", f"--outfile={OUT_JS}"])
    print(f"[OK] {OUT_JS.relative_to(ROOT)}（{OUT_JS.stat().st_size / 1024:.1f} KB，{len(ORDER)} 個元件）")


def build_css(node):
    run([node, str(TAILWIND), "-c", str(TW_CONFIG), "-i", str(CSS_SRC), "-o", str(OUT_CSS), "--minify"])
    print(f"[OK] {OUT_CSS.relative_to(ROOT)}（{OUT_CSS.stat().st_size / 1024:.1f} KB）")


def stamp_versions():
    """把產物內容雜湊寫進 index.html 的引用網址（見檔頭「快取版本號」）。"""
    html = INDEX_HTML.read_text(encoding="utf-8")
    new_html = html
    for rel, path in (("dist/components-bundle.js", OUT_JS), ("dist/app.css", OUT_CSS)):
        ver = hashlib.sha1(path.read_bytes()).hexdigest()[:8]
        pattern = r'(src|href)="' + re.escape(rel) + r'(\?v=[0-9a-f]*)?"'
        new_html, n = re.subn(pattern, lambda m: f'{m.group(1)}="{rel}?v={ver}"', new_html)
        if n != 1:
            fail(f"index.html 應恰有 1 個 {rel} 引用，實際找到 {n} 個")
        print(f"[OK] index.html {rel}?v={ver}")
    if new_html != html:
        INDEX_HTML.write_text(new_html, encoding="utf-8")


def main():
    node = check_tools()
    DIST_DIR.mkdir(exist_ok=True)
    build_js(node)
    build_css(node)
    stamp_versions()


if __name__ == "__main__":
    main()
