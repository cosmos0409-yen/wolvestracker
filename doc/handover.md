# Wolves Tracker 交接手冊

> 最後更新：2026-10-14（**Wolves Ledger 改版完成**：Phase 0–7，見「2026-10 Wolves Ledger 改版」；Phase 6 的效能／無障礙規範見「效能與無障礙」）

## 已完成項目

| # | 項目 | 狀態 | 說明 |
|---|---|---|---|
| 1 | Firebase 整合 | ✅ | 前端以 `onSnapshot`（當季）+ `getDoc`（歷史）讀取 Firestore |
| 2 | Python 爬蟲腳本 | ✅ | `scripts/fetch_data.py`，含 11 PlayType + 6 Tracking |
| 3 | 前端 UI 全面改寫 | ✅ | 雷達圖、Tracking 卡片、球員頭像、賽季標籤 |
| 4 | 反爬蟲機制 | ✅ | curl_cffi 瀏覽器 TLS 模擬 + retry |
| 5 | 賽季類型自動判斷 | ✅ | `get_season_type()`（後端）+ `getSeasonPhase()`（前端） |
| 6 | Windows 排程器自動執行 | ✅ | 每日 14:00 抓當日（`WolvesTracker`）、每週一 14:30 抓熱圖（`WolvesShotchart`）；詳見「自動化排程」 |
| 7 | `seasonType` / `season` 欄位 | ✅ | 所有文件含「例行賽 / 季後賽」標籤 |
| 8 | **Phase 0：前端元件拆檔（bundle 模式）** | ✅ | components/ 9 檔；`scripts/bundle.py` 合併為 `dist/components-bundle.js` |
| 9 | **Phase 1：歷史賽季回補** | ✅ | 22-23 / 23-24 / 24-25 × 例行 / 季後 共 12 個 history 文件 |
| 10 | **Phase 1：寫入前去重** | ✅ | `fetch_data.py` 比對前一筆，相同則跳過寫入 |
| 11 | **Phase 1：歷史標籤清理** | ✅ | `cleanup_and_tag.py` 補貼舊文件 `seasonType` 並刪重複日 |
| 12 | **Phase 2：賽季標籤 + 篩選 + 中英對照** | ✅ | Header 動態標籤、Modal 賽季篩選、Tracking 中英對照 |
| 13 | **Phase 2：陳舊資料 / 休賽期警告** | ✅ | 賽季期間檢查、休賽期靜態提示 |
| 14 | **Phase 3：賽季選擇器 + localStorage 快取** | ✅ | SeasonPicker 下拉 + history doc 永久快取 |
| 15 | **Phase 3：跨賽季雷達 overlay** | ✅ | 球員模式可疊加最多 3 賽季雷達 |
| 16 | **Phase 3：卡片 Modal 跨賽季比較分頁** | ✅ | 每張卡片可切「當季走勢 / 跨賽季比較」，後者表格 + 折線 |
| 17 | **Phase 3：例行賽 / 季後賽 tab 切換** | ✅ | 當季走勢分頁依當前日期預設例行 / 季後 |
| 18 | **爬蟲重構：共用模組 + 設定表** | ✅ | `scripts/nba_common.py`；欄位對應改 `TRACKING_FIELDS` 等設定表，fetch/backfill 共用 |
| 19 | **籃板完整欄位 + REB_COL_PCT 修復** | ✅ | 擴至 9 欄；API 欄名已改為 `REB_CHANCE_PCT`（舊 `REB_COLLECT_PCT` 不存在導致一直是 0） |
| 20 | **投籃 / Clutch / 陣容每日抓取** | ✅ | shotlocations + ptshot + clutch + lineups，每日 +7 個 request |
| 21 | **投籃熱圖（每週）** | ✅ | `fetch_shotchart.py` 逐球員出手座標 → `wolves_shotcharts`；前端 SVG 半場圖 |
| 22 | **移除 GitHub Actions 遺留** | ✅ | 刪除 `nba_update.yml`（datacenter IP 被擋，實際早已改用本機排程） |
| 23 | **配色改版（灰狼新品牌）** | ✅ | 翠綠 `#12A150`（官方 Aurora Green 提亮版）+ 午夜藍底 `#0A1626` + 月光銀 `#C4CED2`；取代舊萊姆綠 |
| 24 | **防守數據（每日）** | ✅ | 對位防守 `leaguedashptdefend` + Hustle + 防守 box + 對手分區；`nba_common.py` 4 支 `fetch_*` + 設定表 |
| 25 | **防守側前端** | ✅ | 修進攻/防守不對稱；`defenseDefs`/`oppZonesDefs`；`doc.defense` 欄位 |
| 26 | **球隊投籃熱圖** | ✅ | `fetch_shotchart.py` `PlayerID=0` 全隊 → `wolves_shotcharts/TEAM_*`；`ShotChart teamMode` |
| 27 | **防守熱圖** | ✅ | `DefenseHeatmap.js` 半場 5 區依「對手命中率 − 該區聯盟均值」著色 |

---

## 2026-07 六分頁大改版（現行架構）

一次把 UI 從「單頁長捲軸」改為**右欄六分頁**，並讓多數數據改由**單場資料**計算，而非只看整季累積快照。

### 後端變更
- **`nba_common.py`**：新增 `BASE_FIELDS`（傳統基本數據 + GP/W/L）、`ONOFF_FIELDS`、`ASSISTED_FIELDS` 設定表 + `fetch_base_box` / `fetch_onoff` / `fetch_assisted_pct` / `fetch_team_game_log`；並補齊 Drives/CatchShoot/PullUp/對位防守的**分子分母欄位**（供前端加權重算 %）。
- **`fetch_data.py`**：每日快照加 `base`（整季總計）+ `onoff`；`capture_single_game` 加 base 欄、matchup/wl、每日重建 `wolves_games_index`；加 `--force-type/--date`（繞過休賽期補期末快照）。
- **`backfill_games.py`**：`--min-gp 0`（全名單）、管線加 `fetch_base_box`、加 `--dates`（補失敗場）。
- **`backfill_history.py`**：從只抓 Synergy+Tracking **擴充為完整類別**終點快照（base/tracking/shooting/clutch/lineups/defense/onoff）；已回補 2022-23~2025-26 × 例行/季後。
- **`fetch_shotchart.py`**：每球加存 `ACTION_TYPE`（出手方式）、`GAME_DATE`（正規化，`gameDates` 索引）；加 `assisted`（受助攻比例）；加 `--season/--type`。
- **`build_bundles.py`（新）**：把每季逐場濃縮成 bundle doc——球隊 1 份（`wolves_games_bundle/{s}_{t}`）、**逐球員各 1 份**（`wolves_pgames_bundle/{s}_{t}_{playerId}`，因整季 15 人一份超過 Firestore 1 MiB）。每場統一 `{date,matchup,wl,stats}`。
- **`index.html`**：Firestore 改 `initializeFirestore(..., autoDetectLongPolling)`（WebChannel 被擋環境退回長輪詢，修 localhost 讀取卡死）。

