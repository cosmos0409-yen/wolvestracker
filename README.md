# 🐺 Wolves Ledger｜灰狼數據帳本

Minnesota Timberwolves 的每日 Synergy PlayType 與 NBA Tracking 數據研究站（另附對戰分析與薪資頁），設計目標是寫專欄時「找得快、看得準、引用得出去」。

## 功能總覽

開站首頁是最新一場比賽的單場頁（比分看板＋單場分頁），點「← 回主畫面」進主畫面。主畫面由上而下：刊頭（賽季年份／例行·季後／賽程月曆／對戰／薪資／搜尋）→ 頭像列（全隊＋球員）→ 身分列（4 個主數字、「數據截至」日期；球員另顯示該季薪資）→ 章節列（六章節；總覽與 Playtype 另有「進攻端／防守端」切換）。

- **賽程月曆**：刊頭「賽程」打開整季（例行＋季後）月曆，有比賽的日子標對手與勝負，點日期看該場 Box Score；過去賽季也能用（單場資料從 2022-23 起）

- **網址記住畫面**：球員、章節、賽季、賽別、日期、攻守、打開的走勢指標、單場比賽都寫進網址，貼到筆記裡下次一點就回到同一畫面。球員寫成「ID-名字」（如 `p=1630162-anthony-edwards`）、賽季寫成 `s=2025-26&t=playoffs`；舊格式的連結仍可開
- **單場比賽頁（Game Center）**：比分看板與每節比分常駐，下方分四頁——概要（本場焦點與 Four Factors、本場 vs 季平均、比賽資訊）／Box Score（兩隊，可切「傳統｜進階」——進階有進攻／防守／淨效率、使用率、真實命中率等，灰狼球員另有「不在場」效率；點灰狼球員展開本場進階並標出優於季平均的項目，2026-27 起）／對比（球隊對比）／投籃（本場投籃）；用賽程條換場次會停在同一頁；點指標直接看該指標逐場走勢並圈出這場
- **對戰分析（`#vs`）**：交手前瞻用。預設看近三季（本季例行賽未過半時多含一季，避免開季樣本太少），可切只看本季或指定賽季、例行／季後——
  - 首頁：對手總表（戰績、得失分、場均分差，標出**勁敵／順手／棘手**）、指標 × 對手熱圖（灰狼打各隊時哪些數據特別好或差）、單一指標排行（附 95% 波動範圍）、勝負關鍵因子（贏球和輸球時差最多的指標）、灰狼球員 × 對手（誰打哪隊特別好）
  - 單隊頁（`#vs=DEN`）：戰績與主客、最突出的 5 項、交手紀錄、全部指標、每節分差、對手打灰狼（兩隊 box 與對手球員）、灰狼球員打這隊、投籃分布；單場頁可一鍵跳到「與這隊歷次交手」
  - 排序與上色看「偏離程度」（差距 ÷ 場數造成的正常波動），只交手兩三場的極端值不會被誇大；每個數字都標場數。只用既有逐場資料計算；每節分差與對手 box 從 2025-26 起才有
- **薪資頁（Cap Sheet，`#cap`）**：分「總覽／合約／選秀權／規則」四頁——
  - 總覽：所在層級、是否鎖死在 apron（hard cap）、奢侈稅率（依繳稅紀錄自動判定是否累犯），奢侈稅薪資／apron 薪資／各門檻空間、門檻儀表、奢侈稅分級估算
  - 合約：逐年薪資總表（往後 5 季、選項與保障標記、點球員名開球員頁）、薪資結構、薪資占比 vs 貢獻占比（公式常駐、可關閉）
  - 選秀權：2027 起各年首輪／次輪狀態，可展開原文條件與出處
  - 規則：超過薪資帽／奢侈稅線／第一、第二 apron 會受到的操作限制，附出處
  - 縮寫金額滑鼠移上去顯示完整金額；資料人工整理自 Spotrac、Hoops Rumors 等公開資料，與 Spotrac 逐元對帳
