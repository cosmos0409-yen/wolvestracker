# Wolves Tracker 交接手冊

> 最後更新：2026-07-02（爬蟲重構 + 投籃/Clutch/陣容/熱圖數據擴充完成）

## 已完成項目

| # | 項目 | 狀態 | 說明 |
|---|---|---|---|
| 1 | Firebase 整合 | ✅ | 前端以 `onSnapshot`（當季）+ `getDoc`（歷史）讀取 Firestore |
| 2 | Python 爬蟲腳本 | ✅ | `scripts/fetch_data.py`，含 11 PlayType + 6 Tracking |
| 3 | 前端 UI 全面改寫 | ✅ | 雷達圖、Tracking 卡片、球員頭像、賽季標籤 |
| 4 | 反爬蟲機制 | ✅ | curl_cffi 瀏覽器 TLS 模擬 + retry |
| 5 | 賽季類型自動判斷 | ✅ | `get_season_type()`（後端）+ `getSeasonPhase()`（前端） |
| 6 | Windows 排程器自動執行 | ✅ | 14:00 抓當日（`WolvesTracker`），15:00 跑 backfill queue（`WolvesBackfill`） |
| 7 | `seasonType` / `season` 欄位 | ✅ | 所有文件含「例行賽 / 季後賽」標籤 |
| 8 | **Phase 0：前端元件拆檔（bundle 模式）** | ✅ | components/ 6 檔；`scripts/bundle.py` 合併為 `dist/components-bundle.js` |
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

---

## 進行中優化計畫

詳見 `doc/plan.md`。

| Phase | 內容 | 狀態 |
|-------|------|------|
| Phase 0 | 前端元件拆檔（bundle 模式） | ✅ 完成 |
| Phase 1 | 歷史賽季數據回補（22-23 至 24-25） | ✅ 完成 |
| Phase 2 | UI 賽季標籤、分類篩選、Tracking 中英對照 | ✅ 完成 |
| Phase 3 | 跨賽季比較功能 | ✅ 完成 |
| Phase 4 | 行動裝置響應與細節優化 | ⏳ 待執行 |

---

## 專案檔案結構

```
wolvestracker/
├── index.html                       ← HTML 骨架 + Firebase 初始化，引用 dist/components-bundle.js
├── components/                      ← React 元件原始碼（編輯這裡）
│   ├── Icons.js                     ← SVG icon set，掛 window.Icons
│   ├── constants.js                 ← PlayTypesList / STARTER_SORT_WEIGHT / trackingDefs / SEASON_OPTIONS / getSeasonPhase
│   ├── MetricComponents.js          ← TrendValue / SimpleLineChart / SimpleMetricCard
│   ├── PlayTypeCard.js              ← PlayType 卡片
│   ├── TrackingCardRow.js           ← Tracking 卡片群組（source 參數決定資料來源欄位）
│   ├── ShotChart.js                 ← 投籃熱圖（SVG 半場圖，讀 wolves_shotcharts）
│   └── App.js                       ← 主容器、Firebase 連線、HistoryModal、雷達圖、跨賽季比較
├── dist/
│   └── components-bundle.js         ← 自動產生，勿手改
├── scripts/
│   ├── nba_common.py                ← 共用模組：SESSION/重試/欄位設定表/所有抓取函式
│   ├── fetch_data.py                ← 每日當季數據爬蟲（含寫入前去重）
│   ├── backfill_history.py          ← 歷史賽季回補腳本（import nba_common）
│   ├── fetch_shotchart.py           ← 投籃熱圖爬蟲（每週，逐球員）
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
`Icons → constants → MetricComponents → PlayTypeCard → TrackingCardRow → ShotChart → App`，依序拼接寫入 `dist/components-bundle.js`。

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
欄位：`date`, `seasonType`, `type`, `timestamp`, `stats`, `tracking`, `shooting`, `clutch`, `lineups`（lineups 僅球隊文件）

球員以 **playerName** 為 key（每日快照沿用舊結構）；`tracking` / `shooting` / `clutch` 皆為 `{playerName: {...}}` 同構。

### 投籃熱圖（`fetch_shotchart.py` 寫入，每週）
```
wolves_shotcharts/{playerId}_{season}_{regular|playoffs}   例：1630162_2025-26_regular
```
欄位：`playerId`, `playerName`, `season`, `seasonType`, `timestamp`, `shots[]`（每筆 `{x, y, made, dist, zone}`，座標單位 0.1 呎、籃框在原點）。整季覆寫，非每日快照。

### 歷史賽季快照（`backfill_history.py` 寫入）
```
wolves_team_history/{season}_{type}      例：2022-23_regular
wolves_player_history/{season}_{type}    例：2023-24_playoffs
```
球員以 **PlayerID** 為 key，含 `playerName`、`isCurrentRoster`、`stats[]`、`tracking{}`。

前端 `App.js` 內 `normalizeHistoryPlayer()` 把 PlayerID-keyed 結構轉成 playerName-keyed，與每日快照相容。

### 寫入前去重
`fetch_data.py` 寫入前會抓最近 14 天最新一筆，深度比對 `DATA_KEYS`（stats / tracking / shooting / clutch / lineups），完全相同則跳過寫入避免堆積無意義文件。

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

### 雷達跨賽季 overlay
- `compareKeys` state：使用者勾選的歷史賽季（最多 2 個，加主賽季共 3 條雷達）
- `compareCache` state：已載入的歷史 doc，多源共用
- 主色：進攻綠 / 防守紅；比較色盤：藍 / 黃 / 粉
- 球員模式才顯示

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
`fetch_log.txt` / `backfill_log.txt` 看細節。腳本有 3 次 retry，通常等隔天即可。

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