### 前端變更（`components/`）
- 新元件：`OverviewTab` / `SplitsTab` / `ShootingTab` / `ComparisonTab` / `RadarPanel` / `gameAggregates.js`(`GameAgg`) / `gamesData.js`。
- **資料層分工**：
  - 季平均 / Splits / 趨勢折線 → `GameAgg` 算 **bundle 逐場**（`gamesData.loadSeasonGames` 讀單一 bundle doc；百分比欄以 Σ分子/Σ分母 加權，見 `GameAgg.RATIO_DEFS`）。
  - Playtype / Clutch / Lineups / On-Off / 防守 → 每日或歷史**快照**。
  - 投籃 → `wolves_shotcharts` 逐球（前端算距離區間/分區/出手方式）。
  - 跨季比較 → `wolves_*_history` 各季終點快照（`ComparisonTab` + `loadHistoryByDocId`）。
- header：賽別切換（例行/季後，預設依時節）+ **日曆日期**（選到哪天 → 總覽顯示截至該日季平均，`GameAgg.seasonToDate`）。取代原 ‹ › 翻頁與 `viewIndex`。
- `RadarPanel`：軸可自選 3~6 個（localStorage 記憶）+ 疊加 chips 搬到雷達下方 + 自選指標比較表。
- `normalizeHistoryPlayer` 擴充：各類別皆以球員名展開（不只 stats/tracking）。
- `HistoryModal` 縮減為僅當季走勢（跨賽季已由跨季分頁取代）。

### 已知資料缺口 / 後續
- **2023-24 / 2022-23 逐場 games 未回補**（跨季比較用 history 快照不受影響，但那兩季的 Splits/投籃趨勢無資料）。要補：`backfill_games.py` 分批 + `build_bundles.py --all` + `fetch_shotchart.py` 已補。
- **fetch_data 未瘦身**：每日 tracking（雷達用）/defense（防守分頁用）仍需要；只有 shooting 真正沒用（省 1-2 requests，不值得砍）。防守分頁的 defense_box/對手分區不在 games 內，故防守維持快照。
- **2025-26 當季每日快照的類別不齊**：base/shooting/clutch/lineups/defense/onoff 是賽季中途才加進抓取，例行賽只有 2026-04-14（2026-10 以 `fetch_data.py --force-type regular --date 2026-04-14` 補寫完整期末快照）、季後賽只有 2026-05-15 / 06-15 有完整類別。前端防守分頁遇缺會說明並提供「改看 {最近有資料日期}」按鈕；新賽季起每日快照皆完整，不再有此問題
- 排程環境：`.bat` 用 Python312 絕對路徑（裸 `python` 會抓到沒 curl_cffi 的版本）。

---

## 進行中優化計畫

詳見 `doc/plan.md`。

| Phase | 內容 | 狀態 |
|-------|------|------|
| Phase 0 | 前端元件拆檔（bundle 模式） | ✅ 完成 |
| Phase 1 | 歷史賽季數據回補（22-23 至 24-25） | ✅ 完成 |
| Phase 2 | UI 賽季標籤、分類篩選、Tracking 中英對照 | ✅ 完成 |
| Phase 3 | 跨賽季比較功能 | ✅ 完成 |
| Phase 4 | 行動裝置響應與細節優化 | ✅ 完成 |

（2026-07 後續批次：配色改版、防守數據、球隊/防守熱圖、球員互相比較、休賽期標示、單場數據回補+面板——詳見「已完成項目」23–27 與「給下一位 Agent 的維護重點」。）

### 2026-10 Wolves Ledger 改版（專欄研究工具重設計）

定位：使用者寫灰狼專欄時查資料用的研究工具；品質標竿為 Synergy（密集可排序表格）與 BBall Index（百分位色條、一眼看出強弱）。計畫檔：`~/.claude/plans/partitioned-knitting-fog.md`。

| Phase | 內容 | 狀態 |
|-------|------|------|
| 0 | 數據命名精準度修正（見「指標命名對照」） | ✅ |
| 1 | 預編譯建置（esbuild＋Tailwind CLI，移除瀏覽器內 Babel／Tailwind CDN） | ✅ |
| 2 | 設計系統 `components/ui.js` | ✅ |
| 3 | 版面骨架（刊頭／頭像列／身分列／章節列）＋網址狀態＋快速搜尋 | ✅ |
| 4 | 各章節內容重排（Synergy 式 Playtype 表、強弱項等） | ✅ |
| 5 | 寫作工具（複製引用、指標定義、近期異動、CSV／PNG 匯出） | ✅ |
| 6 | 品質迭代：首屏只讀近期快照、移除阻斷載入、對比 AA、觸控目標、總覽近 N 場 | ✅ |
| 7 | 更新規格文件、清理暫存 | ✅ |

Phase 6 結果（PageSpeed 手機）：無障礙 97→**100**、總傳輸 11.3 MB→約 3.2 MB、SEO 100、最佳做法 96。效能分數見「常見問題：PageSpeed 效能分數」。

---

## 專案檔案結構

```
wolvestracker/
├── index.html                       ← HTML 骨架 + Firebase 初始化，引用 dist/components-bundle.js
├── components/                      ← React 元件原始碼（編輯這裡）
│   ├── Icons.js                     ← SVG icon set，掛 window.Icons
│   ├── ui.js                        ← 設計系統 window.UI（StatCell/Ledger/DataTable/Seg/Section/PctBar、複製引用、匯出）
│   ├── glossary.js                  ← 指標定義 window.GLOSSARY（「?」小卡內容）
│   ├── constants.js                 ← 標籤與 defs / SEASON_OPTIONS / getSeasonPhase / 快照讀取範圍（SNAPSHOT_SINCE/UNTIL、snapshotWindowStart）
│   ├── MetricComponents.js / PlayTypeCard.js / PlaytypeSection.js / TrackingCardRow.js
│   ├── ShotChart.js / DefenseHeatmap.js ← 投籃熱圖、防守熱圖
│   ├── gameAggregates.js / gamesData.js ← GameAgg 逐場重算、bundle 載入
│   ├── SingleGamePanel.js / Highlights.js ← 單場面板、近期異動
│   ├── OverviewTab.js / SplitsTab.js / ShootingTab.js / ComparisonTab.js / RadarPanel.js / HistoryModal.js
│   ├── urlState.js                  ← 網址 hash 讀寫
│   ├── Masthead.js / RosterRail.js / IdentityBar.js / ChapterNav.js / CommandPalette.js ← 版面骨架與快速搜尋
│   └── App.js                       ← 主容器：資料訂閱、狀態、版面組裝
├── styles/app.css                   ← Tailwind 入口＋全站基礎樣式（背景、焦點框、減少動態）
├── tailwind.config.js               ← 字體、slate-500/600 對比調整
├── package.json / package-lock.json ← 鎖定 esbuild、tailwindcss 版本（npm ci）
├── dist/
│   ├── components-bundle.js(.map)   ← 自動產生，勿手改
│   └── app.css                      ← 自動產生，勿手改
├── scripts/
│   ├── nba_common.py                ← 共用模組：SESSION/重試/欄位設定表/所有抓取函式
│   ├── fetch_data.py                ← 每日當季數據爬蟲（含寫入前去重）
│   ├── backfill_history.py          ← 歷史賽季回補腳本（import nba_common）
│   ├── fetch_shotchart.py           ← 投籃熱圖爬蟲（每週，逐球員 + 全隊）
│   ├── backfill_games.py            ← 單場數據回補（DateFrom=DateTo 逐場；--index-only 產索引）
│   ├── backfill_queue.txt           ← 回補佇列（已清空）
│   ├── cleanup_and_tag.py           ← 一次性：補貼舊文件 seasonType、刪除完全相同的後續日期
│   └── bundle.py                    ← 前端打包（合併＋esbuild＋Tailwind＋版本號）
├── run_fetch.bat                    ← Windows 排程：當日數據
├── run_shotchart.bat                ← Windows 排程：每週投籃熱圖
├── run_backfill_next.bat            ← Windows 排程：回補 queue 第一行（已可刪）
└── doc/
    ├── handover.md                  ← 本文件
    └── plan.md                      ← 4 階段執行計畫
```

