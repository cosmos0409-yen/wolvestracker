"""
網站圖示（PWA／加入主畫面）：icons/*.svg 原稿 → 各尺寸 PNG。

產物：
    icons/apple-touch-icon.png   180×180  iOS「加入主畫面」（iOS 不吃 SVG，透明處會變黑，所以原稿滿版不透明）
    icons/icon-192.png           192×192  manifest（Android／桌面安裝）
    icons/icon-512.png           512×512  manifest
    icons/icon-maskable-512.png  512×512  manifest maskable（Android 自行裁形狀，原稿帳本縮在圓形安全區內）
    icons/og-image.png           1200×630 社群分享預覽圖（index.html 的 og:image；原稿的 <!--ICON--> 換成 icon.svg 內容，有文字，用本機系統字）

刊頭 Logo 直接用 icons/icon.svg（向量，免 PNG）。分頁小圖示（favicon）仍是 index.html 內嵌的 W：
16px 時帳本細節會糊成一塊。

用法：
    npm ci                         # 新電腦第一次（安裝鎖定版本的 @resvg/resvg-js）
    python scripts/build_icons.py  # 改了 icons/*.svg 才需要跑；產物要一起提交
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "icons"

# (原稿, 產物, 邊長)
TARGETS = [
    ("icon.svg", "apple-touch-icon.png", 180),
    ("icon.svg", "icon-192.png", 192),
    ("icon.svg", "icon-512.png", 512),
    ("icon-maskable.svg", "icon-maskable-512.png", 512),
    ("og-image.svg", "og-image.png", 1200),
]

# resvg 是 Rust 寫的 SVG 算圖器，輸出與瀏覽器一致。圖示沒有文字；分享預覽圖有文字，載入本機系統字。
# 站徽不用 <image href="icon.svg">：resvg 不載入外部 SVG，而且 @resvg/resvg-js 2.6.2 帶 resourcesDir 會忽略 fitTo
# （圖示全被算成原稿尺寸，實測踩過）。改成把原稿裡的 <!--ICON--> 直接換成 icon.svg 的內容
RENDER_JS = """
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');
for (const [src, out, size] of JSON.parse(process.argv[1])) {
    let svg = fs.readFileSync(src, 'utf8');
    if (svg.includes('<!--ICON-->')) {
        const icon = fs.readFileSync(path.join(path.dirname(src), 'icon.svg'), 'utf8');
        svg = svg.replace('<!--ICON-->', icon.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''));
    }
    const img = new Resvg(svg, { fitTo: { mode: 'width', value: size },
        font: { loadSystemFonts: true, defaultFontFamily: 'Microsoft JhengHei' } }).render();
    const png = img.asPng();
    fs.writeFileSync(out, png);
    console.log(`${out}  ${img.width}x${img.height}  ${png.length} bytes`);
}
"""


def main():
    if not (ROOT / "node_modules" / "@resvg" / "resvg-js").exists():
        sys.exit("找不到 @resvg/resvg-js，先在專案根目錄跑 npm ci")
    jobs = [[str(ICONS / src), str(ICONS / out), size] for src, out, size in TARGETS]
    subprocess.run(["node", "-e", RENDER_JS, json.dumps(jobs)], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
