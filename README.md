# 🐺 Wolves PlayType & Tracking Daily Tracker

Minnesota Timberwolves 的每日 Synergy PlayType 與 NBA Tracking 數據追蹤儀表板。

## 功能總覽

右欄採**六分頁**，可切**例行賽/季後賽**、用 header 日曆選「截至某日」的季平均：

| 分頁 | 說明 |
|---|---|
| **總覽 (Overview)** | 傳統季平均摘要（得分/籃板/助攻/命中率等，可選截至日期）+ 在場/不在場效率(On/Off) + 關鍵時刻(Clutch) + 五人陣容(Lineups) + 單場面板 |
| **Splits** | 期間篩選（全季/每月/勝敗/主客/近N場/自訂區間/季後系列）→ 卡片牆（該期間 vs 全季 綠紅漲跌）+ 點卡展開趨勢折線（逐場/每週/每月） |
| **投籃 (Shooting)** | 距離區間(5ft)/分區/出手方式卡片（命中率 + 出手佔比）+ 受助攻比例 + 可篩選的投籃熱圖 + 命中率趨勢 |
| **防守 (Defense)** | 對位防守、Hustle、防守 box、對手分區命中 + 防守熱圖 |
| **Playtype** | 11 種進攻 + 9 種防守戰術的 PPP、Percentile、FG%（點卡看當季走勢） |
| **跨季比較 (Comparison)** | 多選賽季 × 數據類別 → 並列終點值表格 + 點指標畫逐季折線 |
| **雷達圖** | 軸可自選（3~6 個 Playtype/Tracking 指標）+ 疊加歷史賽季或同季隊友 + 自選指標比較表 |
| **歷史賽季回補** | 2022-23 起各賽季例行賽/季後賽完整終點快照（供跨季比較） |
| **中英雙語** | UI 標籤皆以「中文 (English)」格式呈現 |

季平均與 Splits 的百分比欄以「Σ分子/Σ分母」加權重算（非平均百分比），資料源為**逐場打包 bundle**（單一 doc，避免多次讀取）。

## 技術架構

```
wolvestracker/
├── index.html               # 前端 SPA (React 18 + Recharts, CDN)
├── components/              # React 元件原始碼（修改後需重新 bundle）
│   ├── OverviewTab / SplitsTab / ShootingTab / ComparisonTab / RadarPanel  # 六分頁 + 雷達
│   ├── gameAggregates.js    # GameAgg：逐場聚合（季平均/月/勝敗/趨勢，加權%）
│   └── gamesData.js         # 讀逐場 bundle（單一 getDoc）
├── dist/components-bundle.js # bundle.py 產生的合併檔（勿手改）
├── scripts/
│   ├── nba_common.py        # 共用模組：連線/欄位設定表/抓取函式
│   ├── fetch_data.py        # 每日當季爬蟲 (NBA Stats API → Firebase)
│   ├── backfill_games.py    # 單場逐場回補（--dates 補失敗場）
│   ├── backfill_history.py  # 歷史賽季完整終點快照回補
│   ├── build_bundles.py     # 逐場打包成 bundle doc（前端 Splits/總覽用）
│   ├── fetch_shotchart.py   # 投籃熱圖爬蟲（每週；含出手方式/日期/受助攻）
│   └── bundle.py            # 前端元件打包
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
                每日 14:00 / 每週一 14:30                      即時讀取 (onSnapshot)
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
# 改過 components/ 之後先重新打包
python scripts/bundle.py
# 任何靜態伺服器即可
python -m http.server 8080
```

## 自動化排程（Windows 工作排程器）

> 早期版本使用 GitHub Actions，但 GitHub 機房 IP 會被 NBA API 封鎖，
> 已改為本機 Windows Task Scheduler（家用 IP）執行。

| 工作名稱 | 頻率 | 執行內容 |
|---|---|---|
| `WolvesTracker` | 每日 14:00 | `run_fetch.bat` → `fetch_log.txt` |
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
  `wolves_games_bundle` / `wolves_pgames_bundle`（逐場打包，前端 Splits/總覽讀取）
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
