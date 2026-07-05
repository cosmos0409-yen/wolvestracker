# 🐺 Wolves PlayType & Tracking Daily Tracker

Minnesota Timberwolves 的每日 Synergy PlayType 與 NBA Tracking 數據追蹤儀表板。

## 功能總覽

| 功能 | 說明 |
|---|---|
| **Synergy PlayType** | 11 種進攻 + 9 種防守戰術的 PPP、Percentile、FG% |
| **Tracking 進階數據** | 切入(Drives)、接球跳投(C&S)、急停跳投(PullUp)、傳送(Passing)、觸球(Touches)、籃板完整拆分(Rebounding) |
| **投籃數據** | 分區命中率（禁區/油漆區/中距/角落三分/弧頂三分）+ 投籃拆分（eFG%、2分/3分佔比與命中率） |
| **關鍵時刻 (Clutch)** | 最後 5 分鐘分差 5 分內的得分、命中率、正負值等 |
| **防守數據 (Defense)** | 對位防守（對手被守命中率）、Hustle（干擾/抄截干擾/掩護助攻/卡位）、防守 box（效率/抄截/阻攻）、對手分區命中 |
| **五人陣容 (Lineups)** | 上場時間前 10 組陣容的攻防效率與淨效率 |
| **投籃熱圖 (Shot Chart)** | 球員與全隊整季出手座標繪於 SVG 半場圖（每週更新） |
| **防守熱圖 (Defense Heatmap)** | 半場 5 區依「對手命中率 − 該區聯盟均值」著色，一眼看守得好/壞 |
| **雷達圖** | 以 Recharts 繪製球員進攻/防守能力雷達圖 |
| **歷史走勢 / 跨賽季比較** | 點擊卡片查看當季走勢折線圖與歷史賽季並列比較 |
| **歷史賽季回補** | 2022-23 起各賽季例行賽/季後賽終點快照 |
| **中英雙語** | UI 標籤皆以「中文 (English)」格式呈現 |

## 技術架構

```
wolvestracker/
├── index.html               # 前端 SPA (React 18 + Recharts, CDN)
├── components/              # React 元件原始碼（修改後需重新 bundle）
├── dist/components-bundle.js # bundle.py 產生的合併檔（勿手改）
├── scripts/
│   ├── nba_common.py        # 共用模組：連線/欄位設定表/抓取函式
│   ├── fetch_data.py        # 每日當季爬蟲 (NBA Stats API → Firebase)
│   ├── backfill_history.py  # 歷史賽季回補
│   ├── fetch_shotchart.py   # 投籃熱圖爬蟲（每週）
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
- 集合：`wolves_team_stats` / `wolves_player_stats`（每日）、
  `wolves_team_history` / `wolves_player_history`（歷史）、`wolves_shotcharts`（熱圖）
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
