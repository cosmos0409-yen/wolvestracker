# Wolves Tracker 優化執行計畫

> 建立日期：2026-04-18  
> 最後更新：2026-04-18

---

## 已確認決策

| 項目 | 決策 |
|------|------|
| 歷史賽季快照 | 每季只存賽季末一個終點快照 |
| 歷史球員範圍 | 先抓該賽季的歷史名單（`commonteamroster?Season=YYYY-YY`）拿到當時球員列表，再過濾數據 |
| 球員主鍵 | 統一改用 **PlayerID**（穩定不變），姓名作顯示用 |
| 跨賽季比對 | 同一 PlayerID 可在不同賽季文件中被串連，現役球員另以 `isCurrentRoster: true` 標記 |
| 轉隊球員處理 | 抓**整季數據**：API 不加 `TeamID` 篩選，改抓全聯盟後用歷史名單 PlayerID 過濾 |
| GitHub Actions | 正式移除，改以 Windows 排程器（每日台灣時間 14:00）執行 |
| Firestore 方案 | 免費版（每日讀取上限 50,000 次），前端以 localStorage 快取歷史數據、避免 onSnapshot 用於靜態歷史集合 |
| 前端架構 | Phase 0 進行元件拆檔，從單一 index.html 拆出獨立 .js 元件檔，GitHub Pages 相容 |
| Header 賽季標籤 | 隨選取日期動態切換（4/15 顯示例行賽，4/16 顯示季後賽） |
| 陳舊警告 | 僅在賽季期間（10/20–6/20）檢查；休賽期顯示「休賽期，下次更新預計 10/20」 |
| Backfill 執行 | 6 個賽季組合分 6 天執行，使用 Windows 排程器自動跑 queue |

---

## 目標概覽

| 目標 | 說明 |
|------|------|
| 歷史賽季數據 | 補齊 22-23、23-24、24-25 三季（例行賽＋季後賽）終點快照至 Firebase |
| 球員跨賽季比對 | 以 PlayerID 串連歷史與現役球員，讓使用者比較同球員的跨賽季數據 |
| 賽季內變化 | 使用者可觀察 25-26 賽季每日累計數據的演進趨勢 |
| 賽季間比較 | 使用者可在 UI 選擇不同賽季與類型，比較球隊或球員表現 |
| UI 優化 | 賽季標籤、分類篩選、行動裝置支援、資料陳舊警告 |

---

## Firebase 資料結構設計

### 現有結構（不動）
每日快照，追蹤當季數據演進：
```
wolves_team_stats/{YYYY-MM-DD}
wolves_player_stats/{YYYY-MM-DD}
```
文件欄位：`date`, `season`, `seasonType`, `type`, `timestamp`, `stats`, `tracking`

### 新增結構（歷史賽季終點快照）
```
wolves_team_history/{season}_{type}      例：2022-23_regular
wolves_player_history/{season}_{type}    例：2023-24_playoffs
```

球員文件結構（以 PlayerID 為主鍵）：
```json
{
  "season": "2022-23",
  "seasonType": "例行賽",
  "stats": {
    "1629649": {                          // PlayerID 為 key
      "playerName": "Anthony Edwards",
      "isCurrentRoster": true,
      "playType": [...],
      "tracking": {...}
    },
    "1626157": {
      "playerName": "Karl-Anthony Towns",
      "isCurrentRoster": false,            // 已離隊
      "playType": [...],
      "tracking": {...}
    }
  }
}
```

**現有每日快照（`wolves_player_stats`）也應同步改為以 PlayerID 為主鍵**，確保跨賽季 PlayerID 查詢一致性。

### Firestore 免費版使用策略
- **歷史集合** 使用 `getDoc()`（單次讀取），不用 `onSnapshot()`
- **歷史數據 localStorage 快取**：讀取一次後存入 localStorage，key 為 `wt_history_{season}_{type}`，永不過期（歷史數據不會變動）
- **當日數據** 繼續用 `onSnapshot()` 確保即時更新
- **每日讀取量估算**：當日 onSnapshot（~2）+ 使用者點開歷史賽季（最多 12 次，但 localStorage 命中後歸零）→ 遠低於 50,000 上限

---

## 執行階段

---

