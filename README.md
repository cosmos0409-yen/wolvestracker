# 🐺 Wolves Ledger｜灰狼數據帳本

Minnesota Timberwolves 的每日 Synergy PlayType 與 NBA Tracking 數據研究站（另附薪資與奢侈稅頁），設計目標是寫專欄時「找得快、看得準、引用得出去」。

## 功能總覽

版面由上而下：刊頭（賽季年份／例行·季後／截至日期／最新一場／薪資／搜尋）→ 頭像列（全隊＋球員）→ 身分列（4 個主數字；球員另顯示該季薪資）→ 章節列（六章節；總覽與 Playtype 另有攻守切換）。

- **網址記住畫面**：球員、章節、賽季、賽別、日期、攻守、打開的走勢指標、單場比賽都寫進網址，貼到筆記裡下次一點就回到同一畫面
- **單場比賽頁（Game Center）**：比分看板與每節比分、本場焦點與 Four Factors、兩隊 Box Score（點灰狼球員展開本場進階並標出優於季平均的項目）、球隊對比、本場 vs 季平均、本場投籃；點指標直接看該指標逐場走勢並圈出這場
- **薪資頁（Cap Sheet，`#cap`）**：分「總覽／合約／選秀權／規則」四頁——
  - 總覽：所在層級、是否鎖死在 apron（hard cap）、奢侈稅率（依繳稅紀錄自動判定是否累犯），奢侈稅薪資／apron 薪資／各門檻空間、門檻儀表、奢侈稅分級估算
  - 合約：逐年薪資總表（往後 5 季、選項與保障標記、點球員名開球員頁）、薪資結構、薪資占比 vs 貢獻占比（公式常駐、可關閉）
  - 選秀權：2027 起各年首輪／次輪狀態，可展開原文條件與出處
  - 規則：超過薪資帽／奢侈稅線／第一、第二 apron 會受到的操作限制，附出處
  - 縮寫金額滑鼠移上去顯示完整金額；資料人工整理自 Spotrac、Hoops Rumors 等公開資料，與 Spotrac 逐元對帳
- **快捷鍵**：`/` 搜尋球員／章節／賽季／最近比賽／薪資，`1–6` 切章節
- **複製引用**：點數字旁的「?」看定義，小卡內可一鍵複製「球員｜賽季｜截至日期｜指標 數值｜資料來源｜畫面網址」
- **指標定義**：指標旁的「?」說明定義、計算方式與資料來源
- **匯出**：表格可匯出 CSV（Excel 可直接開），圖表與表格可匯出 16:9／1:1 PNG 專欄配圖
- **無障礙**：文字對比符合 WCAG AA、按鈕點擊範圍至少 24px、鍵盤操作有焦點框（PageSpeed 無障礙 100）

| 分頁 | 說明 |
|---|---|
| **總覽 (Overview)** | 近期異動（近 5/10 場 vs 全季）+ 季平均（可切全季／近 5 場／近 10 場，可選截至日期）+ Playtype 強弱項 + 雷達 + 在場/不在場效率(On/Off) + 關鍵時刻(Clutch) + 五人陣容(Lineups) + 單場面板 |
| **Splits** | 期間篩選（全季/每月/勝敗/主客/近N場/自訂區間/季後系列）→ 卡片牆（基本／進階／投籃分區／防守，該期間 vs 全季 綠紅漲跌）+ 點卡展開趨勢折線（逐場/每週/每月，逐場鋪勝負底色、點任一場看單場頁） |
| **投籃 (Shooting)** | 距離區間(5ft)/分區/出手方式卡片（命中率 + 出手佔比）+ 分區「與上季比」差異半場圖 + 受助攻比例 + 可篩選的投籃熱圖 + 命中率趨勢 |
| **防守 (Defense)** | 最近防守者（Defense Dashboard）、防守 box、對手分區命中、拼勁（干擾、地板球）、掩護與卡位（掩護助攻得分、卡位） + 防守熱圖 |
| **Playtype** | 11 種進攻 + 9 種防守戰術，Synergy 式可排序表格（Freq、Poss/G、PPP、百分位色階條、FG%），可切卡片；點類型看當季走勢 |
| **跨季比較 (Comparison)** | 賽季軌跡疊圖（各季以出賽第 N 場對齊，看今年同期 vs 往年）+ 多選賽季 × 數據類別 → 並列終點值表格 + 逐季折線（可多選指標、疊加其他球員／全隊、指數化） |
| **雷達圖**（在總覽） | 軸可自選（3~6 個 Playtype/Tracking 指標）+ 疊加歷史賽季或同季隊友 + 自選指標比較表 |
| **歷史賽季回補** | 2022-23 起各賽季例行賽/季後賽完整終點快照（供跨季比較） |
| **中英雙語** | 中文標籤旁一律以小字保留 NBA 原文（命名對照見 doc/handover.md） |

季平均與 Splits 的百分比欄以「Σ分子/Σ分母」加權重算（非平均百分比），資料源為**逐場打包 bundle**（單一 doc，避免多次讀取）。

## 技術架構