---

## 開發工作流程

### 編輯前端
0. 新電腦第一次：專案根目錄跑 `npm ci`（依 `package-lock.json` 安裝鎖定版本的 esbuild / tailwindcss 到 `node_modules/`，不進版控）
1. 改 `components/*.js`
2. `python scripts/bundle.py` 重新打包（合併 → esbuild 編譯 JSX → Tailwind 產 CSS → 蓋版本號）
3. `python -m http.server 8000` 啟動本地伺服器
4. 瀏覽器開 `http://localhost:8000`，Ctrl+F5 強制重整
5. 確認無誤後 commit `components/`、`dist/`（`components-bundle.js`、`.map`、`app.css`）與 `index.html`，推送 GitHub Pages
   - `bundle.py` 每次會把產物內容雜湊寫進 `index.html` 的 `components-bundle.js?v=…`、`app.css?v=…`（Pages 一律快取 10 分鐘，不加版本號會出現「新 HTML＋舊檔」）——所以 `index.html` 也會有 diff，記得一起提交

### 前端建置（2026-10 起預先編譯）
- 以前：瀏覽器載入 Babel Standalone（約 2.3 MB）即時編譯 JSX、Tailwind CDN（約 400 KB）即時產 CSS。現在兩者都在 `bundle.py` 事先做完，首次造訪少下載約 667 KB（壓縮後），掛載時間約 740ms → 約 100ms
- `dist/components-bundle.js`：esbuild `--target=es2018`（`?.`／`??` 會降級，舊手機也能跑），只壓空白與語法、**不改名識別字**（元件靠頂層名稱與 `window.*` 互相引用）；`.map` 供除錯對照原始碼
- `dist/app.css`：Tailwind 3 CLI 掃 `components/**/*.js` 與 `index.html`，只輸出用到的 class。**class 必須完整寫在原始碼**，不可字串拼接（`text-${c}-400` 會掃不到）
- `index.html` 的 bundle 用 `<script defer>`：與 `type="module"` 的 Firebase 初始化同屬「解析完依序執行」，保證元件在 Firebase 之後執行
- 合併後未編譯的 JSX 暫存在 `.build/`（不進版控）

### 版面骨架與網址狀態（2026-10 Phase 3）
- 由上而下：`Masthead`（Wolves Ledger 字標、期別行、賽季下拉／例行·季後／截至日期／搜尋）→ 休賽/陳舊細條 → `RosterRail`（全隊＋球員頭像 chips，尾端「本季無數據」淡色 chips 沿用 `jumpToPlayerHistory` 探測）→ `IdentityBar`（4 個主數字，與總覽同源 `GameAgg.seasonToDate`）→ `ChapterNav`（sticky，01–06 章節＋攻守）→ 內容
- 舊左側欄已移除；雷達＋疊加比較由 App 組成 `radarSlot` 傳入 `OverviewTab`
- 網址 hash（`components/urlState.js`）：`#v=player&p=名字&tab=shooting&s=2024-25_playoffs&t=playoffs&d=2026-06-15&side=def`，只寫非預設值；**有 `v=` 時完全以網址為準**，沒寫的項目＝預設（當季/總覽/進攻/最新日），不退回 localStorage——否則同一條連結會因電腦不同而開出不同畫面
- 網址帶日期時用 `pendingDateRef` 延後套用：資料載入 effect 一開始會清空 `selectedDate`
- 狀態變動用 `history.replaceState`（不產生瀏覽紀錄）；同分頁貼上新連結靠 `hashchange` 套用
- 快捷鍵：`/` 開 `CommandPalette`（球員/章節/賽季/攻守/賽別，比對走 `nameKey`）、`1–6` 切章節；輸入框聚焦或 Modal 開著時不攔截

### 寫作工具（2026-10 Phase 5）
- **複製引用**：`UI.CopyBtn` + `UI.citeLine`，格式「主體｜賽季｜（期間）｜截至日期｜指標（原文） 數值｜資料：來源｜當下畫面網址」（網址含 hash，可從引用回到原畫面查證；總覽「近 N 場」切換不在網址裡，但期間已寫在引用文字中）。情境由 App 每次 render 寫入 `window.CiteCtx`：**快照數字引用快照日（asOfSnap）、GameAgg 逐場重算的平均引用截至日（asOfAgg）**，兩者可能不同；Splits/單場/Clutch 以 `citeNote` 附期間或場次。`StatCell` 的 `citeAsOf`／`citeNote` 由 `TrackingCardRow` 傳入
- **指標定義**：`components/glossary.js`（`window.GLOSSARY`，key → def/calc/src/verify），`UI.Info` 顯示「?」小卡；名稱仍以 constants.js 為單一來源，glossary 只寫意思。`verify: true` 的條目畫面會標「待確認」
- **近期異動**：`components/Highlights.js`，近 5/10 場 vs 全季（截至 untilDate），排序＝|Δ| ÷ (逐場標準差 ÷ √N)，|分數| < 1 不列；命中率需近 N 場出手達門檻（FG 25、3P 10、FT 8）
- 刊頭「複製連結」＝複製含 hash 的目前網址
- **匯出**（`UI.ExportMenu`／`exportCSV`／`exportPNG`）：表格（Playtype、陣容、跨季比較、Splits、投籃分區）可匯出 CSV（第一列為出處、UTF-8 BOM 供 Excel）；投籃分布、雷達、趨勢圖與表格可匯出 PNG 配圖（16:9＝1600×900、1:1＝1080×1080，含字標／標題／主體·賽季·日期／來源）
  - `html-to-image@1.11.13`（jsDelivr）只在第一次匯出時載入
  - 配圖不放 NBA Logo／頭像：跨網域圖片會讓畫布無法輸出，也避免在配圖上用官方商標
  - 踩過的雷：配圖根節點不可 `position:fixed`+負座標（會整張空白）→ 外層 holder 負責藏到畫面外
  - 匯出時移除複製鈕、「?」與 `data-export-hide` 標記的元素