### Phase 0：前端元件拆檔

**目標：** 將 index.html 中的 React 元件拆出為獨立 .js 檔，降低後續 Phase 的開發複雜度。

**優先度：** 最高（Phase 1 後端、Phase 0 前端可同步進行）  
**預計工時：** 1 個工作日

#### 工作項目

**0-A 拆檔結構**
```
wolvestracker/
├── index.html          ← 只保留 HTML 骨架與 script 引入
├── components/
│   ├── App.js          ← 主容器、狀態管理、Firebase 連線
│   ├── Header.js       ← 標題、賽季標籤、連線狀態
│   ├── Sidebar.js      ← 模式切換、球員名單、雷達圖
│   ├── PlayTypeCard.js ← PlayType 卡片
│   ├── TrackingCard.js ← Tracking 卡片群組
│   └── HistoryModal.js ← 歷史彈窗、折線圖
└── scripts/
    └── fetch_data.py
```

**0-B index.html 引入方式**
```html
<script type="text/babel" src="components/Header.js"></script>
<script type="text/babel" src="components/Sidebar.js"></script>
<!-- ... 其餘元件 -->
<script type="text/babel" src="components/App.js"></script>
```

**0-C 引入方式（實際採用：bundle 模式）**
- Babel Standalone 對外部 `type="text/babel"` 是平行 fetch、依完成順序執行，不保證文件順序，會導致 App.js 在依賴前執行而崩潰
- 改採離線打包：`scripts/bundle.py` 將 `components/*.js` 依依賴順序合併為 `dist/components-bundle.js`
- index.html 只引用一個 `<script type="text/babel" src="dist/components-bundle.js">`
- 編輯元件後執行 `python scripts/bundle.py` 重新打包

**0-D 驗證**
- 本地 `python -m http.server 8000` 開啟，確認所有功能正常
- 確認 Firebase API key 在 Google Cloud Console 已加入 `http://localhost:8000/*` 白名單
- 推送至 GitHub Pages，確認遠端也正常載入

**0-E 收尾 Bug 修正**（2026-04-18 新增）
- ✅ Tracking 模式折線圖 TypeError：`SimpleLineChart` 改為 `d.stat?.[dataKey] ?? d.tracking?.[dataKey] ?? 0`
- ✅ 雷達圖標籤超框：自訂 `PolarAngleAxis tick` renderer，中文與英文分兩行顯示，字級降為 10/9，外圈半徑 60% → 58%，容器 250px → 280px，加 margin

#### 完成標準
- index.html 的 `<script>` 區塊行數從數千行降至 50 行以內 ✅
- GitHub Pages 功能與拆檔前完全一致
- Tracking modal 折線圖正常顯示
- 雷達圖任何視角文字均不超框

---

### Phase 1：歷史賽季數據抓取

**目標：** 建立一次性回補腳本，將 22-23、23-24、24-25 三季的終點快照寫入 Firebase。

**優先度：** 最高（與 Phase 0 同步進行）  
**預計工時：** 1 個工作日

#### 工作項目

**1-A 現有腳本已完成部分** ✅
- `season` 與 `seasonType` 欄位已加入 `fetch_data.py`
- `get_season_type()` 依據日期自動切換 API 參數

**1-B 新增 `scripts/backfill_history.py`**

目標：6 個快照（3 賽季 × 例行賽/季後賽），灰狼均有出賽：

| 賽季 | 例行賽 | 季後賽 |
|------|--------|--------|
| 2022-23 | ✅ | ✅（首輪出局） |
| 2023-24 | ✅ | ✅（西冠） |
| 2024-25 | ✅ | ✅ |

腳本邏輯（重點變更）：
- 接受 `--season 2022-23 --type regular` 參數
- **Step 1**：呼叫 `commonteamroster?Season={season}` 拿到該賽季灰狼**歷史名單**（PlayerID + 姓名）
- **Step 2**：呼叫 `fetch_roster()` 拿到**現役名單**（PlayerID 集合）
- **Step 3**：抓取數據時 **API 不加 TeamID 篩選**（抓全聯盟），改用歷史名單 PlayerID 過濾，確保拿到該球員整季數據（包含轉隊前後）
- **Step 4**：寫入時以 PlayerID 為 key，比對現役名單標記 `isCurrentRoster`
- Document ID：`{season}_{type}` → `2022-23_regular`
- 寫入集合：`wolves_team_history`、`wolves_player_history`