```
wolvestracker/
├── index.html               # 前端 SPA「Wolves Ledger」(React 18 + Recharts, 鎖版本 CDN)
├── components/              # React 元件原始碼（修改後需重新 bundle）
│   ├── OverviewTab / SplitsTab / ShootingTab / ComparisonTab / RadarPanel  # 六分頁 + 雷達
│   ├── GamePage.js          # 單場比賽頁（#game=日期）
│   ├── CapPage.js           # 薪資頁（#cap）：計算、四分頁區塊
│   ├── SeasonPaceChart.js   # 疊圖：賽季軌跡＋通用多序列折線 LineOverlay
│   ├── gameAggregates.js    # GameAgg：逐場聚合（季平均/月/勝敗/趨勢，加權%）
│   └── gamesData.js         # 讀逐場 bundle（單一 getDoc）
├── dist/                    # bundle.py 產物：components-bundle.js（預編譯 JS）、app.css（Tailwind）（勿手改）
├── styles/app.css           # Tailwind 入口
├── package.json             # 前端建置工具（esbuild、tailwindcss，鎖定版本）
├── scripts/
│   ├── nba_common.py        # 共用模組：連線/欄位設定表/抓取函式
│   ├── fetch_data.py        # 每日當季爬蟲 (NBA Stats API → Firebase)
│   ├── backfill_games.py    # 單場逐場回補（--dates 補失敗場；--box-only 只補 box score）
│   ├── backfill_history.py  # 歷史賽季完整終點快照回補
│   ├── build_bundles.py     # 逐場打包成 bundle doc（前端 Splits/總覽用）
│   ├── fetch_shotchart.py   # 投籃熱圖爬蟲（每週；含出手方式/日期/受助攻）
│   ├── sync_salary.py       # 薪資同步（Google Sheet 發佈的 CSV → Firestore，每日排程順跑）
│   └── bundle.py            # 前端打包（合併 → esbuild 編譯 JSX → Tailwind 產 CSS）
├── run_fetch.bat            # Windows 排程入口（每日）
├── run_shotchart.bat        # Windows 排程入口（每週）
├── requirements.txt         # Python 依賴
└── doc/
    ├── test/test_cases.md   # 測試案例清單
    └── handover.md          # 交接手冊
```

### 資料流

```
NBA Stats API ──(Python, 本機排程)──▶ Firebase Firestore ◀──(JS)── index.html (GitHub Pages)
                每日 03:00 / 每週一 14:30                      即時讀取 (onSnapshot，開站先讀近期快照)

Google Sheet（人工維護薪資）──(sync_salary.py，每日順跑)──▶ Firestore wolves_salary/main
```

## 快速開始

### 本地測試爬蟲

```bash
pip install -r requirements.txt
python scripts/fetch_data.py
# 無 Firebase 環境時會輸出 local_test_data.json
```

### 本地預覽前端

```bash
# 新電腦第一次：安裝建置工具（需 Node.js）
npm ci
# 改過 components/ 之後先重新打包
python scripts/bundle.py
# 任何靜態伺服器即可；用 8000 埠（Firebase API Key 的網址白名單只開 localhost:8000）
python -m http.server 8000
```

## 自動化排程（Windows 工作排程器）

> 早期版本使用 GitHub Actions，但 GitHub 機房 IP 會被 NBA API 封鎖，
> 已改為本機 Windows Task Scheduler（家用 IP）執行。

| 工作名稱 | 頻率 | 執行內容 |
|---|---|---|
| `WolvesTracker` | 每日 03:00（賽後 12 小時數據才齊；喚醒＋錯過補跑） | `run_fetch.bat`（當季數據＋薪資同步）→ `fetch_log.txt` |
| `WolvesShotchart` | 每週一 14:30 | `run_shotchart.bat` → `shotchart_log.txt` |

建立每週排程的指令：

```
schtasks /create /tn "WolvesShotchart" /tr "C:\wolvestracker\run_shotchart.bat" /sc WEEKLY /d MON /st 14:30
```

## 部署設定

### 1. Firebase

- 專案：`wolves-traker`
- 集合：`wolves_team_stats` / `wolves_player_stats`（每日快照）、
  `wolves_team_history` / `wolves_player_history`（歷史終點快照）、`wolves_shotcharts`（逐球熱圖）、
  `wolves_team_games` / `wolves_player_games`（單場，doc id=日期）、`wolves_games_index`（比賽索引）、
  `wolves_games_bundle` / `wolves_pgames_bundle`（逐場打包，前端 Splits/總覽讀取）、
  `wolves_salary`（薪資頁，單一 doc，由 Google Sheet 同步）
- **新增集合必加 `*` 索引豁免**（Console → 索引 → 自動 → 豁免項目；所有集合皆已設定）
- **新增集合必到 Firebase Console 加 read 白名單**（否則前端 `Missing or insufficient permissions`）
- 安全規則：匿名讀取、後端寫入（新集合需在規則中加入 read 白名單）
- 本地憑證：`firebase-key.json`（在 .gitignore，勿提交）

### 2. GitHub Pages

- 分支：`main`
- 根目錄直接部署 `index.html`

## 反爬蟲策略

NBA `stats.nba.com` API 有嚴格的反爬蟲機制，本專案採用：

- `curl_cffi` 模擬真實瀏覽器 TLS 指紋（`impersonate="chrome110"`）
- 隨機 User-Agent 旋轉（5 組瀏覽器指紋）
- `Sec-Fetch-*`、`x-nba-stats-origin` 等必要 headers
- 每次請求間隔 2 秒 + 失敗後遞增等待 retry（最多 3 次），重試耗盡印出 `[FAILED]` 標記
- 全聯盟單次請求優先，唯一逐球員的 shotchart 降為每週執行
- `safe_col()` 防禦性欄位取值，避免 API 回傳結構變更時 crash

## License

MIT
