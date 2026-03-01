# 🐺 Wolves PlayType & Tracking Daily Tracker

Minnesota Timberwolves 的每日 Synergy PlayType 與 NBA Tracking 數據追蹤儀表板。

[![Daily NBA Stats Update](https://github.com/cosmos0409-yen/wolvestracker/actions/workflows/nba_update.yml/badge.svg)](https://github.com/cosmos0409-yen/wolvestracker/actions)

## 功能總覽

| 功能 | 說明 |
|---|---|
| **Synergy PlayType** | 11 種進攻 + 9 種防守戰術的 PPP、Percentile、FG% |
| **Tracking 進階數據** | 切入(Drives)、接球跳投(C&S)、急停跳投(PullUp)、傳送(Passing)、觸球(Touches)、籃板(Rebounding) |
| **雷達圖** | 以 Recharts 繪製球員進攻/防守能力雷達圖 |
| **球員大頭貼** | 直接從 NBA CDN 載入球員頭像 |
| **歷史走勢** | 點擊卡片可查看歷史數據表格 + 折線圖，支援近5/10/20場及日期區間篩選 |
| **自動更新** | GitHub Actions 每日自動抓取並寫入 Firebase |
| **中英雙語** | UI 標籤皆以「中文 (English)」格式呈現 |

## 技術架構

```
wolvestracker/
├── index.html              # 前端 SPA (React 18 + Recharts, CDN)
├── scripts/
│   └── fetch_data.py       # Python 爬蟲 (NBA Stats API → Firebase)
├── requirements.txt        # Python 依賴
├── .github/workflows/
│   └── nba_update.yml      # GitHub Actions 自動排程
└── doc/
    ├── test/test_cases.md   # 測試案例清單
    └── handover.md          # 交接手冊
```

### 資料流

```
NBA Stats API  ──(Python)──▶  Firebase Firestore  ◀──(JS)──  index.html (GitHub Pages)
                  每日排程                                     即時讀取 (onSnapshot)
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
# 任何靜態伺服器即可
npx serve .
# 或
python -m http.server 8080
```

## 部署設定

### 1. Firebase

- 專案：`wolves-traker`
- 資料庫：Firestore (`wolves_team_stats` / `wolves_player_stats`)
- 安全規則：匿名讀取、後端寫入

### 2. GitHub Secrets

在 Repository Settings → Secrets → Actions 新增：

| Secret 名稱 | 說明 |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Service Account JSON（整份 JSON 字串） |

### 3. GitHub Actions

工作流路徑：`.github/workflows/nba_update.yml`
- 排程：每日 UTC 12:00（台灣時間 20:00）
- 也可手動觸發 (`workflow_dispatch`)

### 4. GitHub Pages

- 分支：`main`
- 根目錄直接部署 `index.html`

## 反爬蟲策略

NBA `stats.nba.com` API 有嚴格的反爬蟲機制，本專案採用：

- `requests.Session()` 維持 TCP/TLS 持久連線
- 隨機 User-Agent 旋轉（5 組瀏覽器指紋）
- `Sec-Fetch-*`、`x-nba-stats-origin` 等必要 headers
- 每次請求間隔 2 秒 + 失敗後 3 秒 retry（最多 3 次）
- `safe_col()` 防禦性欄位取值，避免 API 回傳結構變更時 crash

## License

MIT