### 設計系統（2026-10，`components/ui.js` → `window.UI`）
- 字體：`font-sans`＝Noto Sans TC（內文/中文）、`font-display`＝Barlow Condensed（大數字/標題）、`font-mono`＝JetBrains Mono（小標籤/NBA 原文/表格數字），定義在 `tailwind.config.js`，字型檔由 `index.html` 的 Google Fonts 載入
- 背景：底色 `#0A1626`＋刊頭淡光暈＋極淡顆粒，寫在 `styles/app.css` 的 `@layer base`
- 元件：`UI.StatCell`（指標格，數值三態：0 照常顯示／無資料「—」／不適用「—」+ tooltip）、`UI.Ledger`＋`UI.ledgerCols(n)`（細線數據表，依指標數選能整除的欄數）、`UI.PctBar`（百分位色階條，紅→月光銀→綠；**只給真的有 percentile 的資料**）、`UI.Delta`（漲跌）、`UI.DataTable`（可排序表格，手機首欄固定且限寬換行）
- Phase 4 補：`UI.Section`（區塊標題＋小字原文＋說明＋右側操作，accent 色標保留舊色條語意：攻綠/守紅/Clutch 琥珀/結構藍）、`UI.Note`（空狀態）、`UI.Chip`／`UI.selectClass`（篩選膠囊）
- 新區塊一律用這些元件組，標籤寫「中文＋小字原文」，風格自動一致

### 各章節（2026-10 Phase 4）
- 總覽：季平均可切「全季｜近 5 場｜近 10 場」（同一截至日，`GameAgg.lastN`＋`aggregate`；全季只列身分列沒有的 6 項，近 N 場列完整 10 項）；**Playtype 強弱項**（Synergy 百分位，門檻每場球權 ≥ 1.0、排除 Misc；強項只列 ≥ 50、弱項只列 < 50——攻守百分位皆越高越好，已用資料驗證：防守 PPP 越低百分位越高）；雷達移入；On/Off 顯示「在場 − 離場」差值；陣容手機只顯示姓氏
- Playtype：`PlaytypeSection.js`，預設 Synergy 式可排序表格（Freq/Poss/PPP/百分位/FG%），可切卡片（`wt_pref_playtypeView`）
- 投籃：命中率格可點看趨勢；熱圖命中＝實心綠點、未中＝空心紅環，球場線月光銀畫在點下方
- 防守熱圖：顏色為「不透明預混色」（`blend()`），避免各區半透明疊色互相污染；基準值 `ZONE_REF` 為寫死的聯盟約略均值，畫面上會直接標出，**非官方即時數字**
- 走勢 Modal：賽別預設沿用刊頭的例行/季後（舊版用日期判斷，休賽期誤設例行賽）；Esc 關閉；「近 N 筆」（每筆是一份快照，不一定是一場比賽）
- 雷達關閉進場動畫（使用者不要進場動畫，且截圖/切換時圖形不會只畫一半）
- 當季快照訂閱：略過「fromCache 且為空」的 snapshot——斷網時 Firestore 會先丟本機空結果，不可顯示成「當季尚無快照資料」
- 已知資料缺口：2025-26 球員季後賽 06-15 快照的 Playtype `freq`（POSS_PCT）NBA 全回 0 → 前端視為「未提供」顯示「—」，**不自行用 possTotal 推算**（NBA 不列低球權類型，推算值失真）

### 效能與無障礙（2026-10 Phase 6）
- **當季快照先只讀近期**（`App.js` 的 `snapFull`／`snapFullReady`，`constants.js` 的 `snapshotWindowStart()`）：
  - 開站只讀最近幾天：賽季中＝今天往前 10 天；休賽期＝6/30 往前 30 天。整季約 120 份、首次傳輸近 9 MB，第一屏只需要「當期＋前一期」
  - 何時補讀整季：選了日期、開走勢 Modal、目前賽別在近期快照裡不足兩份、或近期查詢回 `failed-precondition`（缺索引）
  - 補讀期間顯示載入骨架，**不可**顯示「沒有快照」，也不可把最新一天的數字標成所選日期（`showSkeleton` 的兩個條件）
  - 只用 doc id 範圍查詢：`orderBy(documentId,'desc')`／`limitToLast` 需要 `__name__` 降冪索引，已實測會被拒
  - 權限或網路錯誤**不**改讀整季（改讀也不會好），照常顯示錯誤
- **不擋首屏**：React／Recharts／prop-types 用 `<script defer>`（與 module 型 Firebase 初始化、bundle 同屬依序執行佇列，順序不變）；Google Fonts 用 `rel="preload" onload` 非阻斷載入＋`<noscript>` 退路
- **對比（WCAG AA，小字 ≥ 4.5:1）**：`tailwind.config.js` 把 slate-500 改 `#8493A8`、slate-600 改 `#7C8CA2`（原生值在 `#0A1626` 上只有 3.8／2.4）。全站 slate-500/600 只當文字色用；若要拿來當底色或框線，先確認不受影響
  - 品牌色當底時字用深藍 `#0A1626`（白字在綠底 3.4、紅底 3.8 皆不足）；品牌色字配同色淡底用 `/[0.08]`
  - 結構藍 `#236192` 在深底只有 2.8，不可當小字色；連結改用月光銀
- **觸控目標 ≥ 24×24 且不重疊**（PageSpeed 量的是按鈕本身的框，不算 `::before` 外擴）：
  - `UI.Info`（「?」）按鈕本身 24px、內圈 16px，只用上下負邊距，**不可用左右負邊距**（會壓到相鄰複製鈕／排序鈕）
  - `StatCell` 標題列右側留 `pr-8`，避開右上角複製鈕
  - 表頭排序鈕 `min-h/min-w-[24px]`；小按鈕用 `py-1` 補高度
- 鍵盤焦點：`styles/app.css` 的 `:focus-visible` 綠框；`prefers-reduced-motion` 時關過場動畫
- **驗證方式**（無自動化測試，皆手動執行）：
  1. `python scripts/bundle.py` 後用本地 `python -m http.server 8000`
  2. 背景 Chrome（Node 內建 WebSocket＋CDP）跑情境腳本：桌面 1440／手機 375–412 截圖、讀 DOM 斷言、console 錯誤
  3. 無障礙：逐一文字節點算對比（含疊加的半透明底）、找無名稱按鈕、檢查按鈕框大小與重疊
  4. 效能：CDP 加慢速 4G（1.6 Mbps、150ms）＋CPU 4 倍降速，量 `first-contentful-paint`／LCP 與各網域傳輸量
  5. 上線後用 PageSpeed Insights（網頁版；API 匿名額度為 0）看無障礙與總傳輸量
  - 測試腳本放在 session scratchpad，未進版控；重建時照上述方法即可