- **快捷鍵**：`/` 搜尋球員／章節／賽季／最近比賽／對戰（打隊伍三碼，如 `DEN`）／薪資；數字鍵切目前畫面的分頁（主畫面 `1–6` 章節、單場頁 `1–4`、薪資頁 `1–4`）
- **複製引用**：點數字旁的「?」看定義，小卡內可一鍵複製「球員｜賽季｜截至日期｜指標 數值｜資料來源｜畫面網址」
- **聯盟名次**：全隊數據（身分列、季平均、全隊效率、Clutch、防守、Splits「全季」）下方標「聯盟第N」（30 隊，當季每日更新）；球隊 Playtype 由百分位換算名次。總覽另有「全隊效率」（OffRtg／DefRtg／NetRtg／Pace／TS% 等）
- **引用籃（貼文用純文字）**：在各頁「?」小卡「加入引用籃」收集數值或比較（Splits 期間、跨季、On/Off、單場），右下角抽屜裡排順序、把出手數＋命中率併成一行、選格式（※行首、名次、→／差值／📈📉），一鍵複製成可直接貼臉書的文字
- **指標定義**：指標旁的「?」說明定義、計算方式與資料來源
- **匯出**：表格可匯出 CSV（Excel 可直接開），圖表與表格可匯出 16:9／1:1 PNG 專欄配圖
- **加到手機主畫面**：iPhone 用 Safari「分享 → 加入主畫面」、Android 用 Chrome「安裝應用程式」，以「灰狼帳本」圖示開啟、沒有網址列
- **無障礙**：文字對比符合 WCAG AA、按鈕點擊範圍至少 24px、鍵盤操作有焦點框（PageSpeed 無障礙 100）

| 分頁 | 說明 |
|---|---|
| **總覽 (Overview)** | 近期異動（近 N 場 vs 全季，場數跟著季平均的期間）+ 季平均（可切全季／近 5 場／近 10 場；截至日期在身分列選）+ Playtype 強弱項 + 雷達 + 在場/不在場效率(On/Off) + 關鍵時刻(Clutch) + 五人陣容(Lineups) + 單場面板 |
| **Splits** | 期間篩選（全季/每月/勝敗/主客/近N場/對手/自訂區間/季後系列）→ 卡片牆（基本／進階／投籃分區／防守，該期間 vs 全季 綠紅漲跌）+ 點卡展開趨勢折線（逐場/每週/每月，逐場鋪勝負底色、點任一場看單場頁） |
| **投籃 (Shooting)** | 距離區間(5ft)/分區/出手方式卡片（命中率 + 出手佔比）+ 分區「與上季比」差異半場圖 + 受助攻比例 + 可篩選的投籃熱圖 + 命中率趨勢 |
| **防守 (Defense)** | 最近防守者（Defense Dashboard）、防守 box、對手分區命中、拼勁（干擾、地板球）、掩護與卡位（掩護助攻得分、卡位） + 防守熱圖 |
| **Playtype** | 11 種進攻 + 9 種防守戰術，Synergy 式可排序表格（Freq、Poss/G、PPP、百分位色階條、FG%），可切卡片；點類型看當季走勢 |
| **跨季比較 (Comparison)** | 賽季軌跡疊圖（各季以出賽第 N 場對齊，看今年同期 vs 往年；例行／季後跟著刊頭）+ 多選賽季 × 數據類別 → 並列終點值表格 + 逐季折線（可多選指標、疊加其他球員／全隊、指數化） |
| **雷達圖**（在總覽） | 軸可自選（3~6 個 Playtype/Tracking 指標）+ 疊加歷史賽季或同季隊友 + 自選指標比較表 |
| **歷史賽季回補** | 2022-23 起各賽季例行賽/季後賽完整終點快照（供跨季比較） |
| **中英雙語** | 中文標籤旁一律以小字保留 NBA 原文（命名對照見 doc/handover.md） |

季平均與 Splits 的百分比欄以「Σ分子/Σ分母」加權重算（非平均百分比），資料源為**逐場打包 bundle**（單一 doc，避免多次讀取）。

## 技術架構