**1-C 同步調整 `fetch_data.py`**
- 將 `player_stats_map` 改為以 PlayerID 為 key（與歷史結構一致）
- 球員 tracking 資料同樣改用 PlayerID
- 確保未來每日快照與歷史文件結構一致，前端查詢邏輯統一

**1-D Firestore 安全規則更新**

新增兩個 history 集合的讀取規則。

**1-E Backfill Queue 機制（避免一次跑被擋）**

新增 `scripts/backfill_queue.txt`：
```
2022-23,regular
2022-23,playoffs
2023-24,regular
2023-24,playoffs
2024-25,regular
2024-25,playoffs
```

新增 `scripts/run_backfill_next.bat`：
- 讀取 queue 第一行，呼叫 `backfill_history.py` 執行該組合
- 執行成功後從 queue 移除該行
- 若 queue 為空則跳過

新增 Windows 排程任務 `WolvesBackfill`：
- 每日台灣時間 **15:00** 執行（避開 14:00 的當日數據抓取）
- 連續 6 天自動跑完，第 7 天起 queue 為空自動跳過
- 完成後可手動刪除排程：`schtasks /delete /tn "WolvesBackfill" /f`

**1-F 驗證**
- 6 天後確認 Firebase 出現 12 個 history 文件
- 抽查已離隊球員（例如 Towns）出現在 22-23 球員文件，`isCurrentRoster: false`
- 抽查現役球員（例如 Edwards）在各歷史文件均有 `isCurrentRoster: true`
- 抽查季中加盟球員（例如 22-23 的 Conley）整季數據完整

#### 完成標準
- Firebase 中出現 12 個 history 文件（6 球隊 + 6 球員）
- 每個文件含 `season`、`seasonType`、`isCurrentRoster`（球員文件）欄位
- 現役球員可被 PlayerID 跨文件串連

---

### Phase 2：UI 賽季標籤、分類與架構接線

**目標：** 前端讀取 `seasonType` 與 `season` 欄位，讓使用者清楚看到資料屬性，並可篩選。

**優先度：** 高（依賴 Phase 0 拆檔完成）  
**預計工時：** 1–2 個工作日

#### 工作項目

**2-A Header 賽季標籤**（`Header.js`）
- 標籤**隨選取日期動態切換**：選 4/15 顯示「2025-26 例行賽」，選 4/16 顯示「2025-26 季後賽」
- 標籤內容讀自當前選取日期文件的 `season` + `seasonType`
- 顏色：例行賽用藍色（`#236192`），季後賽用綠色（`#78BE20`）

**2-B 歷史 Modal 賽季類型篩選**（`HistoryModal.js`）
- 在日期篩選上方加入 `例行賽 / 季後賽 / 全部` 切換
- 篩選後只顯示對應 `seasonType` 的記錄

**2-C 資料陳舊警告**（`App.js`）
- **僅在賽季期間檢查**（10/20–6/20）：若最新文件距今超過 2 天，顯示黃色警告
- **休賽期顯示靜態訊息**：「目前為休賽期，下次數據更新預計 10/20」
- 判斷邏輯共用 `get_season_type()` 邏輯（前端版本）

**2-D localStorage 快取接線**（`App.js`）
- 讀取 history 集合時先查 `localStorage`，命中則跳過 Firestore 請求
- 未命中才呼叫 `getDoc()`，回傳後存入 localStorage

**2-E Tracking 卡片中英對照標題**（`TrackingCardRow.js` + `MetricComponents.js`）
- 卡片群組標題已含中文+英文（如「切入次數 (Drives)」），維持現狀
- **每個指標 metric 增加 `englishLabel` 欄位**，在 `SimpleMetricCard` 標題下方以小字顯示英文（例：`切入進球 / DRIVE_FGM`）
- 順便檢查整個介面其他純中文標題，補上英文對照
- `trackingDefs`（constants.js）所有 metric 加 `englishLabel` 欄位