### bundle.py 合併順序
見 `scripts/bundle.py` 的 `ORDER`（依賴者在後，`App.js` 最後）。元件靠共用 script scope 與 `window.*` 互相引用，所以順序就是依賴順序。

---

## 自動化排程（Windows Task Scheduler）

| 排程名稱 | 時間 | 腳本 | 用途 | Log |
|---|---|---|---|---|
| `WolvesTracker` | 每日 14:00 | `run_fetch.bat` | 抓當日數據；若與前一筆完全相同則跳過寫入 | `fetch_log.txt` |
| `WolvesShotchart` | 每週一 14:30 | `run_shotchart.bat` | 逐球員投籃座標（整季覆寫） | `shotchart_log.txt` |

（`WolvesBackfill` 已刪除；backfill queue 完成後不再需要）

**建立 / 手動執行**：
```powershell
schtasks /create /tn "WolvesShotchart" /tr "C:\wolvestracker\run_shotchart.bat" /sc WEEKLY /d MON /st 14:30
schtasks /run /tn "WolvesTracker"
schtasks /run /tn "WolvesShotchart"
```

**失敗排查**：log 內搜尋 `[FAILED]`——重試 3 次耗盡的項目會印此標記並帶著部分資料繼續，缺哪一項一目了然。

### .bat 檔注意事項
- 必須是 **CRLF** 換行（LF 會讓 cmd 把多行視為一條長指令）
- 開頭必須有 `chcp 65001 > nul` 切 UTF-8，否則中文路徑/字串會以 cp950 解析爆炸
- 內容**不能含中文註解**（會被 cmd 解析）
- Python 腳本前綴 `set PYTHONIOENCODING=utf-8` 才能正確輸出中文

---

## Firebase 設定

### Firestore 安全規則

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /wolves_team_stats/{date}        { allow read: if request.auth != null; allow write: if false; }
    match /wolves_player_stats/{date}      { allow read: if request.auth != null; allow write: if false; }
    match /wolves_team_history/{docId}     { allow read: if request.auth != null; allow write: if false; }
    match /wolves_player_history/{docId}   { allow read: if request.auth != null; allow write: if false; }
    match /wolves_shotcharts/{docId}       { allow read: if request.auth != null; allow write: if false; }
    match /wolves_player_games/{date}      { allow read: if request.auth != null; allow write: if false; }
    match /wolves_team_games/{date}        { allow read: if request.auth != null; allow write: if false; }
    match /wolves_games_index/{docId}      { allow read: if request.auth != null; allow write: if false; }
    match /wolves_games_bundle/{docId}     { allow read: if request.auth != null; allow write: if false; }
    match /wolves_pgames_bundle/{docId}    { allow read: if request.auth != null; allow write: if false; }
  }
}
```

> ⚠️ 新增集合時必須同步在 Firebase Console 加上對應 match 並重新發佈，否則前端會報 `Missing or insufficient permissions`。

### API Key Referrer 白名單（Google Cloud Console）

到 https://console.cloud.google.com/apis/credentials → 編輯 Browser API key → HTTP referrers，須包含：
- `http://localhost:8000/*`（本地開發）
- `http://localhost/*`
- GitHub Pages 網域

少了 localhost 會出現 `auth/requests-from-referer-...-are-blocked`。

### 服務帳戶（寫入用）
- Firebase Console → 專案設定 → 服務帳戶 → 產生新的私密金鑰
- 下載的 JSON 放在本機（**絕對不要 commit**），檔名 `firebase-key.json` 放專案根目錄

---

## Firebase 資料結構

### 每日快照（`fetch_data.py` 寫入）
```
wolves_team_stats/{YYYY-MM-DD}
wolves_player_stats/{YYYY-MM-DD}
```
欄位：`date`, `seasonType`, `type`, `timestamp`, `stats`, `tracking`, `shooting`, `clutch`, `defense`, `lineups`（lineups 僅球隊文件）

球員以 **playerName** 為 key（每日快照沿用舊結構）；`tracking` / `shooting` / `clutch` / `defense` 皆為 `{playerName: {...}}` 同構。
- `defense`（球員）= 對位防守 + Hustle + 防守 box 合併；`defense`（球隊）= Hustle + 防守 box + 對手分區（`*_OPP_FG_PCT` 等扁平欄位）。

### 投籃熱圖（`fetch_shotchart.py` 寫入，每週）
```
wolves_shotcharts/{playerId}_{season}_{regular|playoffs}   例：1630162_2025-26_regular
wolves_shotcharts/TEAM_{season}_{regular|playoffs}         全隊出手（PlayerID=0，前端球隊熱圖用）
```
欄位：`playerId`, `playerName`, `season`, `seasonType`, `timestamp`, `shots[]`（每筆 `{x, y, made, dist, zone}`，座標單位 0.1 呎、籃框在原點）。整季覆寫，非每日快照。全隊約 7,000+ 點、約 0.5 MB（單文件上限 1 MiB）。

### 單場數據（`backfill_games.py` 回補 / `fetch_data.py` 每日順抓，G2/G3）
```
wolves_player_games/{YYYY-MM-DD}   球員單場（僅輪換 GP>=20；欄位 players:{name:{...}}）
wolves_team_games/{YYYY-MM-DD}     球隊單場（stats:{...}）
```
含 Tracking(6) + 對位防守 + Hustle + 分區投籃的單場值（`DateFrom=DateTo` 抓）。不含 Clutch（單日不穩）與 Synergy（不支援日期）。
- **PlayType 單場**只能由每日快照的 Synergy 整數總量相減還原：`stats[]` 每項含 `gp/possTotal/ptsTotal/fgmTotal/fgaTotal`（`fetch_synergy_data` 已改 `PerMode=Totals`，顯示用 `poss` 由總量/GP 推導，比率不變）。兩份 GP 差=1 的快照相減得單場；PERCENTILE 無法還原。
- **每日補抓（2026-10 起）**：`fetch_data.py` 的 `capture_recent_games()` 每次執行都讀 `teamgamelog`（只列已完賽場次），檢查最近 5 場（`CAPTURE_LOOKBACK_GAMES`）在 `wolves_player_games` 是否缺漏或 `partial=True`，逐場以**賽程上的比賽日期**擷取，並增量更新 bundle（`build_bundles.upsert_game`）與 `wolves_games_index`。不可改回用「執行當天日期」：排程在台北 14:00＝美東凌晨，當天日期永遠是比賽隔天，查單場會落空（舊版 `capture_single_game` 即此問題，從未成功寫入過）。
- 單場文件多兩個欄位：`partial`（base 有資料但 tracking/hustle 等來源缺，NBA 單場資料偶爾晚更新）與 `captureTries`；partial 場次下次執行自動重抓，最多 3 次（`CAPTURE_MAX_TRIES`）。漏跑幾天也會自動補（5 場內）。
- 單場抓取邏輯集中在 `nba_common.fetch_single_game()`，`backfill_games.py` 與每日共用。
- 前端單場面板（G-c）已完成：`SingleGamePanel.js` 選日期看單場，只渲染有資料的群組（單場無 ShotProfile/DefenseBox/PlayType）；日期選單讀 `wolves_games_index/{season}_{type}`（一份 doc，`backfill_games.py --index-only` 產生）。