```
wolvestracker/
├── index.html               # 前端 SPA「Wolves Ledger」(React 18 鎖版本 CDN，圖表自繪 SVG)
├── components/              # React 元件原始碼（修改後需重新 bundle）
│   ├── OverviewTab / SplitsTab / ShootingTab / ComparisonTab / RadarPanel  # 六分頁 + 雷達
│   ├── GamePage.js          # 單場比賽頁（#game=日期；也是開站首頁）
│   ├── GameCalendar.js      # 刊頭賽程月曆（整季例行＋季後，點日期開單場頁）
│   ├── CapPage.js           # 薪資頁（#cap）：計算、四分頁區塊
│   ├── MatchupHome.js / MatchupPage.js  # 對戰首頁（#vs）、單隊對戰頁（#vs=三碼）
│   ├── matchupData.js       # 對戰分析計算（範圍、對手彙整、偏離程度、標籤、勝負關鍵因子）
│   ├── SeasonPaceChart.js   # 疊圖：賽季軌跡＋通用多序列折線 LineOverlay
│   ├── gameAggregates.js    # GameAgg：逐場聚合（季平均/月/勝敗/趨勢，加權%）
│   └── gamesData.js         # 讀逐場 bundle（單一 getDoc）、比賽索引、單場文件
├── dist/                    # bundle.py 產物：components-bundle.js（預編譯 JS）、app.css（Tailwind）（勿手改）
├── styles/app.css           # Tailwind 入口
├── package.json             # 前端建置工具（esbuild、tailwindcss、resvg，鎖定版本）
├── manifest.webmanifest     # PWA 設定（加到主畫面的名稱與圖示）
├── icons/                   # 網站圖示：SVG 原稿＋各尺寸 PNG
├── scripts/
│   ├── nba_common.py        # 共用模組：連線/欄位設定表/抓取函式
│   ├── fetch_data.py        # 每日當季爬蟲 (NBA Stats API → Firebase；--games-only 只抓單場)
│   ├── watchdog.py          # 每日抓取看門狗（主排程沒完成或昨晚那場缺就補抓，桌面通知）
│   ├── backfill_games.py    # 單場逐場回補（--dates 補失敗場；--box-only 只補 box score；--adv-only 只補進階＋單場 On/Off；--clean-players 對帳剔除非當時隊員）
│   ├── backfill_history.py  # 歷史賽季完整終點快照回補
│   ├── build_bundles.py     # 逐場打包成 bundle doc（前端 Splits/總覽用）
│   ├── fetch_shotchart.py   # 投籃熱圖爬蟲（每週整季對帳；每日由 fetch_data 增量併入新場次）
│   ├── sync_salary.py       # 薪資同步（Google Sheet 發佈的 CSV → Firestore，每日排程順跑）
│   ├── build_icons.py       # 網站圖示：icons/*.svg → 各尺寸 PNG（改圖示才需要跑）
│   └── bundle.py            # 前端打包（合併 → esbuild 編譯 JSX → Tailwind 產 CSS）
├── run_fetch.bat            # Windows 排程入口（每日）
├── run_watchdog.bat         # Windows 排程入口（每日看門狗）
├── run_shotchart.bat        # Windows 排程入口（每週）
├── requirements.txt         # Python 依賴
└── doc/
    ├── test/test_cases.md   # 測試案例清單
    └── handover.md          # 交接手冊
```

### 資料流

```
NBA Stats API ──(Python, 本機排程)──▶ Firebase Firestore ◀──(JS)── index.html (GitHub Pages)
                每日 03:00（15:00 看門狗補抓）/ 每週一 14:30   Firestore lite 讀取（開站先讀近期快照）

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
| `WolvesTracker` | 每日 03:00（賽後 12 小時數據才齊；喚醒＋錯過補跑＋用電池可跑） | `run_fetch.bat`（當季數據＋薪資同步）→ `fetch_log.txt` |
| `WolvesWatchdog` | 每日 15:00（喚醒＋錯過補跑＋用電池可跑） | `run_watchdog.bat`：主排程沒完成 → 完整補抓；昨晚那場還沒進資料庫 → 只抓單場（暫定版，隔天 03:00 定稿）；有補抓或失敗才跳 Windows 桌面通知 → `watchdog_log.txt` |
| `WolvesShotchart` | 每週一 14:30 | `run_shotchart.bat` → `shotchart_log.txt` |

建立每週排程的指令（看門狗要設電池選項，改用 PowerShell `Register-ScheduledTask`，指令見 `doc/handover.md`「自動化排程」）：

```
schtasks /create /tn "WolvesShotchart" /tr "C:\wolvestracker\run_shotchart.bat" /sc WEEKLY /d MON /st 14:30
```

看門狗手動檢查：`python scripts/watchdog.py --dry-run`（只印判斷）、`--test-notify`（測試通知）。

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
- 全聯盟單次請求優先，唯一逐球員的 shotchart 降為每週執行（每日只用單場全隊查詢增量）
- `safe_col()` 防禦性欄位取值，避免 API 回傳結構變更時 crash

## License

MIT