#### 完成標準
- Header 賽季標籤顯示正確
- Modal 篩選運作正常
- 第二次載入歷史賽季數據時，Network 面板無 Firestore 請求
- Tracking 卡片每個指標皆顯示中英對照

---

### Phase 3：跨賽季比較功能

**目標：** 使用者可選擇賽季，並排或疊加比較球員/球隊跨賽季的數據。

**優先度：** 中（依賴 Phase 1、2 完成）  
**預計工時：** 3–5 個工作日

#### 工作項目

**3-A 賽季選擇器**（`Sidebar.js`）
- 下拉選單：`2022-23 / 2023-24 / 2024-25 / 2025-26（進行中）`
- 例行賽 / 季後賽各自切換
- 選取歷史賽季時，讀取 `wolves_*_history` 集合

**3-B 球員跨賽季對比**（`Sidebar.js` + `PlayTypeCard.js`）
- 選取球員後，若歷史賽季有 PlayerID 對應資料，雷達圖可疊加最多 3 個賽季
- 以不同顏色線條區分，附圖例

**3-C 賽季間比較卡片**（`PlayTypeCard.js`）
- 選擇「比較模式」後，PlayType 卡片顯示兩個賽季數值並列
- 差值以顏色＋箭頭標示

**3-D 25-26 賽季內趨勢線**（`HistoryModal.js`）（2026-04-20 修訂）
- 「當季走勢」分頁原 `全部 / 例行賽 / 季後賽` 三 chip 改為 **例行賽 / 季後賽** 兩 tab 二擇一
- 預設值依 `getSeasonPhase()`：4/15 前預設例行賽、4/16 後預設季後賽
- 歷史模式（單一終點快照）下整個 tab 隱藏
- 日期範圍 / 近 N 場 篩選保留

#### 完成標準
- 可切換任意賽季（含歷史）查看數據
- 現役球員可跨賽季比較，離隊球員只在對應賽季顯示
- 雷達圖最多疊加 3 個賽季，圖例清晰

---

### Phase 4：行動裝置與細節優化

**目標：** 改善手機使用體驗，提升整體視覺流暢度。

**優先度：** 低（最後執行）  
**預計工時：** 2–3 個工作日

#### 工作項目

**4-A 行動裝置響應**
- Sidebar 改為可收合底部抽屜（mobile drawer）
- PlayType 卡片改為單欄滾動，Tracking 卡片改為 2 欄
- 雷達圖在手機端縮小至 200x200

**4-B Loading Skeleton**
- 資料載入中時顯示灰色骨架占位卡片，取代全頁 spinner

**4-C 多指標疊加折線圖**（`HistoryModal.js`）
- 折線圖新增多指標選擇（PPP + 百分位等），不同顏色線條，附圖例

#### 完成標準
- 375px 寬度手機上所有功能正常
- Skeleton 動畫流暢無閃爍
- 多指標折線圖正確疊加

---

## 時程總覽

```
Week 1   Phase 0（前端拆檔，1 工作日）
         Phase 1 啟動：建立 backfill 腳本與 queue，啟動 Windows 排程
         Phase 1 自動跑 6 天（不需人工介入）
Week 2   Phase 1 完成驗證
         Phase 2：UI 賽季標籤、快取接線
Week 3-4 Phase 3：跨賽季比較功能
Week 5   Phase 4：行動裝置優化
```

**Phase 1 backfill 不需電腦長時間開機，每天約 5–10 分鐘執行時間即可，14:00 與 15:00 兩個排程錯開避免相互干擾。**

---

## 交接手冊更新時機

| 時間點 | 更新內容 |
|--------|---------|
| Phase 0 完成後 | 更新 `doc/handover.md`：新的元件檔案結構與引入方式 |
| Phase 1 完成後 | 更新 `doc/handover.md`：新 Firebase 集合說明、backfill 腳本使用方式、球員 PlayerID 串接邏輯 |
| Phase 2 完成後 | 更新 `doc/handover.md`：localStorage 快取機制、新 UI 元件與 Firebase 欄位對應 |
| Phase 3 完成後 | 更新 `doc/handover.md`：跨賽季比較架構、PlayerID 跨文件查詢邏輯 |
| Phase 4 完成後 | 更新 `doc/handover.md`：RWD breakpoint 設定、Skeleton 元件位置 |