### 歷史賽季快照（`backfill_history.py` 寫入）
```
wolves_team_history/{season}_{type}      例：2022-23_regular
wolves_player_history/{season}_{type}    例：2023-24_playoffs
```
球員以 **PlayerID** 為 key，含 `playerName`、`isCurrentRoster`、`stats[]`、`tracking{}`。

前端 `App.js` 內 `normalizeHistoryPlayer()` 把 PlayerID-keyed 結構轉成 playerName-keyed，與每日快照相容。

### 寫入前去重
`fetch_data.py` 寫入前會抓最近 14 天最新一筆，深度比對 `DATA_KEYS`（stats / tracking / shooting / clutch / lineups / defense），完全相同則跳過寫入避免堆積無意義文件。

### Firestore 免費方案（Spark）用量
按「文件讀寫次數」計費，非大小。新增數據是往同一份每日文件加欄位（非新增文件），故寫入次數不變（每天約 2 份 + 熱圖每週約 19 份）。球員每日文件約 52 KB（單文件上限 1 MiB 的 5%），一整季約 4.7 MB（儲存上限 1 GiB）。唯一隨流量成長的是「讀取次數」：前端開站只讀近期快照（約 10–15 份），需要整季時才讀整個當季 collection（約 120 份），個人用量離 50,000/天 很遠。

---

## 配色（灰狼新品牌，2026-07 改版）

色值目前以 hex 直接寫在各元件（Tailwind arbitrary values），未抽 CSS 變數。要改配色用 `sed` 全域替換 + 對照下表。

| 用途 | 色碼 | 說明 |
|---|---|---|
| 主色（進攻/選中/圖表主線/命中） | `#12A150` | 官方 Aurora Green 提亮版（官方 `#009A4C` 深底小字偏暗） |
| 結構藍（球隊/球員切換、連結） | `#236192` | Lake Blue |
| 底色 | `#0A1626` | 午夜藍（`index.html` body + loading） |
| 月光銀（logo 環、區塊標題底線） | `#C4CED2` | 標題底線用 `border-[#C4CED2]/30` |
| 防守/未命中/負值 | `#EF4444` | 功能色（非品牌） |

> header logo 圖仍是舊 Logo（`i.imgur.com/HSY3cX7.png`）；要換新 Logo 需一張透明 PNG（不宜熱連 IG CDN）。

---

## 前端架構重點

### 賽季模式（`selectedSeasonKey`）
- `'current'`：當季 onSnapshot 兩個集合（先近期、需要時整季，見「效能與無障礙」），date 為實際日期，刊頭日曆選日期
- 其他（如 `'2024-25_playoffs'`）：history mode，`getDoc` 一次拿賽季終點快照，date 顯示賽季 label，日期切換隱藏

### localStorage 快取
- key：`wt_history_{season}_{type}`（如 `wt_history_2024-25_playoffs`）
- 存 `{ team, player }` 原始 doc，永不過期
- 切換到歷史賽季優先讀 localStorage；讀到才呼 Firestore（Iter 1）
- 跨賽季比較分頁進入時，逐個歷史賽季走相同邏輯（共用 cache）

### 雷達 overlay（跨賽季 + 球員互相比較）
- `compareKeys` state：勾選的歷史賽季（最多 2 個，加主賽季共 3 條雷達）
- `comparePlayers` state：勾選的同季其他球員（Phase D，球員 + 當季模式；資料已在 `playerHistory`，無需額外抓取）
- `radarSeries` = 主序列 + `compareKeys` 賽季 + `comparePlayers` 球員；比較時主序列標籤改用球員名
- `compareCache` state：已載入的歷史 doc，多源共用
- 主色：進攻綠 / 防守紅；比較色盤：藍 / 黃 / 粉（賽季與球員共用索引）
- 球員模式才顯示

### 單場數據面板（`SingleGamePanel.js`）
- 當季模式下、球員/球隊視圖底部顯示；日期選單讀 `wolves_games_index/{season}_{seasonTypeView}`（隨例行/季後切換；`gamesIndex` state，一份 doc + localStorage 快取 `wt_games_index_v2_*`，TTL 6 小時——賽季中每日索引會重建）
- 切換賽別後原選日期不在新清單 → 自動跳到新清單最後一場；缺值卡片顯示「—」（不印孤立單位）
- 選日期後讀 `wolves_{player|team}_games/{date}`（localStorage 快取），依攻守取 defs，**只渲染該實體有資料的群組**（`def.metrics.some(有值)`）→ 自動隱藏單場沒有的 ShotProfile/DefenseBox/PlayType
- 卡片用 `TrackingCardRow clickable={false}`（單場無走勢，不可點）
- 攻守跟隨右側攻/守切換（`OverviewTab` 的 `viewSide` prop）：防守側顯示最近防守者／Hustle／抄截阻攻單場值

### Modal 跨賽季比較分頁
- 每張卡片皆可用，含 PlayType 與 Tracking
- 進入時自動載入全部 6 個歷史快照
- 表格列出每個賽季 + 主賽季最新值（綠底高亮），欄位是該卡片所有指標
- 點欄位標題切換折線圖：X 軸是賽季縮寫（22-23R / 22-23P / ... / 當季），Y 軸該指標數值

### 當季走勢「例行 / 季後」二擇一
- 當季模式下 Modal「當季走勢」分頁顯示兩個 tab（移除「全部」）
- 預設依 `getSeasonPhase()`：4/15 前例行賽、4/16 後季後賽
- 歷史模式整個 tab 區塊隱藏

### 指標命名對照（2026-10 命名精準度修正）
原則：中文標籤必須對應 NBA 欄位的**實際語意**；中文旁一律以小字保留 NBA 原文（`englishLabel` 或 `en`），避免查證時對不上。資料 key 不因改名而變。

