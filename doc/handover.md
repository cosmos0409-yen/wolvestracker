# Wolves Tracker 交接手冊

> 最後更新：2026-07-09（**六分頁大改版**：單場數據驅動 + bundle 架構 + 跨季比較 + 雷達軸自選；見下方「2026-07 六分頁大改版」）

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

---

## 專案檔案結構

```
wolvestracker/
├── index.html                       ← HTML 骨架 + Firebase 初始化，引用 dist/components-bundle.js
├── components/                      ← React 元件原始碼（編輯這裡）
│   ├── Icons.js                     ← SVG icon set，掛 window.Icons
│   ├── constants.js                 ← PlayTypesList / 色票 / trackingDefs / shootingDefs / clutchDefs / defenseDefs / oppZonesDefs / SEASON_OPTIONS / getSeasonPhase
│   ├── MetricComponents.js          ← TrendValue / SimpleLineChart / SimpleMetricCard
│   ├── PlayTypeCard.js              ← PlayType 卡片
│   ├── TrackingCardRow.js           ← 數據卡片群組（source 參數:tracking/shooting/clutch/defense）
│   ├── ShotChart.js                 ← 投籃熱圖（SVG 半場點雲，teamMode 讀 TEAM_ doc）
│   ├── DefenseHeatmap.js            ← 防守熱圖（半場 5 區依對手命中率偏差著色）
│   ├── SingleGamePanel.js           ← 單場數據面板（選日期看單場，只渲染有資料的群組）
│   └── App.js                       ← 主容器、Firebase 連線、HistoryModal、雷達圖、跨賽季/球員比較、單場面板掛載
├── dist/
│   └── components-bundle.js         ← 自動產生，勿手改
├── scripts/
│   ├── nba_common.py                ← 共用模組：SESSION/重試/欄位設定表/所有抓取函式
│   ├── fetch_data.py                ← 每日當季數據爬蟲（含寫入前去重）
│   ├── backfill_history.py          ← 歷史賽季回補腳本（import nba_common）
│   ├── fetch_shotchart.py           ← 投籃熱圖爬蟲（每週，逐球員 + 全隊）
│   ├── backfill_games.py            ← 單場數據回補（DateFrom=DateTo 逐場；--index-only 產索引）
│   ├── backfill_queue.txt           ← 回補佇列（已清空）
│   ├── cleanup_and_tag.py           ← 一次性：補貼舊文件 seasonType、刪除完全相同的後續日期
│   └── bundle.py                    ← 元件打包工具
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
1. 改 `components/*.js`
2. `python scripts/bundle.py` 重新打包
3. `python -m http.server 8000` 啟動本地伺服器
4. 瀏覽器開 `http://localhost:8000`，Ctrl+F5 強制重整
5. 確認無誤後 commit `components/` 與 `dist/components-bundle.js`，推送 GitHub Pages

### 為何用 bundle 而非多檔引入
Babel Standalone 對 `<script type="text/babel" src="...">` 是平行 fetch、依完成順序執行（非文件順序），會導致 App.js 在依賴前執行而崩潰。離線打包成單一 bundle 同時解決此問題與 file:// 直開時 fetch 被擋的問題。

### bundle.py 合併順序
`Icons → constants → MetricComponents → PlayTypeCard → TrackingCardRow → ShotChart → DefenseHeatmap → SingleGamePanel → App`，依序拼接寫入 `dist/components-bundle.js`。

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
按「文件讀寫次數」計費，非大小。新增數據是往同一份每日文件加欄位（非新增文件），故寫入次數不變（每天約 2 份 + 熱圖每週約 19 份）。球員每日文件約 52 KB（單文件上限 1 MiB 的 5%），一整季約 4.7 MB（儲存上限 1 GiB）。唯一隨流量成長的是「讀取次數」（前端 onSnapshot 讀整個當季 collection），個人用量離 50,000/天 很遠。

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
- `'current'`：當季 onSnapshot 兩個集合，date 為實際日期，可逐日左右切換
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
- 當季模式下、球員/球隊視圖底部顯示；日期選單讀 `wolves_games_index/{season}_regular`（`gamesIndex` state，一份 doc + localStorage 快取）
- 選日期後讀 `wolves_{player|team}_games/{date}`（localStorage 快取），依攻守取 defs，**只渲染該實體有資料的群組**（`def.metrics.some(有值)`）→ 自動隱藏單場沒有的 ShotProfile/DefenseBox/PlayType
- 卡片用 `TrackingCardRow clickable={false}`（單場無走勢，不可點）

### Modal 跨賽季比較分頁
- 每張卡片皆可用，含 PlayType 與 Tracking
- 進入時自動載入全部 6 個歷史快照
- 表格列出每個賽季 + 主賽季最新值（綠底高亮），欄位是該卡片所有指標
- 點欄位標題切換折線圖：X 軸是賽季縮寫（22-23R / 22-23P / ... / 當季），Y 軸該指標數值

### 當季走勢「例行 / 季後」二擇一
- 當季模式下 Modal「當季走勢」分頁顯示兩個 tab（移除「全部」）
- 預設依 `getSeasonPhase()`：4/15 前例行賽、4/16 後季後賽
- 歷史模式整個 tab 區塊隱藏

---

## 常見問題

### Q: 我修了 components/App.js 但網頁沒變
忘了跑 `python scripts/bundle.py`。或瀏覽器有快取，按 Ctrl+F5。

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

### Q: 歷史快取要怎麼清
DevTools → Application → Local Storage → 刪 `wt_history_*` 開頭的 key。或在 console 跑 `Object.keys(localStorage).filter(k=>k.startsWith('wt_history_')).forEach(k=>localStorage.removeItem(k))`。

---

## 已知技術決策

- **不用 GitHub Actions**：datacenter IP 容易被 NBA 封鎖，改用本機 Windows 排程（家用 IP）。workflow 檔已於 2026-07-02 移除
- **欄位設定表驅動**：抓哪些欄位寫在 `nba_common.py` 的 `*_FIELDS` 設定表，不寫在程式邏輯裡；加新數據只改設定表
- **全聯盟單次請求優先**：球員數據一律抓全聯盟再過濾（順帶解決轉隊歸屬問題）；唯一逐球員的 `shotchartdetail` 降為每週執行以控制被擋風險
- **`REB_COL_PCT` 來源是 `REB_CHANCE_PCT`**：NBA API 已無 `REB_COLLECT_PCT` 欄位，輸出欄名保留 `REB_COL_PCT` 以相容前端與歷史資料
- **不用 npm/build tooling**：CDN 載入 React + Babel Standalone，零依賴部署到 GitHub Pages
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
- **改 `components/*.js` 後一定要 `python scripts/bundle.py`**：前端讀的是 `dist/components-bundle.js`；新元件還要加進 `bundle.py` 的 `ORDER`（放在 `App.js` 之前）。
- **GitHub Pages 偶發 `Deployment failed, try again later`**：GitHub 暫時性，`gh run rerun <id>` 重跑即可，不是程式問題。

### D. 效能與擴充強化點

- **讀取配額是唯一會隨流量成長的**：前端當季用 `onSnapshot(collection(...))` 每次載入讀**整個當季 collection**（季末約 82 份/collection）。個人用量離免費上限 50,000/天 很遠，但若之後流量變大，優化方向：當季只讀最近 N 天、或分頁、或改 `getDocs` + 日期範圍。寫入/儲存都極寬鬆（見「Firestore 免費方案用量」）。
- **每日請求預算**：目前約 53/天（含防守）。加新 endpoint 會同步升高 + 被擋風險。原則：**優先用「全聯盟單次請求」的 leaguedash 系列**（一次拿全隊）；逐球員的 `shotchartdetail` 才降為每週。真要加逐球員數據，比照 `fetch_shotchart.py` 走每週排程。
- **單場資料是累積欄位的子集**：`backfill_games.py` / `capture_single_game()` 只抓 tracking + 對位防守 + Hustle + 分區投籃。想讓單場也有投籃拆分 / 防守 box / 對手分區，要在**這兩處**都加對應 `fetch_*`，再重跑回補（`--start/--limit` 分批）。`SingleGamePanel` 會自動顯示新增的群組（它只渲染「有資料」的 def）。
- **配色未抽變數**：色值以 hex 直接寫在各元件（Tailwind arbitrary values）。改配色目前靠 `sed` 全域替換 + CLAUDE.md 色票表。若之後配色常改，值得抽成 CSS 變數或 Tailwind theme extend（一次性重構所有 `[#...]` 類名）。
- **`SingleGamePanel` 的日期選單靠索引文件**：`wolves_games_index/{season}_{type}`（`backfill_games.py --index-only` 產生）。每季回補完記得跑一次 `--index-only` 更新索引；否則選單不會有新賽季。

### E. 可清理 / 待整理（低優先）

- 專案根目錄有早期開發遺留的 `debug_*.py` / `test_*.py`（約 10 個），可清。
- `scripts/backfill_queue.txt`、`run_backfill_next.bat`、`cleanup_and_tag.py` 是 Phase 1 一次性產物，queue 已空、`WolvesBackfill` 排程已刪，可視需要移除。
- G2 每日單場「有比賽才抓」是靠去重信號（`not skip_player`）判斷；若哪天去重邏輯改動，記得這個相依關係。
- `capture_single_game`（每日）沒存 matchup/wl，`backfill_games` 有；若要每日單場也顯示對手/勝負，補上即可（可從 `teamgamelog` 或索引查）。
