
# Wolves Tracker 專案快速查表

## 常用指令
- 每日抓取：`python scripts/fetch_data.py`（休賽期自動跳過；補期末快照用 `--force-type playoffs --date YYYY-MM-DD`）
- 投籃熱圖（每週）：`python scripts/fetch_shotchart.py`（跨季重跑 `--season 2024-25 --type regular`）
- 單場回補：`python scripts/backfill_games.py --season 2024-25 --type regular`（補失敗場 `--dates 2024-11-21,2025-01-09`）
- 歷史回補：`python scripts/backfill_history.py --season 2024-25 --type regular`（完整類別終點快照）
- **逐場打包**：回補 games 後跑 `python scripts/build_bundles.py --all`（前端 Splits/總覽讀 bundle）
- 前端打包：改 `components/*.js` 後必跑 `python scripts/bundle.py`（esbuild 編 JSX＋Tailwind 產 CSS＋index.html 蓋版本號；勿手改 dist/；新電腦先 `npm ci`）
- 本地預覽：`python -m http.server 8000`（Firestore 用 autoDetectLongPolling，localhost 可讀）

## 色票（灰狼新品牌，hex 直接寫在元件；改色用 sed 全域替換）
- 主色（進攻/選中/圖表主線/命中）：`#12A150`  · 結構藍（切換/連結）：`#236192`
- 底色：`#0A1626`  · 月光銀（logo 環/標題底線 `/30`）：`#C4CED2`  · 防守/未命中/負值：`#EF4444`

- 字體：`font-sans` Noto Sans TC／`font-display` Barlow Condensed（數字/標題）／`font-mono` JetBrains Mono（標籤/原文）；共用介面元件在 `components/ui.js`（`window.UI`：Section/StatCell/Ledger/PctBar/DataTable/Seg/Chip/Note），新區塊一律用它組；只給真的有 percentile 的資料畫百分位條

## 硬性約束
- 抓取邏輯與欄位對應集中在 `scripts/nba_common.py`——**新增數據改設定表（`*_FIELDS`），不要在 fetch_data.py / backfill_history.py / backfill_games.py 寫重複邏輯**
- 每日快照球員以 playerName 為 key；歷史快照以 PlayerID 為 key（前端 `normalizeHistoryPlayer` 對齊，已展開 base/tracking/shooting/clutch/defense/onoff 各類別），勿更動
- 每日文件欄位：`stats`(Synergy)/`base`/`tracking`/`shooting`/`clutch`/`defense`/`lineups`/`onoff`，新增欄位記得併入 `fetch_data.py` 的 `DATA_KEYS`（去重）
- **新 Firestore 集合必加安全規則 read 白名單**（Firebase Console，見 doc/handover.md）——已踩過多次，症狀是前端 `Missing or insufficient permissions`
- .bat 檔必須 CRLF、`chcp 65001`、無中文註解；排程用 Python 絕對路徑（`Python312`，裸 `python` 會解析到沒套件的版本）
- 不用 GitHub Actions（機房 IP 被 NBA 擋）；正式排程為 Windows Task Scheduler
- 逐球員 endpoint（shotchartdetail）只能低頻執行（每週）；games 回補分批、每場約 20 requests，避免被 NBA 封鎖（症狀是 403/429；零星 500/503 是伺服器抖動非封鎖）
- Pages 部署偶發 `Deployment failed, try again later`（GitHub 暫時性）→ `gh run rerun <id>` 重跑即可

## 前端架構（六分頁，React 18 CDN＋預編譯 JSX/Tailwind）
- `components/*.js` 掛 `window.*`，`bundle.py` 依 ORDER 串接 → esbuild（es2018、不改名識別字）→ `dist/components-bundle.js`；Tailwind CLI → `dist/app.css`。class 必須完整寫在原始碼（不可字串拼接，否則 CLI 掃不到）
- 提交前端改動要連 `dist/` 與 `index.html`（`?v=` 內容雜湊）一起提交
- 版面（無側欄）：刊頭 `Masthead`（賽季/賽別/日期/搜尋）→ 頭像列 `RosterRail`（全隊＋球員）→ 身分列 `IdentityBar` → 章節列 `ChapterNav`（sticky，含攻守）→ 六章節：總覽(`OverviewTab`，含雷達)/Splits(`SplitsTab`)/投籃(`ShootingTab`)/防守/Playtype/跨季(`ComparisonTab`)
- 網址 hash 記住畫面（`urlState.js`；有 `v=` 時完全以網址為準，不退回 localStorage 偏好）；快捷鍵 `/` 搜尋（`CommandPalette`）、`1–6` 切章節
- **資料層分工**：季平均/Splits/趨勢 → `GameAgg`(`gameAggregates.js`) 算 **bundle 逐場**（`gamesData.loadSeasonGames`，讀 `wolves_games_bundle`/`wolves_pgames_bundle` 單一 doc，避免 90+ 併發 getDoc 卡死）；Playtype/Clutch/Lineups/On-Off/防守 → 每日/歷史快照；投籃 → `wolves_shotcharts` 逐球
- 季平均加權：百分比欄以 Σ分子/Σ分母 重算（`GameAgg.RATIO_DEFS`），非平均百分比
- 賽別切換(例行/季後，預設依時節) + 日曆日期(截至該日季平均) 在刊頭；雷達軸自選在 `RadarPanel`

## 規格文件
- `doc/handover.md`：交接手冊（架構/排程/資料結構/FAQ）
- `README.md`：對外說明