| 前端標籤 | 原文 | API 欄位 / endpoint | 注意 |
|---|---|---|---|
| 合理衝撞區命中率 | Restricted Area | `*shotlocations` 區域 `Restricted Area` | 不是整個禁區 |
| 禁區（非 RA）命中率 | In The Paint (Non-RA) | 同上 `In The Paint (Non-RA)` | 不含合理衝撞區 |
| 底角三分 / 非底角三分 | Corner 3 / Above the Break 3 | 同上 | 非底角含兩翼，不只弧頂 |
| 最近防守者 (Defense Dashboard) | DFGA / DFG% / DIFF% | `leaguedashptdefend`（`MATCHUP_*_FIELDS`） | 是「最近防守者」資料，**不是** `leagueseasonmatchups` 的對位資料；DIFF% 負=守得好 |
| 干擾球 | Deflections | `leaguehustlestats{player|team}` `DEFLECTIONS` | 不是抄截 |
| 搶回散球 | Loose Balls Recovered | `LOOSE_BALLS_RECOVERED` | |
| 籃板機會轉換率 | REB Chance% | `REB_CHANCE_PCT`（輸出欄名沿用 `REB_COL_PCT`） | 籃板 ÷ 籃板機會 |
| 每百次切入得分 | DRIVE_PTS_PCT | tracking Drives | ＝切入得分 ÷ 切入次數 × 100（含被犯規罰球得分），**不是**佔總得分比例（2026-10 經使用者指正並以資料驗證） |
| 二次助攻 | Secondary AST | tracking Passing `SECONDARY_AST` | 傳給隊友、隊友接球 1 秒內未運球就助攻，原傳球者記一次（NBA.com 官方定義，2026-10 查證）；舊名「二傳助攻」易與排球「二傳」混淆而改名，群組名同步改「傳球與助攻」 |
| Clutch（名稱保留） | Clutch | `*clutch`，PerGame | 第四節或延長賽最後 5 分鐘、分差 5 分內，場均 |
| 五人陣容「總分鐘」 | MIN | `leaguedashlineups` Advanced | 此 endpoint 忽略 PerMode，MIN 一律總分鐘（2026-10 實測） |
| 雷達軸 `PR` / `%` | — | Synergy `PERCENTILE` / tracking 原始值 | 兩種尺度共用 0–100 軸，軸名必帶尺度標示 |

新增指標時：先查 NBA.com 對應頁的欄位定義，再決定中文；不確定時中文寫直譯並保留原文。

---

## 常見問題

### Q: 我修了 components/App.js 但網頁沒變
忘了跑 `python scripts/bundle.py`（新電腦還要先 `npm ci`）。或瀏覽器有快取，按 Ctrl+F5。

### Q: 本地開發出現 `auth/requests-from-referer-...-are-blocked`
Google Cloud Console 的 API Key 白名單沒加 `http://localhost:8000/*`。

### Q: 切換歷史賽季出現 `Missing or insufficient permissions`
Firestore Rules 沒涵蓋 history collections。貼上本文件「Firestore 安全規則」整段重新發佈。

### Q: NBA API 跑失敗
看對應 log：`fetch_log.txt`（每日）/ `shotchart_log.txt`（熱圖）/ `backfill_games_log*.txt`（單場回補）。搜 `[FAILED]` 看缺哪項；腳本有 3 次 retry，通常等隔天即可。

### Q: Backfill 進度怎麼看
看 `scripts/backfill_queue.txt` 還剩幾行。Phase 1 已完成、queue 已清空。

### Q: 想新增數據（三種情境，皆只需改一處後端）
1. **既有 API 的新欄位**（如籃板再加一欄）：`nba_common.py` 對應的 `*_FIELDS` 設定表加一行 `(輸出欄名, API 欄名, 是否百分比)`
2. **`leaguedashptstats` 新類型**（如 SpeedDistance）：`TRACKING_TYPES` 加名稱 + `TRACKING_FIELDS` 加對應欄位列表
3. **全新 endpoint**（如 Hustle）：`nba_common.py` 仿照 `fetch_clutch()` 寫一支新函式（用 `fetch_with_retry`），`fetch_data.py` 主流程呼叫並掛進文件欄位與 `DATA_KEYS`

前端同步：`components/constants.js` 加 defs（含 `englishLabel`）→ `App.js` 對應區塊 → `python scripts/bundle.py` 重新打包。每日與歷史回補會自動同步生效（共用 nba_common）。

不確定 API 欄名時，先抓一次 response 印 `resultSets[0]['headers']` 對照（欄名錯誤會被 `safe_col` 靜默吞成 0）。

### Q: 想追蹤其他球隊
改 `scripts/nba_common.py` 的 `TEAM_ID` 常數（所有腳本共用）。

### Q: PageSpeed 效能分數為什麼和實際感受差很多
PageSpeed 的效能分數是「模擬推算」，每次會跳動：同一版曾給第一個畫面 1.6 秒與 8.4 秒兩種估算。以同樣條件（慢速 4G、CPU 降速、全新訪客）實測為準：2026-10 為第一個畫面約 1.6 秒、主要內容約 9.7 秒（「近期異動」要等 Firestore 資料）。另外 PageSpeed 的測試環境裡匿名登入會失敗（Google 驗證端點 403），所以「最佳做法」會被扣錯誤紀錄，一般讀者不受影響。看 PageSpeed 時以**無障礙分數與總傳輸量**為主。

### Q: 歷史快取要怎麼清
DevTools → Application → Local Storage → 刪 `wt_history_*` 開頭的 key。或在 console 跑 `Object.keys(localStorage).filter(k=>k.startsWith('wt_history_')).forEach(k=>localStorage.removeItem(k))`。

---

## 已知技術決策

- **不用 GitHub Actions**：datacenter IP 容易被 NBA 封鎖，改用本機 Windows 排程（家用 IP）。workflow 檔已於 2026-07-02 移除
- **欄位設定表驅動**：抓哪些欄位寫在 `nba_common.py` 的 `*_FIELDS` 設定表，不寫在程式邏輯裡；加新數據只改設定表
- **全聯盟單次請求優先**：球員數據一律抓全聯盟再過濾（順帶解決轉隊歸屬問題）；唯一逐球員的 `shotchartdetail` 降為每週執行以控制被擋風險
- **`REB_COL_PCT` 來源是 `REB_CHANCE_PCT`**：NBA API 已無 `REB_COLLECT_PCT` 欄位，輸出欄名保留 `REB_COL_PCT` 以相容前端與歷史資料
- **輕量預編譯、不用打包框架**：React／Recharts 仍走鎖版本 CDN；JSX 與 Tailwind 由 `bundle.py` 呼叫 esbuild／tailwindcss 預先編譯，產物進版控，GitHub Pages 直接服務 main（無 CI 建置步驟）
- **PlayerID 為主鍵（歷史）**：跨賽季穩定，姓名僅供顯示。每日快照仍用 playerName-keyed（沿用舊結構），靠前端 normalizer 對齊
- **歷史賽季只存終點快照**：每季 1 個文件，省 Firestore 讀寫額度；逐日 backfill 約需 5,600 次 API call，目前不做
- **歷史賽季用 localStorage 永久快取**：免費版 Firestore 每日讀取上限 50,000，靜態歷史數據只讀 1 次
- **跨賽季折線圖以賽季為 X 軸**：歷史賽季只有終點快照，無法畫逐日；用「賽季順序軸」串接歷史終點 + 當季最新

---

## 給下一位 Agent 的維護重點（2026-07 交接）

> 這一節專門寫給接手的 Agent。前面章節是「怎麼運作」，這節是「動它之前要知道什麼、下一步可以做什麼」。

### A. PlayType (Synergy) 維護

- **資料來源**：`fetch_synergy_data()`（`nba_common.py`），11 種進攻 + 9 種防守（防守跳過 Cut/Misc）。PlayType 清單 `PLAY_TYPES` 是 NBA 固定的，**不能自訂新增**。
- **已改用 `PerMode=Totals`**：每個 stats item 除了顯示欄位（poss/freq/ppp/fgPct/percentile），還存整數總量 `gp/possTotal/ptsTotal/fgmTotal/fgaTotal`。顯示的 `poss` 是 `possTotal/GP` 推導、比率欄位與 PerGame 模式相同。**動這支函式時，顯示欄位與總量欄位都要保留**（總量是單場還原的唯一材料）。
- **Synergy 不支援 `DateFrom/DateTo`**（實測參數被忽略）→ 這是 PlayType 沒有單場資料的根本原因，也是為何 `_with_date()` 不套用在 Synergy。
- **PERCENTILE 是全聯盟相對排名**：只在賽季累積下有意義，無法相減、無法還原單場、單場也沒有百分位。
- 前端顯示：`PlayTypeCard.js` + `App.js` 的 Synergy 區塊 + 雷達圖（用 percentile）。

### B. 下一步：PlayType 單場還原（G3 的收尾，尚未做）

材料已經每天在存（見 A 的整數總量），但**還原邏輯與 UI 都還沒寫**。要做的話：
1. 後端或前端取「兩份 GP 差=1 的每日快照」，同一 playType 的 `possTotal/ptsTotal/fgmTotal/fgaTotal` 相減 → 得單場整數 → 算單場 `ppp = ΔPTS/ΔPOSS`、`fgPct = ΔFGM/ΔFGA`、`freq = 該類ΔPOSS / 全類ΔPOSS`。**因為存的是整數，相減無捨入誤差**。
2. `PERCENTILE` 略過（無法還原）；`GP` 差≠1 時標示為「N 場合計」不可拆。
3. 前端可把還原出的單場 PlayType 併進 `SingleGamePanel`（目前面板只有 Tracking/防守/分區投籃，缺 PlayType）。
4. 只對**未來賽季**有效：2025-26 當時存的是舊結構（無整數總量），無法回溯還原；2026-27 起每天都有材料。

### C. 常見雷區（都踩過，務必記得）

- **新 Firestore 集合 = 必加 read 規則**：每加一個集合，都要去 Firebase Console 在 `match /databases/{database}/documents { ... }` **大括號內**加 `allow read: if request.auth != null`。這個 session 踩了兩次（`wolves_shotcharts`、`wolves_*_games`），症狀都是前端 `Missing or insufficient permissions`。放到大括號外會靜默失效。
- **`.bat` / 重導向輸出要 `PYTHONIOENCODING=utf-8`**：腳本裡有 emoji（🔑✅），Windows 預設 cp950 會在 `print` 時崩潰。正式 `.bat` 已設；手動 `python x.py > log.txt` 也要設，否則死在第一個 emoji。
- **新每日欄位要加進 `DATA_KEYS`**（`fetch_data.py`）：否則去重不會比對它，可能漏寫或誤判相同。
- **改 `components/*.js` 後一定要 `python scripts/bundle.py`**：前端讀的是 `dist/components-bundle.js` 與 `dist/app.css`；新元件還要加進 `bundle.py` 的 `ORDER`（放在 `App.js` 之前）。
- **GitHub Pages 偶發 `Deployment failed, try again later`**：GitHub 暫時性，`gh run rerun <id>` 重跑即可，不是程式問題。
- **Firestore 查詢只用 doc id 升冪範圍**：`orderBy(documentId(),'desc')`、`limitToLast` 都需要另建索引，會回 `failed-precondition`；`onSnapshot` 必帶 error callback，否則失敗時畫面永遠停在骨架。
- **slate-500/600 已被改成較亮的自訂值**（對比 AA）：看到 `text-slate-500` 不等於 Tailwind 原生色。

### D. 效能與擴充強化點

- **讀取配額是唯一會隨流量成長的**：2026-10 起開站只讀近期快照（見「效能與無障礙」），整季只在需要時才讀。寫入/儲存都極寬鬆（見「Firestore 免費方案用量」）。
- **中文字型約 1 MB**（Noto Sans TC 切片，首次造訪下載、之後快取）：使用者 2026-10 決定先不換；若要再省，可改用系統中文字（微軟正黑體／蘋方），英數字型不受影響。
- **每日請求預算**：目前約 71/天（快照 70＋賽程 1，2026-10 實測），比賽隔天另加單場每場 20。加新 endpoint 會同步升高 + 被擋風險。原則：**優先用「全聯盟單次請求」的 leaguedash 系列**（一次拿全隊）；逐球員的 `shotchartdetail` 才降為每週。真要加逐球員數據，比照 `fetch_shotchart.py` 走每週排程。
- **單場資料是累積欄位的子集**：`nba_common.fetch_single_game()`（回補與每日共用）只抓 tracking + 對位防守 + Hustle + 分區投籃。想讓單場也有投籃拆分 / 防守 box / 對手分區，在這個函式加對應 `fetch_*`，再重跑回補（`--start/--limit` 分批）。`SingleGamePanel` 會自動顯示新增的群組（它只渲染「有資料」的 def）。
- **配色未抽變數**：色值以 hex 直接寫在各元件（Tailwind arbitrary values）。改配色目前靠 `sed` 全域替換 + CLAUDE.md 色票表。若之後配色常改，值得抽成 CSS 變數或 Tailwind theme extend（一次性重構所有 `[#...]` 類名）。
- **`SingleGamePanel` 的日期選單靠索引文件**：`wolves_games_index/{season}_{type}`。當季由每日 `fetch_data.py` 自動重建；歷史賽季回補後跑 `backfill_games.py --index-only`。

### E. 可清理 / 待整理（低優先）

- 專案根目錄有早期開發遺留的 `debug_*.py` / `test_*.py`（約 10 個），可清。
- `scripts/backfill_queue.txt`、`run_backfill_next.bat`、`cleanup_and_tag.py` 是 Phase 1 一次性產物，queue 已空、`WolvesBackfill` 排程已刪，可視需要移除。

---

## 更新紀錄

- 2026-10-14 — SECONDARY_AST 依 NBA.com 官方定義改寫並更名「二次助攻」，glossary 已無待確認條目
- 2026-10-14 — Wolves Ledger 改版 Phase 6–7：近期快照載入、移除阻斷載入、對比 AA、觸控目標、總覽近 N 場、引用附網址；新增「效能與無障礙」「2026-10 Wolves Ledger 改版」，更新檔案結構、Spark 用量、雷區與常見問題
